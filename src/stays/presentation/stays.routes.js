const StaysView = () => import('./views/stays-view.vue');

export const STAYS_ROUTES = {
    STAYS: '/stays',
    ACCESS_CONTROL_LEGACY: '/access-control',
};

const staysRoutes = [
    {
        path: STAYS_ROUTES.STAYS,
        name: 'stays',
        component: StaysView,
        meta: {
            title: 'Control de Acceso',
            module: 'Control de Acceso',
            description: 'Gestión de control de acceso a la empresa',
            showBackButton: false,
        },
    },
    {
        path: STAYS_ROUTES.ACCESS_CONTROL_LEGACY,
        redirect: STAYS_ROUTES.STAYS,
    },
]

export default staysRoutes;