/**
 * IAM Domain - User Entity
 *
 * Objeto de dominio puro.
 * Sin dependencias Vue, sin HTTP, sin imports de otras capas.
 */
export class User {
    constructor({
        id       = null,
        username = '',
        roles    = [],
    } = {}) {
        this.id       = id;
        this.username = username;
        this.roles    = roles;
    }

    /** @returns {string} Rol principal del usuario */
    get primaryRole() {
        return this.roles[0] ?? '';
    }

    /** @returns {boolean} true si tiene el rol indicado */
    hasRole(role) {
        return this.roles.includes(role);
    }
}
