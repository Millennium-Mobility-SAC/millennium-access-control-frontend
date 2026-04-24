import { User } from '../../domain/models/user.entity.js';
import { UserResponse } from '../../domain/models/user-response.entity.js';

/**
 * IAM Infrastructure - User Assembler
 *
 * Transforma recursos crudos del API en entidades de dominio.
 * Nunca retorna datos crudos fuera de esta clase.
 */
export class UserAssembler {

    /**
     * Transforma la respuesta directa de /sign-in en una entidad UserResponse.
     * @param {Object} response - Respuesta Axios del login.
     * @returns {UserResponse|null}
     */
    static toUserResponseFromLoginResponse(response) {
        if (response.status !== 200 && response.status !== 201) return null;
        const d = response.data;
        if (!d) return null;
        return new UserResponse({
            id:       d.id       ?? null,
            username: d.username ?? '',
            token:    d.token    ?? d.accessToken ?? d.access_token ?? '',
            roles:    d.roles    ?? [],
        });
    }

    /**
     * Transforma un recurso individual del API en una entidad User.
     * @param {Object} r - Recurso crudo del API.
     * @returns {User}
     */
    static toEntityFromResource(r) {
        return new User({
            id:       r.id       ?? null,
            username: r.username ?? '',
            roles:    r.roles    ?? [],
        });
    }

    /**
     * Transforma un único recurso de respuesta en una entidad User.
     * Útil para login / perfil propio.
     * Soporta respuesta directa o anidada en { user, token }.
     * @param {Object} response - Respuesta Axios.
     * @returns {User|null}
     */
    static toEntityFromResponse(response) {
        if (response.status !== 200 && response.status !== 201) return null;
        const data = response.data?.user ?? response.data;
        if (!data) return null;
        return UserAssembler.toEntityFromResource(data);
    }

    /**
     * Valida la respuesta HTTP y transforma la colección de recursos en entidades.
     * @param {Object} response - Respuesta Axios.
     * @returns {User[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const list = response.data?.items ?? response.data?.data ?? response.data;
        if (!Array.isArray(list)) return [];
        return list.map(r => UserAssembler.toEntityFromResource(r));
    }
}
