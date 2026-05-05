const signInForm          = () => import('./views/sign-in.vue');
const forgotPasswordForm  = () => import('./views/forgot-password.vue');
const profileCreateView   = () => import('./views/profile-create-view.vue');

export const IAM_ROUTES = {
    SIGN_IN:          '/sign-in',
    FORGOT_PASSWORD:  '/forgot-password',
    RESET_PASSWORD:   '/reset-password',
    CREATE_PROFILE:   '/create-profile',
};

const iamRoutes = [
    {
        path: IAM_ROUTES.SIGN_IN,
        name: 'sign-in',
        component: signInForm,
        meta: {
            title: 'Iniciar Sesión',
            requiresAuth: false,
        },
    },
    {
        path: IAM_ROUTES.FORGOT_PASSWORD,
        name: 'forgot-password',
        component: forgotPasswordForm,
        meta: {
            title: 'Recuperar Contraseña',
            requiresAuth: false,
        },
    },
    {
        path: IAM_ROUTES.CREATE_PROFILE,
        name: 'create-profile',
        component: profileCreateView,
        meta: {
            title: 'Crear Perfil',
            requiresAuth: false,
        },
    },
]

export default iamRoutes;
