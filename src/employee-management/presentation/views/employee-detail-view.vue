<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { useEmployeeManagementStore } from '../../application/employee-management.store.js'
import { DOCUMENT_TYPES } from '../constants/employee-management-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeOfDayForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { todayIsoLocal, toIsoDateString } from '@/shared/domain/employee-attendance-day.js'

const route = useRoute()
const router = useRouter()
const store = useEmployeeManagementStore()
const { isLoading, error, run } = useAsyncAction()
const { showError } = useNotification()

const employeeId = computed(() => {
  const n = Number(route.params.id)
  return Number.isFinite(n) && n > 0 ? n : null
})

const employee = computed(() => store.selected)

const initials = computed(() => {
  const e = employee.value
  if (!e) return '?'
  const a = (e.firstName || '').trim().charAt(0)
  const b = (e.lastName || '').trim().charAt(0)
  const pair = `${a}${b}`.toUpperCase()
  if (pair.length >= 2) return pair
  const n = (e.fullName || '').trim()
  return n ? n.slice(0, 2).toUpperCase() : '?'
})

const attendanceColumns = [
  { field: 'attendanceDate', header: 'Fecha', style: 'min-width: 7rem', template: 'att-date-template' },
  { field: 'checkInTime', header: 'Ingreso', style: 'min-width: 6.5rem', template: 'att-in-template' },
  { field: 'checkOutTime', header: 'Salida', style: 'min-width: 6.5rem', template: 'att-out-template' },
]

const attendanceSearch = ref('')
const filterDateFrom = ref(null)
const filterDateTo = ref(null)

function isoFromCalendar(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return toIsoDateString(dt)
}

function todayCalendarDate() {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

/**
 * Solo «Desde»: completa «Hasta» con hoy.
 * Si «Hasta» queda inválida (desde > hasta), reemplaza «Hasta» por hoy (o por «Desde» si es posterior a hoy).
 */
function syncAttendanceHastaWithSoloDesde() {
  const fromVal = filterDateFrom.value
  if (!fromVal) return
  const fromIso = isoFromCalendar(fromVal)
  if (!fromIso) return
  const toVal = filterDateTo.value
  if (!toVal) {
    filterDateTo.value = todayCalendarDate()
    return
  }
  const toIso = isoFromCalendar(toVal)
  if (!toIso) {
    filterDateTo.value = todayCalendarDate()
    return
  }
  if (fromIso > toIso) {
    const todayD = todayCalendarDate()
    const todayIso = isoFromCalendar(todayD)
    if (fromIso > todayIso) {
      filterDateTo.value = fromVal instanceof Date ? new Date(fromVal.getTime()) : new Date(fromVal)
    } else {
      filterDateTo.value = todayD
    }
  }
}

function attendanceDayIso(row) {
  const v = row?.attendanceDate
  if (v == null || v === '') return null
  return String(v).trim().slice(0, 10)
}

/** Búsqueda global + rango de fechas (solo lectura local sobre el historial cargado). */
const filteredAttendance = computed(() => {
  let rows = [...store.attendance]
  let from = isoFromCalendar(filterDateFrom.value)
  let to = isoFromCalendar(filterDateTo.value)
  if (from && to && from > to) {
    const swap = from
    from = to
    to = swap
  }
  if (from) {
    rows = rows.filter((r) => {
      const d = attendanceDayIso(r)
      return d && d >= from
    })
  }
  if (to) {
    rows = rows.filter((r) => {
      const d = attendanceDayIso(r)
      return d && d <= to
    })
  }
  const q = attendanceSearch.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter((r) => {
      const hay = [r.attendanceDate, r.checkInTime, r.checkOutTime]
        .map(x => (x != null ? String(x) : ''))
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }
  return rows
})

function resetAttendanceFilters(clearFilters) {
  filterDateFrom.value = null
  filterDateTo.value = null
  attendanceSearch.value = ''
  if (typeof clearFilters === 'function') clearFilters()
}

function onAttendanceSearchChange(v) {
  attendanceSearch.value = v ?? ''
}

function sanitizeFilePart(s) {
  return String(s || 'empleado')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
}

/** Excel en cliente: incluye columna Trabajador (mismos filtros que la tabla). */
function exportAttendanceExcel() {
  const e = employee.value
  if (!e) return
  const worker = (e.fullName ?? '').trim() || '—'
  const list = filteredAttendance.value
  if (!list.length) {
    showError('No hay registros para exportar con los filtros actuales.')
    return
  }
  const rows = list.map((r) => ({
    Trabajador: worker,
    Fecha: formatAttendanceDate(r.attendanceDate),
    Ingreso: formatAttendanceTime(r.checkInTime),
    Salida: formatAttendanceTime(r.checkOutTime),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
  const slug = sanitizeFilePart(e.fullName) || 'empleado'
  const date = todayIsoLocal()
  XLSX.writeFile(wb, `asistencia-${slug}-${date}.xlsx`)
}

function getDocTypeLabel(value) {
  return DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value
}

const formatAttendanceDate = (val) => formatCalendarDateForUi(val)

function formatAttendanceTime(timeVal) {
  return formatTimeOfDayForUi(timeVal)
}

async function loadDetail() {
  const id = employeeId.value
  if (id == null) {
    showError('Identificador de empleado no válido.')
    await router.replace({ name: 'employee-management' })
    return
  }
  attendanceSearch.value = ''
  filterDateFrom.value = null
  filterDateTo.value = null
  await run(async () => {
    await store.fetchById(id)
    await store.fetchAttendance(id)
  }, { errorMessage: 'No se pudo cargar el empleado o su historial de asistencia.' })
  if (error.value) {
    showError(error.value)
    await router.replace({ name: 'employee-management' })
  }
}

watch([filterDateFrom, filterDateTo], () => {
  syncAttendanceHastaWithSoloDesde()
})

watch(employeeId, () => { loadDetail() }, { immediate: true })
</script>

<template>
  <div class="ed-root app-page-view flex flex-column gap-3 md:gap-4">
    <section v-if="isLoading && !employee" class="ed-card surface-card border-round-lg border-1 surface-border w-full p-3 md:p-4 flex flex-column sm:flex-row align-items-start sm:align-items-center gap-3 text-600">
      <pv-progress-spinner style="width: 2rem; height: 2rem" stroke-width="4" aria-hidden="true" />
      <span>Cargando datos del empleado…</span>
    </section>

    <section v-else-if="employee" class="ed-profile w-full border-round-xl overflow-hidden shadow-1 border-1 surface-border">
      <div class="ed-profile__row">
        <div class="ed-profile__col ed-profile__col--identity">
          <div class="ed-identity">
            <div class="ed-avatar" aria-hidden="true">{{ initials }}</div>
            <div class="ed-identity__text min-w-0">
              <h1 class="ed-profile__name m-0">{{ employee.fullName }}</h1>
              <pv-tag
                :value="employee.status === 'ACTIVE' ? 'Activo' : 'Inactivo'"
                :severity="employee.status === 'ACTIVE' ? 'success' : 'secondary'"
                class="ed-status-tag"
              />
            </div>
          </div>
        </div>
        <div class="ed-profile__col ed-profile__col--doc">
          <div class="ed-field-block">
            <span class="ed-field-block__icon" aria-hidden="true"><i class="pi pi-id-card" /></span>
            <div class="ed-field-block__content min-w-0">
              <span class="ed-field-block__label">Documento</span>
              <p class="ed-field-block__value m-0">
                <span class="ed-doc-pill">{{ getDocTypeLabel(employee.documentType) }}</span>
                <span class="ed-doc-num">{{ employee.documentNumber }}</span>
              </p>
            </div>
          </div>
        </div>
        <div class="ed-profile__col ed-profile__col--cargo">
          <div class="ed-field-block">
            <span class="ed-field-block__icon" aria-hidden="true"><i class="pi pi-briefcase" /></span>
            <div class="ed-field-block__content min-w-0">
              <span class="ed-field-block__label">Cargo</span>
              <p class="ed-field-block__value m-0">{{ employee.position?.trim() || 'Sin cargo asignado' }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="!isLoading" class="ed-empty text-600">
      No se encontró información del empleado.
    </section>

    <section class="ed-history flex flex-column gap-2 flex-1 min-h-0 min-w-0">
      <h2 class="ed-history__title m-0 text-base text-color">
        <span class="ed-history__title-main font-bold">Historial de ingreso y salida</span>
        <span class="ed-history__title-sub font-normal text-sm text-color-secondary">
          Solo lectura. Las correcciones de registros erróneos se hacen en «Marcación personal» (administradores).
        </span>
      </h2>
      <div class="ed-history__table flex-1 min-h-0 min-w-0 surface-card border-round-lg border-1 surface-border p-2 md:p-3">
        <DataManager
          :items="store.attendance"
          :filtered-items="filteredAttendance"
          :global-filter-value="attendanceSearch"
          :title="{ singular: 'registro', plural: 'registros' }"
          :columns="attendanceColumns"
          :dynamic="true"
          :loading="isLoading"
          :show-global-search="true"
          search-placeholder="Buscar por fecha u hora…"
          :show-actions="false"
          :show-selection="false"
          :show-action-buttons="false"
          :show-new="false"
          :show-delete="false"
          :show-export="false"
          @global-filter-change="onAttendanceSearchChange"
        >
          <template #filters="{ clearFilters }">
            <div class="app-filters-row app-filters-row--stack-sm ed-att-filters w-full min-w-0 flex-1">
              <pv-calendar
                v-model="filterDateFrom"
                date-format="dd/mm/yy"
                placeholder="Desde"
                show-icon
                icon-display="input"
                input-id="ed-att-from"
                class="ed-att-filters__cal w-full md:w-14rem"
              />
              <pv-calendar
                v-model="filterDateTo"
                date-format="dd/mm/yy"
                placeholder="Hasta"
                show-icon
                icon-display="input"
                input-id="ed-att-to"
                class="ed-att-filters__cal w-full md:w-14rem"
              />
              <div class="ed-att-filters__actions flex flex-column sm:flex-row gap-2 w-full md:w-auto md:ml-auto">
                <pv-button
                  type="button"
                  icon="pi pi-download"
                  label="Exportar"
                  severity="secondary"
                  size="small"
                  outlined
                  class="w-full sm:w-auto"
                  @click="exportAttendanceExcel"
                />
                <pv-button
                  type="button"
                  label="Limpiar filtros"
                  text
                  size="small"
                  class="w-full sm:w-auto"
                  @click="resetAttendanceFilters(clearFilters)"
                />
              </div>
            </div>
          </template>
          <template #att-date-template="{ data }">
            {{ formatAttendanceDate(data.attendanceDate) }}
          </template>
          <template #att-in-template="{ data }">
            {{ formatAttendanceTime(data.checkInTime) }}
          </template>
          <template #att-out-template="{ data }">
            {{ formatAttendanceTime(data.checkOutTime) }}
          </template>
        </DataManager>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ed-root {
  max-width: 100%;
  min-height: 0;
}

.ed-profile {
  background: var(--surface-0, #fff);
}

/* Móvil: bloques apilados. Tablet/desktop: fila identidad | documento | cargo */
.ed-profile__row {
  display: grid;
  grid-template-columns: 1fr;
  align-items: stretch;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #1a6bc2) 8%, var(--surface-0, #fff)) 0%,
    var(--surface-0, #fff) 50%
  );
}

@media (min-width: 768px) {
  .ed-profile__row {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 1.25rem 1.5rem;
    padding: 1.25rem 1.5rem;
  }
}

.ed-profile__col {
  min-width: 0;
}

.ed-profile__col--doc,
.ed-profile__col--cargo {
  border-left: none;
  border-top: 1px solid var(--surface-border, #e2e8f0);
  padding-left: 0;
  padding-top: 1rem;
}

@media (min-width: 768px) {
  .ed-profile__col--doc,
  .ed-profile__col--cargo {
    border-top: none;
    border-left: 1px solid var(--surface-border, #e2e8f0);
    padding-top: 0;
    padding-left: 1.25rem;
  }
}

.ed-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.85rem;
  min-width: 0;
}

@media (min-width: 768px) {
  .ed-identity {
    flex-wrap: nowrap;
  }
}

.ed-identity__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.ed-avatar {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  background: linear-gradient(145deg, var(--primary-color, #1a6bc2), color-mix(in srgb, var(--primary-color, #1a6bc2) 65%, #0f172a));
  box-shadow: 0 4px 14px color-mix(in srgb, var(--primary-color, #1a6bc2) 35%, transparent);
  flex-shrink: 0;
}

.ed-profile__name {
  font-size: clamp(1rem, 2vw, 1.35rem);
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-body, #0f172a);
  word-break: break-word;
}

.ed-status-tag :deep(.p-tag) {
  font-weight: 600;
  padding: 0.35rem 0.75rem;
}

.ed-field-block {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.ed-field-block__icon {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--surface-100, #f1f5f9);
  color: var(--text-body-secondary, #64748b);
  font-size: 1rem;
}

.ed-field-block__label {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-body-secondary, #64748b);
  margin-bottom: 0.3rem;
}

.ed-field-block__value {
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--text-body, #1e293b);
  overflow-wrap: break-word;
}

.ed-doc-pill {
  display: inline-block;
  padding: 0.12rem 0.45rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--surface-100, #f1f5f9);
  color: var(--text-body-secondary, #64748b);
  margin-right: 0.35rem;
  vertical-align: middle;
}

.ed-doc-num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.ed-history__title {
  letter-spacing: 0.02em;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ed-history__title-main {
  line-height: 1.3;
}

.ed-history__title-sub {
  line-height: 1.4;
  max-width: 100%;
}

@media (min-width: 768px) {
  .ed-history__title {
    display: block;
  }

  .ed-history__title-sub {
    display: inline;
  }

  .ed-history__title-sub::before {
    content: '— ';
  }
}

.ed-history__table {
  background: var(--surface-white, #fff);
  min-height: 10rem;
}

@media (min-width: 768px) {
  .ed-history__table {
    min-height: 12rem;
  }
}

.ed-att-filters {
  align-items: stretch;
}

@media (min-width: 768px) {
  .ed-att-filters {
    flex-wrap: nowrap;
    align-items: center;
  }

  .ed-att-filters__actions {
    flex-shrink: 0;
    margin-left: auto;
  }
}

.ed-att-filters__cal :deep(.p-calendar),
.ed-att-filters__cal :deep(.p-inputtext) {
  width: 100%;
}
</style>
