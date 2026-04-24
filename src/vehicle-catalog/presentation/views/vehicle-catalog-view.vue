<script setup>
import { ref, onMounted }              from 'vue'
import { useRouter }                   from 'vue-router'
import { useVehicleCatalogStore }      from '../../application/vehicle-catalog.store.js'
import { useAsyncAction }              from '@/shared/composables/use-async-action.js'
import { useNotification }             from '@/shared/composables/use-notification.js'
import DataManager                     from '@/shared/presentation/components/data-manager.vue'
import VehicleCreateAndEdit            from '../components/vehicle-create-and-edit.vue'
import VehicleDetailDrawer             from '../components/vehicle-detail-drawer.vue'
import { VEHICLE_COLUMNS, VEHICLE_IMPORT_COLUMNS } from '../constants/vehicle-catalog-ui.constants.js'

import { getAccessStatusLabel as VEHICLE_STATUS_LABEL_FN, getAccessStatusSeverity } from '@/shared/presentation/constants/access-status.constants.js'

const router             = useRouter()
const store              = useVehicleCatalogStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

const drawerVisible = ref(false)
const drawerItem    = ref(null)

function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
}

const columns = VEHICLE_COLUMNS

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

function openHistory(vehicle) {
  router.push({
    name: 'vehicle-access-history',
    params: { vehicleId: vehicle.id },
    query: { plate: vehicle.licensePlate, brand: vehicle.brand, model: vehicle.model },
  })
}

// ── Date/time formatters ──────────────────────────────────────────────────────
function fmtDate(value) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function fmtTime(value) {
  if (!value) return ''
  const parts = value.split(':')
  const h   = Number(parts[0])
  const min = Number(parts[1])
  const sec = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(min)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const base = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  return sec !== null && !isNaN(sec)
    ? `${base}:${String(sec).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

// ── Days badge class (colores por rango) ──────────────────────────────────────
// 0-3 días → verde | 4-7 → amarillo | 8-14 → naranja | 15+ → rojo
function daysBadgeClass(days) {
  if (days <= 3)  return 'vc-days--ok'
  if (days <= 7)  return 'vc-days--warn'
  if (days <= 14) return 'vc-days--alert'
  return 'vc-days--danger'
}
</script>

<template>
  <div class="p-3">

    <DataManager
      :items="store.vehicles"
      :title="{ singular: 'vehículo', plural: 'vehículos' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      search-placeholder="Busca por placa, marca, modelo..."
      :show-view-action="false"
      :view-action-icon-only="true"
      view-button-label="Ver detalle"
      :show-edit-action="true"
      :show-delete-action="true"
      :show-history-action="true"
      history-button-label="Ver historial de accesos"
      :show-import="false"
      :import-columns="VEHICLE_IMPORT_COLUMNS"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="openDrawer"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @import-data-requested-manager="handleImport"
      @history-item-requested-manager="openHistory"
    >
      <template #vehicle-status="{ value }">
        <pv-tag
          :value="VEHICLE_STATUS_LABEL_FN(value)"
          :severity="getAccessStatusSeverity(value)"
        />
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

    <!-- Detail Drawer -->
    <VehicleDetailDrawer
      v-model:visible="drawerVisible"
      :item="drawerItem"
      @edit-requested="openEditDialog"
    />

    <!-- Create / Edit dialog -->
    <VehicleCreateAndEdit
      :entity="editEntity"
      :visible="dialogVisible"
      :edit="isEditing"
      @canceled-shared="closeDialog"
      @saved-shared="handleSave"
    />

  </div>
</template>

<style scoped>
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
