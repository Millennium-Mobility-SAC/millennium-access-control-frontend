<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useIamStore } from '../../application/iam.store.js';
import { IAM_ROUTES } from '../iam.routes.js';
import IamBranding from '../components/iam-branding.vue';

const router   = useRouter();
const iamStore = useIamStore();

const username = ref('');
const password = ref('');

// ── Protección básica contra brute-force en el cliente ────────────────────
// El backend DEBE implementar rate limiting real (Spring Security + bucket4j).
// Esto es una capa defensiva de UX, no una medida de seguridad primaria.
const COOLDOWN_SECONDS  = 5;
const MAX_ATTEMPTS      = 5;
const failedAttempts    = ref(0);
const cooldownRemaining = ref(0);
let _cooldownTimer = null;

const isLockedOut = computed(() => cooldownRemaining.value > 0);
const lockoutMessage = computed(() =>
    isLockedOut.value
        ? `Demasiados intentos. Espera ${cooldownRemaining.value}s para intentarlo de nuevo.`
        : ''
);

function _startCooldown() {
    cooldownRemaining.value = COOLDOWN_SECONDS * Math.min(failedAttempts.value, 6); // backoff progresivo
    _cooldownTimer = setInterval(() => {
        cooldownRemaining.value--;
        if (cooldownRemaining.value <= 0) {
            clearInterval(_cooldownTimer);
            _cooldownTimer = null;
        }
    }, 1000);
}

onBeforeUnmount(() => {
    if (_cooldownTimer) clearInterval(_cooldownTimer);
});

async function handleLogin() {
    if (isLockedOut.value || iamStore.isLoading) return;

    const ok = await iamStore.login({ username: username.value, password: password.value });
    if (ok) {
        failedAttempts.value = 0;
        router.push('/stays');
    } else {
        failedAttempts.value++;
        if (failedAttempts.value >= MAX_ATTEMPTS) {
            _startCooldown();
        }
    }
}

</script>

<template>
  <div class="flex flex-column md:flex-row w-full min-h-screen">

    <!-- Panel izquierdo - Branding compartido -->
    <iam-branding />

    <!-- Panel derecho - Formulario -->
    <div class="bg-surface flex align-items-center justify-content-center p-4 md:p-6 w-full md:w-6 md:h-screen">

      <div class="w-full form-container px-2 md:px-3">

        <!-- Header -->
        <div class="mb-4 text-center">
          <h2 class="text-4xl md:text-5xl font-bold mb-2 text-color">Iniciar Sesion</h2>
          <p class="text-sm m-0 text-color-secondary">Ingresa tus credenciales para acceder</p>
        </div>

          <!-- Aviso de bloqueo temporal -->
          <div v-if="isLockedOut" class="login-error login-error--lockout mb-3">
            <i class="pi pi-lock login-error__icon"></i>
            <span class="login-error__text">{{ lockoutMessage }}</span>
          </div>

          <!-- Error del store -->
          <div v-else-if="iamStore.error" class="login-error mb-3">
          <i class="pi pi-exclamation-circle login-error__icon"></i>
          <span class="login-error__text">{{ iamStore.error?.message ?? iamStore.error }}</span>
        </div>

        <!-- Formulario -->
        <form @submit.prevent="handleLogin" class="flex flex-column gap-3">

          <!-- Usuario -->
          <div class="flex flex-column gap-2">
            <label for="username" class="font-semibold text-sm text-color">Usuario</label>
            <pv-input-text
              id="username"
              v-model="username"
              placeholder="Ingrese su usuario"
              class="w-full"
              size="large"
            />
          </div>

          <!-- Contrasena -->
          <div class="flex flex-column gap-2">
            <label for="password" class="font-semibold text-sm text-color">Contrasena</label>
            <pv-password
              id="password"
              v-model="password"
              placeholder="Ingrese su contrasena"
              :feedback="false"
              toggle-mask
              size="large"
              class="w-full"
            />
          </div>

          <!-- Boton -->
          <pv-button
            type="submit"
            label="Iniciar Sesion"
            class="w-full mt-2"
            size="large"
            :loading="iamStore.isLoading"
            :disabled="!username || !password || iamStore.isLoading || isLockedOut"
          />

          <!-- Olvidaste contrasena -->
          <div class="text-center mt-2">
            <a @click.prevent="router.push(IAM_ROUTES.FORGOT_PASSWORD)" class="text-sm cursor-pointer link-primary no-underline">
              Olvidaste tu contrasena?
            </a>
          </div>

        </form>

        <!-- Footer movil -->
        <div class="block md:hidden text-center pt-4">
          <p class="text-xs text-color-secondary m-0">
            &copy; {{ new Date().getFullYear() }} Metasoft Solutions. Todos los derechos reservados.
          </p>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
.form-container { max-width: 25rem; }
.bg-surface     { background-color: var(--color-white); }
.link-primary   { color: var(--color-primary); }
a.link-primary:hover { opacity: 0.8; }

.login-error {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid #ef4444;
    border-radius: 8px;
}

.login-error__icon {
    color: #dc2626;
    font-size: 1.1rem;
    margin-top: 1px;
    flex-shrink: 0;
}

.login-error__text {
    color: #991b1b;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
}

.login-error--lockout {
    background: #fefce8;
    border-color: #fde047;
    border-left-color: #eab308;
}

.login-error--lockout .login-error__icon {
    color: #a16207;
}

.login-error--lockout .login-error__text {
    color: #713f12;
}
</style>
