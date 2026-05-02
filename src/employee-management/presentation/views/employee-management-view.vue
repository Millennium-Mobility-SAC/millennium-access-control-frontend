<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
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

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  return store.employees.filter(e => {
    if (filterStatus.value && e.status !== filterStatus.value) return false
    if (!q) return true
    const searchable = [e.fullName, e.position, e.documentNumber].join(' ').toLowerCase()
    return searchable.includes(q)
  })
})

/** Anchos mínimos moderados: scroll horizontal suave en móvil/tablet. */
const columns = [
  { field: 'fullName', header: 'Empleado', style: 'min-width: 9rem' },
  { field: 'position', header: 'Cargo', style: 'min-width: 6.5rem' },
  { field: 'documentNumber', header: 'Documento', style: 'min-width: 7.5rem', template: 'document-template' },
  { field: 'status', header: 'Estado', style: 'min-width: 5.5rem', template: 'status-template' },
]

function getDocTypeLabel(value) {
  return DOCUMENT_TYPES.find(t => t.value === value)?.label ?? value
}

function statusLabel(status) {
  return status === 'ACTIVE' ? 'Activo' : 'Inactivo'
}

/** Excel en cliente: respeta búsqueda y filtro de estado; columna Trabajador. */
function exportEmployeesExcel() {
  const list = filteredItems.value
  if (!list.length) {
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
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
  const date = todayIsoLocal()
  XLSX.writeFile(wb, `empleados-${date}.xlsx`)
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

async function handleImport(rows) {
  let result = null
  await run(async () => { result = await store.bulkCreate(rows) })
  if (result) {
    showInfo(`${result.success} importado(s), ${result.failed} con error.`)
  } else if (error.value) showError(error.value)
}

onMounted(async () => {
  await run(() => store.fetchAll(), { errorMessage: 'No se pudo cargar el listado de empleados.' })
  if (error.value) showError(error.value)
})
</script>

<template>
  <div class="em-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.employees"
      :filtered-items="filteredItems"
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
      <template #filters>
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
        </div>
      </template>
      <template #document-template="{ data }">
        <span class="em-doc-cell">
          <span class="doc-badge">{{ getDocTypeLabel(data.documentType) }}</span>
          <span class="em-doc-num">{{ data.documentNumber }}</span>
        </span>
      </template>
      <template #status-template="{ value }">
        <pv-tag :value="value === 'ACTIVE' ? 'Activo' : 'Inactivo'" :severity="value === 'ACTIVE' ? 'success' : 'secondary'" />
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
    grid-template-columns: minmax(10rem, 1.75fr) minmax(9rem, 1fr);
    gap: 0.75rem;
    align-items: center;
  }
}

.em-filter-select,
.em-filter-select :deep(.p-select) {
  width: 100%;
  max-width: 100%;
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

.doc-badge {
  display: inline-block;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background: #f3f4f6;
  vertical-align: middle;
}

.em-doc-cell {
  display: block;
  max-width: 100%;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.em-doc-num {
  display: inline;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 768px) {
  .em-doc-cell {
    display: inline;
    overflow-wrap: normal;
    word-break: normal;
  }
}
</style>

