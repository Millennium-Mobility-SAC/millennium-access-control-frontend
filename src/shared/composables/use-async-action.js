import { ref } from 'vue';

/**
 * Composable para ejecutar acciones asíncronas con manejo de isLoading + error.
 * Elimina el patrón repetitivo try/catch/finally en stores y componentes.
 *
 * @param {import('vue').Ref<boolean>} [sharedLoading] - Ref de loading compartido (opcional).
 * @param {import('vue').Ref<any>}     [sharedError]   - Ref de error compartido (opcional).
 * @returns {{ isLoading: import('vue').Ref<boolean>, error: import('vue').Ref<any>, run: Function }}
 *
 * @example
 * // En un store — reutilizando state compartido:
 * const isLoading = ref(false);
 * const error     = ref(null);
 * const { run }   = useAsyncAction(isLoading, error);
 *
 * async function fetchAll() {
 *     await run(async () => {
 *         const response = await api.getAll();
 *         items.value = Assembler.toEntitiesFromResponse(response);
 *     });
 * }
 *
 * @example
 * // En un componente — con state propio:
 * const { isLoading, error, run } = useAsyncAction();
 * await run(async () => { ... });
 */
export function useAsyncAction(sharedLoading, sharedError) {
    const isLoading = sharedLoading ?? ref(false);
    const error     = sharedError   ?? ref(null);

    /**
     * Ejecuta una acción asíncrona con manejo automático de loading/error.
     *
     * @param {Function} action           - Función async a ejecutar.
     * @param {Object}   [options]        - Opciones adicionales.
     * @param {string}   [options.errorMessage] - Mensaje por defecto si el error no tiene message.
     * @param {boolean}  [options.rethrow]      - Si true, re-lanza el error después de capturarlo.
     * @returns {Promise<any>} El resultado de la action, o undefined si falló.
     */
    async function run(action, options = {}) {
        const { errorMessage = 'Ha ocurrido un error', rethrow = false } = options;
        isLoading.value = true;
        error.value     = null;
        try {
            const result = await action();
            return result;
        } catch (e) {
            error.value = e?.response?.data?.message ?? e?.message ?? errorMessage;
            if (rethrow) throw e;
        } finally {
            isLoading.value = false;
        }
    }

    return { isLoading, error, run };
}
