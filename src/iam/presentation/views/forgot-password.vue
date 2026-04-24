<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useIamStore } from '../../application/iam.store.js';
import { IAM_ROUTES } from '../iam.routes.js';
import IamBranding from '../components/iam-branding.vue';

const router   = useRouter();
const iamStore = useIamStore();

const email   = ref('');
const success = ref(false);

async function handleSubmit() {
    const ok = await iamStore.forgotPassword(email.value);
    if (ok) success.value = true;
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
          <h2 class="text-3xl md:text-4xl font-bold mb-2 text-color">Recuperar Contrasena</h2>
          <p class="text-sm m-0 text-color-secondary">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contrasena
          </p>
        </div>

        <!-- Estado de exito -->
        <div v-if="success" class="flex flex-column align-items-center gap-3 py-4 text-center">
          <div class="success-icon-circle flex align-items-center justify-content-center">
            <i class="pi pi-envelope" style="font-size: 1.5rem; color: #22c55e;"></i>
          </div>
          <h3 class="text-xl font-bold m-0 text-color">Correo enviado</h3>
          <p class="text-sm text-color-secondary m-0 line-height-3">
            Revisa tu bandeja de entrada. Si el correo esta registrado,
            recibiras el enlace de recuperacion en los proximos minutos.
          </p>
          <pv-button
            label="Volver al inicio de sesion"
            icon="pi pi-arrow-left"
            class="w-full mt-2"
            @click="router.push(IAM_ROUTES.SIGN_IN)"
          />
        </div>

        <!-- Formulario -->
        <form v-else @submit.prevent="handleSubmit" class="flex flex-column gap-3">

          <!-- Error -->
          <pv-message v-if="iamStore.error" severity="error" class="w-full">
            {{ iamStore.error }}
          </pv-message>

          <!-- Email -->
          <div class="flex flex-column gap-2">
            <label for="email" class="font-semibold text-sm text-color">Correo electronico</label>
            <pv-icon-field>
              <pv-input-icon class="pi pi-envelope" />
              <pv-input-text
                id="email"
                v-model="email"
                type="email"
                placeholder="correo@empresa.pe"
                class="w-full"
                size="large"
              />
            </pv-icon-field>
          </div>

          <!-- Boton -->
          <pv-button
            type="submit"
            label="Enviar enlace de recuperacion"
            icon="pi pi-send"
            class="w-full mt-2"
            :loading="iamStore.isLoading"
            :disabled="!email || iamStore.isLoading"
          />

          <!-- Volver -->
          <div class="text-center mt-2">
            <a @click.prevent="router.push(IAM_ROUTES.SIGN_IN)" class="text-sm cursor-pointer link-primary no-underline">
              Volver a iniciar sesion
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
.success-icon-circle {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background-color: color-mix(in srgb, #22c55e 15%, transparent);
}
</style>
