import { computed } from 'vue'
import { useIamStore } from '@/iam/application/iam.store.js'

/**
 * Permisos granulares por rol (RBAC centralizado).
 * Única fuente de verdad para qué acciones puede ejecutar cada rol en el frontend.
 *
 * IMPORTANTE: estas restricciones son UX. El backend DEBE validar los mismos permisos
 * en cada endpoint protegido, independientemente del frontend.
 */
const ROLE_PERMISSIONS = Object.freeze({
    ROLE_ADMIN: [
        'stays:create', 'stays:view', 'stays:edit', 'stays:delete',
        'stays:register-exit', 'stays:register-return',
        'checkpoint:create', 'checkpoint:view', 'checkpoint:edit', 'checkpoint:delete',
        'attachments:upload', 'attachments:delete',
    ],
    ROLE_SUPPORT_ADMIN: [
        'stays:create', 'stays:view', 'stays:edit', 'stays:delete',
        'stays:register-exit', 'stays:register-return',
        'checkpoint:create', 'checkpoint:view', 'checkpoint:edit', 'checkpoint:delete',
        'attachments:upload', 'attachments:delete',
    ],
    ROLE_SECURITY_GUARD: [
        'stays:create', 'stays:view',
        'stays:register-exit', 'stays:register-return',
        'checkpoint:create', 'checkpoint:view',
        'attachments:upload',
    ],
})

/**
 * Composable de permisos basado en el rol del usuario autenticado.
 *
 * @example
 * const { canEditStays, canDeleteStays } = usePermissions()
 *
 * // En template:
 * // <pv-button v-if="canEditStays" label="Editar" />
 */
export function usePermissions() {
    
    const iamStore = useIamStore()

    /**
     * Verifica si alguno de los roles del usuario tiene el permiso solicitado.
     * @param {string} permission
     * @returns {boolean}
     */
    function can(permission) {
        const roles = iamStore.currentUserRoles ?? []
        return roles.some(role => ROLE_PERMISSIONS[role]?.includes(permission) ?? false)
    }

    // ── Stays ─────────────────────────────────────────────────────────────
    const canCreateStays         = computed(() => can('stays:create')) 
    const canViewStays           = computed(() => can('stays:view'))
    const canEditStays           = computed(() => can('stays:edit'))
    const canDeleteStays         = computed(() => can('stays:delete'))
    const canRegisterExitStays   = computed(() => can('stays:register-exit'))
    const canRegisterReturnStays = computed(() => can('stays:register-return'))

    // ── Security Checkpoint ───────────────────────────────────────────────
    const canCreateCheckpoint = computed(() => can('checkpoint:create'))
    const canViewCheckpoint   = computed(() => can('checkpoint:view'))
    const canEditCheckpoint   = computed(() => can('checkpoint:edit'))
    const canDeleteCheckpoint = computed(() => can('checkpoint:delete'))

    // ── Adjuntos / Evidencias ─────────────────────────────────────────────
    const canUploadAttachments = computed(() => can('attachments:upload'))
    const canDeleteAttachments = computed(() => can('attachments:delete'))

    return {
        can,
        canCreateStays,
        canViewStays,
        canEditStays,
        canDeleteStays,
        canRegisterExitStays,
        canRegisterReturnStays,
        canCreateCheckpoint,
        canViewCheckpoint,
        canEditCheckpoint,
        canDeleteCheckpoint,
        canUploadAttachments,
        canDeleteAttachments,
    }
}
