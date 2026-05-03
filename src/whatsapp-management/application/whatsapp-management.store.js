import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WhatsAppManagementApi } from '../infrastructure/api/whatsapp-management.api.js'

export const useWhatsAppManagementStore = defineStore('whatsapp-management', () => {
    const api = new WhatsAppManagementApi()

    // ── Estado ────────────────────────────────────────────────────────────
    const isLoading    = ref(false)
    const error        = ref(null)
    const connected    = ref(null)   // null = no consultado aún
    const enabled      = ref(false)
    const groupId      = ref('')
    const hasKey       = ref(false)
    const maskedKey    = ref(null)
    const generatedKey = ref(null)   // key en claro (solo justo después de rotar)
    const qrString     = ref(null)
    const groups       = ref([])    // [{ id, name, participants }]
    const isLoadingGroups = ref(false)
    let _qrPollingId   = null

    function _clearError() { error.value = null }

    function _parseError(e) {
        return e?.response?.data?.message
            || e?.response?.data?.error
            || e?.message
            || 'Error inesperado'
    }

    function _applyConfiguration(data) {
        enabled.value   = !!data.enabled
        groupId.value   = data.groupId || ''
        hasKey.value    = !!data.hasApiKey
        maskedKey.value = data.maskedApiKey || null
    }

    // ── Acciones ──────────────────────────────────────────────────────────

    async function fetchConfiguration() {
        _clearError()
        isLoading.value = true
        try {
            const { data } = await api.getConfiguration()
            _applyConfiguration(data)
        } catch (e) {
            error.value = _parseError(e)
        } finally {
            isLoading.value = false
        }
    }

    async function fetchStatus() {
        _clearError()
        try {
            const { data } = await api.getStatus()
            connected.value = !!data.connected
            if (data.connected) {
                qrString.value = null
                stopQrPolling()
            }
        } catch (e) {
            error.value = _parseError(e)
        }
    }

    async function fetchQr() {
        try {
            const { data } = await api.getQr()
            qrString.value = data.qr || null
            if (data.qr && connected.value === null) {
                connected.value = false
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
                await fetchStatus()
            }
        }, 3000)
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
            error.value = _parseError(e)
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
            error.value = _parseError(e)
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
            error.value = _parseError(e)
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
            // Reinicia el polling para capturar el nuevo QR cuando Node lo emita
            stopQrPolling()
            startQrPolling()
            return true
        } catch (e) {
            error.value = _parseError(e)
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
            groups.value = Array.isArray(data) ? data : []
            return true
        } catch (e) {
            error.value = _parseError(e)
            groups.value = []
            return false
        } finally {
            isLoadingGroups.value = false
        }
    }

    return {
        // estado
        isLoading, error, connected, enabled, groupId, hasKey, maskedKey, generatedKey, qrString,
        groups, isLoadingGroups,
        // acciones
        fetchConfiguration, fetchStatus, fetchQr, startQrPolling, stopQrPolling,
        rotateApiKey, updateGroupId, setEnabled, resetSession, clearGeneratedKey, fetchGroups,
    }
})
