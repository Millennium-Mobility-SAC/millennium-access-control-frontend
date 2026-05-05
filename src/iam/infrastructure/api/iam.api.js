/**
 * IAM Infrastructure - API Service
 *
 * Responsabilidad: Comunicación HTTP con el backend del módulo IAM.
 * Maneja autenticación, autorización y gestión de identidad.
 * NO contiene lógica de negocio.
 *
 * Usa assemblers para transformar datos API ⇄ Dominio.
 */

import { BaseApi } from '../../../shared/infrustructure/base-api.js';
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js';

export class IamApi extends BaseApi {
    #endpoint;

    constructor() {
        super();
        this.#endpoint = new BaseEndpoint(this, import.meta.env.VITE_IAM_ENDPOINT ?? '/authentication');
    }

    // ── Auth-specific methods ─────────────────────────────────────────────

    /**
     * Inicia sesión con credenciales de usuario.
     * @param {{ username: string, password: string }} credentials
     * @returns {Promise<AxiosResponse>} { token, user }
     */
    login(credentials) {
        return this.http.post(`${this.#endpoint.endpointPath}/sign-in`, credentials);
    }

    /**
     * Cierra la sesión del usuario autenticado.
     * @returns {Promise<AxiosResponse>}
     */
    logout() {
        return this.http.post(`${this.#endpoint.endpointPath}/logout`);
    }

    /**
     * Registra una nueva empresa con su usuario propietario (OWNER).
     * @param {{ empresa: Object, usuario: Object }} payload
     * @returns {Promise<AxiosResponse>}
     */
    register(payload) {
        return this.http.post(`${this.#endpoint.endpointPath}/register`, payload);
    }

    /**
     * Refresca el token de acceso usando el refresh token.
     * @param {string} refreshToken
     * @returns {Promise<AxiosResponse>} { token }
     */
    refreshToken(refreshToken) {
        return this.http.post(`${this.#endpoint.endpointPath}/refresh`, { refreshToken });
    }

    /**
     * Solicita correo de recuperación de contraseña.
     * @param {string} email
     * @returns {Promise<AxiosResponse>}
     */
    forgotPassword(email) {
        return this.http.post(`${this.#endpoint.endpointPath}/forgot-password`, { email });
    }

    /**
     * Restablece la contraseña con token de recuperación.
     * @param {{ token: string, password: string }} payload
     * @returns {Promise<AxiosResponse>}
     */
    resetPassword(payload) {
        return this.http.post(`${this.#endpoint.endpointPath}/reset-password`, payload);
    }

    /**
     * Obtiene el perfil del usuario autenticado por su ID.
     * @param {number|string} userId
     * @returns {Promise<AxiosResponse>}
     */
    getProfileByUserId(userId) {
        return this.http.get(`/profiles/user/${userId}`);
    }

    /**
     * Crea un nuevo perfil de usuario (crea cuenta IAM + datos de perfil en un solo paso).
     * @param {Object} resource - Campos del perfil (username, password, roles, email, firstName, lastName, phoneNumber, documentType, documentNumber, position, department, active)
     * @returns {Promise<AxiosResponse>}
     */
    createProfile(resource) {
        return this.http.post('/profiles', resource);
    }

    // ── CRUD genérico (usuarios del sistema) ─────────────────────────────

    getAll()             { return this.#endpoint.getAll(); }
    getById(id)          { return this.#endpoint.getById(id); }
    create(resource)     { return this.#endpoint.create(resource); }
    update(id, resource) { return this.#endpoint.update(id, resource); }
    delete(id)           { return this.#endpoint.delete(id); }
}

export const iamApi = new IamApi();
