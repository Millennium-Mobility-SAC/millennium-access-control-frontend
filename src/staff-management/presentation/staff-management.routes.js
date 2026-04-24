const CollaboratorsManagementView = () => import('./views/staff-management-view.vue');

export const STAFF_MANAGEMENT_ROUTES = {
    STAFF_MANAGEMENT: '/staff-management',
};

const staffManagementRoutes = [
    { 
        path: STAFF_MANAGEMENT_ROUTES.STAFF_MANAGEMENT,
        name: 'staff-management',
        component: CollaboratorsManagementView,
        meta: {
            module: 'Gestión de Personal',
            description: 'Gestión de colaboradores y roles dentro de la empresa',
            showBackButton: false,
        },
    },
]

export default staffManagementRoutes;