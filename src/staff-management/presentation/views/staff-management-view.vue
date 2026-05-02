<script setup>
import { ref, computed, onMounted }                               from 'vue'
import * as XLSX from 'xlsx'
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
  { field: 'fullName',       header: 'Colaborador', sortable: true, style: 'min-width: 9rem; font-weight: 600;', template: 'nombre-template'    },
  { field: 'documentNumber', header: 'Documento',   sortable: true, style: 'min-width: 7rem',                   template: 'documento-template' },
  { field: 'position',       header: 'Cargo',       sortable: true, style: 'min-width: 6.5rem'                                                   },
  { field: 'department',     header: 'Área',        sortable: true, style: 'min-width: 6rem',                   template: 'area-template'      },
  { field: 'email',          header: 'Correo',      sortable: true, style: 'min-width: 9rem'                                                   },
  { field: 'active',         header: 'Estado',      sortable: true, style: 'min-width: 5.5rem',                   template: 'estado-template'    },
]

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
function exportStaffExcel() {
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
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores')
  const date = todayIsoLocal()
  XLSX.writeFile(wb, `colaboradores-${date}.xlsx`)
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

async function handleImport(rows) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} colaborador(es) importado(s) correctamente.`)
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

      <template #filters>
        <div class="app-filters-row app-filters-row--stack-sm sm-filters w-full">
          <pv-icon-field class="sm-filter-search flex-1 min-w-0 w-full">
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
        </div>
      </template>
      <template #nombre-template="{ data }">
        <div class="collab-name-cell">
          <span class="collab-avatar">{{ data.firstName?.[0] ?? '?' }}{{ data.lastName?.[0] ?? '' }}</span>
          <span>{{ data.fullName || '—' }}</span>
        </div>
      </template>

      <template #documento-template="{ data }">
        <span class="sm-doc-cell">
          <span class="doc-type-badge">{{ getDocumentTypeLabel(data.documentType) }}</span>
          <span class="sm-doc-num">{{ data.documentNumber || '—' }}</span>
        </span>
      </template>

      <template #area-template="{ value }">
        {{ getDepartmentLabel(value) || '—' }}
      </template>

      <template #estado-template="{ value }">
        <pv-tag
          :value="value ? 'Activo' : 'Inactivo'"
          :severity="value ? 'success' : 'secondary'"
        />
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
}

@media (min-width: 768px) {
  .sm-filters {
    flex-wrap: nowrap;
    align-items: center;
  }

  .sm-filter-select--estado {
    width: 9rem;
    max-width: 100%;
    flex-shrink: 0;
  }

  .sm-filter-select--area {
    width: 11rem;
    max-width: 100%;
    flex-shrink: 0;
  }
}

.collab-name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.collab-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background-color: #dbeafe;
  color: #1d4ed8;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}
.collab-avatar--lg {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 0.75rem;
}

.doc-type-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 600;
}

.sm-doc-cell {
  display: block;
  max-width: 100%;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.sm-doc-num {
  display: inline;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 768px) {
  .sm-doc-cell {
    display: inline;
    overflow-wrap: normal;
    word-break: normal;
  }
}
</style>
