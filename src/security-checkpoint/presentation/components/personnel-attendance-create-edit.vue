<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { normalizeApiError } from '@/shared/infrustructure/error-normalizer.js'
import { useSecurityCheckpointStore } from '../../application/security-checkpoint.store.js'
import { DOCUMENT_TYPES } from '@/employee-management/presentation/constants/employee-management-ui.constants.js'
import { toIsoDateString } from '@/shared/domain/employee-attendance-day.js'
import {
  formatCalendarDateForUi,
  formatLocalCalendarDateForUi,
  formatTimeOfDayForUi,
} from '@/shared/domain/format-datetime-ui.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  /** `create`: flujo ingreso/salida del día. `edit`: corregir un registro del historial (admin). */
  mode: {
    type: String,
    default: 'create',
    validator: v => v === 'create' || v === 'edit',
  },
  /** Fila del listado (AttendanceRecord) cuando `mode === 'edit'`. */
  recordToEdit: { type: Object, default: null },
  submitLoading: { type: Boolean, default: false },
  initialLookup: { type: String, default: '' },
  /** @deprecated use initialLookup */
  initialDocumentNumber: { type: String, default: '' },
})

const emit = defineEmits(['canceled-shared'])

const store = useSecurityCheckpointStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const formEntity = ref({})
/** Fila elegida en el autocompletado: texto + empleado */
const selectedWrap = ref(null)
/** Lista para el panel (misma referencia que puede asignar v-model) */
const suggestionRows = ref([])
const suggestLoading = ref(false)
const nowClock = ref(new Date())
let clockTimer = null
let suggestDebounceTimer = null

const entityName = 'registro de asistencia'

const isEditMode = computed(() => props.mode === 'edit' && props.recordToEdit != null)

const employee = computed(() => selectedWrap.value?.raw ?? null)

/** Copia estable del registro al abrir el diálogo (ids para PUT). */
const editTarget = ref(null)
const editFormDate = ref(null)
/** Fecha ancla local (2000-01-01) + hora del API; mismo control horario que el registro de asistencia (12 h + segundos). */
const editFormCheckInAt = ref(new Date(2000, 0, 1, 0, 0, 0))
const editFormCheckOutAt = ref(null)
const editFormNoCheckout = ref(false)
/** Copia de hora de salida al activar «sin salida». */
const editStashedCheckOutAt = ref(null)

/** Opciones para edición rápida (12 h + min + AM/PM; segundos del registro original). */
const EDIT_TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: i + 1,
}))
const EDIT_TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i,
}))
const EDIT_TIME_AMPM_OPTIONS = [
  { label: 'AM', value: false },
  { label: 'PM', value: true },
]

const editInH12 = ref(12)
const editInMin = ref(0)
const editInPm = ref(false)
/** Segundos del check-in original (no editables). */
const editInheritedCheckInSec = ref(0)
const editOutH12 = ref(12)
const editOutMin = ref(0)
const editOutPm = ref(false)
/** Segundos del check-out original (no editables). */
const editInheritedCheckOutSec = ref(0)

function dateTo12hParts(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return { h12: 12, m: 0, s: 0, pm: false }
  }
  const h24 = d.getHours()
  const pm = h24 >= 12
  const hMod = h24 % 12
  const h12 = hMod === 0 ? 12 : hMod
  return { h12, m: d.getMinutes(), s: d.getSeconds(), pm }
}

function partsToAnchorDate(h12, min, sec, pm) {
  let h24
  if (pm) {
    h24 = h12 === 12 ? 12 : h12 + 12
  } else {
    h24 = h12 === 12 ? 0 : h12
  }
  return new Date(2000, 0, 1, h24, min, sec)
}

function applyPartsToCheckInAt() {
  editFormCheckInAt.value = partsToAnchorDate(
    editInH12.value,
    editInMin.value,
    editInheritedCheckInSec.value,
    editInPm.value,
  )
}

function applyPartsToCheckOutAt() {
  editFormCheckOutAt.value = partsToAnchorDate(
    editOutH12.value,
    editOutMin.value,
    editInheritedCheckOutSec.value,
    editOutPm.value,
  )
}

function syncInPartsFromDate() {
  const p = dateTo12hParts(editFormCheckInAt.value)
  editInH12.value = p.h12
  editInMin.value = p.m
  editInPm.value = p.pm
}

function syncOutPartsFromDate() {
  const d = editFormCheckOutAt.value
  if (!d || Number.isNaN(d.getTime())) return
  const p = dateTo12hParts(d)
  editOutH12.value = p.h12
  editOutMin.value = p.m
  editOutPm.value = p.pm
}

/** Convierte hora API (`HH:mm` / `HH:mm:ss`) a `Date` anclado al 2000-01-01 (hora local). */
function apiTimeToEditDate(timeVal) {
  if (timeVal == null || timeVal === '') return new Date(2000, 0, 1, 0, 0, 0)
  let s = String(timeVal).trim()
  if (s.length === 5 && s[2] === ':') s = `${s}:00`
  const parts = s.split(':').map(Number)
  const hh = parts[0]
  const mm = parts[1]
  const ss = parts[2] ?? 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
    return new Date(2000, 0, 1, 0, 0, 0)
  }
  return new Date(2000, 0, 1, hh, mm, ss)
}

/** `HH:mm:ss` para el PUT a partir del `Date` del timepicker. */
function editDateToApiTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const h = d.getHours()
  const m = d.getMinutes()
  const sec = d.getSeconds()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function attendanceRecordDayIso(row) {
  const v = row?.attendanceDate
  if (v == null || v === '') return null
  return String(v).trim().slice(0, 10)
}

function clearEditForm() {
  editTarget.value = null
  editFormDate.value = null
  editFormCheckInAt.value = new Date(2000, 0, 1, 0, 0, 0)
  editFormCheckOutAt.value = null
  editFormNoCheckout.value = false
  editStashedCheckOutAt.value = null
  editInH12.value = 12
  editInMin.value = 0
  editInPm.value = false
  editInheritedCheckInSec.value = 0
  editOutH12.value = 12
  editOutMin.value = 0
  editOutPm.value = false
  editInheritedCheckOutSec.value = 0
}

function initEditFromRecord(row) {
  if (!row?.id || row.employeeId == null) {
    clearEditForm()
    return
  }
  editTarget.value = { id: row.id, employeeId: row.employeeId }
  const iso = attendanceRecordDayIso(row)
  editFormDate.value = iso ? new Date(`${iso}T12:00:00`) : null
  editFormCheckInAt.value = apiTimeToEditDate(row.checkInTime)
  editInheritedCheckInSec.value = editFormCheckInAt.value.getSeconds()
  const noOut = row.checkOutTime == null || row.checkOutTime === ''
  editFormNoCheckout.value = noOut
  editFormCheckOutAt.value = noOut ? null : apiTimeToEditDate(row.checkOutTime)
  editStashedCheckOutAt.value = null
  if (!noOut && editFormCheckOutAt.value) {
    editInheritedCheckOutSec.value = editFormCheckOutAt.value.getSeconds()
  } else {
    editInheritedCheckOutSec.value = 0
  }
  syncInPartsFromDate()
  if (!noOut && editFormCheckOutAt.value) {
    syncOutPartsFromDate()
  } else {
    editOutH12.value = 12
    editOutMin.value = 0
    editOutPm.value = false
  }
}

watch(editFormNoCheckout, (noSalida) => {
  if (!props.visible || props.mode !== 'edit') return
  if (noSalida) {
    editStashedCheckOutAt.value = editFormCheckOutAt.value
      ? new Date(editFormCheckOutAt.value.getTime())
      : null
    editFormCheckOutAt.value = null
  } else {
    editFormCheckOutAt.value = editStashedCheckOutAt.value
      ? new Date(editStashedCheckOutAt.value.getTime())
      : apiTimeToEditDate(props.recordToEdit?.checkOutTime)
    editInheritedCheckOutSec.value = editFormCheckOutAt.value.getSeconds()
    syncOutPartsFromDate()
  }
})

watch(
  [editInH12, editInMin, editInPm],
  () => {
    if (!props.visible || props.mode !== 'edit') return
    applyPartsToCheckInAt()
  },
)

watch(
  [editOutH12, editOutMin, editOutPm],
  () => {
    if (!props.visible || props.mode !== 'edit') return
    if (editFormNoCheckout.value) return
    applyPartsToCheckOutAt()
  },
)

const pendingAction = ref(null)
/** Fila de asistencia del día local (misma que usa la lógica de ingreso/salida). */
const todayAttendanceRow = ref(null)
/** Evita habilitar el envío hasta conocer la acción del día (sin usar isLoading del guardado). */
const attendanceReady = ref(false)

/** Encabezado del diálogo: acción concreta cuando ya hay empleado y acción conocida. */
const headerTitleOverride = computed(() => {
  if (!employee.value) return null
  if (pendingAction.value === 'INGRESO') return 'REGISTRAR INGRESO'
  if (pendingAction.value === 'SALIDA') return 'REGISTRAR SALIDA'
  return null
})

const shellHeaderTitleOverride = computed(() => {
  if (isEditMode.value) return 'Corregir registro de marcación'
  return headerTitleOverride.value
})

/** Título del bloque gris (misma lógica que el encabezado cuando aplica). */
const registroSectionTitle = computed(() => {
  if (pendingAction.value === 'INGRESO') return 'REGISTRAR INGRESO'
  if (pendingAction.value === 'SALIDA') return 'REGISTRAR SALIDA'
  return 'REGISTRO'
})

const customSubmitLabel = computed(() => {
  if (isEditMode.value) return 'Guardar cambios'
  if (pendingAction.value === 'INGRESO') return 'Confirmar ingreso'
  if (pendingAction.value === 'SALIDA') return 'Confirmar salida'
  return 'Registrar'
})

const clockDateShort = computed(() => formatLocalCalendarDateForUi(nowClock.value))

const clockTimeLive = computed(() => formatTimeOfDayForUi(nowClock.value))

/** Día ya cerrado: mostrar fecha/hora de ingreso y salida del servidor (sin reloj en vivo). */
const showCompletedDayTimes = computed(() => {
  const row = todayAttendanceRow.value
  if (pendingAction.value !== null || !row) return false
  const inn = row.checkInTime
  const out = row.checkOutTime
  return inn != null && inn !== '' && out != null && out !== ''
})

const completedCheckInDate = computed(() => formatAttendanceDateEs(todayAttendanceRow.value?.attendanceDate))
const completedCheckInTime = computed(() => formatAttendanceTimeEs(todayAttendanceRow.value?.checkInTime))
const completedCheckOutDate = computed(() => formatAttendanceDateEs(todayAttendanceRow.value?.attendanceDate))
const completedCheckOutTime = computed(() => formatAttendanceTimeEs(todayAttendanceRow.value?.checkOutTime))

/** Ingreso ya registrado: mostrar al confirmar salida. */
const salidaIngresoDate = computed(() => formatAttendanceDateEs(todayAttendanceRow.value?.attendanceDate))
const salidaIngresoTime = computed(() => formatAttendanceTimeEs(todayAttendanceRow.value?.checkInTime))

const showSalidaWithCheckIn = computed(() => {
  if (!attendanceReady.value) return false
  if (pendingAction.value !== 'SALIDA') return false
  const row = todayAttendanceRow.value
  if (!row) return false
  const inn = row.checkInTime
  return inn != null && inn !== ''
})

function formatAttendanceDateEs(val) {
  return formatCalendarDateForUi(val)
}

function formatAttendanceTimeEs(timeVal) {
  return formatTimeOfDayForUi(timeVal)
}

function getDocTypeLabel(value) {
  return DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value
}

function formatLine(emp) {
  if (!emp) return ''
  const doc = `${getDocTypeLabel(emp.documentType)} ${emp.documentNumber}`.trim()
  return `${doc} — ${emp.fullName}`
}

function toRow(emp) {
  return { id: emp.id, line: formatLine(emp), raw: emp }
}

function resetState() {
  clearTimeout(suggestDebounceTimer)
  suggestDebounceTimer = null
  selectedWrap.value = null
  suggestionRows.value = []
  pendingAction.value = null
  todayAttendanceRow.value = null
  attendanceReady.value = false
  formEntity.value = {}
}

function startClock() {
  stopClock()
  nowClock.value = new Date()
  clockTimer = setInterval(() => { nowClock.value = new Date() }, 1000)
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

watch(
  [employee, showCompletedDayTimes],
  () => {
    if (!employee.value) {
      stopClock()
      return
    }
    if (showCompletedDayTimes.value) {
      stopClock()
      return
    }
    startClock()
  },
  { immediate: true },
)

watch(
  () => selectedWrap.value?.raw?.id,
  async (id) => {
    if (isEditMode.value) return
    if (!id) {
      pendingAction.value = null
      todayAttendanceRow.value = null
      attendanceReady.value = false
      formEntity.value = {}
      return
    }
    attendanceReady.value = false
    pendingAction.value = null
    todayAttendanceRow.value = null
    try {
      const { action, todayRow } = await store.getPendingActionForEmployee(id)
      pendingAction.value = action
      todayAttendanceRow.value = todayRow ?? null
      formEntity.value = { employeeId: id }
      attendanceReady.value = true
    } catch (e) {
      showError(normalizeApiError(e, 'No se pudo obtener el estado de asistencia del día.'))
      selectedWrap.value = null
      pendingAction.value = null
      todayAttendanceRow.value = null
      formEntity.value = {}
      attendanceReady.value = false
    }
  },
)

watch(() => props.visible, async (open) => {
  if (open) {
    if (props.mode === 'edit') {
      stopClock()
      resetState()
      initEditFromRecord(props.recordToEdit)
      if (!editTarget.value?.id) {
        showError('No se puede editar este registro.')
        emit('canceled-shared')
      }
      return
    }
    clearEditForm()
    resetState()
    const preset = (props.initialLookup || props.initialDocumentNumber || '').trim()
    if (preset.length >= 2) {
      try {
        const list = await store.fetchEmployeeSuggestions(preset)
        suggestionRows.value = list.map(toRow)
        if (list.length === 1) selectedWrap.value = suggestionRows.value[0]
      } catch (e) {
        suggestionRows.value = []
        showError(normalizeApiError(e, 'No se pudieron cargar sugerencias.'))
      }
    }
  } else {
    stopClock()
    clearEditForm()
  }
})

onUnmounted(() => {
  stopClock()
  clearTimeout(suggestDebounceTimer)
})

const mismatchMessage = computed(() => {
  if (!employee.value) return null
  if (!employee.value.isActive) return 'Este empleado está inactivo: no se puede registrar asistencia.'
  if (pendingAction.value === 'UNKNOWN') return 'No se pudo determinar el estado del día. Intenta de nuevo.'
  if (pendingAction.value === null) {
    return 'La marcación del día ya está completa (ingreso y salida).'
  }
  return null
})

const canSubmitEdit = computed(() => {
  const t = editTarget.value
  if (!t?.id || t.employeeId == null) return false
  const d = editFormDate.value
  if (!d) return false
  const iso = d instanceof Date
    ? (Number.isNaN(d.getTime()) ? null : toIsoDateString(d))
    : toIsoDateString(d)
  if (!iso) return false
  const ci = editDateToApiTime(editFormCheckInAt.value)
  if (!ci) return false
  if (editFormNoCheckout.value) return true
  const out = editFormCheckOutAt.value
  if (!out || Number.isNaN(out.getTime())) return false
  const co = editDateToApiTime(out)
  if (!co) return false
  if (co < ci) return false
  return true
})

const canSubmit = computed(() => {
  if (isEditMode.value) return canSubmitEdit.value
  if (!attendanceReady.value) return false
  if (!employee.value?.isActive) return false
  return pendingAction.value === 'INGRESO' || pendingAction.value === 'SALIDA'
})

async function loadSuggestions(query) {
  const q = query.trim()
  suggestLoading.value = true
  try {
    const list = await store.fetchEmployeeSuggestions(q)
    const mapped = list.map(toRow)
    const cur = selectedWrap.value
    if (cur && !mapped.some(r => r.id === cur.id)) {
      mapped.unshift(cur)
    }
    suggestionRows.value = mapped
  } catch (e) {
    suggestionRows.value = []
    showError(normalizeApiError(e, 'No se pudieron cargar sugerencias.'))
  } finally {
    suggestLoading.value = false
  }
}

function onComplete(event) {
  const q = (event.query ?? '').trim()
  clearTimeout(suggestDebounceTimer)
  if (q.length < 2) {
    suggestionRows.value = []
    return
  }
  suggestDebounceTimer = setTimeout(() => loadSuggestions(q), 280)
}

function isoFromEditDate(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return toIsoDateString(dt)
}

async function onSaveFromShell() {
  if (!canSubmit.value) return
  if (isEditMode.value) {
    const row = editTarget.value
    if (!row?.id || row.employeeId == null) return
    const iso = isoFromEditDate(editFormDate.value)
    if (!iso) {
      showError('Selecciona una fecha válida.')
      return
    }
    const ci = editDateToApiTime(editFormCheckInAt.value)
    if (!ci) {
      showError('Indica la hora de ingreso.')
      return
    }
    let co = null
    if (!editFormNoCheckout.value) {
      co = editDateToApiTime(editFormCheckOutAt.value)
      if (!co) {
        showError('Indica la hora de salida o active «Sin registro de salida».')
        return
      }
      if (co < ci) {
        showError('La hora de salida no puede ser anterior a la de ingreso el mismo día.')
        return
      }
    }
    await run(async () => {
      await store.updateAttendanceRecord(row.employeeId, row.id, {
        attendance_date: iso,
        check_in_time: ci,
        check_out_time: co,
      })
      showSuccess('Registro actualizado.')
      emit('canceled-shared')
    }, { errorMessage: 'No se pudo actualizar el registro de marcación.' })
    if (error.value) showError(error.value)
    return
  }
  if (!employee.value) return
  const action = pendingAction.value
  await run(async () => {
    if (action === 'INGRESO') await store.registerCheckIn(employee.value.id)
    else if (action === 'SALIDA') await store.registerCheckOut(employee.value.id)
    showSuccess(action === 'INGRESO' ? 'Ingreso registrado correctamente.' : 'Salida registrada correctamente.')
    emit('canceled-shared')
  }, {
    errorMessage: action === 'INGRESO'
      ? 'No se pudo registrar el ingreso.'
      : 'No se pudo registrar la salida.',
  })
  if (error.value) showError(error.value)
}

const shellLoading = computed(() => props.submitLoading || isLoading.value)
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    :entity="formEntity"
    :entity-name="entityName"
    :header-title-override="shellHeaderTitleOverride"
    :edit="isEditMode"
    size="standard"
    :custom-button-label="customSubmitLabel"
    :submit-loading="shellLoading"
    :submit-disabled="!canSubmit || shellLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSaveFromShell"
  >
    <template #content>
      <div v-if="isEditMode" class="pa-edit-shell flex flex-column gap-3">
        <header v-if="recordToEdit" class="pa-edit-employee">
          <div class="pa-edit-employee__name">{{ recordToEdit.fullName }}</div>
          <div class="pa-edit-employee__doc">
            {{ getDocTypeLabel(recordToEdit.documentType) }} {{ recordToEdit.documentNumber }}
          </div>
        </header>

        <p class="pa-edit-hint m-0" role="note">
          <i class="pi pi-info-circle pa-edit-hint__icon" aria-hidden="true" />
          <span>Corrija solo datos erróneos. Los permisos los valida el servidor.</span>
        </p>

        <section class="pa-registro pa-edit-form" aria-labelledby="pa-edit-form-legend">
          <div id="pa-edit-form-legend" class="pa-registro__head">
            <i class="pi pi-pencil pa-registro__icon" aria-hidden="true" />
            <span class="pa-registro__title">Datos del registro</span>
          </div>
          <div class="pa-registro__rule" />

          <div class="flex flex-column gap-3">
            <div class="pa-registro__block">
              <span class="pa-registro__sublabel">Registro de ingreso</span>
              <div class="pa-registro__row pa-edit-date-time-row flex gap-3 flex-wrap">
                <div class="pa-registro__field pa-edit-date-col">
                  <label for="pa-edit-date" class="pa-registro__label">Fecha</label>
                  <pv-calendar
                    id="pa-edit-date"
                    v-model="editFormDate"
                    date-format="dd/mm/yy"
                    show-icon
                    icon-display="input"
                    class="w-full"
                  />
                </div>
                <div class="pa-registro__field flex-1 min-w-0 pa-time-quick">
                  <span class="pa-registro__label pa-time-quick__label">
                    <i class="pi pi-clock pa-time-quick__clock" aria-hidden="true" />
                    Hora ingreso
                  </span>
                  <div class="pa-time-quick__row flex align-items-center gap-2">
                    <pv-select
                      v-model="editInH12"
                      :options="EDIT_TIME_HOUR_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--h"
                      placeholder="H"
                    />
                    <span class="pa-time-quick__sep" aria-hidden="true">:</span>
                    <pv-select
                      v-model="editInMin"
                      :options="EDIT_TIME_MINUTE_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--m"
                      placeholder="MM"
                    />
                    <pv-select
                      v-model="editInPm"
                      :options="EDIT_TIME_AMPM_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--ampm"
                    />
                  </div>
                  <span class="pa-edit-microcopy m-0 mt-1">Vista: {{ formatTimeOfDayForUi(editFormCheckInAt) }}</span>
                </div>
              </div>
            </div>

            <div
              class="pa-edit-switch-row flex align-items-center justify-content-between flex-wrap gap-3"
              role="group"
              aria-labelledby="pa-edit-switch-label"
            >
              <div class="flex flex-column gap-1 min-w-12rem">
                <span id="pa-edit-switch-label" class="pa-edit-switch-title">Sin registro de salida</span>
                <span class="pa-edit-microcopy m-0">
                  Si está activo, no se guarda hora de salida (jornada abierta).
                </span>
              </div>
              <pv-input-switch
                v-model="editFormNoCheckout"
                input-id="pa-edit-no-out"
              />
            </div>

            <div v-if="!editFormNoCheckout" class="pa-registro__block">
              <span class="pa-registro__sublabel">Registro de salida</span>
              <div class="pa-registro__row pa-edit-date-time-row flex gap-3 flex-wrap">
                <div class="pa-registro__field pa-edit-date-col">
                  <label for="pa-edit-date-out" class="pa-registro__label">Fecha</label>
                  <pv-calendar
                    id="pa-edit-date-out"
                    v-model="editFormDate"
                    date-format="dd/mm/yy"
                    show-icon
                    icon-display="input"
                    class="w-full"
                    disabled
                  />
                  <span class="pa-edit-microcopy pa-edit-microcopy--tight m-0">
                    Mismo día del ingreso (el registro tiene una sola fecha en el sistema).
                  </span>
                </div>
                <div class="pa-registro__field flex-1 min-w-0 pa-time-quick">
                  <span class="pa-registro__label pa-time-quick__label">
                    <i class="pi pi-clock pa-time-quick__clock" aria-hidden="true" />
                    Hora salida
                  </span>
                  <div class="pa-time-quick__row flex align-items-center gap-2">
                    <pv-select
                      v-model="editOutH12"
                      :options="EDIT_TIME_HOUR_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--h"
                      placeholder="H"
                    />
                    <span class="pa-time-quick__sep" aria-hidden="true">:</span>
                    <pv-select
                      v-model="editOutMin"
                      :options="EDIT_TIME_MINUTE_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--m"
                      placeholder="MM"
                    />
                    <pv-select
                      v-model="editOutPm"
                      :options="EDIT_TIME_AMPM_OPTIONS"
                      option-label="label"
                      option-value="value"
                      class="pa-time-quick__sel pa-time-quick__sel--ampm"
                    />
                  </div>
                  <span class="pa-edit-microcopy m-0 mt-1">Vista: {{ formatTimeOfDayForUi(editFormCheckOutAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="flex flex-column gap-3">
        <div class="flex flex-column gap-2">
          <label class="text-sm font-semibold" for="pa-ac">Buscar empleado</label>
          <pv-auto-complete
            id="pa-ac"
            v-model="selectedWrap"
            :suggestions="suggestionRows"
            option-label="line"
            data-key="id"
            :min-length="2"
            :delay="280"
            :force-selection="true"
            :loading="suggestLoading"
            :show-clear="true"
            placeholder="Escriba DNI o nombre (mín. 2 caracteres)…"
            class="w-full"
            fluid
            @complete="onComplete"
          />
          <small v-if="!employee" class="text-600">Escriba y elija una coincidencia de la lista.</small>
        </div>

        <section v-if="employee" class="pa-registro" aria-live="polite">
          <div class="pa-registro__head">
            <i class="pi pi-clock pa-registro__icon" aria-hidden="true"></i>
            <span class="pa-registro__title">{{ registroSectionTitle }}</span>
          </div>
          <div class="pa-registro__rule" />
          <div v-if="showCompletedDayTimes" class="pa-registro__blocks flex flex-column gap-3">
            <div class="pa-registro__block">
              <span class="pa-registro__sublabel">Ingreso</span>
              <div class="pa-registro__row flex gap-3 flex-wrap">
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Fecha</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Fecha de ingreso registrada"
                  >
                    <span class="pa-faux-input__value">{{ completedCheckInDate }}</span>
                    <i class="pi pi-calendar pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Hora</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Hora de ingreso registrada"
                  >
                    <span class="pa-faux-input__value">{{ completedCheckInTime }}</span>
                    <i class="pi pi-clock pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
            <div class="pa-registro__block">
              <span class="pa-registro__sublabel">Salida</span>
              <div class="pa-registro__row flex gap-3 flex-wrap">
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Fecha</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Fecha de salida registrada"
                  >
                    <span class="pa-faux-input__value">{{ completedCheckOutDate }}</span>
                    <i class="pi pi-calendar pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Hora</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Hora de salida registrada"
                  >
                    <span class="pa-faux-input__value">{{ completedCheckOutTime }}</span>
                    <i class="pi pi-clock pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="showSalidaWithCheckIn"
            class="pa-registro__blocks flex flex-column gap-3"
          >
            <div class="pa-registro__block">
              <span class="pa-registro__sublabel">Registro de ingreso</span>
              <div class="pa-registro__row flex gap-3 flex-wrap">
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Fecha</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Fecha de ingreso registrada"
                  >
                    <span class="pa-faux-input__value">{{ salidaIngresoDate }}</span>
                    <i class="pi pi-calendar pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
                <div class="pa-registro__field flex-1 min-w-12rem">
                  <span class="pa-registro__label">Hora</span>
                  <div
                    class="pa-faux-input w-full"
                    role="status"
                    aria-label="Hora de ingreso registrada"
                  >
                    <span class="pa-faux-input__value">{{ salidaIngresoTime }}</span>
                    <i class="pi pi-clock pa-faux-input__icon text-500" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
            <div class="pa-registro__row flex gap-3 flex-wrap">
              <div class="pa-registro__field flex-1 min-w-12rem">
                <span class="pa-registro__label">Fecha</span>
                <div
                  class="pa-faux-input w-full"
                  role="status"
                  aria-label="Fecha de referencia para la salida"
                >
                  <span class="pa-faux-input__value">{{ clockDateShort }}</span>
                  <i class="pi pi-calendar pa-faux-input__icon text-500" aria-hidden="true" />
                </div>
              </div>
              <div class="pa-registro__field flex-1 min-w-12rem">
                <span class="pa-registro__label">Hora</span>
                <div
                  class="pa-faux-input w-full"
                  role="status"
                  aria-label="Hora de referencia para la salida"
                >
                  <span class="pa-faux-input__value">{{ clockTimeLive }}</span>
                  <i class="pi pi-clock pa-faux-input__icon text-500" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="pa-registro__row flex gap-3 flex-wrap">
            <div class="pa-registro__field flex-1 min-w-12rem">
              <span class="pa-registro__label">Fecha</span>
              <div
                class="pa-faux-input w-full"
                role="status"
                aria-label="Fecha de referencia en este equipo"
              >
                <span class="pa-faux-input__value">{{ clockDateShort }}</span>
                <i class="pi pi-calendar pa-faux-input__icon text-500" aria-hidden="true" />
              </div>
            </div>
            <div class="pa-registro__field flex-1 min-w-12rem">
              <span class="pa-registro__label">Hora</span>
              <div
                class="pa-faux-input w-full"
                role="status"
                aria-label="Hora de referencia en este equipo"
              >
                <span class="pa-faux-input__value">{{ clockTimeLive }}</span>
                <i class="pi pi-clock pa-faux-input__icon text-500" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <pv-message v-if="employee && mismatchMessage" severity="warn" :closable="false">
          {{ mismatchMessage }}
        </pv-message>
      </div>
    </template>
  </CreateAndEdit>
</template>

<style scoped>
.pa-registro {
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
  padding: 0.75rem 1rem 0.65rem;
  background: var(--surface-ground, #f9fafb);
}

.pa-registro__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.pa-registro__icon {
  font-size: 1rem;
  color: var(--primary-color, #2563eb);
}

.pa-registro__title {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-color-secondary, #64748b);
}

.pa-registro__rule {
  height: 1px;
  background: var(--surface-border, #e5e7eb);
  margin-bottom: 0.75rem;
}

.pa-registro__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-color, #1e293b);
  margin-bottom: 0.35rem;
}

.pa-registro__sublabel {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-color-secondary, #64748b);
  margin-bottom: 0.35rem;
}

.pa-faux-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 6px;
  background: var(--surface-100, #f3f4f6);
  color: var(--text-color-secondary, #64748b);
  font-weight: 500;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
}

.pa-faux-input__value {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.pa-faux-input__icon {
  flex-shrink: 0;
  font-size: 0.95rem;
  pointer-events: none;
}

/* Modo edición: contraste y jerarquía */
.pa-edit-shell {
  max-width: 36rem;
}

.pa-edit-employee {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--surface-border, #e5e7eb);
  background: var(--surface-50, #fafafa);
}

.pa-edit-employee__name {
  font-size: 1.05rem;
  font-weight: 800;
  color: #020617;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.pa-edit-employee__doc {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  margin-top: 0.2rem;
}

.pa-edit-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-color-secondary, #475569);
}

.pa-edit-hint__icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--primary-color, #2563eb);
  font-size: 0.95rem;
}

.pa-edit-form .pa-registro__field {
  min-width: 0;
}

.pa-edit-date-time-row {
  align-items: flex-start;
  min-width: 0;
}

/* Fecha compacta; el ancho restante va a hora + selects. */
.pa-edit-date-col {
  flex: 0 1 10.5rem;
  max-width: min(10.5rem, 100%);
  min-width: 0;
}

.pa-edit-date-col :deep(.p-datepicker),
.pa-edit-date-col :deep(.p-calendar),
.pa-edit-date-col :deep(.p-inputwrapper) {
  width: 100%;
  max-width: 100%;
}

.pa-edit-switch-row {
  padding: 0.35rem 0;
  border-top: 1px solid var(--surface-border, #e5e7eb);
  border-bottom: 1px solid var(--surface-border, #e5e7eb);
}

.pa-edit-switch-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
}

.pa-edit-microcopy {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-color-secondary, #64748b);
  max-width: 32rem;
}

.pa-edit-microcopy--tight {
  display: block;
  margin-top: 0.35rem;
  max-width: none;
}

/* Edición: hora / minuto / AM-PM con Select; segundos solo desde el registro (applyParts*). */
.pa-time-quick__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pa-time-quick__clock {
  font-size: 0.95rem;
  color: var(--primary-color, #2563eb);
}

.pa-time-quick {
  width: 100%;
  min-width: 0;
}

.pa-time-quick__row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
  margin-top: 0.15rem;
  width: 100%;
  min-width: 0;
}

.pa-time-quick__sel {
  flex: 0 0 auto;
}

/* Hora y minuto: ancho ajustado a 1–2 dígitos + flecha (sin estirar). */
.pa-time-quick__sel--h :deep(.p-select),
.pa-time-quick__sel--m :deep(.p-select) {
  width: fit-content;
  min-width: 2.65rem;
  max-width: 3.65rem;
}

.pa-time-quick__sel--h :deep(.p-select-label),
.pa-time-quick__sel--m :deep(.p-select-label) {
  flex: 0 1 auto;
  min-width: 0;
  padding-inline: 0.35rem 0.2rem;
  overflow: visible;
  text-overflow: clip;
}

/* AM / PM: espacio para la etiqueta completa + flecha. */
.pa-time-quick__sel--ampm :deep(.p-select) {
  width: fit-content;
  min-width: 5.35rem;
}

.pa-time-quick__sel--ampm :deep(.p-select-label) {
  flex: 0 1 auto;
  padding-inline: 0.4rem 0.2rem;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}

.pa-time-quick__sep {
  font-weight: 800;
  color: var(--text-color-secondary, #64748b);
  user-select: none;
  line-height: 1;
}
</style>
