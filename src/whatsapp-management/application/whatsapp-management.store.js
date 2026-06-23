import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WhatsAppManagementApi } from '../infrastructure/api/whatsapp-management.api.js'

const SYNC_POLL_MS = 3000

export const useWhatsAppManagementStore = defineStore('whatsapp-management', () => {
    const api = new WhatsAppManagementApi()

    // ── Estado ────────────────────────────────────────────────────────────
    const isLoading    = ref(false)
    const error        = ref(null)   // mensaje amigable para el usuario
    const rawError     = ref(null)   // mensaje técnico para reportar
    const connected    = ref(null)   // null = no consultado aún
    const chatsSynced  = ref(null)   // null = N/A; false = sincronizando; true = listo
    const enabled      = ref(false)
    const groupId      = ref('')
    const hasKey       = ref(false)
    const maskedKey    = ref(null)
    const generatedKey = ref(null)   // key en claro (solo justo después de rotar)
    const qrString     = ref(null)
    const groups       = ref([])    // [{ id, name, participants }]
    const isLoadingGroups = ref(false)
    let _qrPollingId   = null
    let _syncPollingId = null

    const chatsSyncing = computed(() => connected.value === true && chatsSynced.value === false)

    function _clearError() { error.value = null; rawError.value = null }

    /** Extrae el texto técnico crudo para mostrar en "Detalles técnicos". */
    function _extractRaw(e) {
        return e?.response?.data?.message
            || e?.response?.data?.error
            || e?.message
            || String(e)
    }

    /** Mapea el error a un mensaje amigable en español. */
    function _parseError(e) {
        const status = e?.response?.status
        const raw    = _extractRaw(e)
        const lc     = raw.toLowerCase()

        if (status === 401) return 'No autorizado. Verifica que tu sesión esté activa.'
        if (status === 403) return 'No tienes permisos para realizar esta acción.'
        if (status === 404) return 'El recurso solicitado no existe en el servidor.'
        if (status === 425 || /sincroniza/i.test(lc))
            return 'WhatsApp todavía está sincronizando los chats. Espera unos segundos.'
        if (status === 503) return 'El servicio no está disponible en este momento. Intenta de nuevo en unos segundos.'
        if (status >= 500 && status < 600) return 'Error interno del servidor. Si persiste, contacta al administrador.'

        if (/i\/o error|connection refused|econnrefused/i.test(lc))
            return 'No se pudo comunicar con el servicio de WhatsApp. Verifica que el microservicio Node.js esté en ejecución.'
        if (/timed? ?out|timeout/i.test(lc))
            return 'La operación tardó demasiado. El servicio puede estar sobrecargado. Intenta de nuevo.'
        if (/network error/i.test(lc))
            return 'Error de red. Verifica tu conexión y que el servidor esté disponible.'

        // Fallback: el mensaje tal como viene pero sin traceback de Spring
        const cleaned = (e?.response?.data?.message || e?.message || 'Error inesperado')
            .replace(/An unexpected error occurred:\s*/i, '')
            .trim()
        return cleaned.length > 0 ? cleaned : 'Error inesperado'
    }

    /** Establece error amigable + error técnico en un solo paso. */
    function _setError(e) {
        error.value    = _parseError(e)
        rawError.value = _extractRaw(e)
    }

    function _applyConfiguration(data) {
        enabled.value   = !!data.enabled
        groupId.value   = data.groupId || ''
        hasKey.value    = !!data.hasApiKey
        maskedKey.value = data.maskedApiKey || null
    }

    function _applyStatus(data) {
        connected.value = !!data.connected
        if (data.connected) {
            chatsSynced.value = !!data.chatsSynced
            if (data.chatsSynced) {
                stopSyncPolling()
            } else {
                startSyncPolling()
            }
            qrString.value = null
            stopQrPolling()
        } else {
            chatsSynced.value = null
            stopSyncPolling()
        }
    }

    function startSyncPolling() {
        if (_syncPollingId || chatsSynced.value) return
        _syncPollingId = setInterval(async () => {
            if (!connected.value) {
                stopSyncPolling()
                return
            }
            await fetchStatus({ silent: true })
        }, SYNC_POLL_MS)
    }

    function stopSyncPolling() {
        if (_syncPollingId) {
            clearInterval(_syncPollingId)
            _syncPollingId = null
        }
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

    async function fetchStatus(options = {}) {
        const { silent = false } = options
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
            if (data.qr && connected.value === null) {
                connected.value = false
                chatsSynced.value = null
            }
        } catch {
            // silencioso: el QR no es crítico
        }
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
            // Si aún no tenemos QR (Node está regenerando), también re-chequea estado
            if (!qrString.value) {
                await fetchStatus({ silent: true })
            }
        }, 5000)
    }

    function stopQrPolling() {
        if (_qrPollingId) {
            clearInterval(_qrPollingId)
            _qrPollingId = null
        }
    }

    async function rotateApiKey() {
        _clearError()
        generatedKey.value = null
        isLoading.value = true
        try {
            const { data } = await api.rotateApiKey()
            generatedKey.value = data.key
            hasKey.value    = true
            maskedKey.value = data.key.slice(0, 6) + '••••••••••••••••••••••••••••••••' + data.key.slice(-4)
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

    async function resetSession() {
        _clearError()
        isLoading.value = true
        try {
            await api.resetSession()
            qrString.value = null
            connected.value = false
            chatsSynced.value = null
            groups.value = []
            // Reinicia el polling para capturar el nuevo QR cuando Node lo emita
            stopSyncPolling()
            stopQrPolling()
            startQrPolling()
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
        if (chatsSyncing.value) return false
        _clearError()
        isLoadingGroups.value = true
        try {
            const { data } = await api.listGroups()
            groups.value = Array.isArray(data) ? data : []
            return true
        } catch (e) {
            _setError(e)
            groups.value = []
            if (e?.response?.status === 425) startSyncPolling()
            return false
        } finally {
            isLoadingGroups.value = false
        }
    }

    return {
        // estado
        isLoading, error, rawError, connected, chatsSynced, chatsSyncing,
        enabled, groupId, hasKey, maskedKey, generatedKey, qrString,
        groups, isLoadingGroups,
        // acciones
        fetchConfiguration, fetchStatus, fetchQr, startQrPolling, stopQrPolling,
        startSyncPolling, stopSyncPolling,
        rotateApiKey, updateGroupId, setEnabled, resetSession, clearGeneratedKey, fetchGroups,
    }
})
