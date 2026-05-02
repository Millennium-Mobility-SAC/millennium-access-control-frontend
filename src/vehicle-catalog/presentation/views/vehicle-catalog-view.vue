<script setup>
import { ref, computed, onMounted }  from 'vue'
import { useRouter }                   from 'vue-router'
import { useVehicleCatalogStore }      from '../../application/vehicle-catalog.store.js'
import { useIamStore }                 from '@/iam/application/iam.store.js'
import { useAsyncAction }              from '@/shared/composables/use-async-action.js'
import { useNotification }             from '@/shared/composables/use-notification.js'
import DataManager                     from '@/shared/presentation/components/data-manager.vue'
import VehicleCreateAndEdit            from '../components/vehicle-create-and-edit.vue'
import { VEHICLE_COLUMNS, VEHICLE_IMPORT_COLUMNS } from '../constants/vehicle-catalog-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeHmAmPmForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { VEHICLE_ROUTE_NAMES }         from '../vehicle-catalog.routes.js'
import { MOTIVOS_INGRESO, MOTIVOS_SALIDA_TEMPORAL } from '@/stays/presentation/constants/stays-ui.constants.js'

import { getAccessStatusLabel as VEHICLE_STATUS_LABEL_FN, getAccessStatusSeverity, ACCESS_STATUS } from '@/shared/presentation/constants/access-status.constants.js'

const router             = useRouter()
const store              = useVehicleCatalogStore()
const iamStore           = useIamStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

// Filtros
const filterStatus = ref(null)
const searchText   = ref('')

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  return store.vehicles.filter(v => {
    if (filterStatus.value && v.currentStatus !== filterStatus.value) return false
    if (q) {
      const searchable = [v.licensePlate, v.brand, v.model, String(v.year ?? '')]
        .filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })
})

function clearAllFilters() {
  filterStatus.value = null
  searchText.value   = ''
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

async function handleImport(rows) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} vehículo(s) importado(s) correctamente.`)
    } else {
      showError(`${result.success} importado(s), ${result.failed} no se procesó(aron) — posibles placas duplicadas.`)
    }
  } else if (error.value) {
    showError(error.value)
  }
}

onMounted(async () => {
  await run(() => store.fetchAll())
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

function labelMotivoSalidaTemporal(value) {
  if (value == null || value === '') return '—'
  return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === value)?.label ?? value
}

/** Ubicación: motivo de salida temporal si hay una activa; si no, el motivo de ingreso del flujo. */
function formatUbicacionCatalog(row) {
  if (row.catalogActiveTemporalExitReason) {
    return labelMotivoSalidaTemporal(row.catalogActiveTemporalExitReason)
  }
  return labelMotivoIngreso(row.catalogFlowEntryReason)
}
</script>

<template>
  <div class="vc-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.vehicles"
      :filtered-items="filteredItems"
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
      @import-data-requested-manager="handleImport"
      @clear-filters="clearAllFilters"
    >
      <template #filters>
        <div class="app-filters-row app-filters-row--stack-sm vc-filters w-full">
          <pv-icon-field class="vc-filter-search flex-1 min-w-0 w-full">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por placa, marca, modelo o año"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>
          <pv-select
            v-model="filterStatus"
            :options="ACCESS_STATUS"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            show-clear
            class="vc-filter-select w-full"
          />
        </div>
      </template>

      <template #vehicle-plate-template="{ data }">
        <span class="vc-plate" :title="data.licensePlate || undefined">{{ data.licensePlate || '—' }}</span>
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
        <span class="vc-motivo">{{ formatUbicacionCatalog(data) }}</span>
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

  </div>
</template>

<style scoped>
.vc-page {
  flex: 1 1 auto;
}

.vc-filters {
  align-items: stretch;
}

@media (min-width: 768px) {
  .vc-filters {
    flex-wrap: nowrap;
    align-items: center;
  }

  .vc-filter-select {
    width: 12rem;
    max-width: 100%;
    flex-shrink: 0;
  }
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
</style>
