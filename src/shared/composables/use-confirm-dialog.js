import { useConfirm } from 'primevue/useconfirm'

/**
 * Composable para manejar diálogos de confirmación de forma consistente
 * Envuelve useConfirm de PrimeVue con métodos predefinidos para operaciones comunes
 */
export function useConfirmDialog() {
    const confirm = useConfirm()

    /**
     * Muestra un diálogo de confirmación genérico
     * Soporta dos modos: callback (legacy) o promesa (async/await)
     * @param {Object} options - Opciones del diálogo
     * @param {string} options.message - Mensaje a mostrar
     * @param {string} options.header - Título del diálogo
     * @param {Function} options.accept - Callback al confirmar (opcional si se usa como promesa)
     * @param {Function} options.reject - Callback al rechazar (opcional)
     * @param {string} options.icon - Icono a mostrar (por defecto: 'pi pi-exclamation-triangle')
     * @param {string} options.acceptLabel - Texto del botón aceptar (por defecto: 'Confirmar')
     * @param {string} options.rejectLabel - Texto del botón rechazar (por defecto: 'Cancelar')
     * @returns {Promise<boolean>} Promise que resuelve a true si confirma, false si rechaza
     */
    const showConfirm = ({ message, header, accept, reject, icon, acceptLabel, rejectLabel }) => {
        return new Promise((resolve) => {
            confirm.require({
                message,
                header: header || 'Confirmar acción',
                icon: icon || 'pi pi-exclamation-triangle',
                rejectProps: {
                    label: rejectLabel || 'Cancelar',
                    severity: 'secondary',
                    outlined: true
                },
                acceptProps: {
                    label: acceptLabel || 'Confirmar'
                },
                accept: () => {
                    if (accept) accept();
                    resolve(true);
                },
                reject: () => {
                    if (reject) reject();
                    resolve(false);
                }
            })
        })
    }

    /**
     * Muestra confirmación para eliminar un único item
     * @param {string} itemType - Tipo de item (ej: 'trabajador', 'contacto', 'distribuidor')
     * @param {string} itemName - Nombre del item a eliminar
     * @param {Function} onConfirm - Callback al confirmar
     * @param {boolean} permanent - Si es eliminación permanente (por defecto: true)
     */
    const confirmDelete = (itemType, itemName, onConfirm, permanent = true) => {
        const permanentText = permanent ? 'permanentemente ' : ''
        confirm.require({
            message: `¿Está seguro que desea eliminar ${permanentText}${itemType} "${itemName}"?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: {
                label: 'Cancelar',
                severity: 'secondary',
                outlined: true
            },
            acceptProps: {
                label: 'Eliminar',
                severity: 'danger'
            },
            accept: () => {
                if (onConfirm) onConfirm()
            },
            reject: () => {}
        })
    }

    /**
     * Muestra confirmación para eliminar múltiples items
     * @param {string} itemType - Tipo de item en singular (ej: 'trabajador', 'contacto')
     * @param {string} itemTypePlural - Tipo de item en plural (ej: 'trabajadores', 'contactos')
     * @param {number} count - Cantidad de items a eliminar
     * @param {Function} onConfirm - Callback al confirmar
     */
    const confirmDeleteMultiple = (itemType, itemTypePlural, count, onConfirm) => {
        const displayType = count === 1 ? itemType : itemTypePlural
        confirm.require({
            message: `¿Está seguro que desea eliminar ${count} ${displayType}?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: {
                label: 'Cancelar',
                severity: 'secondary',
                outlined: true
            },
            acceptProps: {
                label: 'Eliminar',
                severity: 'danger'
            },
            accept: () => {
                if (onConfirm) onConfirm()
            },
            reject: () => {}
        })
    }

    return {
        showConfirm,
        confirmDelete,
        confirmDeleteMultiple
    }
}
