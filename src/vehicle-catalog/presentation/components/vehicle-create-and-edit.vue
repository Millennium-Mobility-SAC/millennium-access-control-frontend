<script setup>
import { reactive, watch, ref } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useFormRules } from '@/shared/composables/use-form-rules.js'
import { useFormValidation } from '@/shared/composables/use-form-validation.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
  submitLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])
const rules = useFormRules()
const vehicleFormRef = ref(null)
const { guardValidated } = useFormValidation()

const VALIDATION_FIELD_ORDER = ['vin', 'licensePlate', 'brand', 'model', 'year']

const form = reactive({
  id:           null,
  vin:          '',
  licensePlate: '',
  brand:        '',
  model:        '',
  year:         null,
  color:        '',
})

const errors = reactive({
  vin: '',
  licensePlate: '',
  brand: '',
  model: '',
  year: '',
})

watch(() => props.visible, (val) => {
  if (!val) return
  const src = props.entity ?? {}
  clearErrors()
  Object.assign(form, {
    id:           src.id           ?? null,
    vin:          src.vin          ?? '',
    licensePlate: src.licensePlate ?? '',
    brand:        src.brand        ?? '',
    model:        src.model        ?? '',
    year:         src.year         ?? null,
    color:        src.color        ?? '',
  })
})

function clearErrors() {
  errors.vin = ''
  errors.licensePlate = ''
  errors.brand = ''
  errors.model = ''
  errors.year = ''
}

/** Placa y VIN se guardan en su forma canónica, no solo se ven en mayúsculas. */
function normalizeIdentityField(field, event) {
  form[field] = (event?.target?.value ?? form[field] ?? '').toUpperCase()
}

function validate() {
  clearErrors()
  let valid = true
  // Identidad mínima: la unidad llega de fábrica con VIN y recibe la matrícula
  // después, así que ninguna de las dos es obligatoria por sí sola.
  const hasVin   = !rules.isBlank(form.vin)
  const hasPlate = !rules.isBlank(form.licensePlate)
  if (!hasVin && !hasPlate) {
    errors.vin = 'Ingresa el VIN o la placa. Se requiere al menos uno de los dos.'
    valid = false
  }
  if (hasVin && !rules.hasMaxLength(form.vin, 17)) {
    errors.vin = 'El VIN no debe superar 17 caracteres.'
    valid = false
  }
  if (hasPlate && !rules.isLicensePlate(form.licensePlate)) {
    errors.licensePlate = 'Ingresa una placa valida (5-10 caracteres, letras/numeros/guion).'
    valid = false
  }
  if (!rules.isBlank(form.brand) && !rules.hasMaxLength(form.brand, 50)) {
    errors.brand = 'La marca no debe superar 50 caracteres.'
    valid = false
  }
  if (!rules.isBlank(form.model) && !rules.hasMaxLength(form.model, 50)) {
    errors.model = 'El modelo no debe superar 50 caracteres.'
    valid = false
  }
  if (!rules.isYear(form.year)) {
    errors.year = 'Ingresa un anio valido entre 1900 y 2100.'
    valid = false
  }
  return valid
}

async function onSave(payload) {
  if (!await guardValidated(validate(), errors, {
    containerRef: vehicleFormRef,
    fieldOrder: VALIDATION_FIELD_ORDER,
  })) return
  emit('saved-shared', payload)
}
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Vehículo"
    :edit="edit"
    size="standard"
    :submit-loading="submitLoading"
    :submit-disabled="submitLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSave($event)"
  >
    <template #content>
      <div ref="vehicleFormRef" class="vce-form">

        <!-- Identificación -->
        <div class="vce-section">
          <div class="vce-section-header">
            <i class="pi pi-car vce-section-icon" />
            <span>Identificación</span>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex vce-field--highlight">
              <label class="vce-label">VIN</label>
              <pv-input-text
                v-model="form.vin"
                placeholder="Ej. 3N1CN7AD8KL845233"
                class="w-full vce-input-vin"
                maxlength="17"
                :invalid="!!errors.vin"
                @input="normalizeIdentityField('vin', $event)"
              />
              <small v-if="errors.vin" class="vce-error">{{ errors.vin }}</small>
            </div>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex vce-field--highlight">
              <label class="vce-label">
                Placa
                <span class="vce-label-opt">si aún no está matriculada, déjala vacía</span>
              </label>
              <pv-input-text
                v-model="form.licensePlate"
                placeholder="Ej. ABC-123"
                class="w-full vce-input-plate"
                :invalid="!!errors.licensePlate"
                @input="normalizeIdentityField('licensePlate', $event)"
              />
              <small v-if="errors.licensePlate" class="vce-error">{{ errors.licensePlate }}</small>
            </div>
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Color</label>
              <pv-input-text v-model="form.color" placeholder="Ej. Blanco" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Datos del vehículo -->
        <div class="vce-section">
          <div class="vce-section-header">
            <i class="pi pi-info-circle vce-section-icon" />
            <span>Datos del vehículo</span>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Marca</label>
              <pv-input-text v-model="form.brand" placeholder="Ej. Toyota" class="w-full" />
              <small v-if="errors.brand" class="vce-error">{{ errors.brand }}</small>
            </div>
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Modelo</label>
              <pv-input-text v-model="form.model" placeholder="Ej. Corolla" class="w-full" />
              <small v-if="errors.model" class="vce-error">{{ errors.model }}</small>
            </div>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Año</label>
              <pv-input-number
                v-model="form.year"
                :use-grouping="false"
                :min="1900"
                :max="2100"
                placeholder="2022"
                class="w-full"
                :invalid="!!errors.year"
              />
              <small v-if="errors.year" class="vce-error">{{ errors.year }}</small>
            </div>
          </div>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>

<style>
.vce-form { display: flex; flex-direction: column; }

.vce-section {
  padding: 0.75rem 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.vce-section:last-child { border-bottom: none; padding-bottom: 0.25rem; }

.vce-section-header {
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
.vce-section-icon { font-size: 0.75rem; color: #1A6BC2; }

.vce-row {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.vce-row:last-child { margin-bottom: 0; }

.vce-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.vce-field--flex { flex: 1; }

.vce-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
.vce-label-opt { font-weight: 400; color: #9ca3af; font-size: 0.75rem; margin-left: 0.25rem; }

.vce-input-plate { font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.vce-input-vin {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.vce-error { font-size: 0.75rem; color: #dc2626; }
</style>
