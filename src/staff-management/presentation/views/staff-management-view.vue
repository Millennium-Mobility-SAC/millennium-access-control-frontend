<script setup>
import { ref, computed, onMounted }                               from 'vue'
import { downloadImportErrorReport }            from '@/shared/composables/use-import-error-report.js'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useStaffManagementStore }          from '../../application/staff-management.store.js'
import { useIamStore }                      from '@/iam/application/iam.store.js'
import { useAsyncAction }                   from '@/shared/composables/use-async-action.js'
import { useNotification }                  from '@/shared/composables/use-notification.js'
import DataManager                          from '@/shared/presentation/components/data-manager.vue'
import StaffCreateAndEdit                   from '../components/staff-create-and-edit.vue'
import ImportSpreadsheet                    from '@/shared/presentation/components/import-spreadsheet.vue'
import StaffDetailDrawer                    from '../components/staff-detail-drawer.vue'
import { TIPOS_DOCUMENTO, DEPARTAMENTOS, STAFF_IMPORT_COLUMNS, ROLES_OPTIONS } from '../constants/staff-management-ui.constants.js'
import { todayIsoLocal } from '@/shared/domain/employee-attendance-day.js'

const store              = useStaffManagementStore()
const iamStore           = useIamStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

const drawerVisible = ref(false)
const drawerItem    = ref(null)

// Importación
const importVisible = ref(false)

// Filtros
const filterActive     = ref(null)
const filterDepartment = ref(null)
const searchText       = ref('')

const ESTADO_OPTIONS = [
  { label: 'Activo',   value: true  },
  { label: 'Inactivo', value: false },
]

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  return store.employees.filter(e => {
    if (filterActive.value !== null && e.active !== filterActive.value) return false
    if (filterDepartment.value && e.department !== filterDepartment.value) return false
    if (q) {
      const searchable = [e.fullName, e.firstName, e.lastName, e.email, e.position, e.username, e.documentNumber]
        .filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })
})

function clearAllFilters() {
  filterActive.value     = null
  filterDepartment.value = null
  searchText.value       = ''
}

function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
  // Fetch full profile to get username and roles
  store.fetchById(item.id).then(() => {
    if (store.selected) drawerItem.value = store.selected
  })
}

const columns = [
  {
    field: 'fullName',
    header: 'Colaborador',
    sortable: true,
    template: 'nombre-template',
    style: 'min-width: 12rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'documentNumber',
    header: 'Documento',
    sortable: true,
    template: 'documento-template',
    style: 'min-width: 8.5rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'position',
    header: 'Cargo',
    sortable: true,
    template: 'cargo-template',
    style: 'min-width: 8rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'department',
    header: 'Área',
    sortable: true,
    template: 'area-template',
    style: 'min-width: 7rem',
    headerStyle: 'text-align: left;',
    bodyStyle: 'text-align: left; vertical-align: middle;',
  },
  {
    field: 'active',
    header: 'Estado',
    sortable: true,
    template: 'estado-template',
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

function collaboratorInitials(data) {
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

function getDepartmentLabel(value) {
  return DEPARTAMENTOS.find(d => d.value === value)?.label ?? value ?? '—'
}

function getDocumentTypeLabel(value) {
  return TIPOS_DOCUMENTO.find(t => t.value === value)?.label ?? value ?? 'DNI'
}

function staffStatusLabel(active) {
  return active ? 'Activo' : 'Inactivo'
}

/** Excel en cliente: respeta filtros de la tabla. */
async function exportStaffExcel() {
  const list = filteredItems.value
  if (!list.length) {
    showError('No hay colaboradores para exportar con los filtros actuales.')
    return
  }
  const rows = list.map((e) => ({
    Colaborador: (e.fullName ?? '').trim() || '—',
    'Tipo de documento': getDocumentTypeLabel(e.documentType),
    Documento: e.documentNumber ?? '',
    Cargo: (e.position ?? '').trim() || '—',
    Área: getDepartmentLabel(e.department) || '—',
    Correo: (e.email ?? '').trim() || '—',
    Usuario: (e.username ?? '').trim() || '—',
    Estado: staffStatusLabel(e.active),
  }))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Colaboradores')
  if (rows.length) {
    ws.addRow(Object.keys(rows[0]))
    rows.forEach(r => ws.addRow(Object.values(r)))
  }
  const date = todayIsoLocal()
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `colaboradores-${date}.xlsx`)
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
      showSuccess('Colaborador actualizado correctamente.')
    } else {
      await store.create(entity)
      showSuccess('Colaborador creado correctamente.')
    }
    dialogVisible.value = false
  })
  if (error.value) showError(error.value)
}

function handleDelete(item) {
  run(async () => {
    await store.remove(item.id)
    showSuccess('Colaborador eliminado correctamente.')
  }).then(() => { if (error.value) showError(error.value) })
}

async function handleDeleteSelected(items) {
  await run(async () => {
    await Promise.all(items.map(item => store.remove(item.id)))
    showSuccess(`${items.length} colaborador(es) eliminado(s) correctamente.`)
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
      showSuccess(`${result.success} colaborador(es) importado(s) correctamente.`)
    } else {
      const msg = result.success > 0
        ? `${result.success} importado(s), ${result.failed} no se procesó(aron).`
        : `No se pudo importar ningún colaborador (${result.failed} error(es)).`
      showError(`${msg} Descargando reporte de errores...`)
      if (importColumns?.length) {
        await downloadImportErrorReport(result.failedRows, importColumns, 'errores-importacion-colaboradores')
      }
    }
  } else if (error.value) {
    showError(error.value)
  }
}

onMounted(async () => {
  await run(() => store.fetchAll())
})
</script>

<template>
  <div class="sm-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.employees"
      :filtered-items="filteredItems"
      :title="{ singular: 'colaborador', plural: 'colaboradores' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      :show-export="false"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalle"
      :show-edit-action="true"
      :show-delete-action="iamStore.hasFullActionAccess"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="openDrawer"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @clear-filters="clearAllFilters"
    >
      <template #extra-actions>
        <pv-button
          icon="pi pi-upload"
          label="Importar"
          severity="info"
          size="small"
          outlined
          @click="importVisible = true"
        />
        <pv-button
          label="Exportar"
          icon="pi pi-download"
          severity="secondary"
          size="small"
          outlined
          @click="exportStaffExcel"
        />
      </template>

      <template #filters="{ clearFilters }">
        <div class="app-filters-row app-filters-row--stack-sm sm-filters w-full">
          <pv-icon-field class="sm-filter-search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por nombre, documento, correo o cargo"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>
          <pv-select
            v-model="filterActive"
            :options="ESTADO_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            show-clear
            class="sm-filter-select sm-filter-select--estado w-full"
          />
          <pv-select
            v-model="filterDepartment"
            :options="DEPARTAMENTOS"
            option-label="label"
            option-value="value"
            placeholder="Área"
            show-clear
            class="sm-filter-select sm-filter-select--area w-full"
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
      <template #nombre-template="{ data }">
        <div v-if="data" class="collab-name-cell">
          <span class="collab-avatar" :style="getAvatarStyle(data)">
            {{ collaboratorInitials(data) }}
          </span>
          <div class="collab-name-text min-w-0">
            <span class="collab-name-primary">{{ data.fullName || '—' }}</span>
            <span class="collab-name-email">{{ data.email || '—' }}</span>
          </div>
        </div>
        <span v-else>—</span>
      </template>

      <template #documento-template="{ data }">
        <div v-if="data" class="sm-doc-cell">
          <span class="doc-type-badge">{{ getDocumentTypeLabel(data.documentType) }}</span>
          <span class="sm-doc-num">{{ data.documentNumber || '—' }}</span>
        </div>
        <span v-else>—</span>
      </template>

      <template #cargo-template="{ data }">
        <span class="sm-cell-text">{{ data?.position?.trim() || '—' }}</span>
      </template>

      <template #area-template="{ data }">
        <span class="sm-cell-text">{{ getDepartmentLabel(data?.department) || '—' }}</span>
      </template>

      <template #estado-template="{ value }">
        <span
          class="sm-status-pill"
          :class="value ? 'sm-status-pill--active' : 'sm-status-pill--inactive'"
        >
          <span class="sm-status-pill__dot" aria-hidden="true" />
          {{ staffStatusLabel(value) }}
        </span>
      </template>
    </DataManager>

    <!-- Detail Drawer -->
    <StaffDetailDrawer
      v-model:visible="drawerVisible"
      :item="drawerItem"
      @edit-requested="openEditDialog"
    />

    <!-- Create / Edit dialog -->
    <StaffCreateAndEdit
      :entity="editEntity"
      :visible="dialogVisible"
      :edit="isEditing"
      :submit-loading="isLoading"
      @canceled-shared="closeDialog"
      @saved-shared="handleSave"
    />

    <ImportSpreadsheet
      v-model:visible="importVisible"
      :import-columns="STAFF_IMPORT_COLUMNS"
      title="Importar colaboradores"
      @import-confirmed="handleImport"
    />

  </div>
</template>

<style scoped>
.sm-page {
  flex: 1 1 auto;
}

.sm-filters {
  align-items: stretch;
  width: 100%;
}

@media (min-width: 768px) {
  .sm-filters {
    display: grid;
    grid-template-columns: minmax(10rem, 1.75fr) minmax(9rem, 13rem) minmax(9rem, 13rem) auto;
    gap: 0.75rem;
    align-items: center;
  }
}

.sm-filter-select,
.sm-filter-select :deep(.p-select) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.sm-filter-search {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.sm-filter-search :deep(.p-iconfield),
.sm-filter-search :deep(.p-inputtext) {
  width: 100%;
}

.collab-name-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.collab-name-text {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.collab-name-primary {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
  word-break: break-word;
}

.collab-name-email {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.25;
  word-break: break-word;
}

.collab-avatar {
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

.collab-avatar--lg {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 0.75rem;
}

.sm-cell-text {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.35;
  word-break: break-word;
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

.sm-doc-cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: 100%;
  line-height: 1.35;
}

.sm-doc-num {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.sm-status-pill {
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

.sm-status-pill__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.sm-status-pill--active {
  background: #dcfce7;
  color: #15803d;
  border-color: #bbf7d0;
}
.sm-status-pill--active .sm-status-pill__dot {
  background: #16a34a;
}

.sm-status-pill--inactive {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #e5e7eb;
}
.sm-status-pill--inactive .sm-status-pill__dot {
  background: #9ca3af;
}

/* Tabla: más aire y alineación como referencia */
.sm-page :deep(.p-datatable .p-datatable-thead > tr > th) {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.65rem 0.75rem;
}

.sm-page :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.8rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.sm-page :deep(.p-datatable .p-datatable-tbody > tr:hover) {
  background: #f8fafc;
}
</style>
