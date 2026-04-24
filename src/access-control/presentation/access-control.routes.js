const AccessControlView = () => import('./views/access-control-view.vue');

export const ACCESS_CONTROL_ROUTES = {
    ACCESS_CONTROL: '/access-control',
};

const accessControlRoutes = [
    {
        path: ACCESS_CONTROL_ROUTES.ACCESS_CONTROL,
        name: 'access-control',
        component: AccessControlView,
        meta: {
            title: 'Control de Acceso',
            module: 'Control de Acceso',
            description: 'Gestión de control de acceso a la empresa',
            showBackButton: false,
        },
    },
]

export default accessControlRoutes;