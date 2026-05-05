<script setup>
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import logoMillenniumMobility from '@/assets/img/logo-millennium-mobility.png';
import { useIamStore } from '../../application/iam.store.js';
import { IAM_ROUTES } from '../iam.routes.js';
import { useFormRules } from '@/shared/composables/use-form-rules.js';
import {
  PROFILE_DOCUMENT_TYPES,
  PROFILE_DEPARTMENTS,
  PROFILE_ROLES_OPTIONS,
} from '../constants/iam-ui.constants.js';

const router   = useRouter();
const iamStore = useIamStore();
const rules    = useFormRules();

const form = reactive({
  firstName:      '',
  lastName:       '',
  documentType:   'DNI',
  documentNumber: '',
  email:          '',
  phoneNumber:    '',
  position:       '',
  department:     '',
  username:       '',
  password:       '',
  role:           '',
  active:         true,
});

const errors = reactive({
  firstName:      '',
  lastName:       '',
  documentNumber: '',
  email:          '',
  phoneNumber:    '',
  position:       '',
  department:     '',
  username:       '',
  password:       '',
  role:           '',
});

const success = reactive({ value: false });

function clearErrors() {
  Object.keys(errors).forEach(k => (errors[k] = ''));
}

function validate() {
  clearErrors();
  let valid = true;

  if (rules.isBlank(form.firstName) || !rules.hasMaxLength(form.firstName, 60)) {
    errors.firstName = 'El nombre es requerido y no debe superar 60 caracteres.';
    valid = false;
  }
  if (rules.isBlank(form.lastName) || !rules.hasMaxLength(form.lastName, 60)) {
    errors.lastName = 'El apellido es requerido y no debe superar 60 caracteres.';
    valid = false;
  }
  if (rules.isBlank(form.documentNumber) || !rules.hasMaxLength(form.documentNumber, 30)) {
    errors.documentNumber = 'El número de documento es requerido y no debe superar 30 caracteres.';
    valid = false;
  }
  if (!rules.isEmail(form.email) || rules.isBlank(form.email)) {
    errors.email = 'Ingresa un correo electrónico válido.';
    valid = false;
  }
  if (!rules.isBlank(form.phoneNumber) && !rules.isPhone(form.phoneNumber)) {
    errors.phoneNumber = 'Ingresa un teléfono válido (6-20 dígitos).';
    valid = false;
  }
  if (rules.isBlank(form.position) || !rules.hasMaxLength(form.position, 100)) {
    errors.position = 'El cargo es requerido y no debe superar 100 caracteres.';
    valid = false;
  }
  if (rules.isBlank(form.department)) {
    errors.department = 'Selecciona un área o departamento.';
    valid = false;
  }
  if (rules.isBlank(form.username) || !rules.hasMaxLength(form.username, 50)) {
    errors.username = 'El usuario es requerido y no debe superar 50 caracteres.';
    valid = false;
  }
  if (rules.isBlank(form.password) || String(form.password).length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
    valid = false;
  }
  if (rules.isBlank(form.role)) {
    errors.role = 'Selecciona un rol del sistema.';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  if (!validate()) return;

  const payload = {
    username:       form.username.trim(),
    password:       form.password,
    roles:          [form.role],
    email:          form.email.trim(),
    firstName:      form.firstName.trim(),
    lastName:       form.lastName.trim(),
    phoneNumber:    form.phoneNumber.trim() || null,
    documentType:   form.documentType,
    documentNumber: form.documentNumber.trim(),
    position:       form.position.trim(),
    department:     form.department,
    active:         form.active,
  };

  const ok = await iamStore.createProfile(payload);
  if (ok) success.value = true;
}
</script>

<template>
  <div class="pc-page flex align-items-center justify-content-center px-4 py-6 w-full min-h-screen">

    <div class="pc-form-container w-full">

        <!-- Header -->
        <div class="pc-header flex align-items-center gap-3 mb-5">
          <div class="pc-logo-wrap flex align-items-center justify-content-center flex-shrink-0">
            <img :src="logoMillenniumMobility" alt="Millennium Mobility" class="pc-logo-img" />
          </div>
          <div>
            <h1 class="pc-title">Crear Perfil</h1>
            <p class="pc-subtitle">Completa los datos para registrar un nuevo perfil de usuario</p>
          </div>
        </div>
        <div class="pc-header-divider mb-5"></div>

        <!-- Estado de éxito -->
        <div v-if="success.value" class="flex flex-column align-items-center gap-3 py-4 text-center">
          <div class="success-icon-circle flex align-items-center justify-content-center">
            <i class="pi pi-check-circle" style="font-size: 1.5rem; color: #22c55e;"></i>
          </div>
          <h3 class="pc-title" style="font-size: 1.25rem;">Perfil creado</h3>
          <p class="pc-subtitle m-0 line-height-3">
            El perfil fue registrado correctamente.
            Ya puede iniciar sesión con las credenciales asignadas.
          </p>
          <pv-button
            label="Ir al inicio de sesión"
            icon="pi pi-arrow-left"
            class="w-full mt-2"
            @click="router.push(IAM_ROUTES.SIGN_IN)"
          />
        </div>

        <!-- Formulario -->
        <form v-else @submit.prevent="handleSubmit">

          <!-- Error global -->
          <pv-message v-if="iamStore.error" severity="error" class="w-full mb-4">
            {{ iamStore.error }}
          </pv-message>

          <div class="pc-grid">
            <!-- Columna izquierda -->
            <div class="pc-col">

          <!-- ── Identidad ───────────────────────────────────────────── -->
          <div class="pc-section">
            <p class="pc-section-header">Identidad</p>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Tipo de documento</label>
                <pv-select
                  v-model="form.documentType"
                  :options="PROFILE_DOCUMENT_TYPES"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                />
              </div>
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Número de documento</label>
                <pv-input-text
                  v-model="form.documentNumber"
                  placeholder="Ej. 12345678"
                  class="w-full"
                  autocomplete="off"
                  :invalid="!!errors.documentNumber"
                />
                <small v-if="errors.documentNumber" class="pc-error">{{ errors.documentNumber }}</small>
              </div>
            </div>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Nombres</label>
                <pv-input-text
                  v-model="form.firstName"
                  placeholder="Ej. Juan Carlos"
                  class="w-full"
                  :invalid="!!errors.firstName"
                />
                <small v-if="errors.firstName" class="pc-error">{{ errors.firstName }}</small>
              </div>
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Apellidos</label>
                <pv-input-text
                  v-model="form.lastName"
                  placeholder="Ej. Pérez López"
                  class="w-full"
                  :invalid="!!errors.lastName"
                />
                <small v-if="errors.lastName" class="pc-error">{{ errors.lastName }}</small>
              </div>
            </div>
          </div>

          <!-- ── Contacto ────────────────────────────────────────────── -->
          <div class="pc-section pc-section--last">
            <p class="pc-section-header">Contacto</p>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Correo electrónico</label>
                <pv-input-text
                  v-model="form.email"
                  type="email"
                  placeholder="Ej. juan@empresa.com"
                  class="w-full"
                  autocomplete="off"
                  :invalid="!!errors.email"
                />
                <small v-if="errors.email" class="pc-error">{{ errors.email }}</small>
              </div>
              <div class="pc-field pc-field--flex">
                <label class="pc-label">
                  Teléfono
                  <span class="pc-label-opt">(opcional)</span>
                </label>
                <pv-input-text
                  v-model="form.phoneNumber"
                  placeholder="Ej. 956321478"
                  class="w-full"
                  :invalid="!!errors.phoneNumber"
                />
                <small v-if="errors.phoneNumber" class="pc-error">{{ errors.phoneNumber }}</small>
              </div>
            </div>
          </div>

            </div><!-- /pc-col izquierda -->

            <!-- Divisor vertical -->
            <div class="pc-col-divider"></div>

            <!-- Columna derecha -->
            <div class="pc-col">

          <!-- ── Cargo ───────────────────────────────────────────────── -->
          <div class="pc-section">
            <p class="pc-section-header">Cargo</p>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Puesto</label>
                <pv-input-text
                  v-model="form.position"
                  placeholder="Ej. Mecánico Senior"
                  class="w-full"
                  :invalid="!!errors.position"
                />
                <small v-if="errors.position" class="pc-error">{{ errors.position }}</small>
              </div>
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Área / Departamento</label>
                <pv-select
                  v-model="form.department"
                  :options="PROFILE_DEPARTMENTS"
                  option-label="label"
                  option-value="value"
                  placeholder="Selecciona"
                  class="w-full"
                  :invalid="!!errors.department"
                />
                <small v-if="errors.department" class="pc-error">{{ errors.department }}</small>
              </div>
            </div>
          </div>

          <!-- ── Acceso al sistema ───────────────────────────────────── -->
          <div class="pc-section pc-section--last">
            <p class="pc-section-header">Acceso</p>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Nombre de usuario</label>
                <pv-input-text
                  v-model="form.username"
                  placeholder="Ej. jperez"
                  class="w-full"
                  autocomplete="off"
                  :invalid="!!errors.username"
                />
                <small v-if="errors.username" class="pc-error">{{ errors.username }}</small>
              </div>
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Contraseña</label>
                <pv-password
                  v-model="form.password"
                  :feedback="false"
                  toggle-mask
                  placeholder="Mín. 8 caracteres"
                  class="w-full"
                  input-class="w-full"
                  autocomplete="new-password"
                  :invalid="!!errors.password"
                />
                <small v-if="errors.password" class="pc-error">{{ errors.password }}</small>
              </div>
            </div>
            <div class="pc-row">
              <div class="pc-field pc-field--flex">
                <label class="pc-label">Rol del sistema</label>
                <pv-select
                  v-model="form.role"
                  :options="PROFILE_ROLES_OPTIONS"
                  option-label="label"
                  option-value="value"
                  placeholder="Selecciona un rol"
                  class="w-full"
                  :invalid="!!errors.role"
                />
                <small v-if="errors.role" class="pc-error">{{ errors.role }}</small>
              </div>
            </div>
          </div>

            </div><!-- /pc-col derecha -->
          </div><!-- /pc-grid -->

          <!-- Boton de envío -->
          <pv-button
            type="submit"
            label="Crear perfil"
            class="w-full mt-5"
            size="large"
            :loading="iamStore.isLoading"
            :disabled="iamStore.isLoading"
          />

          <!-- Volver -->
          <div class="text-center mt-3">
            <a @click.prevent="router.push(IAM_ROUTES.SIGN_IN)" class="text-sm cursor-pointer link-primary no-underline">
              Volver a iniciar sesión
            </a>
          </div>

        </form>

        <!-- Footer -->
        <div class="text-center pt-5">
          <p class="pc-footer-text m-0">&copy; {{ new Date().getFullYear() }} Metasoft Solutions. Todos los derechos reservados.</p>
        </div>

      </div>

  </div>
</template>

<style scoped>
/* ── Página ─────────────────────────────────────────────────────────────── */
.pc-page {
  background: #080d1a;
}

/* ── Contenedor ─────────────────────────────────────────────────────────── */
.pc-form-container {
  max-width: 52rem;
}

/* ── Cabecera horizontal ─────────────────────────────────────────────────── */
.pc-logo-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}
.pc-logo-img { width: 72%; height: 72%; object-fit: contain; }

.pc-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #E5F3F8;
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}
.pc-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.pc-header-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
}

/* ── Grid de secciones ───────────────────────────────────────────────────── */
.pc-grid {
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  gap: 0 2.5rem;
}

.pc-col-divider {
  background: rgba(255, 255, 255, 0.07);
  width: 1px;
}

.pc-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

@media (max-width: 767px) {
  .pc-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .pc-col-divider { display: none; }
}

/* ── Éxito ───────────────────────────────────────────────────────────────── */
.success-icon-circle {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

/* ── Link ────────────────────────────────────────────────────────────────── */
.link-primary { color: var(--color-primary); }
a.link-primary:hover { opacity: 0.75; }

/* ── Secciones ───────────────────────────────────────────────────────────── */
.pc-section {
  padding: 1.25rem 0 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.pc-section--last {
  border-bottom: none;
  padding-bottom: 0.5rem;
  flex: 1;
}

/* ── Encabezado de sección ───────────────────────────────────────────────── */
.pc-section-header {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 0.875rem;
  padding-left: 0.625rem;
  border-left: 2px solid var(--color-primary);
  line-height: 1;
}

/* ── Filas y campos ──────────────────────────────────────────────────────── */
.pc-row {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 0.625rem;
}
.pc-row:last-child { margin-bottom: 0; }

.pc-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.pc-field--flex { flex: 1; min-width: min(100%, 9rem); }

@media (max-width: 480px) {
  .pc-field--flex { flex: 1 1 100%; min-width: 100%; }
}

.pc-label {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.pc-label-opt {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.7rem;
  margin-left: 0.2rem;
}
.pc-error { font-size: 0.7rem; color: #f87171; margin-top: 0.1rem; }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.pc-footer-text {
  font-size: 0.7rem;
  color: var(--text-disabled);
  letter-spacing: 0.01em;
}

/* Forzar ancho completo en pv-password */
.pc-field :deep(.p-password) { width: 100%; }
.pc-field :deep(.p-password-input) { width: 100%; }
</style>
