/**
 * IAM Infrastructure - Auth Interceptors
 *
 * Toda la lógica de autenticación para el cliente HTTP:
 *   - Request: inyecta headers de autorización.
 *   - Response: maneja 401 (limpia sesión y redirige).
 *
 * Lee localStorage directamente para evitar dependencia circular:
 *   base-api → iam.interceptor → iam.store → iam.api → base-api
 */

const TOKEN_KEY = 'gs_token';
const USER_KEY  = 'gs_user';

/**
 * Interceptor de request: agrega Authorization, X-User-Id y X-Role.
 * @param {import('axios').InternalAxiosRequestConfig} config
 */
export function iamRequestInterceptor(config) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    try {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
            const user = JSON.parse(raw);
            if (user?.id)         config.headers['X-User-Id'] = String(user.id);
            if (user?.roles?.[0]) config.headers['X-Role']    = user.roles[0];
        }
    } catch { /* USER_KEY corrupto — ignorar headers opcionales */ }

    return config;
}

/**
 * Bandera para prevenir que múltiples respuestas 401 simultáneas
 * disparen el evento de sesión expirada más de una vez.
 */
let _sessionExpiredPending = false;

/**
 * Interceptor de response: detecta 401 y notifica al sistema.
 * La respuesta (limpiar estado, redirigir) es responsabilidad de la capa de presentación.
 * @param {import('axios').AxiosError} error
 */
export function iamResponseErrorInterceptor(error) {
    if (error.response?.status === 401 && !_sessionExpiredPending) {
        _sessionExpiredPending = true;
        window.dispatchEvent(new CustomEvent('millennium:session-expired'));
        setTimeout(() => { _sessionExpiredPending = false; }, 2000);
    }
    return Promise.reject(error);
}
