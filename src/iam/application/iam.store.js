import { defineStore } from 'pinia';
import { ref, computed, onScopeDispose } from 'vue';
import { IamApi } from '../infrastructure/api/iam.api.js';
import { UserAssembler } from '../infrastructure/assemblers/user.assembler.js';
import { normalizeApiError } from '@/shared/infrustructure/error-normalizer.js';
import { hasFullActionRoles } from '@/shared/presentation/constants/roles.constants.js';

const TOKEN_KEY = 'gs_token';
const USER_KEY  = 'gs_user';

export const useIamStore = defineStore('iam', () => {
    const api = new IamApi();

    // ── State ─────────────────────────────────────────────────────────────
    const isSignedIn       = ref(false);
    const currentUserId    = ref(null);
    const currentUsername  = ref('');
    const currentUserRoles = ref([]);
    const currentProfile   = ref(null);
    const profileLoading   = ref(false);
    const profileError     = ref(null);
    const isLoading        = ref(false);
    const error            = ref(null);

    _rehydrateSession();

    window.addEventListener('millennium:session-expired', _handleSessionExpired);
    onScopeDispose(() => window.removeEventListener('millennium:session-expired', _handleSessionExpired));

    // ── Getters ───────────────────────────────────────────────────────────
    const currentToken = computed(() =>
        isSignedIn.value ? localStorage.getItem(TOKEN_KEY) : null
    );
    /**
     * Rol efectivo para rutas y menú: con varios roles en el token, prevalecen
     * ROLE_ADMIN y luego ROLE_SUPPORT_ADMIN (acceso completo a todas las opciones).
     */
    const userRole = computed(() => {
        const roles = currentUserRoles.value ?? [];
        if (roles.includes('ROLE_ADMIN')) return 'ROLE_ADMIN';
        if (roles.includes('ROLE_SUPPORT_ADMIN')) return 'ROLE_SUPPORT_ADMIN';
        return roles[0] ?? '';
    });
    const isOwner  = computed(() => false); // ROLE_OWNER no existe en el sistema
    /** Alineado con backend: ADMIN y SUPPORT_ADMIN (borrados, IAM, estadías, etc.). */
    const hasFullActionAccess = computed(() => hasFullActionRoles(currentUserRoles.value));

    // ── Helpers ───────────────────────────────────────────────────────────
    function _setSession(loginResult) {
        localStorage.setItem(TOKEN_KEY, loginResult.token);
        localStorage.setItem(USER_KEY, JSON.stringify({
            id:       loginResult.id,
            username: loginResult.username,
            roles:    loginResult.roles,
        }));
        isSignedIn.value       = true;
        currentUserId.value    = loginResult.id;
        currentUsername.value  = loginResult.username;
        currentUserRoles.value = loginResult.roles ?? [];
    }

    function _clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        isSignedIn.value       = false;
        currentUserId.value    = null;
        currentUsername.value  = '';
        currentUserRoles.value = [];
        currentProfile.value   = null;
        profileError.value     = null;
    }

    function _handleSessionExpired() {
        _clearSession();
        // La redirección a /sign-in es responsabilidad de la capa de presentación.
        // layout.vue observa isSignedIn y redirige cuando se vuelve false.
    }

    function _rehydrateSession() {
        const token = localStorage.getItem(TOKEN_KEY);
        const raw   = localStorage.getItem(USER_KEY);
        if (!token || !raw) return;
        try {
            const { id, username, roles } = JSON.parse(raw);
            isSignedIn.value       = true;
            currentUserId.value    = id ?? null;
            currentUsername.value  = username ?? '';
            currentUserRoles.value = roles ?? [];
        } catch {
            _clearSession();
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Inicia sesion con las credenciales del usuario.
     * @param {{ username: string, password: string }} credentials
     * @returns {Promise<boolean>} true si exitoso
     */
    async function login(credentials) {
        isLoading.value = true;
        error.value     = null;
        try {
            const response    = await api.login(credentials);
            const loginResult = UserAssembler.toUserResponseFromLoginResponse(response);
            if (!loginResult?.isValid) throw new Error('Respuesta de login inválida: token o usuario no recibidos.');
            _setSession(loginResult);
            return true;
        } catch (err) {
            error.value = normalizeApiError(err, 'No se pudo iniciar sesión. Verifica tus credenciales e intenta de nuevo.');
            _clearSession();
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Cierra la sesion del usuario autenticado.
     * El backend usa JWT stateless — no existe endpoint de logout en servidor.
     * La invalidación se logra eliminando el token del cliente.
     */
    function logout() {
        _clearSession();
    }

    /**
     * Registra una nueva empresa con su usuario administrador (OWNER).
     * @param {{ empresa: Object, usuario: Object }} payload
     * @returns {Promise<boolean>} true si exitoso
     */
    async function register(payload) {
        isLoading.value = true;
        error.value     = null;
        try {
            await api.register(payload);
            return true;
        } catch (err) {
            error.value = normalizeApiError(err, 'Error al registrar. Intenta nuevamente.');
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Solicita correo de recuperacion de contrasena.
     * @param {string} email
     * @returns {Promise<boolean>} true si exitoso
     */
    async function forgotPassword(email) {
        isLoading.value = true;
        error.value     = null;
        try {
            await api.forgotPassword(email);
            return true;
        } catch (err) {
            error.value = normalizeApiError(err, 'No encontramos una cuenta con ese correo.');
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Obtiene el perfil del usuario autenticado.
     * @param {number|string} userId
     */
    async function fetchProfile(userId) {
        if (!userId) return;
        profileLoading.value = true;
        profileError.value   = null;
        try {
            const response = await api.getProfileByUserId(userId);
            currentProfile.value = response.data ?? null;
        } catch (err) {
            currentProfile.value = null;
            profileError.value   = normalizeApiError(err, 'No se pudo cargar el perfil. Intenta nuevamente.');
        } finally {
            profileLoading.value = false;
        }
    }

    /**
     * Crea un nuevo perfil de usuario (cuenta IAM + datos personales en un solo paso).
     * @param {Object} payload - Datos del perfil (username, password, roles, email, firstName, lastName, phoneNumber, documentType, documentNumber, position, department, active)
     * @returns {Promise<boolean>} true si exitoso
     */
    async function createProfile(payload) {
        isLoading.value = true;
        error.value     = null;
        try {
            await api.createProfile(payload);
            return true;
        } catch (err) {
            error.value = normalizeApiError(err, 'No se pudo crear el perfil. Verifica los datos e intenta de nuevo.');
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    return {
        isSignedIn, currentUserId, currentUsername, currentUserRoles, currentProfile,
        profileLoading, profileError,
        isLoading, error,
        currentToken, userRole, isOwner, hasFullActionAccess,
        login, logout, register, forgotPassword, fetchProfile, createProfile,
    };
});
