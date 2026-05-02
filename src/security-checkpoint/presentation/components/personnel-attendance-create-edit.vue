<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { normalizeApiError } from '@/shared/infrustructure/error-normalizer.js'
import { useSecurityCheckpointStore } from '../../application/security-checkpoint.store.js'
import { DOCUMENT_TYPES } from '@/employee-management/presentation/constants/employee-management-ui.constants.js'
import { toIsoDateString } from '@/shared/domain/employee-attendance-day.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
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

const employee = computed(() => selectedWrap.value?.raw ?? null)

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

/** Título del bloque gris (misma lógica que el encabezado cuando aplica). */
const registroSectionTitle = computed(() => {
  if (pendingAction.value === 'INGRESO') return 'REGISTRAR INGRESO'
  if (pendingAction.value === 'SALIDA') return 'REGISTRAR SALIDA'
  return 'REGISTRO'
})

const customSubmitLabel = computed(() => {
  if (pendingAction.value === 'INGRESO') return 'Confirmar ingreso'
  if (pendingAction.value === 'SALIDA') return 'Confirmar salida'
  return 'Registrar'
})

const clockDateShort = computed(() => nowClock.value.toLocaleDateString('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}))

const clockTimeLive = computed(() => new Intl.DateTimeFormat('es-PE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
}).format(nowClock.value))

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
  if (val == null || val === '') return '—'
  const iso = toIsoDateString(val) ?? String(val).slice(0, 10)
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatAttendanceTimeEs(timeVal) {
  if (timeVal == null || timeVal === '') return '—'
  let s = String(timeVal).trim()
  if (s.length === 5 && s[2] === ':') s = `${s}:00`
  const d = new Date(`2000-01-01T${s}`)
  if (Number.isNaN(d.getTime())) return String(timeVal)
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)
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

const canSubmit = computed(() => {
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

async function onSaveFromShell() {
  if (!canSubmit.value || !employee.value) return
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
    :header-title-override="headerTitleOverride"
    :edit="false"
    size="standard"
    :custom-button-label="customSubmitLabel"
    :submit-loading="shellLoading"
    :submit-disabled="!canSubmit || shellLoading"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="onSaveFromShell"
  >
    <template #content>
      <div class="flex flex-column gap-3">
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
</style>
