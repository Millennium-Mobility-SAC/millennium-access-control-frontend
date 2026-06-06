import axios from 'axios';

// La URL del backend es obligatoria. Si no está definida, el build/runtime fallará
// con un mensaje claro en lugar de conectarse silenciosamente a localhost en producción.
const platformApi = import.meta.env.VITE_PLATFORM_API_URL ;
if (!platformApi) {
    throw new Error(
        '[Config] La variable de entorno VITE_PLATFORM_API_URL es obligatoria. ' +
        'Defínela en tu archivo .env o en las variables de entorno de Cloudflare Pages.'
    );
}

// Global interceptors for all BaseApi instances. Set via BaseApi.configure() in main.js
let _requestInterceptor       = null;
let _responseErrorInterceptor = null;

export class BaseApi {
    #http;

    get http() {
        return this.#http;
    }

    /**
     * Registers global interceptors for all BaseApi instances.
     * Must be called once in the application bootstrap (main.js)
     * BEFORE any store or API is instantiated.
     *
     * @param {Function} requestFn       - Axios request interceptor.
     * @param {Function} responseErrorFn - Axios response error interceptor.
     */
    static configure(requestFn, responseErrorFn) {
        _requestInterceptor       = requestFn;
        _responseErrorInterceptor = responseErrorFn;
    }

    constructor() {
        this.#http = axios.create({
            baseURL: platformApi,
        });
        if (_requestInterceptor) {
            this.#http.interceptors.request.use(_requestInterceptor);
        }
        if (_responseErrorInterceptor) {
            this.#http.interceptors.response.use(null, _responseErrorInterceptor);
        }
    }
}
