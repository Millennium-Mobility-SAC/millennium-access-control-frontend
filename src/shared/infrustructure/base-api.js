import axios from 'axios';

const platformApi = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:8080/api/v1';

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
