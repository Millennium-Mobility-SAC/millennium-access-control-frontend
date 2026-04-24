<script setup>
import { reactive, watch, onUnmounted, ref } from 'vue'
import CreateAndEdit        from '@/shared/presentation/components/create-and-edit.vue'
import { MOTIVOS_INGRESO, TIPOS_INGRESO, TIPOS_DOCUMENTO, TIPOS_SALIDA } from '../constants/access-control-ui.constants.js'
import { useVehicleCatalogStore } from '@/vehicle-catalog/application/vehicle-catalog.store.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])

const store           = useVehicleCatalogStore()
const plateMatched    = ref(false)
const showSaveVehicle = ref(false)
const savingVehicle   = ref(false)
const hasClient       = ref(false)

function pad(n) { return String(n).padStart(2, '0') }
function nowTimeString() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ── Live clock para Hora de Ingreso ──────────────────────────────────
let clockInterval = null

function startLiveClock() {
  clearInterval(clockInterval)
  clockInterval = setInterval(() => { form.entryTime = to12h(nowTimeString()) }, 1000)
}

function stopLiveClock() {
  clearInterval(clockInterval)
  clockInterval = null
}

// ── Live clock para Hora de Salida ──────────────────────────────────
let exitClockInterval = null

function startExitClock() {
  clearInterval(exitClockInterval)
  exitClockInterval = setInterval(() => { form.exitTime = to12h(nowTimeString()) }, 1000)
}

function stopExitClock() {
  clearInterval(exitClockInterval)
  exitClockInterval = null
}

onUnmounted(() => { stopLiveClock(); stopExitClock() })

// ── Form state ─────────────────────────────────────────────
const form = reactive({
  id:                   null,
  type:                 'VEHICULO',
  entryDate:            null,
  entryTime:            '',
  licensePlate:         null,
  vehicleId:            null,
  brand:                null,
  model:                null,
  year:                 null,
  color:                null,
  mileage:              null,
  clientDocumentNumber: '',
  documentType:         'DNI',
  firstName:            null,
  lastName:             null,
  entryReason:          null,
  exitTime:             '',
  exitDate:             null,
  exitType:             null,
  returnDate:           null,
  returnTime:           '',
})

watch(() => props.visible, (val) => {
  if (!val) { stopLiveClock(); stopExitClock(); return }

  const src = props.entity ?? {}
  const isNew = !src.id

  Object.assign(form, {
    id:                   src.id                   ?? null,
    type:                 src.type                 ?? 'VEHICULO',
    entryDate:            src.entryDate ? new Date(src.entryDate) : (isNew ? new Date() : null),
    entryTime:            src.entryTime ? to12h(src.entryTime) : (isNew ? to12h(nowTimeString()) : ''),
    licensePlate:         src.licensePlate          ?? null,
    vehicleId:            src.vehicleId             ?? null,
    brand:                src.brand                 ?? null,
    model:                src.model                 ?? null,
    year:                 src.year                  ?? null,
    color:                src.color                 ?? null,
    mileage:              src.mileage               ?? null,
    clientDocumentNumber: src.clientDocumentNumber  ?? '',
    documentType:         src.documentType          ?? 'DNI',
    firstName:            src.customerFirstName     ?? src.firstName ?? null,
    lastName:             src.customerLastName      ?? src.lastName  ?? null,
    entryReason:          src.entryReason           ?? null,
    exitDate:             src.exitDate   ? new Date(src.exitDate)  : (!isNew ? new Date() : null),
    exitTime:             src.exitTime   ? to12h(src.exitTime)   : (!isNew ? to12h(nowTimeString()) : ''),
    exitType:             src.exitType   ?? (!isNew ? 'PERMANENTE' : null),
    returnDate:           src.returnDate ? new Date(src.returnDate) : null,
    returnTime:           src.returnTime ? to12h(src.returnTime)   : '',
  })

  // Determina si hay datos de cliente precargados
  hasClient.value = !!(src.clientDocumentNumber || src.customerFirstName || src.firstName)

  clearErrors()

  if (isNew) startLiveClock()
  else stopLiveClock()

  if (!isNew && !src.exitTime) startExitClock()
  else stopExitClock()
})

// ── Búsqueda manual por placa ────────────────────────────────────────
async function searchByPlate() {
  plateMatched.value    = false
  showSaveVehicle.value = false
  if (!form.licensePlate) return
  const found = await store.fetchByLicensePlate(form.licensePlate)
  if (found) {
    form.vehicleId = found.id   ?? null
    form.brand = found.brand || form.brand
    form.model = found.model || form.model
    form.year  = found.year  ?? form.year
    form.color = found.color ?? form.color
    plateMatched.value = true
  } else {
    form.vehicleId    = null
    showSaveVehicle.value = true
  }
}

async function saveVehicle() {
  savingVehicle.value = true
  try {
    await store.create({
      licensePlate: form.licensePlate,
      brand:        form.brand,
      model:        form.model,
      year:         form.year,
      color:        form.color,
    })
    plateMatched.value    = true
    showSaveVehicle.value = false
  } finally {
    savingVehicle.value = false
  }
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

function fillReturnNow() {
  form.returnDate = new Date()
  form.returnTime = to12h(nowTimeString())
}

function onTypeChange(newType) {
  if (newType === 'PERSONA') {
    form.licensePlate = null
    form.brand        = null
    form.model        = null
    form.year         = null
    form.color        = null
    form.mileage      = null
  } else {
    form.firstName = null
    form.lastName  = null
    hasClient.value = false
  }
}

function onClientToggle(enabled) {
  if (!enabled) {
    form.clientDocumentNumber = ''
    form.documentType         = 'DNI'
    form.firstName            = null
    form.lastName             = null
  }
}

// ── Validación del formulario ─────────────────────────────────────────────────
const errors = reactive({
  licensePlate:         '',
  clientDocumentNumber: '',
  firstName:            '',
  lastName:             '',
  entryReason:          '',
})

function clearErrors() {
  errors.licensePlate         = ''
  errors.clientDocumentNumber = ''
  errors.firstName            = ''
  errors.lastName             = ''
  errors.entryReason          = ''
}

function validate() {
  clearErrors()
  let valid = true

  if (form.type === 'VEHICULO') {
    if (!form.licensePlate?.trim()) {
      errors.licensePlate = 'La placa es requerida'
      valid = false
    }
    if (hasClient.value) {
      if (!form.clientDocumentNumber?.trim()) {
        errors.clientDocumentNumber = 'El número de documento es requerido'
        valid = false
      }
      if (!form.firstName?.trim()) {
        errors.firstName = 'El nombre es requerido'
        valid = false
      }
      if (!form.lastName?.trim()) {
        errors.lastName = 'El apellido es requerido'
        valid = false
      }
    }
  } else {
    if (!form.clientDocumentNumber?.trim()) {
      errors.clientDocumentNumber = 'El número de documento es requerido'
      valid = false
    }
    if (!form.firstName?.trim()) {
      errors.firstName = 'El nombre es requerido'
      valid = false
    }
    if (!form.lastName?.trim()) {
      errors.lastName = 'El apellido es requerido'
      valid = false
    }
  }

  if (!form.entryReason) {
    errors.entryReason = 'El motivo de ingreso es requerido'
    valid = false
  }

  return valid
}

function onSave(formData) {
  if (!validate()) return
  emit('saved-shared', formData)
}
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Registro de Acceso"
    :edit="edit"
    size="standard"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSave($event)"
  >
    <template #content>
      <div class="ace-form">

        <!-- ── Tipo de entrada ── -->
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-sign-in ace-section-icon" />
            <span>Tipo de entrada</span>
          </div>
          <div class="ace-type-switcher">
            <button
              v-for="t in TIPOS_INGRESO"
              :key="t.value"
              class="ace-type-btn"
              :class="{ 'ace-type-btn--active': form.type === t.value }"
              type="button"
              @click="form.type = t.value; onTypeChange(t.value)"
            >
              <i :class="[t.icon, 'ace-type-btn__icon']" />
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- ══════════════════════════════════════
             VEHÍCULO
        ══════════════════════════════════════ -->
        <template v-if="form.type === 'VEHICULO'">

          <!-- 1. Vehículo -->
          <div class="ace-section">
            <div class="ace-section-header">
              <i class="pi pi-car ace-section-icon" />
              <span>Vehículo</span>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex ace-field--highlight">
                <label class="ace-label">
                  Placa
                  <span v-if="plateMatched" class="ace-plate-matched">
                    <i class="pi pi-check-circle" /> datos cargados
                  </span>
                </label>
                <div class="ace-plate-search">
                  <pv-input-text
                    v-model="form.licensePlate"
                    placeholder="Ej. ABC-123"
                    class="w-full ace-input-plate"
                    :invalid="!!errors.licensePlate"
                    @keyup.enter="searchByPlate"
                  />
                  <pv-button
                    icon="pi pi-search"
                    severity="secondary"
                    type="button"
                    @click="searchByPlate"
                  />
                </div>
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Marca</label>
                <pv-input-text v-model="form.brand" placeholder="Ej. Toyota" class="w-full" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Modelo</label>
                <pv-input-text v-model="form.model" placeholder="Ej. Corolla" class="w-full" />
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Año</label>
                <pv-input-number
                  v-model="form.year"
                  :use-grouping="false"
                  :min="1900"
                  :max="2100"
                  placeholder="2022"
                  class="w-full"
                />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Color</label>
                <pv-input-text v-model="form.color" placeholder="Ej. Blanco" class="w-full" />
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
               <label class="ace-label">Kilometraje <span class="ace-label-opt">(km)</span></label>
                <pv-input-number
                  v-model="form.mileage"
                  :use-grouping="true"
                  :min="0"
                  placeholder="Ej. 45000"
                  class="w-full"
                />
              </div>
            </div>
            <div v-if="showSaveVehicle" class="ace-save-vehicle">
              <span class="ace-save-vehicle__msg">
                <i class="pi pi-info-circle" /> Vehículo no encontrado. Completa los datos y guárdalo en el catálogo.
              </span>
              <pv-button
                label="Guardar en catálogo"
                icon="pi pi-save"
                severity="warning"
                size="small"
                type="button"
                :loading="savingVehicle"
                @click="saveVehicle"
              />
            </div>
          </div>

          <!-- 2. Cliente -->
          <div class="ace-section">
            <div class="ace-section-header">
              <i class="pi pi-id-card ace-section-icon" />
              <span>Cliente</span>
              <div class="ace-section-toggle">
                <span class="ace-toggle-label">{{ hasClient ? 'Con cliente' : 'Sin cliente' }}</span>
                <pv-input-switch
                  v-model="hasClient"
                  @update:model-value="onClientToggle"
                />
              </div>
            </div>
            <template v-if="hasClient">
              <div class="ace-row">
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Tipo doc.</label>
                  <pv-select
                    v-model="form.documentType"
                    :options="TIPOS_DOCUMENTO"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                </div>
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">N.º de documento</label>
                  <pv-input-text v-model="form.clientDocumentNumber" placeholder="Ej. 12345678" class="w-full" :invalid="!!errors.clientDocumentNumber" />
                  <small v-if="errors.clientDocumentNumber" class="ace-error">{{ errors.clientDocumentNumber }}</small>
                </div>
              </div>
              <div class="ace-row">
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Nombre</label>
                  <pv-input-text v-model="form.firstName" placeholder="Ej. Juan" class="w-full" :invalid="!!errors.firstName" />
                  <small v-if="errors.firstName" class="ace-error">{{ errors.firstName }}</small>
                </div>
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Apellido</label>
                  <pv-input-text v-model="form.lastName" placeholder="Ej. Pérez" class="w-full" :invalid="!!errors.lastName" />
                  <small v-if="errors.lastName" class="ace-error">{{ errors.lastName }}</small>
                </div>
              </div>
            </template>
            <p v-else class="ace-no-client">No se asociará ningún cliente a este ingreso.</p>
          </div>

          <!-- 3. Motivo -->
          <div class="ace-section">
            <div class="ace-section-header">
              <i class="pi pi-tag ace-section-icon" />
              <span>Motivo</span>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Motivo de ingreso</label>
                <pv-select v-model="form.entryReason" :options="MOTIVOS_INGRESO" option-label="label" option-value="value" placeholder="Selecciona" class="w-full" :invalid="!!errors.entryReason" />
                <small v-if="errors.entryReason" class="ace-error">{{ errors.entryReason }}</small>
              </div>
            </div>
          </div>

          <!-- 4. Registro -->
          <div class="ace-section ace-section--last">
            <div class="ace-section-header">
              <i class="pi pi-clock ace-section-icon" />
              <span>Registro</span>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Fecha Ingreso</label>
                <pv-calendar v-model="form.entryDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Hora Ingreso</label>
                <pv-input-mask v-model="form.entryTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
              </div>
            </div>
            <template v-if="edit">
              <div class="ace-row">
                <div class="ace-field ace-field--full">
                  <label class="ace-label">Tipo de salida</label>
                  <pv-select v-model="form.exitType" :options="TIPOS_SALIDA" option-label="label" option-value="value" placeholder="Selecciona" class="w-full" />
                </div>
              </div>
              <div class="ace-row">
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Fecha Salida</label>
                  <pv-calendar v-model="form.exitDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
                </div>
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Hora Salida</label>
                  <pv-input-mask v-model="form.exitTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
                </div>
              </div>
              <div v-if="form.exitType && form.exitType !== 'PERMANENTE'" class="ace-row">
                <div class="ace-field ace-field--full">
                  <pv-button
                    label="Registrar fecha y hora de retorno"
                    icon="pi pi-replay"
                    severity="secondary"
                    size="small"
                    type="button"
                    class="w-full"
                    @click="fillReturnNow"
                  />
                </div>
              </div>
              <div v-if="form.exitType && form.exitType !== 'PERMANENTE'" class="ace-row">
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Fecha Retorno</label>
                  <pv-calendar v-model="form.returnDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" />
                </div>
                <div class="ace-field ace-field--flex">
                  <label class="ace-label">Hora Retorno</label>
                  <pv-input-mask v-model="form.returnTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" />
                </div>
              </div>
            </template>
          </div>

        </template>

        <!-- ══════════════════════════════════════
             PERSONA
        ══════════════════════════════════════ -->
        <template v-else>

          <!-- 1. Persona -->
          <div class="ace-section">
            <div class="ace-section-header">
              <i class="pi pi-user ace-section-icon" />
              <span>Persona</span>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Tipo doc.</label>
                <pv-select
                  v-model="form.documentType"
                  :options="TIPOS_DOCUMENTO"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Número de documento</label>
                <pv-input-text v-model="form.clientDocumentNumber" placeholder="Ej. 12345678" class="w-full" :invalid="!!errors.clientDocumentNumber" />
                <small v-if="errors.clientDocumentNumber" class="ace-error">{{ errors.clientDocumentNumber }}</small>
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Nombre</label>
                <pv-input-text v-model="form.firstName" placeholder="Ej. Juan" class="w-full" :invalid="!!errors.firstName" />
                <small v-if="errors.firstName" class="ace-error">{{ errors.firstName }}</small>
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Apellido</label>
                <pv-input-text v-model="form.lastName" placeholder="Ej. Pérez" class="w-full" :invalid="!!errors.lastName" />
                <small v-if="errors.lastName" class="ace-error">{{ errors.lastName }}</small>
              </div>
            </div>
          </div>

          <!-- 2. Motivo -->
          <div class="ace-section">
            <div class="ace-section-header">
              <i class="pi pi-tag ace-section-icon" />
              <span>Motivo</span>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Motivo de ingreso</label>
                <pv-select v-model="form.entryReason" :options="MOTIVOS_INGRESO" option-label="label" option-value="value" placeholder="Selecciona" class="w-full" :invalid="!!errors.entryReason" />
                <small v-if="errors.entryReason" class="ace-error">{{ errors.entryReason }}</small>
              </div>
            </div>
          </div>

        </template>

        <!-- ── Registro (compartido, siempre montado) ── -->
        <div class="ace-section ace-section--last">
          <div class="ace-section-header">
            <i class="pi pi-clock ace-section-icon" />
            <span>Registro</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Fecha Ingreso</label>
              <pv-calendar v-model="form.entryDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Hora Ingreso</label>
              <pv-input-mask v-model="form.entryTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
            </div>
          </div>
          <template v-if="edit">
            <div class="ace-row">
              <div class="ace-field ace-field--full">
                <label class="ace-label">Tipo de salida</label>
                <pv-select v-model="form.exitType" :options="TIPOS_SALIDA" option-label="label" option-value="value" placeholder="Selecciona" class="w-full" />
              </div>
            </div>
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Fecha Salida</label>
                <pv-calendar v-model="form.exitDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Hora Salida</label>
                <pv-input-mask v-model="form.exitTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
              </div>
            </div>
            <div v-if="form.exitType && form.exitType !== 'PERMANENTE'" class="ace-row">
              <div class="ace-field ace-field--full">
                <pv-button
                  label="Registrar fecha y hora de retorno"
                  icon="pi pi-replay"
                  severity="secondary"
                  size="small"
                  type="button"
                  class="w-full"
                  @click="fillReturnNow"
                />
              </div>
            </div>
            <div v-if="form.exitType && form.exitType !== 'PERMANENTE'" class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Fecha Retorno</label>
                <pv-calendar v-model="form.returnDate" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Hora Retorno</label>
                <pv-input-mask v-model="form.returnTime" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" />
              </div>
            </div>
          </template>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>

<style>
/* ── Form layout ── */
.ace-form {
  display: flex;
  flex-direction: column;
}

/* ── Type switcher ── */
.ace-type-switcher {
  display: flex;
  gap: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.ace-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ace-type-btn + .ace-type-btn {
  border-left: 1px solid #e5e7eb;
}
.ace-type-btn--active {
  background: #1A6BC2;
  color: #ffffff;
}
.ace-type-btn:not(.ace-type-btn--active):hover {
  background: #f3f4f6;
  color: #374151;
}
.ace-type-btn__icon {
  font-size: 0.875rem;
}

/* ── Section ── */
.ace-section {
  padding: 0.75rem 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.ace-section--last {
  border-bottom: none;
  padding-bottom: 0.25rem;
}
.ace-section-header {
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
.ace-section-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  font-size: 0.72rem;
  color: #6b7280;
}
.ace-toggle-label {
  white-space: nowrap;
}
.ace-no-client {
  margin: 0;
  font-size: 0.78rem;
  color: #9ca3af;
  font-style: italic;
}
.ace-section-icon {
  font-size: 0.75rem;
  color: #1A6BC2;
}

/* ── Row ── */
.ace-row {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.ace-row:last-child { margin-bottom: 0; }

/* ── Field ── */
.ace-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ace-field--flex  { flex: 1 1 0; min-width: 120px; }
.ace-field--full  { width: 100%; margin-bottom: 0.75rem; }
.ace-field--half  { width: 50%; min-width: 180px; }

/* ── Plate input highlight ── */
.ace-plate-search {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  width: 100%;
}
.ace-plate-search .ace-input-plate { flex: 1; }

/* ── Time field with button ── */
.ace-time-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  width: 100%;
}
.ace-time-field > :first-child { flex: 1; }
.ace-time-hint {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-primary, #6366f1);
}

.ace-field--highlight .ace-input-plate input {
  font-size: 1rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

/* ── Plate autocomplete match indicator ── */
.ace-plate-matched {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: 0.4rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: #16a34a;
}
.ace-plate-matched .pi {
  font-size: 0.7rem;
}

/* ── Save vehicle banner ── */
.ace-save-vehicle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  margin-top: 0.25rem;
  border-radius: 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
}
.ace-save-vehicle__msg {
  font-size: 0.78rem;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

/* ── Label ── */
.ace-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.ace-label-opt {
  font-size: 0.72rem;
  font-weight: 400;
  color: #9ca3af;
}

/* ── Validation error messages ── */
.ace-error {
  display: block;
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: -0.1rem;
}

/* ── Responsive ── */
@media (max-width: 560px) {
  .ace-field--flex {
    flex: 1 1 100%;
    min-width: 100%;
  }
  .ace-field--half {
    width: 100%;
    min-width: 100%;
  }
  .ace-save-vehicle {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .ace-save-vehicle pv-button,
  .ace-save-vehicle .p-button {
    width: 100%;
  }
  .ace-type-btn {
    padding: 0.5rem 0.5rem;
    font-size: 0.8rem;
  }
}
</style>
