import { useIamStore } from '../../application/iam.store.js';
import { getDefaultRouteForRole, hasRouteAccess } from '@/shared/presentation/constants/roles.constants.js';

/**
 * Rutas que no requieren autenticación.
 * Definidas aquí directamente para evitar la dependencia infrastructure → presentation.
 */
const PUBLIC_PATHS = ['/sign-in', '/forgot-password', '/reset-password', '/create-profile'];

/**
 * Guard de autenticación global para Vue Router 4.
 * Retorna el destino de redirección en lugar de llamar next() (API deprecada).
 *
 * Lógica:
 *   1. Si ya autenticado e intenta ir a /sign-in → redirige a su ruta inicial por rol.
 *   2. Ruta protegida sin sesión → redirige a /sign-in.
 *   3. Rol sin acceso a la ruta → redirige a su primera ruta permitida.
 *   4. Todo lo demás → permite la navegación.
 */
export function authenticationGuard(to, from) {
    const iamStore = useIamStore();
    const isAnonymous = !iamStore.isSignedIn;
    const requiresAuth = !PUBLIC_PATHS.includes(to.path);
    const role = iamStore.userRole;
    const defaultRoute = getDefaultRouteForRole(role);

    if (to.path === '/sign-in' && iamStore.isSignedIn) {
        if (!defaultRoute) {
            iamStore.logout();
            return true;
        }
        return defaultRoute;
    }

    if (isAnonymous && requiresAuth) {
        return { path: '/sign-in', query: { redirect: to.fullPath } };
    }

    if (!isAnonymous && requiresAuth && !defaultRoute) {
        iamStore.logout();
        return { path: '/sign-in' };
    }

    if (role && requiresAuth && !hasRouteAccess(role, to.path)) {
        return to.path === defaultRoute ? true : defaultRoute;
    }

    return true;
}
