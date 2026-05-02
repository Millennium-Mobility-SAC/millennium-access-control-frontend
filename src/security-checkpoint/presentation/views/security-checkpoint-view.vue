<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { useSecurityCheckpointStore } from '../../application/security-checkpoint.store.js'
import { useIamStore } from '@/iam/application/iam.store.js'
import PersonnelAttendanceCreateEdit from '../components/personnel-attendance-create-edit.vue'
import { DOCUMENT_TYPES } from '@/employee-management/presentation/constants/employee-management-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeOfDayForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { sortAttendanceRecordsByRecencyDesc } from '../../domain/sort-attendance-records.js'
import { todayIsoLocal, toIsoDateString } from '@/shared/domain/employee-attendance-day.js'

const store = useSecurityCheckpointStore()
const iamStore = useIamStore()

/** Vista Marcación de personal: siempre muestra el historial del más reciente al más antiguo. */
const attendanceHistoryRows = computed(() =>
  sortAttendanceRecordsByRecencyDesc(store.attendanceRecords),
)
const { isLoading, error, run } = useAsyncAction()
const { showError, showSuccess } = useNotification()

const personnelDialogVisible = ref(false)
const personnelDialogMode = ref('create')
const personnelRecordToEdit = ref(null)

function closePersonnelDialog() {
  personnelDialogVisible.value = false
  personnelDialogMode.value = 'create'
  personnelRecordToEdit.value = null
}

function openCreatePersonnelDialog() {
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

const columns = [
  { field: 'fullName', header: 'Empleado', style: 'min-width: 11rem' },
  { field: 'position', header: 'Cargo', style: 'min-width: 9rem' },
  { field: 'documentNumber', header: 'Documento', style: 'min-width: 10rem', template: 'doc-template' },
  { field: 'attendanceDate', header: 'Fecha', style: 'min-width: 9rem', template: 'fecha-template' },

  { field: 'checkInTime', header: 'Ingreso', style: 'min-width: 8rem', template: 'hora-ingreso-template' },
  { field: 'checkOutTime', header: 'Salida', style: 'min-width: 8rem', template: 'hora-salida-template' },
]

function getDocTypeLabel(value) {
  return DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value
}

const formatDateCell = (value) => formatCalendarDateForUi(value)

function formatTimeCell(value) {
  return formatTimeOfDayForUi(value)
}

/** Excel en cliente: mismos registros que la tabla (filtros actuales del API). */
function exportAttendanceExcel() {
  const list = attendanceHistoryRows.value
  if (!list.length) {
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
    Salida: formatTimeCell(r.checkOutTime),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Marcación')
  const date = todayIsoLocal()
  XLSX.writeFile(wb, `marcacion-personal-${date}.xlsx`)
}

/**
 * Rango + texto opcionales: solo texto | todo | rango completo + texto.
 * Si hay una sola fecha, con debounce no se consulta; con warnIncompleteDates (Enter en búsqueda) se muestra aviso.
 */
async function runAttendanceFetch(options = {}) {
  const { warnIncompleteDates = false } = options
  const from = isoFromDate(filterDateFrom.value)
  const to = isoFromDate(filterDateTo.value)
  const search = filterSearch.value.trim()

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

onMounted(async () => {
  filterDateFrom.value = null
  filterDateTo.value = null
  filterSearch.value = ''
  await run(async () => {
    await store.fetchAttendanceRecords()
  }, { errorMessage: 'No se pudo cargar el historial de marcación.' })
  if (error.value) showError(error.value)
  filtersWatchReady.value = true
})
</script>

<template>
  <div class="p-3">

    <DataManager
      :items="attendanceHistoryRows"
      :filtered-items="attendanceHistoryRows"
      :title="{ singular: 'registro', plural: 'registros' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      search-placeholder="Buscar…"
      :show-new="true"
      new-button-label="Registrar asistencia"
      :show-delete="true"
      :show-selection="true"
      :show-export="false"
      :show-actions="iamStore.hasFullActionAccess"
      :show-view-action="false"
      :show-edit-action="iamStore.hasFullActionAccess"
      :show-delete-action="iamStore.hasFullActionAccess"
      :show-action-buttons="true"
      @new-item-requested-manager="openCreatePersonnelDialog"
      @edit-item-requested-manager="openEditPersonnelDialog"
      @delete-item-requested-manager="deleteAttendanceRow"
    >
      <template #extra-actions>
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
        <pv-icon-field class="scp-filter-field flex-1 min-w-16rem w-full">
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

        <pv-calendar
          v-model="filterDateFrom"
          date-format="dd/mm/yy"
          placeholder="Desde"
          show-icon
          icon-display="input"
          input-id="chk-from"
          class="scp-filter-field w-full md:w-14rem"
        />

        <pv-calendar
          v-model="filterDateTo"
          date-format="dd/mm/yy"
          placeholder="Hasta"
          show-icon
          icon-display="input"
          input-id="chk-to"
          class="scp-filter-field w-full md:w-14rem"
        />
      </template>
      <template #fecha-template="{ data }">
        {{ formatDateCell(data.attendanceDate) }}
      </template>
      <template #doc-template="{ data }">
        <span class="doc-badge">{{ getDocTypeLabel(data.documentType) }}</span>
        <span class="ml-1">{{ data.documentNumber }}</span>
      </template>
      <template #hora-ingreso-template="{ data }">
        {{ formatTimeCell(data.checkInTime) }}
      </template>
      <template #hora-salida-template="{ data }">
        {{ formatTimeCell(data.checkOutTime) }}
      </template>
    </DataManager>

    <PersonnelAttendanceCreateEdit
      :visible="personnelDialogVisible"
      :mode="personnelDialogMode"
      :record-to-edit="personnelRecordToEdit"
      @canceled-shared="closePersonnelDialog"
    />
  </div>
</template>

<style scoped>
.doc-badge {
  display: inline-block;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background: #f3f4f6;
}
</style>
