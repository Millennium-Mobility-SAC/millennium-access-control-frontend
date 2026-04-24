/**
 * Shared Infrastructure — Mock Fallback Utility
 *
 * Centraliza la estrategia de fallback a datos mock cuando el backend no está disponible.
 * Controlado por la variable de entorno VITE_USE_MOCK.
 *
 * @example
 * import { withMockFallback } from '../../../shared/infrustructure/mock-fallback.js';
 * import { MOCK_ITEMS } from '../module.mock.js';
 *
 * // En el store:
 * async function fetchAll() {
 *     const data = await withMockFallback(
 *         () => api.getAll(),                // API call
 *         () => [...MOCK_ITEMS],             // Mock fallback
 *     );
 *     items.value = Assembler.toEntitiesFromResponse(data);
 * }
 */

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Intenta ejecutar la función API; si falla y mock está habilitado, ejecuta el fallback.
 *
 * @param {Function} apiFn   - Función que realiza la llamada API (async).
 * @param {Function} mockFn  - Función que retorna datos mock (sync o async).
 * @returns {Promise<any>} Resultado de la API o del mock.
 * @throws {Error} Si la API falla y mock no está habilitado.
 */
export async function withMockFallback(apiFn, mockFn) {
    try {
        return await apiFn();
    } catch (apiError) {
        if (isMockEnabled() && mockFn) {
            return await mockFn();
        }
        throw apiError;
    }
}

/**
 * Ejecuta una mutación (create/update/delete) con mock-aware behavior.
 * Si la API falla y mock está habilitado, la operación se considera exitosa
 * (el optimistic update ya se aplicó en el store).
 *
 * @param {Function} apiFn     - Función que realiza la mutación API (async).
 * @param {Object}   [options] - Opciones.
 * @param {Function} [options.onApiError]  - Callback si la API falla pero mock absorbe el error.
 * @returns {Promise<any>} Resultado de la API, o undefined si mock absorbió el error.
 * @throws {Error} Si la API falla y mock no está habilitado.
 */
export async function withMockMutation(apiFn, options = {}) {
    try {
        return await apiFn();
    } catch (apiError) {
        if (isMockEnabled()) {
            options.onApiError?.(apiError);
            return undefined;
        }
        throw apiError;
    }
}
