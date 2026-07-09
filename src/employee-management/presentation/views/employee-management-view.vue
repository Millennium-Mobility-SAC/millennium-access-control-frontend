<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { downloadImportErrorReport } from '@/shared/composables/use-import-error-report.js'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import ImportSpreadsheet from '@/shared/presentation/components/import-spreadsheet.vue'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { useEmployeeManagementStore } from '../../application/employee-management.store.js'
import { useIamStore } from '@/iam/application/iam.store.js'
import EmployeeCreateAndEdit from '../components/employee-create-and-edit.vue'
import { EMPLOYEE_ROUTE_NAMES } from '../employee-management.routes.js'
import {
  DOCUMENT_TYPES,
  EMPLOYEE_IMPORT_COLUMNS,
  EMPLOYEE_IMPORT_TEMPLATE_FILENAME,
  EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS,
  EMPLOYEE_STATUS_OPTIONS,
} from '../constants/employee-management-ui.constants.js'
import { todayIsoLocal } from '@/shared/domain/employee-attendance-day.js'

const router = useRouter()
const store = useEmployeeManagementStore()
const iamStore = useIamStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError, showInfo } = useNotification()

const dialogVisible = ref(false)
const isEditing = ref(false)
const editEntity = ref(null)
const importVisible = ref(false)

const searchText = ref('')
const filterStatus = ref(null)

function buildFilters() {
  return {
    status: filterStatus.value ?? undefined,
    search: searchText.value.trim() || undefined,
  }
}

watch(filterStatus, () => {
  run(() => store.fetchEmployees(buildFilters()))
})

let _empSearchTimer = null
watch(searchText, () => {
  clearTimeout(_empSearchTimer)
  _empSearchTimer = setTimeout(() => {
    run(() => store.fetchEmployees(buildFilters()))
  }, 350)
})

/** Anchos y plantillas alineados con la tabla de Colaboradores. */
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
    template: 'document-template',
    style: 'min-width: 8.5rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'status',
    header: 'Estado',
    template: 'status-template',
    style: 'min-width: 6.5rem',
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
  const key = String(data?.id ?? data?.fullName ?? '')
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

function statusLabel(status) {
  return status === 'ACTIVE' ? 'Activo' : 'Inactivo'
}

/** Excel: descarga todos los empleados que coincidan con los filtros activos. */
async function exportEmployeesExcel() {
  let list = null
  await run(async () => { list = await store.exportEmployees() })
  if (error.value) { showError(error.value); return }
  if (!list?.length) {
    showError('No hay empleados para exportar con los filtros actuales.')
    return
  }
  const rows = list.map((e) => ({
    Trabajador: (e.fullName ?? '').trim() || '—',
    Cargo: (e.position ?? '').trim() || '—',
    'Tipo de documento': getDocTypeLabel(e.documentType),
    Documento: e.documentNumber ?? '',
    Estado: statusLabel(e.status),
  }))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Empleados')
  if (rows.length) {
    ws.addRow(Object.keys(rows[0]))
    rows.forEach(r => ws.addRow(Object.values(r)))
  }
  const date = todayIsoLocal()
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `empleados-${date}.xlsx`)
}

function openNewDialog() {
  isEditing.value = false
  editEntity.value = null
  dialogVisible.value = true
}

function openEditDialog(item) {
  isEditing.value = true
  editEntity.value = item
  dialogVisible.value = true
}

function goToEmployeeDetail(item) {
  if (item?.id == null) return
  router.push({ name: EMPLOYEE_ROUTE_NAMES.DETAIL, params: { id: String(item.id) } })
}

async function handleSave(entity) {
  await run(async () => {
    if (isEditing.value) {
      await store.update(entity.id, entity)
      showSuccess('Empleado actualizado correctamente.')
    } else {
      await store.create(entity)
      showSuccess('Empleado creado correctamente.')
    }
    dialogVisible.value = false
  })
  if (error.value) showError(error.value)
}

async function handleDelete(item) {
  await run(async () => {
    await store.remove(item.id)
    showSuccess('Empleado eliminado correctamente.')
  })
  if (error.value) showError(error.value)
}

async function handleDeleteSelected(items) {
  await run(async () => {
    await Promise.all(items.map(item => store.remove(item.id)))
    showSuccess(`${items.length} empleado(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

async function handleDeleteAll() {
  await run(async () => {
    const count = await store.deleteAll()
    showSuccess(`${count} empleado(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

async function handleImport(rows, importColumns) {
  let result = null
  await run(async () => { result = await store.bulkCreate(rows) })
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} empleado(s) importado(s) correctamente.`)
    } else {
      const msg = result.success > 0
        ? `${result.success} importado(s), ${result.failed} no se procesó(aron).`
        : `No se pudo importar ningún empleado (${result.failed} error(es)).`
      showError(`${msg} Descargando reporte de errores...`)
      if (importColumns?.length) {
        await downloadImportErrorReport(result.failedRows, importColumns, 'errores-importacion-empleados')
      }
    }
  } else if (error.value) showError(error.value)
}

function clearAllFilters() {
  searchText.value = ''
  filterStatus.value = null
  // watchers fire automatically and reload data
}

function handleEmpPageChange({ page }) {
  run(() => store.goToEmpPage(page))
}

onMounted(async () => {
  await run(() => store.fetchEmployees({}), { errorMessage: 'No se pudo cargar el listado de empleados.' })
  if (error.value) showError(error.value)
})
</script>

<template>
  <div class="em-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.employees"
      :total-records="store.empPagination.totalElements"
      :rows="20"
      :lazy="true"
      :title="{ singular: 'empleado', plural: 'empleados' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      :show-export="false"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalles"
      :show-edit-action="true"
      :show-delete-action="iamStore.hasFullActionAccess"
      :show-history-action="false"
      @new-item-requested-manager="openNewDialog"
      @edit-item-requested-manager="openEditDialog"
      @view-item-requested-manager="goToEmployeeDetail"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @delete-all-requested-manager="handleDeleteAll"
      @clear-filters="clearAllFilters"
      @page-changed="handleEmpPageChange"
    >
      <template #extra-actions>
        <pv-button label="Importar" icon="pi pi-upload" severity="info" size="small" outlined @click="importVisible = true" />
        <pv-button
          label="Exportar"
          icon="pi pi-download"
          severity="secondary"
          size="small"
          outlined
          @click="exportEmployeesExcel"
        />
      </template>
      <template #filters="{ clearFilters }">
        <div class="app-filters-row app-filters-row--stack-sm em-filters w-full">
          <pv-icon-field class="em-filter-search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por nombre, cargo o documento"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>
          <pv-select
            v-model="filterStatus"
            :options="EMPLOYEE_STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            show-clear
            class="em-filter-select w-full"
          />
          <pv-button
            type="button"
            label="Limpiar filtros"
            text
            size="small"
            class="w-full sm:w-auto"
            @click="clearFilters"
          />
        </div>
      </template>
      <template #empleado-template="{ data }">
        <div v-if="data" class="em-name-cell">
          <span class="em-avatar" :style="getAvatarStyle(data)">
            {{ employeeInitials(data) }}
          </span>
          <div class="em-name-text min-w-0">
            <span class="em-name-primary">{{ data.fullName || '—' }}</span>
            <span class="em-name-sub">{{ data.position?.trim() || '—' }}</span>
          </div>
        </div>
        <span v-else>—</span>
      </template>

      <template #document-template="{ data }">
        <div v-if="data" class="em-doc-cell">
          <span class="doc-type-badge">{{ getDocTypeLabel(data.documentType) }}</span>
          <span class="em-doc-num">{{ data.documentNumber || '—' }}</span>
        </div>
        <span v-else>—</span>
      </template>

      <template #status-template="{ value }">
        <span
          class="em-status-pill"
          :class="value === 'ACTIVE' ? 'em-status-pill--active' : 'em-status-pill--inactive'"
        >
          <span class="em-status-pill__dot" aria-hidden="true" />
          {{ statusLabel(value) }}
        </span>
      </template>
    </DataManager>

    <EmployeeCreateAndEdit
      :visible="dialogVisible"
      :edit="isEditing"
      :entity="editEntity"
      :submit-loading="isLoading"
      @canceled-shared="dialogVisible = false"
      @saved-shared="handleSave"
    />

    <ImportSpreadsheet
      v-model:visible="importVisible"
      :import-columns="EMPLOYEE_IMPORT_COLUMNS"
      :template-download-file-name="EMPLOYEE_IMPORT_TEMPLATE_FILENAME"
      template-sheet-name="Empleados"
      :template-sample-rows="EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS"
      title="Importar empleados"
      @import-confirmed="handleImport"
    />
  </div>
</template>

<style scoped>
.em-page {
  /* Ocupa alto útil bajo el toolbar en layout flex */
  flex: 1 1 auto;
}

.em-filters {
  align-items: stretch;
  width: 100%;
}

@media (min-width: 768px) {
  .em-filters {
    display: grid;
    grid-template-columns: minmax(10rem, 1.75fr) minmax(9rem, 13rem) auto;
    gap: 0.75rem;
    align-items: center;
  }
}

.em-filter-select,

.em-filter-select :deep(.p-select) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.em-filter-search {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.em-filter-search :deep(.p-iconfield),
.em-filter-search :deep(.p-inputtext) {
  width: 100%;
}

.em-name-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.em-name-text {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.em-name-primary {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
  word-break: break-word;
}

.em-name-sub {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.25;
  word-break: break-word;
}

.em-avatar {
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

.em-doc-cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: 100%;
  line-height: 1.35;
}

.em-doc-num {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.em-status-pill {
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

.em-status-pill__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.em-status-pill--active {
  background: #dcfce7;
  color: #15803d;
  border-color: #bbf7d0;
}
.em-status-pill--active .em-status-pill__dot {
  background: #16a34a;
}

.em-status-pill--inactive {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #e5e7eb;
}
.em-status-pill--inactive .em-status-pill__dot {
  background: #9ca3af;
}

.em-page :deep(.p-datatable .p-datatable-thead > tr > th) {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.65rem 0.75rem;
}

.em-page :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.8rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.em-page :deep(.p-datatable .p-datatable-tbody > tr:hover) {
  background: #f8fafc;
}
</style>

