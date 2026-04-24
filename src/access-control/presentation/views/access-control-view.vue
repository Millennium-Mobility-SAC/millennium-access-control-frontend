<script setup>
import { ref, computed, onMounted }                        from 'vue'
import { useAccessControlStore }                from '../../application/access-control.store.js'
import { useAsyncAction }                       from '@/shared/composables/use-async-action.js'
import { useNotification }                      from '@/shared/composables/use-notification.js'
import DataManager                              from '@/shared/presentation/components/data-manager.vue'
import AccessCreateAndEdit                      from '../components/access-create-and-edit.vue'
import AccessRegisterExit                       from '../components/access-register-exit.vue'
import AccessRegisterReturn                     from '../components/access-register-return.vue'
import AccessImportDialog                        from '../components/access-import-dialog.vue'
import AccessDetailDrawer                        from '../components/access-detail-drawer.vue'
import { MOTIVOS_INGRESO, MOTIVO_SEVERITY, TIPOS_INGRESO, TIPOS_DOCUMENTO, ACCESS_STATUS, ACCESS_STATUS_SEVERITY, MOTIVOS_SALIDA_TEMPORAL } from '../constants/access-control-ui.constants.js'
import * as XLSX from 'xlsx'

const store              = useAccessControlStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

const drawerVisible = ref(false)
const drawerItem    = ref(null)

const exitDialogVisible   = ref(false)
const exitEntity          = ref(null)

const returnDialogVisible = ref(false)
const returnEntity        = ref(null)

// Filtros
const filterStatus = ref(null)
const filterType   = ref(null)
const filterMotivo = ref(null)
const searchText   = ref('')

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  return store.items.filter(item => {
    if (filterStatus.value && item.status !== filterStatus.value) return false
    if (filterType.value   && item.type   !== filterType.value)   return false
    if (filterMotivo.value && item.entryReason !== filterMotivo.value) return false
    if (q) {
      const searchable = [
        item.licensePlate,
        item.fullName,
        item.firstName,
        item.lastName,
        item.brand,
        item.model,
        item.clientDocumentNumber,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })
})

function clearAllFilters() {
  filterStatus.value = null
  filterType.value   = null
  filterMotivo.value = null
  searchText.value   = ''
}

async function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
  await run(() => store.fetchById(item.id))
  if (store.selected) drawerItem.value = store.selected
}

const columns = [
  { field: 'status',      header: 'Estado',        sortable: true, style: 'min-width: 150px', template: 'status-template'   },
  { field: 'type',        header: 'Tipo',           sortable: true, style: 'min-width: 100px', template: 'tipo-template'     },
  { field: 'licensePlate', header: 'Placa / Nombre', sortable: true, style: 'min-width: 150px', template: 'identidad-template' },
  { field: 'entryReason', header: 'Motivo',          sortable: true, style: 'min-width: 140px', template: 'motivo-template'   },
  { field: 'entryDate',   header: 'Ingreso',         sortable: true, style: 'min-width: 160px', template: 'ingreso-template'  },
  { field: 'exitDate',    header: 'Salida',          sortable: true, style: 'min-width: 160px', template: 'salida-template'   },
]

function formatDate(value) {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d) ? '-' : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(value) {
  if (!value) return null
  const parts = value.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  const s = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(m)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h % 12 === 0 ? 12 : h % 12
  const base   = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return s !== null && !isNaN(s)
    ? `${base}:${String(s).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

function getEntryReasonLabel(value) {
  return MOTIVOS_INGRESO.find(m => m.value === value)?.label ?? value ?? '-'
}

function getEntryReasonSeverity(value) {
  return MOTIVO_SEVERITY[value] ?? 'secondary'
}

function getExitReasonLabel(value) {
  return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === value)?.label ?? value ?? '—'
}

function getStatusLabel(value) {
  return ACCESS_STATUS.find(s => s.value === value)?.label ?? value ?? '-'
}

function getStatusSeverity(value) {
  return ACCESS_STATUS_SEVERITY[value] ?? 'secondary'
}

function getDocumentTypeLabel(value) {
  return TIPOS_DOCUMENTO.find(t => t.value === value)?.label ?? value ?? 'DNI'
}

function openNewDialog() {
  isEditing.value  = false
  editEntity.value = null
  dialogVisible.value = true
}

async function openEditDialog(item) {
  isEditing.value = true
  await run(() => store.fetchById(item.id))
  editEntity.value    = store.selected ?? item
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

async function handleSave(entity) {
  await run(async () => {
    if (isEditing.value) {
      await store.update(entity.id, entity)
      showSuccess('Registro actualizado correctamente.')
    } else {
      await store.create(entity)
      showSuccess('Registro creado correctamente.')
    }
    dialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

function handleDelete(item) {
  run(async () => {
    await store.remove(item.id)
    showSuccess('Registro eliminado correctamente.')
  }).then(() => { if (error.value) showError(error.value) })
}

function openExitDialog(item) {
  exitEntity.value        = item
  exitDialogVisible.value = true
}

function openReturnDialog(item) {
  returnEntity.value        = item
  returnDialogVisible.value = true
}

async function handleExit(exitData) {
  await run(async () => {
    await store.registerExit(exitData.id, exitData)
    showSuccess('Salida registrada correctamente.')
    exitDialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

async function handleReturn(returnData) {
  await run(async () => {
    await store.registerReturn(returnData.id, returnData)
    showSuccess('Retorno registrado correctamente.')
    returnDialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

async function handleDeleteSelected(items) {
  await run(async () => {
    await Promise.all(items.map(item => store.remove(item.id)))
    showSuccess(`${items.length} registro(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

// Importación
const importDialogVisible = ref(false)

async function handleImport(rows) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} ingreso(s) importado(s) correctamente.`)
    } else {
      showError(`${result.success} importado(s), ${result.failed} no se procesó(aron) — verifica los datos.`)
    }
  } else if (error.value) {
    showError(error.value)
  }
}

onMounted(async () => {
  await run(() => store.fetchAll())
})

// Exportación a Excel
function label(list, value, fallback = value ?? '—') {
  return list.find(i => i.value === value)?.label ?? fallback
}

function fmtDateExport(value) {
  if (!value) return ''
  const str = String(value)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : new Date(str)
  return isNaN(d) ? str : d
}

function applySheetStyles(ws, colWidths) {
  ws['!cols'] = colWidths.map(wch => ({ wch }))
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && cell.t === 'd') cell.z = 'DD/MM/YYYY'
    }
  }
}

function fmtTimeExport(value) {
  if (!value) return ''
  const parts = value.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  const s = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(m)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const base = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return s !== null && !isNaN(s)
    ? `${base}:${String(s).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

// Columnas compartidas (ingreso, registrado por, salida permanente, salida temporal)
function sharedExitCols(exit, exitIndex) {
  return {
    'Nro. Salida Temporal':   exitIndex !== null ? exitIndex + 1 : '',
    'Estado Salida Temporal': exit ? label(ACCESS_STATUS, exit.status) : '',
    'Motivo Salida Temporal': exit ? label(MOTIVOS_SALIDA_TEMPORAL, exit.exitReason) : '',
    'Fecha Salida Temporal':  exit ? fmtDateExport(exit.exitDate) : '',
    'Hora Salida Temporal':   exit ? fmtTimeExport(exit.exitTime) : '',
    'Placa Reemplazo':        exit ? (exit.replacementLicensePlate ?? '') : '',
    'Fecha Retorno':          exit ? fmtDateExport(exit.returnDate) : '',
    'Hora Retorno':           exit ? fmtTimeExport(exit.returnTime) : '',
  }
}

function sharedEntryCols(entry) {
  return {
    'ID':                      entry.id ?? '',
    'Estado':                  label(ACCESS_STATUS, entry.status),
    'Motivo Ingreso':          label(MOTIVOS_INGRESO, entry.entryReason),
    'Fecha Ingreso':           fmtDateExport(entry.entryDate),
    'Hora Ingreso':            fmtTimeExport(entry.entryTime),
    'Registrado por':          [entry.registeredByFirstName, entry.registeredByLastName].filter(Boolean).join(' ') || '',
    'Fecha Salida Permanente': fmtDateExport(entry.permanentExitDate),
    'Hora Salida Permanente':  fmtTimeExport(entry.permanentExitTime),
    'Tipo Doc. Cliente':       entry.permanentExitDate ? label(TIPOS_DOCUMENTO, entry.customerDocumentType) : '',
    'Nro. Doc. Cliente':       entry.permanentExitDate ? (entry.customerDni ?? '') : '',
    'Nombre Cliente':          entry.permanentExitDate ? (entry.customerFirstName ?? '') : '',
    'Apellido Cliente':        entry.permanentExitDate ? (entry.customerLastName ?? '') : '',
  }
}

function buildVehicleRow(entry, exit = null, exitIndex = null) {
  return {
    ...sharedEntryCols(entry),
    'Placa':       entry.licensePlate ?? '',
    'Marca':       entry.brand        ?? '',
    'Modelo':      entry.model        ?? '',
    'Año':         entry.year         ?? '',
    'Kilometraje': entry.mileage      ?? '',
    'Color':       entry.color        ?? '',
    ...sharedExitCols(exit, exitIndex),
  }
}

function buildPersonRow(entry, exit = null, exitIndex = null) {
  return {
    ...sharedEntryCols(entry),
    'Tipo Documento': label(TIPOS_DOCUMENTO, entry.documentType),
    'Nro. Documento': entry.clientDocumentNumber ?? '',
    'Nombre':         entry.firstName            ?? '',
    'Apellido':       entry.lastName             ?? '',
    ...sharedExitCols(exit, exitIndex),
  }
}

function flattenRows(entries, buildRow) {
  const rows = []
  for (const entry of entries) {
    if (entry.temporalExits?.length > 0) {
      entry.temporalExits.forEach((exit, i) => rows.push(buildRow(entry, exit, i)))
    } else {
      rows.push(buildRow(entry))
    }
  }
  return rows
}

// Anchos de columna (en caracteres) por hoja
const VEHICLE_COL_WIDTHS = [6, 18, 18, 14, 12, 22, 24, 22, 18, 18, 18, 18, 12, 14, 16, 6, 14, 12, 20, 22, 22, 20, 18, 18, 14, 12]
const PERSON_COL_WIDTHS  = [6, 18, 18, 14, 12, 22, 24, 22, 18, 18, 18, 18, 18, 18, 16, 16, 20, 22, 22, 20, 18, 18, 14, 12]

function handleExport() {
  const vehicles = store.items.filter(e => e.type === 'VEHICULO')
  const persons  = store.items.filter(e => e.type === 'PERSONA')

  const wb = XLSX.utils.book_new()

  if (vehicles.length > 0) {
    const ws = XLSX.utils.json_to_sheet(flattenRows(vehicles, buildVehicleRow), { cellDates: true })
    applySheetStyles(ws, VEHICLE_COL_WIDTHS)
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos')
  }
  if (persons.length > 0) {
    const ws = XLSX.utils.json_to_sheet(flattenRows(persons, buildPersonRow), { cellDates: true })
    applySheetStyles(ws, PERSON_COL_WIDTHS)
    XLSX.utils.book_append_sheet(wb, ws, 'Personas')
  }

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `control-acceso-${date}.xlsx`)
}
</script>

<template>
  <div class="p-3">

    <DataManager
      :items="store.items"
      :filtered-items="filteredItems"
      :title="{ singular: 'registro', plural: 'registros' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      search-placeholder="Busca por placa, nombre, marca..."
      new-button-label="Registrar Ingreso"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalle"
      :show-edit-action="false"
      :show-delete-action="true"
      :show-exit-action="true"
      exit-button-label="Registrar salida"
      :exit-action-condition="(item) => item.status === 'EN_PLANTA' || item.status === 'EN_PLANTA_CUSTODIA'"
      :show-return-action="true"
      return-button-label="Registrar retorno"
      :return-action-condition="(item) => item.status === 'SALIDA_TEMPORAL'"
      :show-import="false"
      :show-export="false"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="openDrawer"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @import-data-requested-manager="handleImport"
      @exit-item-requested-manager="openExitDialog"
      @return-item-requested-manager="openReturnDialog"
      @global-filter-change="(v) => searchText = v"
      @clear-filters="clearAllFilters"
    >
      <template #extra-actions>
        <pv-button
          icon="pi pi-upload"
          label="Importar"
          severity="info"
          size="small"
          outlined
          @click="importDialogVisible = true"
        />
        <pv-button
          icon="pi pi-download"
          label="Exportar"
          severity="secondary"
          size="small"
          outlined
          @click="handleExport"
        />
      </template>

      <template #filters>
        <div class="ac-filters">
          <pv-select
            v-model="filterStatus"
            :options="ACCESS_STATUS"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            show-clear
          />
          <pv-select
            v-model="filterType"
            :options="TIPOS_INGRESO"
            option-label="label"
            option-value="value"
            placeholder="Tipo"
            show-clear
          />
          <pv-select
            v-model="filterMotivo"
            :options="MOTIVOS_INGRESO"
            option-label="label"
            option-value="value"
            placeholder="Motivo"
            show-clear
          />
        </div>
      </template>

      <template #status-template="{ data }">
        <pv-tag
          :value="getStatusLabel(data.status)"
          :severity="getStatusSeverity(data.status)"
        />
      </template>

      <template #tipo-template="{ data }">
        <pv-tag
          :value="data.type === 'PERSONA' ? 'Persona' : 'Vehículo'"
          :severity="data.type === 'PERSONA' ? 'info' : 'secondary'"
          :icon="data.type === 'PERSONA' ? 'pi pi-user' : 'pi pi-car'"
        />
      </template>

      <template #identidad-template="{ data }">
        <span v-if="data.type === 'PERSONA'" style="color: var(--color-gray-900); font-weight: 500">
          {{ data.fullName || '—' }}
        </span>
        <span v-else class="font-bold" style="letter-spacing: 0.04em">
          {{ data.licensePlate || '—' }}
        </span>
      </template>

      <template #motivo-template="{ value }">
        <pv-tag
          :value="getEntryReasonLabel(value)"
          :severity="getEntryReasonSeverity(value)"
        />
      </template>

      <template #ingreso-template="{ data }">
        <div class="flex flex-column" style="line-height: 1.4">
          <span style="font-weight: 600">{{ formatDate(data.entryDate) }}</span>
          <span style="font-size: 0.8rem; color: #6b7280">{{ formatTime(data.entryTime) || '—' }}</span>
        </div>
      </template>

      <template #salida-template="{ data }">
        <div v-if="data.exitDate || data.exitTime" class="flex flex-column" style="line-height: 1.4">
          <span style="font-weight: 600; color: var(--color-success)">{{ formatDate(data.exitDate) }}</span>
          <span style="font-size: 0.8rem; color: #6b7280">{{ formatTime(data.exitTime) || '—' }}</span>
        </div>
        <span v-else class="exit-badge-active">Pendiente</span>
      </template>
    </DataManager>

    <!-- Detail Drawer -->
    <AccessDetailDrawer
      v-model:visible="drawerVisible"
      :item="drawerItem"
      @edit-requested="openEditDialog"
    />

    <!-- Create / Edit dialog -->
    <AccessCreateAndEdit
      :entity="editEntity"
      :visible="dialogVisible"
      :edit="isEditing"
      @canceled-shared="closeDialog"
      @saved-shared="handleSave"
    />

    <!-- Register Exit dialog -->
    <AccessRegisterExit
      :entity="exitEntity"
      :visible="exitDialogVisible"
      @canceled="exitDialogVisible = false"
      @saved="handleExit"
    />

    <!-- Register Return dialog -->
    <AccessRegisterReturn
      :entity="returnEntity"
      :visible="returnDialogVisible"
      @canceled="returnDialogVisible = false"
      @saved="handleReturn"
    />

    <!-- Diálogo de importación con selector de tipo -->
    <AccessImportDialog
      v-model:visible="importDialogVisible"
      @import-confirmed="handleImport"
    />

  </div>
</template>

<style scoped>
.exit-badge-active {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background-color: #dbeafe;
  color: #1d4ed8;
  white-space: nowrap;
}

/* ── Filters bar ─────────────────────────────────────────── */
.ac-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.ac-filters :deep(.p-select) {
  width: 10rem;
}

@media (max-width: 640px) {
  .ac-filters {
    width: 100%;
  }
  .ac-filters :deep(.p-select) {
    flex: 1 1 100%;
    min-width: 0;
  }
}

/* ── Drawer detail panel ─────────────────────────────────── */
/* styles are global — see utilities.css */
</style>
