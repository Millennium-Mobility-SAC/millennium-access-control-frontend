<script setup>
import { reactive, watch, onUnmounted, ref } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import StayImagePicker from './stay-image-picker.vue'
import { TIPOS_SALIDA, MOTIVOS_SALIDA_TEMPORAL, TIPOS_DOCUMENTO } from '../constants/stays-ui.constants.js'
import { nowPeruTimeString, nowPeruDate } from '@/shared/domain/peru-time.js'
import { useFormValidation } from '@/shared/composables/use-form-validation.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
  submitLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['canceled', 'saved'])
const exitFormRef = ref(null)
const { guardValidated } = useFormValidation()

const VALIDATION_FIELD_ORDER = [
  'customerDni',
  'customerFirstName',
  'customerLastName',
  'temporaryExitReason',
  'replacementLicensePlate',
  'attachments',
]

// ── Helpers ────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }

function nowTimeString() {
  return nowPeruTimeString()
}

function to12h(value) {
  if (!value) return ''
  const parts = value.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  const s = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(m)) return ''
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h % 12 === 0 ? 12 : h % 12
  const base   = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return s !== null && !isNaN(s)
    ? `${base}:${String(s).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

// ── Live clock ─────────────────────────────────────────────
let clockInterval = null

function startClock() {
  clearInterval(clockInterval)
  clockInterval = setInterval(() => { form.exitTime = to12h(nowTimeString()) }, 1000)
}

function stopClock() {
  clearInterval(clockInterval)
  clockInterval = null
}

onUnmounted(() => stopClock())

// ── Form state ─────────────────────────────────────────────
const form = reactive({
  id:                      null,
  type:                    'VEHICULO',
  vin:                     null,
  licensePlate:            null,
  brand:                   null,
  model:                   null,
  year:                    null,
  color:                   null,
  exitType:                'PERMANENTE',
  exitDate:                null,
  exitTime:                '',
  temporaryExitReason:     null,
  replacementLicensePlate: null,
  includeCustomer:         false,
  customerDocumentType:    'DNI',
  customerDni:             null,
  customerFirstName:       null,
  customerLastName:        null,
  attachments:             [],
})

watch(() => props.visible, (val) => {
  if (!val) { stopClock(); return }

  const src = props.entity ?? {}

  Object.assign(form, {
    id:                      src.id           ?? null,
    type:                    src.type         ?? 'VEHICULO',
    vin:                     src.vin ?? null,
    licensePlate:            src.licensePlate ?? null,
    brand:                   src.brand        ?? null,
    model:                   src.model        ?? null,
    year:                    src.year         ?? null,
    color:                   src.color        ?? null,
    exitType:                'PERMANENTE',
    exitDate:                nowPeruDate(),
    exitTime:                to12h(nowTimeString()),
    temporaryExitReason:     null,
    replacementLicensePlate: null,
    includeCustomer:         false,
    customerDocumentType:    src.type === 'PERSONA' ? (src.documentType        ?? 'DNI')  : 'DNI',
    customerDni:             src.type === 'PERSONA' ? (src.clientDocumentNumber ?? null)   : null,
    customerFirstName:       src.type === 'PERSONA' ? (src.firstName            ?? null)   : null,
    customerLastName:        src.type === 'PERSONA' ? (src.lastName             ?? null)   : null,
    attachments:             [],
  })

  clearErrors()
  startClock()
})

function onExitTypeChange() {
  if (form.exitType !== 'TEMPORAL') {
    form.temporaryExitReason     = null
    form.replacementLicensePlate = null
    form.includeCustomer         = false
    form.customerDocumentType    = 'DNI'
    form.customerDni             = null
    form.customerFirstName       = null
    form.customerLastName        = null
  }
}

function onReasonChange() {
  if (form.temporaryExitReason !== 'PRESTAMO') {
    form.replacementLicensePlate = null
  }
}

function onCustomerToggle(enabled) {
  if (!enabled) {
    form.customerDocumentType = 'DNI'
    form.customerDni          = null
    form.customerFirstName    = null
    form.customerLastName     = null
  }
}

function onCanceled() {
  stopClock()
  emit('canceled')
}

// ── Validación del formulario ─────────────────────────────────────────────────
const errors = reactive({
  temporaryExitReason:     '',
  replacementLicensePlate: '',
  customerDni:             '',
  customerFirstName:       '',
  customerLastName:        '',
  attachments:             '',
})

function clearErrors() {
  errors.temporaryExitReason     = ''
  errors.replacementLicensePlate = ''
  errors.customerDni             = ''
  errors.customerFirstName       = ''
  errors.customerLastName        = ''
  errors.attachments             = ''
}

function validate() {
  clearErrors()
  let valid = true

  if (form.exitType === 'PERMANENTE' && form.type !== 'PERSONA') {
    if (!form.customerDni?.trim()) {
      errors.customerDni = 'El número de documento es requerido'
      valid = false
    }
    if (!form.customerFirstName?.trim()) {
      errors.customerFirstName = 'El nombre es requerido'
      valid = false
    }
    if (!form.customerLastName?.trim()) {
      errors.customerLastName = 'El apellido es requerido'
      valid = false
    }
  }

  if (form.exitType === 'TEMPORAL') {
    if (!form.temporaryExitReason) {
      errors.temporaryExitReason = 'El motivo es requerido'
      valid = false
    }
    if (form.temporaryExitReason === 'PRESTAMO' && !form.replacementLicensePlate?.trim()) {
      errors.replacementLicensePlate = 'La placa del vehículo de reemplazo es requerida'
      valid = false
    }
  }

  if (form.type === 'VEHICULO' && form.attachments.length === 0) {
    errors.attachments = 'Debes adjuntar al menos una foto de la unidad.'
    valid = false
  }

  return valid
}

async function onSaved(formData) {
  if (!await guardValidated(validate(), errors, {
    containerRef: exitFormRef,
    fieldOrder: VALIDATION_FIELD_ORDER,
    fieldSelectors: { attachments: '.sip__dropzone--invalid' },
  })) return
  stopClock()
  emit('saved', { ...formData })
}

</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Registro de Salida"
    :edit="false"
    size="standard"
    custom-button-label="Registrar salida"
    :submit-loading="submitLoading"
    :submit-disabled="submitLoading"
    @canceled-shared="onCanceled"
    @saved-shared="onSaved($event)"
  >
    <template #content>
      <div ref="exitFormRef" class="ace-form">

        <!-- ── 1. Tipo de salida ── -->
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-sign-out ace-section-icon" />
            <span>Tipo de salida</span>
          </div>
          <div class="ace-row">
            <div class="ace-type-switcher" style="width: 100%;">
              <button
                v-for="t in TIPOS_SALIDA"
                :key="t.value"
                type="button"
                class="ace-type-btn"
                :class="{ 'ace-type-btn--active': form.exitType === t.value }"
                @click="form.exitType = t.value; onExitTypeChange()"
              >
                <i :class="t.value === 'PERMANENTE' ? 'pi pi-sign-out' : 'pi pi-clock'" />
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── 2. Vehículo (informativo, read-only) ── -->
        <div v-if="form.type !== 'PERSONA'" class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-car ace-section-icon" />
            <span>Vehículo</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Placa</label>
              <pv-input-text :model-value="form.licensePlate || (form.vin ? 'VIN ' + form.vin : '—')" class="w-full" :disabled="true" />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Color</label>
              <pv-input-text :model-value="form.color || '—'" class="w-full" :disabled="true" />
            </div>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Marca</label>
              <pv-input-text :model-value="form.brand || '—'" class="w-full" :disabled="true" />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Modelo</label>
              <pv-input-text :model-value="form.model || '—'" class="w-full" :disabled="true" />
            </div>
          </div>
        </div>

        <!-- ── 3. Campos solo para PERMANENTE ── -->
        <template v-if="form.exitType === 'PERMANENTE'">

          <!-- 4a. Cliente (obligatorio) -->
          <div class="ace-section" style="border-bottom: none;">
            <div class="ace-section-header">
              <i class="pi pi-id-card ace-section-icon" />
              <span>Cliente</span>
            </div>

            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Tipo doc.</label>
                <pv-select
                  v-model="form.customerDocumentType"
                  :options="TIPOS_DOCUMENTO"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                  :disabled="form.type === 'PERSONA'"
                />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">N.º de documento</label>
                <pv-input-text v-model="form.customerDni" data-field="customerDni" placeholder="Ej. 12345678" class="w-full" :disabled="form.type === 'PERSONA'" :invalid="!!errors.customerDni" />
                <small v-if="errors.customerDni" class="ace-error">{{ errors.customerDni }}</small>
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Nombre</label>
                <pv-input-text v-model="form.customerFirstName" data-field="customerFirstName" placeholder="Ej. Juan" class="w-full" :disabled="form.type === 'PERSONA'" :invalid="!!errors.customerFirstName" />
                <small v-if="errors.customerFirstName" class="ace-error">{{ errors.customerFirstName }}</small>
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Apellido</label>
                <pv-input-text v-model="form.customerLastName" data-field="customerLastName" placeholder="Ej. Pérez" class="w-full" :disabled="form.type === 'PERSONA'" :invalid="!!errors.customerLastName" />
                <small v-if="errors.customerLastName" class="ace-error">{{ errors.customerLastName }}</small>
              </div>
            </div>
          </div>

        </template>

        <!-- ── 4. Campos solo para TEMPORAL ── -->
        <template v-if="form.exitType === 'TEMPORAL'">

          <!-- 5a. Motivo y placa de reemplazo (solo PRESTAMO) -->
          <div class="ace-section" style="border-bottom: none;">
            <div class="ace-section-header">
              <i class="pi pi-info-circle ace-section-icon" />
              <span>Datos de salida temporal</span>
            </div>

            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Motivo</label>
                <pv-select
                  v-model="form.temporaryExitReason"
                  data-field="temporaryExitReason"
                  :options="MOTIVOS_SALIDA_TEMPORAL"
                  option-label="label"
                  option-value="value"
                  placeholder="Selecciona un motivo"
                  class="w-full"
                  :invalid="!!errors.temporaryExitReason"
                  @change="onReasonChange"
                />
                <small v-if="errors.temporaryExitReason" class="ace-error">{{ errors.temporaryExitReason }}</small>
              </div>
            </div>

            <div v-if="form.temporaryExitReason === 'PRESTAMO'" class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Placa vehículo reemplazo</label>
                <pv-input-text
                  v-model="form.replacementLicensePlate"
                  data-field="replacementLicensePlate"
                  placeholder="Ej. XYZ-456"
                  class="w-full"
                  style="text-transform: uppercase"
                  :invalid="!!errors.replacementLicensePlate"
                />
                <small v-if="errors.replacementLicensePlate" class="ace-error">{{ errors.replacementLicensePlate }}</small>
              </div>
            </div>
          </div>

        </template>

        <!-- ── 5. Fecha y hora de salida ── -->
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-images ace-section-icon" />
            <span>{{ form.type === 'VEHICULO' ? 'Evidencias fotográficas obligatorias' : 'Evidencias (opcional)' }}</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--full">
              <StayImagePicker
                v-model="form.attachments"
                label="Imágenes de salida"
                hint="Ideal para evidencias rápidas desde la cámara del celular."
                :required="form.type === 'VEHICULO'"
                :error="errors.attachments"
              />
            </div>
          </div>
        </div>

        <!-- ── 5. Fecha y hora de salida ── -->
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-calendar ace-section-icon" />
            <span>Fecha y hora de salida</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Fecha</label>
              <pv-calendar
                v-model="form.exitDate"
                date-format="dd/mm/yy"
                show-icon
                icon-display="input"
                placeholder="dd/mm/aaaa"
                class="w-full"
                :disabled="true"
              />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Hora</label>
              <pv-input-mask
                v-model="form.exitTime"
                mask="99:99:99 aa"
                placeholder="00:00:00 AM"
                class="w-full"
                :disabled="true"
              />
            </div>
          </div>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>