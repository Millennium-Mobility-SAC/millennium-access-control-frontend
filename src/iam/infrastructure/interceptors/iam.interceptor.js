/**
 * IAM Infrastructure - Auth Interceptors
 *
 * Toda la lógica de autenticación para el cliente HTTP:
 *   - Request: inyecta el header de autorización Bearer.
 *   - Response: maneja 401 (limpia sesión y redirige).
 *
 * Lee localStorage directamente para evitar dependencia circular:
 *   base-api → iam.interceptor → iam.store → iam.api → base-api
 *
 * SEGURIDAD: Solo se envía el JWT firmado por el servidor. Los claims de
 * identidad (userId, roles) son extraídos por el backend desde el token,
 * nunca desde headers construidos en el cliente.
 */

const TOKEN_KEY = 'gs_token';

// Endpoints que no requieren token de autorización
const PUBLIC_URL_PATTERNS = ['/sign-in', '/register', '/forgot-password', '/reset-password'];

/**
 * Interceptor de request: agrega el header Authorization con el JWT.
 * Se omite en endpoints públicos para evitar que un token expirado en
 * localStorage cause un 401 antes de que el backend procese las credenciales.
 * @param {import('axios').InternalAxiosRequestConfig} config
 */
export function iamRequestInterceptor(config) {
    const isPublic = PUBLIC_URL_PATTERNS.some(pattern => config.url?.includes(pattern));
    if (isPublic) return config;

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

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
