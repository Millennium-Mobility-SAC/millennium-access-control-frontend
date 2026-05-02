<script setup>
import { ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { DOCUMENT_TYPES, EMPLOYEE_STATUS_OPTIONS } from '../constants/employee-management-ui.constants.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  edit: { type: Boolean, default: false },
  entity: { type: Object, default: null },
  submitLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])

const form = ref(defaultForm())
const errors = ref({})

function defaultForm() {
  return {
    firstName: '',
    lastName: '',
    position: '',
    documentType: 'DNI',
    documentNumber: '',
    status: 'ACTIVE',
  }
}

function resetForm() {
  form.value = props.entity ? { ...defaultForm(), ...props.entity } : defaultForm()
  errors.value = {}
}

watch(() => [props.visible, props.entity], resetForm, { immediate: true })

function validate() {
  const next = {}
  if (!form.value.firstName?.trim()) next.firstName = 'Los nombres son requeridos'
  if (!form.value.lastName?.trim()) next.lastName = 'Los apellidos son requeridos'
  if (!form.value.position?.trim()) next.position = 'El cargo es requerido'
  if (!form.value.documentNumber?.trim()) next.documentNumber = 'El número de documento es requerido'
  errors.value = next
  return Object.keys(next).length === 0
}

function submit() {
  if (!validate()) return
  emit('saved-shared', { ...form.value })
}
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Empleado"
    :edit="edit"
    size="standard"
    :submit-loading="submitLoading"
    :submit-disabled="submitLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="submit"
  >
    <template #content>
      <div class="ece-form">
        <div class="ece-section">
          <div class="ece-section-header">
            <i class="pi pi-id-card ece-section-icon" />
            <span>Datos personales</span>
          </div>
          <div class="ece-row">
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Nombres</label>
              <pv-input-text
                v-model="form.firstName"
                class="w-full"
                placeholder="Ej. Juan Carlos"
                :invalid="!!errors.firstName"
              />
              <small v-if="errors.firstName" class="ece-error">{{ errors.firstName }}</small>
            </div>
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Apellidos</label>
              <pv-input-text
                v-model="form.lastName"
                class="w-full"
                placeholder="Ej. Pérez López"
                :invalid="!!errors.lastName"
              />
              <small v-if="errors.lastName" class="ece-error">{{ errors.lastName }}</small>
            </div>
          </div>
          <div class="ece-row">
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Cargo</label>
              <pv-input-text
                v-model="form.position"
                class="w-full"
                placeholder="Ej. Analista de sistemas"
                :invalid="!!errors.position"
              />
              <small v-if="errors.position" class="ece-error">{{ errors.position }}</small>
            </div>
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Estado</label>
              <pv-select v-model="form.status" :options="EMPLOYEE_STATUS_OPTIONS" option-label="label" option-value="value" class="w-full" />
            </div>
          </div>
        </div>

        <div class="ece-section ece-section--last">
          <div class="ece-section-header">
            <i class="pi pi-book ece-section-icon" />
            <span>Documento de identidad</span>
          </div>
          <div class="ece-row">
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Tipo Documento</label>
              <pv-select
                v-model="form.documentType"
                :options="DOCUMENT_TYPES"
                option-label="label"
                option-value="value"
                placeholder="Tipo de documento"
                class="w-full"
              />
            </div>
            <div class="ece-field ece-field--flex">
              <label class="ece-label">Número Documento</label>
              <pv-input-text
                v-model="form.documentNumber"
                class="w-full"
                placeholder="Ingrese el número sin espacios"
                autocomplete="off"
                :invalid="!!errors.documentNumber"
              />
              <small v-if="errors.documentNumber" class="ece-error">{{ errors.documentNumber }}</small>
            </div>
          </div>
        </div>
      </div>
    </template>
  </CreateAndEdit>
</template>

<style>
.ece-form {
  display: flex;
  flex-direction: column;
}

.ece-section {
  padding: 0.75rem 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.ece-section--last {
  border-bottom: none;
  padding-bottom: 0.25rem;
}

.ece-section-header {
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

.ece-section-icon {
  font-size: 0.75rem;
  color: #1A6BC2;
}

.ece-row {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.ece-row:last-child {
  margin-bottom: 0;
}

.ece-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.ece-field--flex {
  flex: 1;
  min-width: min(100%, 12rem);
}

@media (max-width: 767px) {
  .ece-field--flex {
    flex: 1 1 100%;
    min-width: 100%;
  }
}

.ece-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}

.ece-error {
  font-size: 0.75rem;
  color: #dc2626;
}
</style>

