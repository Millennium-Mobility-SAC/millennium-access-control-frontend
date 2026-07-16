<script setup>
import { ref, watch, onMounted, defineAsyncComponent } from 'vue'
import { useRouter }                   from 'vue-router'
import { useVehicleCatalogStore }      from '../../application/vehicle-catalog.store.js'
import { useIamStore }                 from '@/iam/application/iam.store.js'
import { useAsyncAction }              from '@/shared/composables/use-async-action.js'
import { useNotification }             from '@/shared/composables/use-notification.js'
import DataManager                     from '@/shared/presentation/components/data-manager.vue'
import VehicleCreateAndEdit            from '../components/vehicle-create-and-edit.vue'
import { VEHICLE_COLUMNS, VEHICLE_IMPORT_COLUMNS, VEHICLE_BULK_UPDATE_COLUMNS } from '../constants/vehicle-catalog-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeHmAmPmForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { VEHICLE_ROUTE_NAMES }         from '../vehicle-catalog.routes.js'
import { MOTIVOS_INGRESO, MOTIVOS_SALIDA_TEMPORAL, VEHICLE_ORIGIN_FILTER } from '@/stays/presentation/constants/stays-ui.constants.js'
import { resolveVehicleUbicacion } from '../../domain/format-vehicle-ubicacion.js'

import { getAccessStatusLabel as VEHICLE_STATUS_LABEL_FN, getAccessStatusSeverity, ACCESS_STATUS } from '@/shared/presentation/constants/access-status.constants.js'

const ImportSpreadsheet = defineAsyncComponent(() =>
  import('@/shared/presentation/components/import-spreadsheet.vue')
)

const router             = useRouter()
const store              = useVehicleCatalogStore()
const iamStore           = useIamStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

// Bulk update
const bulkUpdateDialogVisible  = ref(false)
const bulkUpdateResultVisible  = ref(false)
const bulkUpdateResult         = ref(null)
const bulkUpdateLoading        = ref(false)

// Filtros
const filterStatus        = ref([])
const filterOrigin        = ref([])
const filterEntryMotivo   = ref([])
const filterTemporalExit  = ref([])
const filterDays          = ref(null)
const searchText          = ref('')

/** Motivos de ingreso en catálogo (origen externo se filtra aparte). */
const MOTIVOS_INGRESO_CATALOG = MOTIVOS_INGRESO.filter(m => m.value !== 'EXTERNO')

/** Estados disponibles en catálogo de vehículos (sin Retornado, que regresa a En planta) */
const VEHICLE_CATALOG_STATUS = ACCESS_STATUS.filter(s => s.value !== 'RETORNADO')

const DAYS_RANGES = [
  { label: '0 – 3 días',   value: '0-3'  },
  { label: '4 – 7 días',   value: '4-7'  },
  { label: '8 – 14 días',  value: '8-14' },
  { label: '+ 15 días',    value: '15+'  },
]

function buildFilters() {
  return {
    statuses:            filterStatus.value.length ? [...filterStatus.value] : undefined,
    flowEntryReasons:    filterEntryMotivo.value.length ? [...filterEntryMotivo.value] : undefined,
    temporalExitReasons: filterTemporalExit.value.length ? [...filterTemporalExit.value] : undefined,
    external:            filterOrigin.value.length ? [...filterOrigin.value] : undefined,
    daysRange:           filterDays.value ?? undefined,
    search:              searchText.value.trim() || undefined,
  }
}

// Push new filters to the backend on any filter change
watch([filterStatus, filterOrigin, filterEntryMotivo, filterTemporalExit, filterDays], () => {
  run(() => store.fetchVehicles(buildFilters()))
}, { deep: true })

// Debounce text search so we don't fire on every keystroke
let _searchTimer = null
watch(searchText, () => {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => {
    run(() => store.fetchVehicles(buildFilters()))
  }, 350)
})

function clearAllFilters() {
  filterStatus.value       = []
  filterOrigin.value       = []
  filterEntryMotivo.value  = []
  filterTemporalExit.value = []
  filterDays.value         = null
  searchText.value         = ''
  // watchers will fire and call fetchVehicles with empty filters
}

function handlePageChange({ page }) {
  run(() => store.goToPage(page))
}

const columns = VEHICLE_COLUMNS

/** Misma idea que empleados: ir a la pantalla de detalle del registro (aquí: historial de accesos). */
function goToVehicleDetail(item) {
  if (item?.id == null) return
  router.push({
    name: VEHICLE_ROUTE_NAMES.ACCESS_HISTORY,
    params: { vehicleId: String(item.id) },
    query: { plate: item.licensePlate, brand: item.brand, model: item.model },
  })
}

function openNewDialog() {
  isEditing.value     = false
  editEntity.value    = null
  dialogVisible.value = true
}

function openEditDialog(item) {
  isEditing.value     = true
  editEntity.value    = item
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

async function handleSave(entity) {
  if (isLoading.value) return
  await run(async () => {
    if (isEditing.value) {
      await store.update(entity.id, entity)
      showSuccess('Vehículo actualizado correctamente.')
    } else {
      await store.create(entity)
      showSuccess('Vehículo registrado correctamente.')
    }
    dialogVisible.value = false
  })
  if (error.value) showError(error.value)
}

function handleDelete(item) {
  run(async () => {
    await store.remove(item.id)
    showSuccess('Vehículo eliminado correctamente.')
  }).then(() => { if (error.value) showError(error.value) })
}

async function handleDeleteSelected(items) {
  await run(async () => {
    await Promise.all(items.map(item => store.remove(item.id)))
    showSuccess(`${items.length} vehículo(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

async function handleDeleteAll() {
  await run(async () => {
    const count = await store.deleteAll()
    showSuccess(`${count} vehículo(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

async function handleImport(rows, importColumns) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} vehículo(s) importado(s) correctamente.`)
    } else {
      const msg = result.success > 0
        ? `${result.success} importado(s), ${result.failed} no se procesó(aron).`
        : `No se pudo importar ningún vehículo (${result.failed} error(es)).`
      showError(`${msg} Descargando reporte de errores...`)
      if (importColumns?.length) {
        const { downloadImportErrorReport } = await import('@/shared/composables/use-import-error-report.js')
        await downloadImportErrorReport(result.failedRows, importColumns, 'errores-importacion-vehiculos')
      }
    }
  } else if (error.value) {
    showError(error.value)
  }
}

async function handleBulkUpdate(rows) {
  if (!rows || rows.length === 0) return
  bulkUpdateLoading.value = true
  try {
    const result = await store.bulkUpdate(rows)
    bulkUpdateResult.value = result
    bulkUpdateResultVisible.value = true
  } catch (e) {
    showError(e?.message ?? 'Error al procesar la actualización masiva.')
  } finally {
    bulkUpdateLoading.value = false
  }
}

onMounted(async () => {
  await run(() => store.fetchVehicles({}))
})

// ── Date/time (compartido: `format-datetime-ui.js`) ──────────────────────────
const fmtDate = (v) => formatCalendarDateForUi(v)
const fmtTime = (v) => formatTimeHmAmPmForUi(v, { seconds: 'always' }) ?? ''

// ── Days badge class (colores por rango) ──────────────────────────────────────
// 0-3 días → verde | 4-7 → amarillo | 8-14 → naranja | 15+ → rojo
function daysBadgeClass(days) {
  if (days <= 3)  return 'vc-days--ok'
  if (days <= 7)  return 'vc-days--warn'
  if (days <= 14) return 'vc-days--alert'
  return 'vc-days--danger'
}

function labelMotivoIngreso(value) {
  if (value == null || value === '') return '—'
  return MOTIVOS_INGRESO.find(m => m.value === value)?.label ?? value
}

function ubicacionTagProps(row) {
  const { label, severity } = resolveVehicleUbicacion(row)
  return { value: label, severity }
}
</script>

<template>
  <div class="vc-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.vehicles"
      :total-records="store.pagination.totalElements"
      :rows="20"
      :lazy="true"
      delete-confirm-extra="También se eliminará todo el historial de accesos asociado (ingresos, salidas temporales y permanentes)."
      :title="{ singular: 'vehículo', plural: 'vehículos' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalles"
      :show-edit-action="true"
      :show-delete-action="iamStore.hasFullActionAccess"
      :show-history-action="false"
      :show-import="iamStore.hasFullActionAccess"
      :import-columns="VEHICLE_IMPORT_COLUMNS"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="goToVehicleDetail"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @delete-all-requested-manager="handleDeleteAll"
      @import-data-requested-manager="handleImport"
      @clear-filters="clearAllFilters"
      @page-changed="handlePageChange"
    >
      <template v-if="iamStore.hasFullActionAccess" #extra-actions>
        <pv-button
          icon="pi pi-pencil"
          label="Actualizar masivamente"
          severity="warning"
          size="small"
          outlined
          :loading="bulkUpdateLoading"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="bulkUpdateDialogVisible = true"
        />
      </template>

      <template #filters="{ clearFilters }">
        <div class="vc-filters-wrap w-full">
          <pv-icon-field class="vc-filter-search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por placa, marca, modelo o color"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>

          <div class="vc-filters">
            <div class="vc-filters__fields">
              <div class="vc-filters__field">
                <label class="vc-filters__label" for="vc-filter-status">Estado</label>
                <pv-multi-select
                  id="vc-filter-status"
                  v-model="filterStatus"
                  :options="VEHICLE_CATALOG_STATUS"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} estados"
                />
              </div>
              <div class="vc-filters__field">
                <label class="vc-filters__label" for="vc-filter-origin">Origen</label>
                <pv-multi-select
                  id="vc-filter-origin"
                  v-model="filterOrigin"
                  :options="VEHICLE_ORIGIN_FILTER"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} orígenes"
                />
              </div>
              <div class="vc-filters__field">
                <label class="vc-filters__label" for="vc-filter-entry">Motivo ingreso</label>
                <pv-multi-select
                  id="vc-filter-entry"
                  v-model="filterEntryMotivo"
                  :options="MOTIVOS_INGRESO_CATALOG"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} motivos"
                />
              </div>
              <div class="vc-filters__field">
                <label class="vc-filters__label" for="vc-filter-temporal">Salida temporal</label>
                <pv-multi-select
                  id="vc-filter-temporal"
                  v-model="filterTemporalExit"
                  :options="MOTIVOS_SALIDA_TEMPORAL"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} motivos"
                />
              </div>
              <div class="vc-filters__field">
                <label class="vc-filters__label" for="vc-filter-days">Días en planta</label>
                <pv-select
                  id="vc-filter-days"
                  v-model="filterDays"
                  :options="DAYS_RANGES"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  show-clear
                />
              </div>
            </div>
            <pv-button
              type="button"
              label="Limpiar"
              icon="pi pi-filter-slash"
              text
              size="small"
              class="vc-filters__clear"
              @click="clearFilters"
            />
          </div>
        </div>
      </template>

      <template #vehicle-plate-template="{ data }">
        <div class="vc-plate-cell">
          <span class="vc-plate" :title="data.licensePlate || undefined">{{ data.licensePlate || '—' }}</span>
          <pv-tag v-if="data.external" value="Ext." severity="danger" class="vc-ext-tag" />
        </div>
      </template>

      <template #vehicle-status="{ value }">
        <pv-tag
          :value="VEHICLE_STATUS_LABEL_FN(value)"
          :severity="getAccessStatusSeverity(value)"
        />
      </template>

      <template #vehicle-flow-motivo="{ value }">
        <span class="vc-motivo">{{ labelMotivoIngreso(value) }}</span>
      </template>

      <template #vehicle-ubicacion="{ data }">
        <pv-tag v-bind="ubicacionTagProps(data)" class="vc-ubicacion-tag" />
      </template>

      <!-- Último ingreso: fecha DD/MM/YYYY + hora -->
      <template #vehicle-entry="{ data }">
        <template v-if="data.lastEntryDate">
          <span class="vc-entry-date">{{ fmtDate(data.lastEntryDate) }}</span>
          <span class="vc-entry-time">{{ fmtTime(data.lastEntryTime) }}</span>
        </template>
        <span v-else class="vc-dash">—</span>
      </template>

      <!-- Días en planta: badge con color por urgencia -->
      <template #vehicle-days="{ data }">
        <span
          v-if="data.daysInPlant != null"
          class="vc-days-badge"
          :class="daysBadgeClass(data.daysInPlant)"
        >{{ data.daysInPlant }} d</span>
        <span v-else class="vc-dash">—</span>
      </template>
    </DataManager>

    <!-- Create / Edit dialog -->
    <VehicleCreateAndEdit
      :entity="editEntity"
      :visible="dialogVisible"
      :edit="isEditing"
      :submit-loading="isLoading"
      @canceled-shared="closeDialog"
      @saved-shared="handleSave"
    />

    <!-- Bulk update — import spreadsheet dialog -->
    <ImportSpreadsheet
      v-if="bulkUpdateDialogVisible"
      v-model:visible="bulkUpdateDialogVisible"
      :import-columns="VEHICLE_BULK_UPDATE_COLUMNS"
      title="Actualización masiva de vehículos"
      template-download-file-name="plantilla-actualizacion-vehiculos.xlsx"
      template-sheet-name="Actualización"
      :template-sample-rows="[{ currentPlate: 'ABC-123', newPlate: '', brand: 'Toyota', model: 'Corolla', year: 2023, color: 'Rojo' }]"
      @import-confirmed="handleBulkUpdate"
    />

    <!-- Bulk update — results dialog -->
    <pv-dialog
      v-model:visible="bulkUpdateResultVisible"
      header="Resultado de la actualización masiva"
      :modal="true"
      :closable="true"
      :draggable="false"
      class="vcu-result-dialog"
      style="width: min(52rem, 96vw)"
    >
      <template v-if="bulkUpdateResult">
        <div class="vcu-summary">
          <span class="vcu-summary-chip vcu-chip--updated">
            <i class="pi pi-check-circle" /> {{ bulkUpdateResult.updated }} actualizado(s)
          </span>
          <span class="vcu-summary-chip vcu-chip--ignored">
            <i class="pi pi-minus-circle" /> {{ bulkUpdateResult.ignored }} ignorado(s)
          </span>
          <span class="vcu-summary-chip vcu-chip--failed">
            <i class="pi pi-times-circle" /> {{ bulkUpdateResult.failed }} fallido(s)
          </span>
          <span class="vcu-summary-total">de {{ bulkUpdateResult.total }} filas procesadas</span>
        </div>

        <pv-data-table
          :value="bulkUpdateResult.results"
          :paginator="bulkUpdateResult.results.length > 10"
          :rows="10"
          class="vcu-result-table mt-3"
          size="small"
          scroll-height="340px"
          scrollable
        >
          <pv-column field="current_plate" header="Placa" style="min-width:7rem; font-weight:700" />
          <pv-column field="status" header="Estado" style="min-width:6rem">
            <template #body="{ data }">
              <pv-tag
                :value="data.status === 'UPDATED' ? 'Actualizado' : data.status === 'IGNORED' ? 'Ignorado' : 'Fallido'"
                :severity="data.status === 'UPDATED' ? 'success' : data.status === 'IGNORED' ? 'warn' : 'danger'"
              />
            </template>
          </pv-column>
          <pv-column field="reason" header="Detalle" style="min-width:12rem">
            <template #body="{ data }">
              <span class="vcu-reason">{{ data.reason ?? '—' }}</span>
            </template>
          </pv-column>
        </pv-data-table>
      </template>
      <template #footer>
        <pv-button label="Cerrar" icon="pi pi-times" text @click="bulkUpdateResultVisible = false" />
      </template>
    </pv-dialog>

  </div>
</template>

<style scoped>
.vc-page {
  flex: 1 1 auto;
}

.vc-filters-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.vc-filter-search {
  width: 100%;
}

.vc-filters {
  display: flex;
  align-items: flex-end;
  gap: 0.625rem;
  width: 100%;
  min-width: 0;
}

.vc-filters__fields {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem 0.625rem;
  flex: 1 1 auto;
  min-width: 0;
}

.vc-filters__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.vc-filters__label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-body-secondary, #6b7280);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vc-filters__clear {
  flex-shrink: 0;
  align-self: flex-end;
  white-space: nowrap;
  margin-bottom: 0.125rem;
}

@media (max-width: 1279px) {
  .vc-filters__fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 899px) {
  .vc-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .vc-filters__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .vc-filters__clear {
    align-self: flex-end;
    margin-bottom: 0;
  }
}

@media (max-width: 479px) {
  .vc-filters__fields {
    grid-template-columns: 1fr;
  }
}

.vc-filters :deep(.p-select),
.vc-filters :deep(.p-multiselect) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 2.5rem;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.vc-filters :deep(.p-select-label),
.vc-filters :deep(.p-multiselect-label) {
  padding: 0 0.625rem;
  font-size: 0.875rem;
  line-height: 1;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 0;
  min-width: 0;
}

.vc-filter-search {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.vc-filter-search :deep(.p-iconfield),
.vc-filter-search :deep(.p-inputtext) {
  width: 100%;
}

/* Placa: una línea; scroll horizontal de la tabla si hace falta */
.vc-plate {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.vc-plate-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
}
.vc-ext-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.35rem;
}

/* ── Entry date/time cell ────────────────────────────────────────────────── */
.vc-entry-date {
  display: block;
  font-size: 0.82rem;
  color: var(--text-body);
  font-weight: 500;
}

.vc-entry-time {
  display: block;
  font-size: 0.72rem;
  color: var(--text-body-secondary);
}

.vc-dash {
  color: var(--text-body-secondary);
}

.vc-motivo {
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--text-body);
  word-break: break-word;
}

.vc-ubicacion-tag {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: normal;
  text-align: left;
  line-height: 1.3;
}

/* ── Days-in-plant badge ─────────────────────────────────────────────────── */
.vc-days-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: 20px;
  letter-spacing: 0.02em;
}

.vc-days--ok      { background: #dcfce7; color: #15803d; }
.vc-days--warn    { background: #fef9c3; color: #a16207; }
.vc-days--alert   { background: #ffedd5; color: #c2410c; }
.vc-days--danger  { background: #fee2e2; color: #b91c1c; }

/* ── Bulk update result dialog ───────────────────────────────────────────── */
.vcu-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.vcu-summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.vcu-chip--updated { background: #dcfce7; color: #15803d; }
.vcu-chip--ignored { background: #fef9c3; color: #a16207; }
.vcu-chip--failed  { background: #fee2e2; color: #b91c1c; }

.vcu-summary-total {
  font-size: 0.78rem;
  color: #6b7280;
  margin-left: 0.25rem;
}

.vcu-reason {
  font-size: 0.78rem;
  color: #374151;
}
</style>
