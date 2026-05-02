import { ROLE_ALLOWED_ROUTES } from '../../../shared/presentation/constants/roles.constants.js';

/**
 * Todos los items de menú disponibles en el sistema.
 * El layout filtra dinámicamente según el rol del usuario.
 */
const ALL_MENU_ITEMS = [
    {
        label: 'Control de acceso',
        icon: 'pi pi-fw pi-shield',
        to: '/stays',
        title: 'Control de acceso',
    },
    {
        label: 'Marcación personal',
        icon: 'pi pi-fw pi-clock',
        to: '/security-checkpoint',
        title: 'Marcación de personal',
    },
    {
        label: 'Colaboradores',
        icon: 'pi pi-fw pi-users',
        to: '/staff-management',
        title: 'Colaboradores',
    },
    {
        label: 'Vehículos',
        icon: 'pi pi-fw pi-car',
        to: '/vehicle-catalog',
        title: 'Catálogo de Vehículos',
    },
    {
        label: 'Empleados',
        icon: 'pi pi-fw pi-id-card',
        to: '/employee-management',
        title: 'Empleados',
    },
];

/**
 * Filtra los items de menú según el rol del usuario.
 *
 * @param {string} role — Rol del usuario actual
 * @returns {Array} Items de menú visibles
 */
export function getMenuItemsByRole(role) {
    if (!role) return ALL_MENU_ITEMS;
    const allowed = ROLE_ALLOWED_ROUTES[role];
    if (!allowed) return ALL_MENU_ITEMS;

    return ALL_MENU_ITEMS.filter(item =>
        allowed.some(r => item.to.startsWith(r))
    );
}
