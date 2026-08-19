import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WhatsAppManagementApi } from '../infrastructure/api/whatsapp-management.api.js'

/**
 * Estado del bot de WhatsApp.
 *
 * `groupsReady` distingue "conectado" de "listo para elegir grupo": al abrir
 * la sesión el listado de grupos tarda un instante, y la vista debe esperar
 * antes de ofrecerlo.
 */

const STATUS_POLL_MS = 3000
const QR_POLL_MS = 5000

export const useWhatsAppManagementStore = defineStore('whatsapp-management', () => {
    const api = new WhatsAppManagementApi()

    // ── Estado ────────────────────────────────────────────────────────────
    const isLoading = ref(false)
    const error = ref(null)   // mensaje amigable
    const rawError = ref(null)   // detalle técnico para reportar

    const connected = ref(null)   // null = aún no consultado
    const sessionState = ref(null)  // CONNECTED | CONNECTING | QR_PENDING | DISCONNECTED | LOGGED_OUT | UNREACHABLE
    const groupsReady = ref(false)
    const qrAvailable = ref(false)
    const requiresPairing = ref(false)
    const linkedNumber = ref(null)
    const linkedName = ref(null)
    const connectedAt = ref(null)
    const lastDisconnectReason = ref(null)
    const baileysVersion = ref(null)
    const waWebVersion = ref(null)

    const enabled = ref(false)
    const groupId = ref('')
    const hasKey = ref(false)
    const maskedKey = ref(null)
    const generatedKey = ref(null)  // propuesta en claro, pendiente de aplicar

    const qrString = ref(null)
    const qrExpiresInSeconds = ref(null)

    const groups = ref([])
    const isLoadingGroups = ref(false)

    let _qrPollingId = null
    let _statusPollingId = null

    // ── Derivados ─────────────────────────────────────────────────────────
    const serviceUnreachable = computed(() => sessionState.value === 'UNREACHABLE')
    /** Conectado pero los grupos aún no se pudieron listar. */
    const groupsPending = computed(() => connected.value === true && !groupsReady.value)
    /** Reconectando con credenciales guardadas: no hace falta escanear nada. */
    const restoringSession = computed(
        () => sessionState.value === 'CONNECTING' && !qrAvailable.value && !serviceUnreachable.value,
    )
    /** La cuenta fue desvinculada: reconectar no sirve, hay que escanear. */
    const loggedOut = computed(() => sessionState.value === 'LOGGED_OUT')

    function _clearError() {
        error.value = null
        rawError.value = null
    }

    function _extractRaw(e) {
        return e?.response?.data?.message || e?.response?.data?.error || e?.message || String(e)
    }

    /** Traduce el error a un mensaje accionable en español. */
    function _parseError(e) {
        const status = e?.response?.status
        const raw = _extractRaw(e)
        const lc = raw.toLowerCase()

        if (status === 401) return 'No autorizado. Verifica que tu sesión esté activa.'
        if (status === 403) return 'No tienes permisos para realizar esta acción.'
        if (status === 404) return 'El recurso solicitado no existe en el servidor.'
        if (status === 425) return 'WhatsApp aún está preparando la lista de grupos. Reintenta en unos segundos.'
        if (status === 504 || /504|gateway timeout|no_healthy_upstream/i.test(lc))
            return 'El servicio de WhatsApp no responde. Revisa que el contenedor esté en ejecución.'
        if (status === 503) return 'El servicio no está disponible en este momento. Intenta de nuevo en unos segundos.'
        if (status >= 500 && status < 600) return 'Error interno del servidor. Si persiste, contacta al administrador.'

        if (/i\/o error|connection refused|econnrefused/i.test(lc))
            return 'No se pudo comunicar con el servicio de WhatsApp. Verifica que el microservicio esté en ejecución.'
        if (/timed? ?out|timeout/i.test(lc))
            return 'La operación tardó demasiado. El servicio puede estar sobrecargado.'
        if (/network error/i.test(lc)) return 'Error de red. Verifica tu conexión.'

        const cleaned = (e?.response?.data?.message || e?.message || 'Error inesperado')
            .replace(/An unexpected error occurred:\s*/i, '')
            .trim()
        return cleaned.length > 0 ? cleaned : 'Error inesperado'
    }

    function _setError(e) {
        error.value = _parseError(e)
        rawError.value = _extractRaw(e)
    }

    function _applyConfiguration(data) {
        enabled.value = !!data.enabled
        groupId.value = data.groupId || ''
        hasKey.value = !!data.hasApiKey
        maskedKey.value = data.maskedApiKey || null
    }

    function _applyStatus(data) {
        connected.value = !!data.connected
        sessionState.value = data.session_state || (data.connected ? 'CONNECTED' : 'DISCONNECTED')
        groupsReady.value = !!data.groups_ready
        qrAvailable.value = !!data.qr_available
        requiresPairing.value = !!data.requires_pairing
        linkedNumber.value = data.linked_number || null
        linkedName.value = data.linked_name || null
        connectedAt.value = data.connected_at || null
        lastDisconnectReason.value = data.last_disconnect_reason || null
        baileysVersion.value = data.baileys_version || null
        waWebVersion.value = data.wa_web_version || null

        if (connected.value) {
            qrString.value = null
            qrExpiresInSeconds.value = null
            stopQrPolling()
            // Se sigue sondeando solo hasta que los grupos estén listos.
            if (groupsReady.value) stopStatusPolling()
            else startStatusPolling()
            return
        }

        // Sin conexión: si hay QR pendiente se sondea el QR; si el servicio no
        // responde o está reconectando, se sondea el estado.
        if (qrAvailable.value) startQrPolling()
        else stopQrPolling()
        startStatusPolling()
    }

    // ── Sondeos ───────────────────────────────────────────────────────────

    function startStatusPolling() {
        if (_statusPollingId) return
        _statusPollingId = setInterval(async () => {
            await fetchStatus({ silent: true })
        }, STATUS_POLL_MS)
    }

    function stopStatusPolling() {
        if (!_statusPollingId) return
        clearInterval(_statusPollingId)
        _statusPollingId = null
    }

    function startQrPolling() {
        if (_qrPollingId) return
        fetchQr()
        _qrPollingId = setInterval(async () => {
            if (connected.value) {
                stopQrPolling()
                return
            }
            await fetchQr()
        }, QR_POLL_MS)
    }

    function stopQrPolling() {
        if (!_qrPollingId) return
        clearInterval(_qrPollingId)
        _qrPollingId = null
    }

    /** Detiene todos los sondeos: llamar al desmontar la vista. */
    function stopPolling() {
        stopQrPolling()
        stopStatusPolling()
    }

    // ── Acciones ──────────────────────────────────────────────────────────

    async function fetchConfiguration() {
        _clearError()
        isLoading.value = true
        try {
            const { data } = await api.getConfiguration()
            _applyConfiguration(data)
        } catch (e) {
            _setError(e)
        } finally {
            isLoading.value = false
        }
    }

    async function fetchStatus({ silent = false } = {}) {
        if (!silent) _clearError()
        try {
            const { data } = await api.getStatus()
            _applyStatus(data)
        } catch (e) {
            if (!silent) _setError(e)
        }
    }

    async function fetchQr() {
        try {
            const { data } = await api.getQr()
            qrString.value = data.qr || null
            qrExpiresInSeconds.value = data.expires_in_seconds ?? null
        } catch {
            // El QR no es crítico: el sondeo de estado ya reporta el problema.
        }
    }

    async function generateApiKey() {
        _clearError()
        generatedKey.value = null
        isLoading.value = true
        try {
            const { data } = await api.generateApiKey()
            // Solo es una propuesta: la clave vigente no cambia hasta que se
            // aplica en la configuración de ambos servicios y se redespliegan.
            generatedKey.value = data.key
            return data.key
        } catch (e) {
            _setError(e)
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function updateGroupId(newGroupId) {
        _clearError()
        isLoading.value = true
        try {
            const { data } = await api.updateGroupId(newGroupId)
            _applyConfiguration(data)
            return true
        } catch (e) {
            _setError(e)
            return false
        } finally {
            isLoading.value = false
        }
    }

    async function setEnabled(value) {
        _clearError()
        isLoading.value = true
        try {
            const { data } = await api.setEnabled(value)
            _applyConfiguration(data)
            return true
        } catch (e) {
            _setError(e)
            return false
        } finally {
            isLoading.value = false
        }
    }

    /** Reconecta sin perder la vinculación: primera opción ante una caída. */
    async function reconnect() {
        _clearError()
        isLoading.value = true
        try {
            await api.reconnect()
            sessionState.value = 'CONNECTING'
            connected.value = false
            groupsReady.value = false
            startStatusPolling()
            return true
        } catch (e) {
            _setError(e)
            return false
        } finally {
            isLoading.value = false
        }
    }

    /** Desvincula la cuenta: obliga a escanear un QR nuevo. */
    async function resetSession() {
        _clearError()
        isLoading.value = true
        try {
            await api.resetSession()
            qrString.value = null
            qrExpiresInSeconds.value = null
            connected.value = false
            sessionState.value = 'DISCONNECTED'
            groupsReady.value = false
            groups.value = []
            linkedNumber.value = null
            linkedName.value = null
            stopPolling()
            startQrPolling()
            startStatusPolling()
            return true
        } catch (e) {
            _setError(e)
            return false
        } finally {
            isLoading.value = false
        }
    }

    function clearGeneratedKey() {
        generatedKey.value = null
    }

    async function fetchGroups() {
        _clearError()
        isLoadingGroups.value = true
        try {
            const { data } = await api.listGroups()
            groups.value = Array.isArray(data)
                ? data.map((group) => ({
                    id: group.id,
                    subject: group.subject,
                    participants: group.participants,
                    isAnnounce: !!group.is_announce,
                    canSend: group.can_send !== false,
                }))
                : []
            return true
        } catch (e) {
            _setError(e)
            groups.value = []
            // 425 = el bot sigue preparando la lista; el sondeo la traerá.
            if (e?.response?.status === 425) startStatusPolling()
            return false
        } finally {
            isLoadingGroups.value = false
        }
    }

    return {
        // estado
        isLoading, error, rawError,
        connected, sessionState, groupsReady, qrAvailable, requiresPairing,
        linkedNumber, linkedName, connectedAt, lastDisconnectReason,
        baileysVersion, waWebVersion,
        enabled, groupId, hasKey, maskedKey, generatedKey,
        qrString, qrExpiresInSeconds,
        groups, isLoadingGroups,
        // derivados
        serviceUnreachable, groupsPending, restoringSession, loggedOut,
        // acciones
        fetchConfiguration, fetchStatus, fetchQr, fetchGroups,
        startQrPolling, stopQrPolling, startStatusPolling, stopStatusPolling, stopPolling,
        generateApiKey, updateGroupId, setEnabled, reconnect, resetSession, clearGeneratedKey,
    }
})
