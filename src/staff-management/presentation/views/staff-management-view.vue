<script setup>
import { ref, onMounted }                               from 'vue'
import { useStaffManagementStore }          from '../../application/staff-management.store.js'
import { useAsyncAction }                   from '@/shared/composables/use-async-action.js'
import { useNotification }                  from '@/shared/composables/use-notification.js'
import DataManager                          from '@/shared/presentation/components/data-manager.vue'
import StaffCreateAndEdit                   from '../components/staff-create-and-edit.vue'
import ImportSpreadsheet                    from '@/shared/presentation/components/import-spreadsheet.vue'
import StaffDetailDrawer                    from '../components/staff-detail-drawer.vue'
import { TIPOS_DOCUMENTO, DEPARTAMENTOS, STAFF_IMPORT_COLUMNS } from '../constants/staff-management-ui.constants.js'

const store              = useStaffManagementStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)

const drawerVisible = ref(false)
const drawerItem    = ref(null)

// Importación
const importVisible = ref(false)

function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
}

const columns = [
  { field: 'fullName',       header: 'Colaborador', sortable: true, style: 'min-width: 160px; font-weight: 600;', template: 'nombre-template'    },
  { field: 'documentNumber', header: 'Documento',   sortable: true, style: 'min-width: 130px',                   template: 'documento-template' },
  { field: 'position',       header: 'Cargo',       sortable: true, style: 'min-width: 140px'                                                   },
  { field: 'department',     header: 'Área',        sortable: true, style: 'min-width: 130px',                   template: 'area-template'      },
  { field: 'email',          header: 'Correo',      sortable: true, style: 'min-width: 180px'                                                   },
  { field: 'active',         header: 'Estado',      sortable: true, style: 'min-width: 100px',                   template: 'estado-template'    },
]

function getDepartmentLabel(value) {
  return DEPARTAMENTOS.find(d => d.value === value)?.label ?? value ?? '—'
}

function getDocumentTypeLabel(value) {
  return TIPOS_DOCUMENTO.find(t => t.value === value)?.label ?? value ?? 'DNI'
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
  <div class="p-3">

    <DataManager
      :items="store.employees"
      :title="{ singular: 'colaborador', plural: 'colaboradores' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      search-placeholder="Busca por nombre, cargo, correo..."
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalle"
      :show-edit-action="true"
      :show-delete-action="true"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="openDrawer"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
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
      </template>
      <template #nombre-template="{ data }">
        <div class="collab-name-cell">
          <span class="collab-avatar">{{ data.firstName?.[0] ?? '?' }}{{ data.lastName?.[0] ?? '' }}</span>
          <span>{{ data.fullName || '—' }}</span>
        </div>
      </template>

      <template #documento-template="{ data }">
        <span class="doc-type-badge">{{ getDocumentTypeLabel(data.documentType) }}</span>
        <span class="ml-1">{{ data.documentNumber || '—' }}</span>
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
</style>
