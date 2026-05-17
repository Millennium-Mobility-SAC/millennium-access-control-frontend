<script setup>
import { reactive, watch, onUnmounted, ref, computed, nextTick } from 'vue'
import CreateAndEdit        from '@/shared/presentation/components/create-and-edit.vue'
import StayImagePicker      from './stay-image-picker.vue'
import { MOTIVOS_INGRESO, TIPOS_INGRESO, TIPOS_DOCUMENTO } from '../constants/stays-ui.constants.js'
import { useVehicleCatalogStore } from '@/vehicle-catalog/application/vehicle-catalog.store.js'
import { useStaysStore }          from '@/stays/application/stays.store.js'
import { useNotification }        from '@/shared/composables/use-notification.js'
import { normalizeApiError }      from '@/shared/infrustructure/error-normalizer.js'
import { nowPeruTimeString, nowPeruDate } from '@/shared/domain/peru-time.js'
import { useStayAttachmentMedia } from '../composables/use-stay-attachment-media.js'

const {
  driveImgAttrs,
  getOpenUrl,
  getPreviewSrc,
  onAttachmentImageError,
} = useStayAttachmentMedia()

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
  submitLoading: { type: Boolean, default: false },
  existingAttachments: { type: Array, default: () => [] },
  canManageAttachments: { type: Boolean, default: false },
  deletingAttachmentId: { type: [Number, null], default: null },
})

const emit = defineEmits(['canceled-shared', 'saved-shared', 'remove-existing-attachment-requested'])

const store           = useVehicleCatalogStore()
const staysStore      = useStaysStore()
const { showError }   = useNotification()
const plateMatched    = ref(false)
const showSaveVehicle = ref(false)
const savingVehicle   = ref(false)
const hasClient       = ref(false)
const lastMileage     = ref(null)
const selectedPlateWrap = ref(null)
const plateSuggestionRows = ref([])
const plateSuggestLoading = ref(false)
let plateSuggestDebounceTimer = null

function pad(n) { return String(n).padStart(2, '0') }
function nowTimeString() {
  return nowPeruTimeString()
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

onUnmounted(() => {
  stopLiveClock()
  stopExitClock()
  clearTimeout(plateSuggestDebounceTimer)
})

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
  attachments:          [],
})

watch(() => props.visible, (val) => {
  if (!val) {
    stopLiveClock()
    stopExitClock()
    resetPlateLookup()
    return
  }

  const src = props.entity ?? {}
  const isNew = !src.id

  Object.assign(form, {
    id:                   src.id                   ?? null,
    type:                 src.type                 ?? 'VEHICULO',
    entryDate:            src.entryDate ? new Date(src.entryDate) : (isNew ? nowPeruDate() : null),
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
    exitDate:             src.exitDate   ? new Date(src.exitDate)  : (!isNew ? nowPeruDate() : null),
    exitTime:             src.exitTime   ? to12h(src.exitTime)   : (!isNew ? to12h(nowTimeString()) : ''),
    exitType:             src.exitType   ?? (!isNew ? 'PERMANENTE' : null),
    returnDate:           src.returnDate ? new Date(src.returnDate) : null,
    returnTime:           src.returnTime ? to12h(src.returnTime)   : '',
    attachments:          [],
  })

  // Determina si hay datos de cliente precargados
  hasClient.value = !!(src.clientDocumentNumber || src.customerFirstName || src.firstName)

  resetPlateLookup()
  if (form.type === 'VEHICULO' && form.licensePlate) {
    selectedPlateWrap.value = toPlateRow({
      id: form.vehicleId,
      licensePlate: form.licensePlate,
      brand: form.brand,
      model: form.model,
      year: form.year,
    })
    plateMatched.value = !!form.vehicleId
  }

  clearErrors()

  if (isNew) startLiveClock()
  else stopLiveClock()

  if (!isNew && !src.exitTime) startExitClock()
  else stopExitClock()
})

// ── Autocompletado de placa (mismo patrón que marcación de personal) ──
function formatPlateLine(vehicle) {
  if (!vehicle) return ''
  const plate = vehicle.licensePlate || ''
  const extra = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')
  return extra ? `${plate} — ${extra}` : plate
}

function toPlateRow(vehicle) {
  return { id: vehicle.id ?? vehicle.licensePlate, line: formatPlateLine(vehicle), raw: vehicle }
}

function resetPlateLookup() {
  clearTimeout(plateSuggestDebounceTimer)
  plateSuggestDebounceTimer = null
  selectedPlateWrap.value = null
  plateSuggestionRows.value = []
  plateMatched.value = false
  showSaveVehicle.value = false
  lastMileage.value = null
}

async function applyVehicleFromSelection(vehicle) {
  if (!vehicle) return
  plateMatched.value = false
  showSaveVehicle.value = false
  lastMileage.value = null
  form.licensePlate = vehicle.licensePlate ?? form.licensePlate
  form.vehicleId = vehicle.id ?? null
  form.brand = vehicle.brand || form.brand
  form.model = vehicle.model || form.model
  form.year = vehicle.year ?? form.year
  form.color = vehicle.color ?? form.color
  plateMatched.value = true
  if (vehicle.id) {
    const ctx = await staysStore.fetchVehicleContext(vehicle.id)
    lastMileage.value = ctx.lastMileage
    if (ctx.lastClient) {
      form.documentType = ctx.lastClient.documentType
      form.clientDocumentNumber = ctx.lastClient.clientDocumentNumber
      form.firstName = ctx.lastClient.firstName
      form.lastName = ctx.lastClient.lastName
      hasClient.value = true
    }
  }
}

async function loadPlateSuggestions(query) {
  const q = query.trim()
  plateSuggestLoading.value = true
  try {
    const list = await store.fetchVehicleSuggestions(q)
    const mapped = list.map(toPlateRow)
    const cur = selectedPlateWrap.value
    if (cur && !mapped.some(r => r.id === cur.id)) {
      mapped.unshift(cur)
    }
    plateSuggestionRows.value = mapped
    if (mapped.length === 0 && q.length >= 2) {
      form.licensePlate = q.toUpperCase()
      form.vehicleId = null
      showSaveVehicle.value = true
      plateMatched.value = false
    } else {
      showSaveVehicle.value = false
    }
  } catch (e) {
    plateSuggestionRows.value = []
    showError(normalizeApiError(e, 'No se pudieron cargar sugerencias de placa.'))
  } finally {
    plateSuggestLoading.value = false
  }
}

function onPlateComplete(event) {
  const q = (event.query ?? '').trim()
  clearTimeout(plateSuggestDebounceTimer)
  plateMatched.value = false
  showSaveVehicle.value = false
  if (q.length < 2) {
    plateSuggestionRows.value = []
    return
  }
  plateSuggestDebounceTimer = setTimeout(() => loadPlateSuggestions(q), 280)
}

watch(
  () => selectedPlateWrap.value?.raw,
  async (vehicle) => {
    if (!props.visible || form.type !== 'VEHICULO') return
    if (!vehicle) {
      form.vehicleId = null
      plateMatched.value = false
      lastMileage.value = null
      showSaveVehicle.value = false
      return
    }
    await applyVehicleFromSelection(vehicle)
  },
)

async function saveVehicle() {
  if (!form.licensePlate?.trim()) return
  savingVehicle.value = true
  try {
    const created = await store.create({
      licensePlate: form.licensePlate,
      brand:        form.brand,
      model:        form.model,
      year:         form.year,
      color:        form.color,
    })
    if (created) {
      selectedPlateWrap.value = toPlateRow(created)
      await applyVehicleFromSelection(created)
    } else {
      plateMatched.value = true
      showSaveVehicle.value = false
    }
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

function onTypeChange(newType) {
  if (newType === 'PERSONA') {
    resetPlateLookup()
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

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

const sourceEntity = computed(() => props.entity ?? {})

const temporalExits = computed(() =>
  Array.isArray(sourceEntity.value.temporalExits) ? sourceEntity.value.temporalExits : [],
)

const latestTemporalExit = computed(() => temporalExits.value[temporalExits.value.length - 1] ?? null)

const hasPermanentExitData = computed(() =>
  hasValue(sourceEntity.value.permanentExitDate) || hasValue(sourceEntity.value.permanentExitTime),
)

const hasTemporalExitData = computed(() =>
  temporalExits.value.some(exit => hasValue(exit?.exitDate) || hasValue(exit?.exitTime)),
)

const hasAnyExitData = computed(() => hasPermanentExitData.value || hasTemporalExitData.value)

const hasReturnData = computed(() =>
  temporalExits.value.some(exit => hasValue(exit?.returnDate) || hasValue(exit?.returnTime)),
)

const visibleStageRank = computed(() => {
  if (hasReturnData.value) return 3
  if (hasAnyExitData.value) return 2
  return 1
})

const OPERATION_RANK = {
  ENTRY: 1,
  TEMPORAL_EXIT: 2,
  PERMANENT_EXIT: 2,
  RETURN: 3,
}

const OPERATION_LABEL = {
  ENTRY: 'Ingreso',
  TEMPORAL_EXIT: 'Salida temporal',
  PERMANENT_EXIT: 'Salida permanente',
  RETURN: 'Retorno',
}

const filteredExistingAttachments = computed(() => {
  if (!props.edit) return []
  return props.existingAttachments.filter((attachment) => {
    const operation =
      attachment?.stay_operation_type ??
      attachment?.stayOperationType ??
      null
    const rank = operation ? (OPERATION_RANK[operation] ?? 1) : 1
    return rank <= visibleStageRank.value
  })
})

const groupedExistingAttachmentSections = computed(() => {
  const byOperation = filteredExistingAttachments.value.reduce((acc, attachment) => {
    const operation = attachment?.stay_operation_type ?? attachment?.stayOperationType ?? 'ENTRY'
    if (!acc[operation]) acc[operation] = []
    acc[operation].push(attachment)
    return acc
  }, {})

  const sections = [
    { key: 'ENTRY', title: OPERATION_LABEL.ENTRY, items: byOperation.ENTRY ?? [], initiallyOpen: true },
    {
      key: 'EXIT',
      title: 'Salida',
      items: [...(byOperation.TEMPORAL_EXIT ?? []), ...(byOperation.PERMANENT_EXIT ?? [])],
      initiallyOpen: true,
    },
    { key: 'RETURN', title: OPERATION_LABEL.RETURN, items: byOperation.RETURN ?? [], initiallyOpen: true },
  ]

  return sections.filter(section => section.items.length > 0)
})

const openSections = ref({
  ENTRY: true,
  EXIT: true,
  RETURN: true,
})
const confirmRemoveVisible = ref(false)
const pendingRemoveAttachment = ref(null)

watch(groupedExistingAttachmentSections, (sections) => {
  const keys = sections.map(section => section.key)
  const latestKey = keys.includes('RETURN')
    ? 'RETURN'
    : keys.includes('EXIT')
      ? 'EXIT'
      : keys.includes('ENTRY')
        ? 'ENTRY'
        : null

  openSections.value = {
    ENTRY: latestKey === 'ENTRY',
    EXIT: latestKey === 'EXIT',
    RETURN: latestKey === 'RETURN',
  }
}, { immediate: true })

function toggleSection(sectionKey) {
  openSections.value[sectionKey] = !openSections.value[sectionKey]
}

function requestRemoveExistingAttachment(attachment) {
  pendingRemoveAttachment.value = attachment
  confirmRemoveVisible.value = true
}

function cancelRemoveExistingAttachment() {
  confirmRemoveVisible.value = false
  pendingRemoveAttachment.value = null
}

function confirmRemoveExistingAttachment() {
  if (!pendingRemoveAttachment.value) return
  emit('remove-existing-attachment-requested', pendingRemoveAttachment.value)
  cancelRemoveExistingAttachment()
}

const exitDateValue = computed(() => {
  if (hasPermanentExitData.value) return sourceEntity.value.permanentExitDate ?? null
  return latestTemporalExit.value?.exitDate ?? null
})

const exitTimeValue = computed(() => {
  if (hasPermanentExitData.value) return to12h(sourceEntity.value.permanentExitTime)
  return to12h(latestTemporalExit.value?.exitTime)
})

const returnDateValue = computed(() => {
  if (!hasReturnData.value) return null
  const exitsWithReturn = temporalExits.value.filter(exit => hasValue(exit?.returnDate) || hasValue(exit?.returnTime))
  return exitsWithReturn[exitsWithReturn.length - 1]?.returnDate ?? null
})

const returnTimeValue = computed(() => {
  if (!hasReturnData.value) return ''
  const exitsWithReturn = temporalExits.value.filter(exit => hasValue(exit?.returnDate) || hasValue(exit?.returnTime))
  return to12h(exitsWithReturn[exitsWithReturn.length - 1]?.returnTime)
})

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
  mileage:              '',
})

function clearErrors() {
  errors.licensePlate         = ''
  errors.clientDocumentNumber = ''
  errors.firstName            = ''
  errors.lastName             = ''
  errors.entryReason          = ''
  errors.mileage              = ''
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

  if (form.type === 'VEHICULO' && form.mileage != null && lastMileage.value != null) {
    if (form.mileage <= lastMileage.value) {
      errors.mileage = `El kilometraje debe ser mayor al último registrado (${lastMileage.value.toLocaleString()} km)`
      valid = false
    }
  }

  return valid
}

function onSave(formData) {
  if (!validate()) {
    nextTick(() => {
      const el = aceForm.value?.querySelector('.p-invalid, [aria-invalid="true"]')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const focusable = el.matches('input,select,textarea,button,[tabindex]') ? el : el.querySelector('input,select,textarea,button,[tabindex]')
        focusable?.focus()
      }
    })
    return
  }
  emit('saved-shared', formData)
}

const aceForm = ref(null)

</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Registro de Acceso"
    :edit="edit"
    size="standard"
    :submit-loading="submitLoading"
    :submit-disabled="submitLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSave($event)"
  >
    <template #content>
      <div ref="aceForm" class="ace-form">

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
                <pv-auto-complete
                  id="ace-plate-ac"
                  v-model="selectedPlateWrap"
                  :suggestions="plateSuggestionRows"
                  option-label="line"
                  data-key="id"
                  :min-length="2"
                  :delay="280"
                  :force-selection="true"
                  :loading="plateSuggestLoading"
                  :show-clear="true"
                  placeholder="Escriba placa, marca o modelo (mín. 2 caracteres)…"
                  class="w-full ace-input-plate"
                  :invalid="!!errors.licensePlate"
                  fluid
                  @complete="onPlateComplete"
                />
                <small v-if="!plateMatched && !showSaveVehicle" class="ace-field-hint">
                  Escriba y elija una coincidencia de la lista.
                </small>
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
                  :invalid="!!errors.mileage"
                />
                <small v-if="lastMileage != null && !errors.mileage" class="ace-field-hint">
                  Último registrado: {{ lastMileage.toLocaleString() }} km
                </small>
                <small v-if="errors.mileage" class="ace-field-error">
                  {{ errors.mileage }}
                </small>
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
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-images ace-section-icon" />
            <span>Evidencias (opcional)</span>
          </div>
          <div v-if="edit && groupedExistingAttachmentSections.length" class="ace-existing-attachments">
            <div class="ace-existing-attachments__title">Evidencias registradas</div>
            <div class="ace-existing-attachments__sections">
              <section
                v-for="section in groupedExistingAttachmentSections"
                :key="section.key"
                class="ace-existing-attachments__section"
              >
                <button
                  type="button"
                  class="ace-existing-attachments__section-toggle"
                  @click="toggleSection(section.key)"
                >
                  <span class="ace-existing-attachments__section-title">{{ section.title }}</span>
                  <span class="ace-existing-attachments__section-meta">
                    {{ section.items.length }}
                    <i class="pi" :class="openSections[section.key] ? 'pi-chevron-up' : 'pi-chevron-down'" />
                  </span>
                </button>
                <div v-if="openSections[section.key]" class="ace-existing-attachments__grid">
                  <div
                    v-for="attachment in section.items"
                    :key="attachment.id"
                    class="ace-existing-attachment"
                  >
                    <a :href="getOpenUrl(attachment)" target="_blank" rel="noopener noreferrer">
                      <img
                        v-bind="driveImgAttrs"
                        :src="getPreviewSrc(attachment, 'w1200')"
                        :alt="attachment.file_name ?? attachment.fileName"
                        @error="onAttachmentImageError"
                      >
                    </a>
                    <button
                      v-if="canManageAttachments"
                      type="button"
                      class="ace-existing-attachment__remove"
                      :disabled="deletingAttachmentId === attachment.id"
                      @click="requestRemoveExistingAttachment(attachment)"
                    >
                      {{ deletingAttachmentId === attachment.id ? '...' : '×' }}
                    </button>
                    <span class="ace-existing-attachment__label">
                      {{ attachment.file_name ?? attachment.fileName }}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--full">
              <StayImagePicker
                v-model="form.attachments"
                label="Imágenes del ingreso"
                hint="Desde celular podrás abrir la cámara o elegir fotos guardadas."
              />
            </div>
          </div>
        </div>

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
          <template v-if="edit && hasAnyExitData">
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Fecha Salida</label>
                <pv-calendar :model-value="exitDateValue ? new Date(exitDateValue) : null" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Hora Salida</label>
                <pv-input-mask :model-value="exitTimeValue" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
              </div>
            </div>
          </template>
          <template v-if="edit && hasReturnData">
            <div class="ace-row">
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Fecha Retorno</label>
                <pv-calendar :model-value="returnDateValue ? new Date(returnDateValue) : null" date-format="dd/mm/yy" show-icon icon-display="input" placeholder="dd/mm/aaaa" class="w-full" :disabled="true" />
              </div>
              <div class="ace-field ace-field--flex">
                <label class="ace-label">Hora Retorno</label>
                <pv-input-mask :model-value="returnTimeValue" mask="99:99:99 aa" placeholder="00:00:00 AM" class="w-full" :disabled="true" />
              </div>
            </div>
          </template>
        </div>

      </div>
    </template>
  </CreateAndEdit>

  <pv-dialog
    v-model:visible="confirmRemoveVisible"
    modal
    header="Confirmar eliminación"
    :style="{ width: 'min(420px, 92vw)' }"
  >
    <p style="margin: 0; color: #374151;">
      ¿Deseas eliminar la evidencia
      <strong>{{ pendingRemoveAttachment?.file_name ?? pendingRemoveAttachment?.fileName ?? '' }}</strong>?
      Esta acción no se puede deshacer.
    </p>
    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <pv-button label="Cancelar" severity="secondary" text @click="cancelRemoveExistingAttachment" />
      <pv-button label="Eliminar" severity="danger" @click="confirmRemoveExistingAttachment" />
    </div>
  </pv-dialog>
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
.ace-field-error {
  display: block;
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: 0.15rem;
}
.ace-field-hint {
  display: block;
  font-size: 0.72rem;
  color: #6b7280;
  margin-top: 0.15rem;
}

.ace-existing-attachments {
  margin-bottom: 0.75rem;
}

.ace-existing-attachments__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 0.45rem;
}

.ace-existing-attachments__sections {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ace-existing-attachments__section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
  background: #f9fafb;
}

.ace-existing-attachments__section-toggle {
  width: 100%;
  border: none;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin-bottom: 0.45rem;
}

.ace-existing-attachments__section-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #1e40af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ace-existing-attachments__section-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #334155;
}

.ace-existing-attachments__section-meta .pi {
  font-size: 0.68rem;
}

.ace-existing-attachments__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 0.5rem;
}

.ace-existing-attachment {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  color: inherit;
}

.ace-existing-attachment a {
  text-decoration: none;
}

.ace-existing-attachment img {
  width: 100%;
  height: 84px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
}

.ace-existing-attachment__remove {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 1.35rem;
  height: 1.35rem;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.75);
  color: #ffffff;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.ace-existing-attachment__label {
  font-size: 0.7rem;
  font-weight: 500;
  color: #334155;
  line-height: 1.2;
  word-break: break-word;
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
