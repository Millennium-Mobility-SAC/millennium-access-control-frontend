<script setup>
import { reactive, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { TIPOS_DOCUMENTO, DEPARTAMENTOS, ROLES_OPTIONS } from '../constants/staff-management-ui.constants.js'
import { useFormRules } from '@/shared/composables/use-form-rules.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
  submitLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])
const rules = useFormRules()

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

const errors = reactive({
  documentNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  username: '',
  password: '',
  position: '',
  department: '',
  role: '',
})

watch(() => props.visible, (val) => {
  if (!val) return

  const src = props.entity ?? {}
  clearErrors()

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

function clearErrors() {
  errors.documentNumber = ''
  errors.firstName = ''
  errors.lastName = ''
  errors.email = ''
  errors.phoneNumber = ''
  errors.username = ''
  errors.password = ''
  errors.position = ''
  errors.department = ''
  errors.role = ''
}

function validate() {
  clearErrors()
  let valid = true

  if (rules.isBlank(form.documentNumber) || !rules.hasMaxLength(form.documentNumber, 30)) {
    errors.documentNumber = 'El numero de documento es requerido y no debe superar 30 caracteres.'
    valid = false
  }
  if (rules.isBlank(form.firstName) || !rules.hasMaxLength(form.firstName, 60)) {
    errors.firstName = 'El nombre es requerido y no debe superar 60 caracteres.'
    valid = false
  }
  if (rules.isBlank(form.lastName) || !rules.hasMaxLength(form.lastName, 60)) {
    errors.lastName = 'El apellido es requerido y no debe superar 60 caracteres.'
    valid = false
  }
  if (!rules.isEmail(form.email)) {
    errors.email = 'Ingresa un correo electronico valido.'
    valid = false
  }
  if (!rules.isPhone(form.phoneNumber)) {
    errors.phoneNumber = 'Ingresa un telefono valido (6-20 caracteres).'
    valid = false
  }
  if (rules.isBlank(form.username) || !rules.hasMaxLength(form.username, 50)) {
    errors.username = 'El usuario es requerido y no debe superar 50 caracteres.'
    valid = false
  }
  if (!props.edit && (rules.isBlank(form.password) || String(form.password).length < 8)) {
    errors.password = 'La contrasena debe tener al menos 8 caracteres.'
    valid = false
  }
  if (!rules.isBlank(form.password) && String(form.password).length < 8) {
    errors.password = 'La contrasena debe tener al menos 8 caracteres.'
    valid = false
  }
  if (rules.isBlank(form.position) || !rules.hasMaxLength(form.position, 100)) {
    errors.position = 'El puesto es requerido y no debe superar 100 caracteres.'
    valid = false
  }
  if (rules.isBlank(form.department)) {
    errors.department = 'Selecciona un departamento.'
    valid = false
  }
  if (!form.roles?.[0]) {
    errors.role = 'Selecciona un rol del sistema.'
    valid = false
  }

  return valid
}

function onSave(payload) {
  if (!validate()) return
  emit('saved-shared', payload)
}
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Colaborador"
    :edit="edit"
    size="standard"
    :submit-loading="submitLoading"
    :submit-disabled="submitLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSave($event)"
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
              <small v-if="errors.documentNumber" class="sce-error">{{ errors.documentNumber }}</small>
            </div>
          </div>
          <div class="sce-row">
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Nombres</label>
              <pv-input-text v-model="form.firstName" placeholder="Ej. Juan" class="w-full" />
              <small v-if="errors.firstName" class="sce-error">{{ errors.firstName }}</small>
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Apellidos</label>
              <pv-input-text v-model="form.lastName" placeholder="Ej. Pérez" class="w-full" />
              <small v-if="errors.lastName" class="sce-error">{{ errors.lastName }}</small>
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
              <small v-if="errors.email" class="sce-error">{{ errors.email }}</small>
            </div>
            <div class="sce-field sce-field--flex">
              <label class="sce-label">Teléfono</label>
              <pv-input-text v-model="form.phoneNumber" placeholder="Ej. 956321478" class="w-full" />
              <small v-if="errors.phoneNumber" class="sce-error">{{ errors.phoneNumber }}</small>
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
              <small v-if="errors.position" class="sce-error">{{ errors.position }}</small>
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
              <small v-if="errors.department" class="sce-error">{{ errors.department }}</small>
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
              <small v-if="errors.username" class="sce-error">{{ errors.username }}</small>
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
              <small v-if="errors.password" class="sce-error">{{ errors.password }}</small>
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
              <small v-if="errors.role" class="sce-error">{{ errors.role }}</small>
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
.sce-error { font-size: 0.75rem; color: #dc2626; }

/* Forzar ancho completo en pv-password */
.sce-field .p-password {
  width: 100%;
}
.sce-field .p-password-input {
  width: 100%;
}
</style>
