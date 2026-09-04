/**
 * Shared Presentation — Role & Permission Constants
 *
 * Define los roles del sistema y los módulos/rutas a los que cada rol tiene acceso.
 * Usado por: layout (menú dinámico), auth guard, toolbar.
 */

export const ROLES = Object.freeze({
    ROLE_ADMIN: 'ROLE_ADMIN',
    ROLE_SECURITY_GUARD: 'ROLE_SECURITY_GUARD',
    ROLE_SUPPORT_ADMIN: 'ROLE_SUPPORT_ADMIN',
});

/**
 * Roles con permisos equivalentes a “administración completa” en API y UI destructiva.
 * Debe coincidir con {@code hasAnyRole('ADMIN','SUPPORT_ADMIN')} en el backend.
 */
export const FULL_ACTION_ROLES = Object.freeze([
    ROLES.ROLE_ADMIN,
    ROLES.ROLE_SUPPORT_ADMIN,
]);

/**
 * @param {string[]|null|undefined} roleNames
 * @returns {boolean}
 */
export function hasFullActionRoles(roleNames) {
    if (!roleNames?.length) return false;
    return FULL_ACTION_ROLES.some(r => roleNames.includes(r));
}

export const ROLE_LABELS = Object.freeze({
    [ROLES.ROLE_ADMIN]:          'Administrador',
    [ROLES.ROLE_SECURITY_GUARD]: 'Agente de Seguridad',
    [ROLES.ROLE_SUPPORT_ADMIN]:  'Soporte Administrativo',
});

/**
 * Rutas base permitidas por rol.
 * El guard y el menú lateral filtran según esta tabla.
 */
export const ROLE_ALLOWED_ROUTES = Object.freeze({
    [ROLES.ROLE_ADMIN]: [
        '/stays',
        '/staff-management',
        '/vehicle-catalog',
        '/traffic-fines',
        '/employee-management',
        '/security-checkpoint',
        '/whatsapp-management',
    ],
    [ROLES.ROLE_SECURITY_GUARD]: [
        '/stays',
        '/security-checkpoint',
    ],
    [ROLES.ROLE_SUPPORT_ADMIN]: [
        '/stays',
        '/staff-management',
        '/vehicle-catalog',
        '/traffic-fines',
        '/employee-management',
        '/security-checkpoint',
        '/whatsapp-management',
    ],
});

/**
 * Verifica si un rol tiene acceso a una ruta.
 * @param {string} role
 * @param {string} path
 * @returns {boolean}
 */
export function hasRouteAccess(role, path) {
    const allowed = ROLE_ALLOWED_ROUTES[role];
    if (!allowed) return false;
    return allowed.some(r => path.startsWith(r));
}

/**
 * Devuelve la primera ruta permitida para un rol autenticado.
 * Si el rol no existe en la matriz de permisos, no hay fallback seguro.
 * @param {string} role
 * @returns {string|null}
 */
export function getDefaultRouteForRole(role) {
    return ROLE_ALLOWED_ROUTES[role]?.[0] ?? null;
}
