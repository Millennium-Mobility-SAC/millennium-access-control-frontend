import { useToast } from 'primevue/usetoast'

/**
 * Composable para gestionar notificaciones con PrimeVue Toast.
 * Proporciona funciones para mostrar distintos tipos de mensajes.
 */
export function useNotification() {
    const toast = useToast()

    /**
     * Notificación de éxito - Fabricio
     */
    const showSuccess = (message, title = 'Éxito', life = 3000) => {
        toast.add({ severity: 'success', summary: title, detail: message, life })
    }

    /**
     * Notificación de error.
     */
    const showError = (message, title = 'Error', life = 5000) => {
        toast.add({ severity: 'error', summary: title, detail: message, life })
    }

    /**
     * Notificación de advertencia.
     */
    const showWarning = (message, title = 'Advertencia', life = 4000) => {
        toast.add({ severity: 'warn', summary: title, detail: message, life })
    }

    /**
     * Notificación informativa.
     */
    const showInfo = (message, title = 'Información', life = 3000) => {
        toast.add({ severity: 'info', summary: title, detail: message, life })
    }

    /**
     * Notificación personalizada.
     */
    const showCustom = (options = {}) => {
        toast.add({
            severity: options.severity ?? 'info',
            summary: options.summary ?? '',
            detail: options.detail ?? '',
            life: options.life ?? 3000,
            closable: options.closable ?? true,
            sticky: options.sticky ?? false
        })
    }

    /**
     * Elimina todas las notificaciones activas.
     */
    const clear = () => {
        toast.removeAllGroups()
    }

    return {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showCustom,
        clear
    }
}
