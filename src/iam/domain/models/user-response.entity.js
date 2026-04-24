/**
 * IAM Domain — UserResponse Entity
 *
 * Representa la respuesta del servidor tras un login exitoso.
 * Objeto de dominio puro: sin Vue, sin HTTP, sin imports externos.
 *
 * Ejemplo de recurso mapeado:
 * {
 *   "id": 3,
 *   "username": "JanoverSaldana",
 *   "token": "eyJ...",
 *   "roles": ["ROLE_SUPPORT_ADMIN"]
 * }
 */
export class UserResponse {
    constructor({
        id       = null,
        username = '',
        token    = '',
        roles    = [],
    } = {}) {
        this.id       = id;
        this.username = username;
        this.token    = token;
        this.roles    = roles;
    }

    /** @returns {string} Rol principal del usuario */
    get primaryRole() {
        return this.roles[0] ?? '';
    }

    /** @returns {boolean} true si el token está presente */
    get isValid() {
        return !!this.token && !!this.username;
    }
}
