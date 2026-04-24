<script setup>
import { reactive, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { TIPOS_DOCUMENTO, DEPARTAMENTOS, ROLES_OPTIONS } from '../constants/staff-management-ui.constants.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])

const form = reactive({
  id:             null,
  firstName:      '',
  lastName:       '',
  documentType:   'DNI',
  documentNumber: '',
  email:          '',
  phoneNumber:    '',
  username:       '',
  password:       '',
  position:       '',
  department:     '',
  active:         true,
  roles:          [],
})

watch(() => props.visible, (val) => {
  if (!val) return

  const src = props.entity ?? {}

  Object.assign(form, {
    id:             src.id             ?? null,
    firstName:      src.firstName      ?? '',
    lastName:       src.lastName       ?? '',
    documentType:   src.documentType   ?? 'DNI',
    documentNumber: src.documentNumber ?? '',
    email:          src.email          ?? '',
    phoneNumber:    src.phoneNumber    ?? '',
    username:       src.username       ?? '',
    password:       '',
    position:       src.position       ?? '',
    department:     src.department     ?? '',
    roles:          src.roles          ? [...src.roles] : [],
  })
})
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Colaborador"
    :edit="edit"
    size="standard"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="emit('saved-shared', $event)"
  >
    <template #content>
      <div class="sce-form">

        <!-- Identidad -->
        <div class="sce-section">
          <div class="sce-section-header">
            <i class="pi pi-id-card sce-section-icon" />
            <span>Identidad</span>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Tipo doc.</label>
              <pv-select
                v-model="form.documentType"
                :options="TIPOS_DOCUMENTO"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Número de documento</label>
              <pv-input-text v-model="form.documentNumber" placeholder="Ej. 12345678" class="w-full" />
            </div>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Nombres</label>
              <pv-input-text v-model="form.firstName" placeholder="Ej. Juan" class="w-full" />
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Apellidos</label>
              <pv-input-text v-model="form.lastName" placeholder="Ej. Pérez" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Contacto -->
        <div class="sce-section">
          <div class="sce-section-header">
            <i class="pi pi-envelope sce-section-icon" />
            <span>Contacto</span>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Correo electrónico</label>
              <pv-input-text v-model="form.email" type="email" placeholder="Ej. juan@empresa.com" class="w-full" />
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Teléfono</label>
              <pv-input-text v-model="form.phoneNumber" placeholder="Ej. 956321478" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Cargo -->
        <div class="sce-section">
          <div class="sce-section-header">
            <i class="pi pi-briefcase sce-section-icon" />
            <span>Cargo</span>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Puesto</label>
              <pv-input-text v-model="form.position" placeholder="Ej. Mecánico Senior" class="w-full" />
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Área / Departamento</label>
              <pv-select
                v-model="form.department"
                :options="DEPARTAMENTOS"
                option-label="label"
                option-value="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Acceso al sistema -->
        <div class="sce-section sce-section--last">
          <div class="sce-section-header">
            <i class="pi pi-lock sce-section-icon" />
            <span>Acceso al sistema</span>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Nombre de usuario</label>
              <pv-input-text v-model="form.username" placeholder="Ej. jperez" class="w-full" autocomplete="off" />
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">
                Contraseña
                <span v-if="edit" class="sce-label-opt">(dejar vacío para no cambiar)</span>
              </label>
              <pv-password
                v-model="form.password"
                :feedback="false"
                toggle-mask
                placeholder="••••••••"
                class="w-full"
                input-class="w-full"
                autocomplete="new-password"
              />
            </div>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Rol del sistema</label>
              <pv-select
                v-model="form.roles[0]"
                :options="ROLES_OPTIONS"
                option-label="label"
                option-value="value"
                placeholder="Selecciona un rol"
                class="w-full"
                @change="form.roles = form.roles[0] ? [form.roles[0]] : []"
              />
            </div>
          </div>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>

<style>
.sce-form {
  display: flex;
  flex-direction: column;
}

.sce-section {
  padding: 0.75rem 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.sce-section--last {
  border-bottom: none;
  padding-bottom: 0.25rem;
}
.sce-section-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.875rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7280;
}
.sce-section-icon {
  font-size: 0.75rem;
  color: #1A6BC2;
}

.sce-row {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.sce-row:last-child { margin-bottom: 0; }

.sce-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.sce-field--flex { flex: 1; }

.sce-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}
.sce-label-opt {
  font-weight: 400;
  color: #9ca3af;
  font-size: 0.75rem;
  margin-left: 0.25rem;
}

/* Forzar ancho completo en pv-password */
.sce-field .p-password {
  width: 100%;
}
.sce-field .p-password-input {
  width: 100%;
}
</style>
