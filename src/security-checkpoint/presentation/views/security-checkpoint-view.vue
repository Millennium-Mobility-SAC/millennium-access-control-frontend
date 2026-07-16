<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { usePermissions } from '@/shared/composables/use-permissions.js'
import { useSecurityCheckpointStore } from '../../application/security-checkpoint.store.js'
import { useIamStore } from '@/iam/application/iam.store.js'
import PersonnelAttendanceCreateEdit from '../components/personnel-attendance-create-edit.vue'
import FacialAttendanceLive from '../components/facial-attendance-live.vue'
import { DOCUMENT_TYPES } from '@/employee-management/presentation/constants/employee-management-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeOfDayForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { todayIsoLocal, toIsoDateString } from '@/shared/domain/employee-attendance-day.js'

const store = useSecurityCheckpointStore()
const iamStore = useIamStore()
const permissions = usePermissions()

/**
 * Vista Marcación de personal: por defecto solo el día de hoy; con «Historial completo»
 * se consultan todas las marcaciones (y filtros por fecha como antes).
 */
const attendanceHistoryRows = computed(() => store.attendanceRecords)

/** false = solo marcaciones de hoy; true = historial completo con filtros de fecha opcionales. */
const fullHistoryMode = ref(false)
const { isLoading, error, run } = useAsyncAction()
const { showError, showSuccess } = useNotification()

const personnelDialogVisible = ref(false)
const personnelDialogMode = ref('create')
const personnelRecordToEdit = ref(null)

const ATTENDANCE_MODE_KEY = 'gs_attendance_mode'
function readStoredAttendanceMode() {
  try {
    const v = localStorage.getItem(ATTENDANCE_MODE_KEY)
    return v === 'FACIAL' ? 'FACIAL' : 'MANUAL'
  } catch {
    return 'MANUAL'
  }
}
const attendanceMode = ref(readStoredAttendanceMode())
watch(attendanceMode, (mode) => {
  try {
    localStorage.setItem(ATTENDANCE_MODE_KEY, mode)
  } catch { /* ignore */ }
  if (mode === 'FACIAL' && personnelDialogMode.value === 'create') {
    closePersonnelDialog()
  }
})

function closePersonnelDialog() {
  personnelDialogVisible.value = false
  personnelDialogMode.value = 'create'
  personnelRecordToEdit.value = null
}

function switchToManualMode() {
  attendanceMode.value = 'MANUAL'
}

function switchToFacialMode() {
  closePersonnelDialog()
  attendanceMode.value = 'FACIAL'
}

function openCreatePersonnelDialog() {
  if (attendanceMode.value === 'FACIAL') return
  personnelDialogMode.value = 'create'
  personnelRecordToEdit.value = null
  personnelDialogVisible.value = true
}

function openEditPersonnelDialog(row) {
  personnelDialogMode.value = 'edit'
  personnelRecordToEdit.value = row
  personnelDialogVisible.value = true
}

async function deleteAttendanceRow(item) {
  if (!item?.id || item.employeeId == null) return
  await run(async () => {
    await store.removeAttendanceRecord(item.employeeId, item.id)
  }, { errorMessage: 'No se pudo eliminar el registro de marcación.' })
  if (error.value) {
    showError(error.value)
    return
  }
  showSuccess('Registro eliminado.')
}

const filterDateFrom = ref(null)
const filterDateTo = ref(null)
/** Texto único: documento, nombre o cargo (servidor con OR) */
const filterSearch = ref('')

/** Debounce para no saturar el API al escribir o al cambiar fechas. */
let fetchDebounceTimer = null
const FETCH_DEBOUNCE_MS = 380

function isoFromDate(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return toIsoDateString(dt)
}

/** Fecha local de hoy (mediodía) para calendarios PrimeVue. */
function todayCalendarDate() {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

/**
 * Solo «Desde»: completa «Hasta» con hoy para aplicar el rango.
 * Si «Hasta» ya tenía valor pero queda inválido (desde > hasta), reemplaza «Hasta» por hoy.
 */
function syncDateHastaWithSoloDesde() {
  const fromVal = filterDateFrom.value
  if (!fromVal) return
  const fromIso = isoFromDate(fromVal)
  if (!fromIso) return
  const toVal = filterDateTo.value
  if (!toVal) {
    filterDateTo.value = todayCalendarDate()
    return
  }
  const toIso = isoFromDate(toVal)
  if (!toIso) {
    filterDateTo.value = todayCalendarDate()
    return
  }
  if (fromIso > toIso) {
    const todayD = todayCalendarDate()
    const todayIso = isoFromDate(todayD)
    // Si «desde» es posterior a hoy, cerrar el rango en un solo día (evita desde>hasta con hasta=hoy).
    if (fromIso > todayIso) {
      filterDateTo.value = fromVal instanceof Date ? new Date(fromVal.getTime()) : new Date(fromVal)
    } else {
      filterDateTo.value = todayD
    }
  }
}

/** Evita que el watch dispare petición duplicada durante el montaje inicial. */
const filtersWatchReady = ref(false)

/** Columnas con el mismo criterio visual que Colaboradores / Empleados. */
const columns = [
  {
    field: 'fullName',
    header: 'Empleado',
    template: 'empleado-template',
    style: 'min-width: 12rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'documentNumber',
    header: 'Documento',
    template: 'doc-template',
    style: 'min-width: 8.5rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'attendanceDate',
    header: 'Fecha',
    template: 'fecha-template',
    style: 'min-width: 7.5rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'checkInTime',
    header: 'Ingreso',
    template: 'hora-ingreso-template',
    style: 'min-width: 7rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'checkOutTime',
    header: 'Salida',
    template: 'hora-salida-template',
    style: 'min-width: 7.5rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
]

const AVATAR_PALETTE = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fee2e2', color: '#b91c1c' },
  { bg: '#fce7f3', color: '#be185d' },
]

function avatarPaletteFor(data) {
  const key = String(data?.employeeId ?? data?.id ?? data?.fullName ?? '')
  let idx = 0
  for (let i = 0; i < key.length; i++) idx = (idx + key.charCodeAt(i)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function employeeInitials(data) {
  if (!data) return '?'
  const a = (data.firstName || '').trim().charAt(0)
  const b = (data.lastName || '').trim().charAt(0)
  const pair = `${a}${b}`.toUpperCase()
  if (pair.length >= 2) return pair
  const n = (data.fullName || '').trim()
  return n ? n.slice(0, 2).toUpperCase() : '?'
}

function getAvatarStyle(data) {
  const palette = avatarPaletteFor(data)
  return { backgroundColor: palette.bg, color: palette.color }
}

function getDocTypeLabel(value) {
  return DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value
}

const formatDateCell = (value) => formatCalendarDateForUi(value)

function formatTimeCell(value) {
  return formatTimeOfDayForUi(value)
}

/** Salida aún no registrada (null, vacío o hora no parseable). */
function isAttendanceCheckOutPending(row) {
  const v = row?.checkOutTime
  if (v == null || v === '') return true
  const formatted = formatTimeOfDayForUi(v, '')
  return formatted === '' || formatted === '—'
}

function formatCheckOutForExport(row) {
  return isAttendanceCheckOutPending(row) ? 'Pendiente' : formatTimeCell(row.checkOutTime)
}

/** Excel export: fetches all records matching active filters from the server. */
async function exportAttendanceExcel() {
  let list
  try {
    list = await store.exportAll()
  } catch {
    showError('No se pudo exportar los registros.')
    return
  }
  if (!list?.length) {
    showError('No hay registros para exportar.')
    return
  }
  const rows = list.map((r) => ({
    Trabajador: (r.fullName ?? '').trim() || '—',
    Cargo: (r.position ?? '').trim() || '—',
    'Tipo de documento': getDocTypeLabel(r.documentType),
    Documento: r.documentNumber ?? '',
    Fecha: formatDateCell(r.attendanceDate),
    Ingreso: formatTimeCell(r.checkInTime),
    Salida: formatCheckOutForExport(r),
  }))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Marcación')
  if (rows.length) {
    ws.addRow(Object.keys(rows[0]))
    rows.forEach(r => ws.addRow(Object.values(r)))
  }
  const date = todayIsoLocal()
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `marcacion-personal-${date}.xlsx`)
}

function handlePageChange({ page }) {
  store.goToPage(page)
}

/**
 * Rango + texto opcionales: solo texto | todo | rango completo + texto.
 * Si hay una sola fecha, con debounce no se consulta; con warnIncompleteDates (Enter en búsqueda) se muestra aviso.
 * Sin modo historial: siempre rango [hoy, hoy] + búsqueda opcional.
 */
async function runAttendanceFetch(options = {}) {
  clearTimeout(fetchDebounceTimer)
  const { warnIncompleteDates = false } = options
  const search = filterSearch.value.trim()

  if (!fullHistoryMode.value) {
    const day = todayIsoLocal()
    await run(async () => {
      await store.fetchAttendanceRecords({ dateFrom: day, dateTo: day, search })
    }, { errorMessage: 'No se pudo cargar el historial de marcación.' })
    if (error.value) showError(error.value)
    return
  }

  const from = isoFromDate(filterDateFrom.value)
  const to = isoFromDate(filterDateTo.value)

  if ((from && !to) || (!from && to)) {
    if (warnIncompleteDates) {
      showError('Complete «Desde» y «Hasta», o deje ambas vacías para no filtrar por fechas.')
    }
    return
  }
  if (from && to && from > to) {
    showError('La fecha inicial no puede ser posterior a la final.')
    return
  }

  await run(async () => {
    if (from && to) {
      await store.fetchAttendanceRecords({ dateFrom: from, dateTo: to, search })
      return
    }
    if (search) {
      await store.fetchAttendanceRecords({ dateFrom: null, dateTo: null, search })
      return
    }
    await store.fetchAttendanceRecords()
  }, { errorMessage: 'No se pudo cargar el historial de marcación.' })
  if (error.value) showError(error.value)
}

function scheduleAttendanceFetch() {
  clearTimeout(fetchDebounceTimer)
  fetchDebounceTimer = setTimeout(() => {
    runAttendanceFetch({ warnIncompleteDates: false })
  }, FETCH_DEBOUNCE_MS)
}

/** Enter en búsqueda: consulta inmediata (misma validación de fechas que al debounce). */
async function flushAttendanceFetch() {
  clearTimeout(fetchDebounceTimer)
  await runAttendanceFetch({ warnIncompleteDates: true })
}

watch([filterDateFrom, filterDateTo], () => {
  syncDateHastaWithSoloDesde()
})

watch([filterSearch, filterDateFrom, filterDateTo], () => {
  if (!filtersWatchReady.value) return
  scheduleAttendanceFetch()
})

/**
 * Activa o desactiva el listado de todo el historial. Al entrar en historial se limpian
 * las fechas para empezar en «todas las marcaciones» (mismo criterio que antes al dejar filtros vacíos).
 */
async function toggleFullHistoryMode() {
  clearTimeout(fetchDebounceTimer)
  if (fullHistoryMode.value) {
    fullHistoryMode.value = false
  } else {
    fullHistoryMode.value = true
    filterDateFrom.value = null
    filterDateTo.value = null
  }
  await runAttendanceFetch({ warnIncompleteDates: false })
}

async function clearAllSearchFilters() {
  filterSearch.value = ''
  filterDateFrom.value = null
  filterDateTo.value = null
  await runAttendanceFetch()
}

onMounted(async () => {
  fullHistoryMode.value = false
  filterDateFrom.value = null
  filterDateTo.value = null
  filterSearch.value = ''
  await runAttendanceFetch({ warnIncompleteDates: false })
  filtersWatchReady.value = true
})
</script>

<template>
  <div class="scp-view" :class="{ 'scp-view--facial': attendanceMode === 'FACIAL' }">
    <FacialAttendanceLive
      v-if="attendanceMode === 'FACIAL'"
      @back-requested="switchToManualMode"
      @registered="runAttendanceFetch({ warnIncompleteDates: false })"
    />

    <template v-else>
    <DataManager
      :items="attendanceHistoryRows"
      :filtered-items="attendanceHistoryRows"
      :lazy="true"
      :total-records="store.pagination.totalElements"
      :rows="20"
      :title="{ singular: 'registro', plural: 'registros' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      search-placeholder="Buscar…"
      :show-new="true"
      new-button-label="Registrar Ingreso/Salida"
      :show-delete="permissions.canDeleteCheckpoint.value"
      :show-selection="permissions.canDeleteCheckpoint.value"
      :show-export="false"
      :show-actions="iamStore.hasFullActionAccess"
      :show-view-action="false"
      :show-edit-action="iamStore.hasFullActionAccess"
      :show-delete-action="iamStore.hasFullActionAccess"
      :show-action-buttons="true"
      @new-item-requested-manager="openCreatePersonnelDialog"
      @edit-item-requested-manager="openEditPersonnelDialog"
      @delete-item-requested-manager="deleteAttendanceRow"
      @page-changed="handlePageChange"
    >
      <template #extra-actions>
        <div class="scp-mode-toggle flex align-items-center gap-2">
          <pv-button
            type="button"
            label="Facial"
            icon="pi pi-face-smile"
            size="small"
            severity="secondary"
            outlined
            @click="switchToFacialMode"
          />
        </div>
        <pv-button
          :label="fullHistoryMode ? 'Solo hoy' : 'Historial completo'"
          :icon="fullHistoryMode ? 'pi pi-calendar' : 'pi pi-history'"
          :severity="fullHistoryMode ? 'secondary' : 'help'"
          size="small"
          outlined
          :title="fullHistoryMode
            ? 'Volver a listar únicamente las marcaciones del día de hoy.'
            : 'Ver todas las marcaciones registradas y filtrar por fechas.'"
          @click="toggleFullHistoryMode"
        />
        <pv-button
          label="Exportar"
          icon="pi pi-download"
          severity="secondary"
          size="small"
          outlined
          @click="exportAttendanceExcel"
        />
      </template>
      <template #filters>
        <div class="scp-filters-row">
          <pv-icon-field class="scp-filter-search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              id="scp-search"
              v-model="filterSearch"
              placeholder="Buscar por documento, nombre o cargo"
              class="w-full"
              autocomplete="off"
              @keyup.enter="flushAttendanceFetch"
            />
          </pv-icon-field>

          <template v-if="fullHistoryMode">
            <pv-calendar
              v-model="filterDateFrom"
              date-format="dd/mm/yy"
              placeholder="Desde"
              show-icon
              icon-display="input"
              input-id="chk-from"
              class="scp-filter-calendar w-full md:w-14rem"
            />

            <pv-calendar
              v-model="filterDateTo"
              date-format="dd/mm/yy"
              placeholder="Hasta"
              show-icon
              icon-display="input"
              input-id="chk-to"
              class="scp-filter-calendar w-full md:w-14rem"
            />
          </template>
          <div
            v-else
            class="scp-today-banner"
            role="status"
          >
            <i class="pi pi-info-circle scp-today-banner__icon" aria-hidden="true" />
            <p class="scp-today-banner__text">
              Mostrando solo las marcaciones del <strong>hoy</strong>.
              Pulse <strong>Historial completo</strong> (arriba) para consultar fechas anteriores.
            </p>
          </div>
          <pv-button
            type="button"
            label="Limpiar filtros"
            text
            size="small"
            class="flex-shrink-0"
            @click="clearAllSearchFilters"
          />
        </div>
      </template>
      <template #empleado-template="{ data }">
        <div v-if="data" class="scp-name-cell">
          <span class="scp-avatar" :style="getAvatarStyle(data)">
            {{ employeeInitials(data) }}
          </span>
          <div class="scp-name-text min-w-0">
            <span class="scp-name-primary">{{ data.fullName || '—' }}</span>
            <span class="scp-name-sub">{{ data.position?.trim() || '—' }}</span>
          </div>
        </div>
        <span v-else>—</span>
      </template>

      <template #fecha-template="{ data }">
        <span class="scp-cell-text">{{ formatDateCell(data?.attendanceDate) }}</span>
      </template>

      <template #doc-template="{ data }">
        <div v-if="data" class="scp-doc-cell">
          <span class="doc-type-badge">{{ getDocTypeLabel(data.documentType) }}</span>
          <span class="scp-doc-num">{{ data.documentNumber || '—' }}</span>
        </div>
        <span v-else>—</span>
      </template>

      <template #hora-ingreso-template="{ data }">
        <span class="scp-time-cell scp-time-cell--in">{{ formatTimeCell(data?.checkInTime) }}</span>
      </template>

      <template #hora-salida-template="{ data }">
        <span
          v-if="isAttendanceCheckOutPending(data)"
          class="scp-status-pill scp-status-pill--pending"
        >
          <span class="scp-status-pill__dot" aria-hidden="true" />
          Pendiente
        </span>
        <span v-else class="scp-time-cell scp-time-cell--out">{{ formatTimeCell(data.checkOutTime) }}</span>
      </template>
    </DataManager>

    <PersonnelAttendanceCreateEdit
      :visible="personnelDialogVisible"
      :mode="personnelDialogMode"
      :record-to-edit="personnelRecordToEdit"
      @canceled-shared="closePersonnelDialog"
    />
    </template>
  </div>
</template>

<style scoped>
.scp-mode-toggle__label {
  white-space: nowrap;
}
/* Contenedor: padding y altura útiles en móvil dentro del layout con scroll */
.scp-view {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  padding: 0.5rem;
}

@media (min-width: 576px) {
  .scp-view {
    padding: 0.75rem;
  }
}

@media (min-width: 768px) {
  .scp-view {
    padding: 1rem;
  }
}

.scp-view--facial {
  padding: 0.35rem;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 4.25rem);
}

.scp-view--facial :deep(.fak) {
  flex: 1 1 auto;
  min-height: 0;
}

@media (min-width: 768px) {
  .scp-view--facial {
    padding: 0.65rem 0.85rem;
    min-height: calc(100dvh - 4.5rem);
  }
}

.doc-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.scp-name-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.scp-name-text {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.scp-name-primary {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
  word-break: break-word;
}

.scp-name-sub {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.25;
  word-break: break-word;
}

.scp-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.scp-cell-text {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.35;
}

.scp-doc-cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: 100%;
  line-height: 1.35;
}

.scp-doc-num {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.scp-time-cell {
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
}

.scp-time-cell--in {
  color: #15803d;
}

.scp-time-cell--out {
  color: #1d4ed8;
}

.scp-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.scp-status-pill__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.scp-status-pill--pending {
  background: #ffedd5;
  color: #c2410c;
  border-color: #fed7aa;
}
.scp-status-pill--pending .scp-status-pill__dot {
  background: #ea580c;
}

.scp-view :deep(.p-datatable .p-datatable-thead > tr > th) {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.65rem 0.75rem;
}

.scp-view :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.8rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.scp-view :deep(.p-datatable .p-datatable-tbody > tr:hover) {
  background: #f8fafc;
}

/**
 * Fila de filtros: misma altura en cruz (búsqueda, calendarios o banner informativo).
 * Altura alineada con input estándar PrimeVue (~2.75rem).
 */
.scp-filters-row {
  --scp-filter-control-height: 2.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
}

/* Móvil / tablet estrecha: apilar filtros a ancho completo */
@media (max-width: 767px) {
  .scp-filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .scp-filter-search {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  .scp-filter-calendar {
    flex: 1 1 auto !important;
    width: 100% !important;
    max-width: none !important;
  }

  .scp-today-banner {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-height: unset;
    align-items: flex-start;
    padding: 0.5rem 0.65rem;
  }

  .scp-today-banner__text {
    font-size: 0.8125rem;
    line-height: 1.4;
  }
}

.scp-filter-search {
  flex: 1 1 16rem;
  min-width: min(100%, 16rem);
  display: flex;
  align-items: stretch;
}

.scp-filter-search :deep(.p-iconfield) {
  display: flex;
  align-items: stretch;
  width: 100%;
}

.scp-filter-search :deep(.p-inputtext) {
  width: 100%;
  min-height: var(--scp-filter-control-height);
  box-sizing: border-box;
}

.scp-filter-calendar {
  flex: 0 1 14rem;
  min-width: 0;
  display: flex;
  align-items: stretch;
}

.scp-filter-calendar :deep(.p-datepicker),
.scp-filter-calendar :deep(.p-inputwrapper) {
  width: 100%;
  display: flex;
  align-items: stretch;
}

.scp-filter-calendar :deep(.p-inputtext) {
  min-height: var(--scp-filter-control-height);
  box-sizing: border-box;
}

.scp-today-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 12rem;
  min-width: 0;
  min-height: var(--scp-filter-control-height);
  padding: 0 0.75rem;
  border-radius: 6px;
  border: 1px solid #93c5fd;
  background: #dbeafe;
  color: #1e3a8a;
  box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
}

.scp-today-banner__icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #1d4ed8;
}

.scp-today-banner__text {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: #172554;
}

.scp-today-banner__text strong {
  font-weight: 600;
  color: #0f172a;
}
</style>
