<script setup>
/**
 * DataManagerComponent
 * 
 * Componente reutilizable para gestión de datos en tablas con funcionalidades completas:
 * - Paginación y ordenamiento dinámico
 * - Filtrado global y personalizado (interno/externo)
 * - Operaciones CRUD con confirmaciones
 * - Selección múltiple y exportación a CSV
 * - Acciones por fila (ver, editar, eliminar)
 * - Slots personalizables para columnas y filtros
 * 
 * @component
 * @example
 * <DataManagerComponent
 *   :items="orders"
 *   :title="{ singular: 'orden', plural: 'órdenes' }"
 *   :columns="columns"
 *   :dynamic="true"
 *   @new-item-requested-manager="handleNew"
 *   @delete-item-requested-manager="handleDelete"
 * />
 */

// ===========================
// IMPORTS
// ===========================
import { ref, computed, onMounted, useSlots, defineAsyncComponent } from 'vue'
import { FilterMatchMode } from '@primevue/core'
import { useConfirm } from 'primevue/useconfirm'

/** Lazy: ExcelJS (~900KB) must not load with every DataManager list view (tablets OOM). */
const ImportSpreadsheet = defineAsyncComponent(() => import('./import-spreadsheet.vue'))

// ===========================
// PROPS
// ===========================
/**
 * Props del componente organizadas por categoría:
 * - Datos básicos: items, title, columns
 * - Configuración de vista: dynamic, loading, rows
 * - Filtros: searchPlaceholder, filteredItems, globalFilterValue
 * - Visibilidad de acciones: showActions, showSelection, showNew, etc.
 * - Textos personalizables: labels de botones y acciones
 */
const props = defineProps({
  // Datos y configuración básica
  items: { type: Array, required: true },
  title: { type: Object, required: true }, // { singular: '', plural: '' }
  dynamic: { type: Boolean, default: false },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  
  // Configuración de búsqueda y filtros
  searchPlaceholder: { type: String, default: 'Busca por ID reporte, ID orden, verificador...' },
  filteredItems: { type: Array, default: null }, // Items pre-filtrados desde padre
  globalFilterValue: { type: String, default: null }, // Control externo del filtro global
  /** Si es false, se oculta la caja de búsqueda global (solo slot #filters). */
  showGlobalSearch: { type: Boolean, default: true },
  /** Si es true, el botón Exportar se muestra al final de la fila de búsqueda / #filters. */
  exportInline: { type: Boolean, default: false },
  showExport: { type: Boolean, default: true },


  // Configuración de visibilidad de componentes
  showActions: { type: Boolean, default: true },
  showSelection: { type: Boolean, default: true },
  showNew: { type: Boolean, default: true },
  showDelete: { type: Boolean, default: true },
  showActionButtons: { type: Boolean, default: true },
  
  // Configuración de paginación
  rows: { type: Number, default: 10 },
  rowsPerPageOptions: { type: Array, default: () => [10, 20, 30, 50] },
  
  // Labels de botones principales
  newButtonLabel:    { type: String, default: 'Agregar'   },
  deleteButtonLabel: { type: String, default: 'Eliminar'  },
  exportButtonLabel: { type: String, default: 'Exportar'  },
  importButtonLabel: { type: String, default: 'Importar'  },

  // Configuración de importación
  showImport:    { type: Boolean, default: false      },
  importColumns: { type: Array,   default: () => []   }, // [{ key, header, required?, default? }]

  // Configuración de acciones por fila
  showViewAction: { type: Boolean, default: true },
  showEditAction: { type: Boolean, default: false },
  showDeleteAction: { type: Boolean, default: false },
  showHistoryAction: { type: Boolean, default: false },
  showExitAction: { type: Boolean, default: false },
  showReturnAction: { type: Boolean, default: false },
  editButtonLabel: { type: String, default: 'Editar' },
  deleteActionLabel: { type: String, default: 'Eliminar' },
  viewButtonLabel: { type: String, default: 'Ver detalles' },
  historyButtonLabel: { type: String, default: 'Ver historial' },
  exitButtonLabel: { type: String, default: 'Registrar salida' },
  returnButtonLabel: { type: String, default: 'Registrar retorno' },
  exitActionCondition: { type: Function, default: null },
  returnActionCondition: { type: Function, default: null },
  viewActionIconOnly: { type: Boolean, default: false },
  /** Texto adicional en el diálogo de confirmación al eliminar (p. ej. efectos en cascada). */
  deleteConfirmExtra: { type: String, default: '' },

  // Paginación lazy (server-side)
  /** Activa el modo lazy: la paginación se delega al servidor. */
  lazy:         { type: Boolean, default: false },
  /** Total de registros en el servidor (requerido cuando lazy=true). */
  totalRecords: { type: Number,  default: 0     },
})

// ===========================
// EMITS
// ===========================
/**
 * Eventos emitidos hacia el componente padre:
 * - CRUD: new, delete-selected, delete-item, view, edit
 * - Filtros: global-filter-change, clear-filters
 * - Selección: row-select, row-unselect
 */
const emit = defineEmits([
  'new-item-requested-manager',
  'delete-selected-items-requested-manager',
  'view-item-requested-manager',
  'edit-item-requested-manager',
  'delete-item-requested-manager',
  'history-item-requested-manager',
  'exit-item-requested-manager',
  'return-item-requested-manager',
  'global-filter-change',
  'clear-filters',
  'row-select',
  'row-unselect',
  'import-data-requested-manager',
  'delete-all-requested-manager',
  'page-changed',
])

// ===========================
// COMPOSABLES
// ===========================
const confirm = useConfirm() // Servicio de confirmación de PrimeVue
const slots = useSlots()

const showInlineExport = computed(() => props.showExport && props.exportInline)

/**
 * Fila inferior de acciones (nuevo, eliminar, importar, exportar “clásico”, extra-actions).
 * Export queda fuera si va en línea con la búsqueda (exportInline).
 */
const showSecondaryToolbar = computed(() => {
  if (!props.showActionButtons) return false
  const exportInSecondary = props.showExport && !props.exportInline
  return (
    props.showNew
    || (props.showDelete && props.showSelection)
    || exportInSecondary
    || props.showImport
    || !!slots['extra-actions']
  )
})

// ===========================
// STATE
// ===========================
const selectedItems = ref([]) // Items seleccionados en la tabla
const filters = ref(null) // Configuración de filtros de PrimeVue
const internalGlobalFilterValue = ref('') // Valor interno del filtro global
const dt = ref(null) // Referencia al componente DataTable
const showImportDialog = ref(false) // Controla la visibilidad del diálogo de importación

// ===========================
// COMPUTED PROPERTIES
// ===========================
/**
 * Items a mostrar en la tabla
 * Prioriza filteredItems del padre, caso contrario usa items
 */
const displayItems = computed(() => props.filteredItems || props.items)

/**
 * Valor del filtro global con sincronización bidireccional
 * Permite control interno o externo del filtro
 */
const currentGlobalFilterValue = computed({
  get: () => props.globalFilterValue !== null ? props.globalFilterValue : internalGlobalFilterValue.value,
  set: (value) => {
    internalGlobalFilterValue.value = value || ''
    emit('global-filter-change', value || '')
  }
})

// ===========================
// METHODS - FILTERS
// ===========================
/**
 * Inicializa la configuración de filtros de PrimeVue
 */
const initFilters = () => {
  filters.value = { global: { value: null, matchMode: FilterMatchMode.CONTAINS } }
}

/**
 * Aplica el filtro global cuando cambia el valor
 * Solo funciona si no hay filtros personalizados del padre
 */
const onGlobalFilterChange = () => {
  if (!props.filteredItems) {
    filters.value['global'].value = currentGlobalFilterValue.value || null
  }
}

/**
 * Limpia todos los filtros (internos y externos)
 * Emite eventos para sincronizar con el componente padre
 */
const clearFilters = () => {
  internalGlobalFilterValue.value = ''
  currentGlobalFilterValue.value = ''
  initFilters()
  emit('clear-filters')
  emit('global-filter-change', '')
}

// ===========================
// METHODS - CRUD OPERATIONS
// ===========================
/**
 * Emite evento para crear nuevo item
 */
const newItem = () => emit('new-item-requested-manager')

/**
 * Muestra confirmación y elimina items seleccionados
 * Maneja plural/singular según cantidad de items
 */
function appendDeleteConfirmExtra(baseMessage) {
  const extra = (props.deleteConfirmExtra ?? '').trim()
  if (!extra) return baseMessage
  return `${baseMessage}\n\n${extra}`
}

const confirmDeleteSelected = () => {
  // Lazy mode + selectAll: the visible page is only a subset of all records.
  // Emit a dedicated event so the parent can delete from the server side.
  if (selectAll.value && props.lazy) {
    const base = `¿Está seguro de que desea eliminar TODOS los ${props.totalRecords} ${props.title.plural}?`
    confirm.require({
      message: appendDeleteConfirmExtra(base),
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      rejectProps:  { label: 'Cancelar', severity: 'secondary', outlined: true },
      acceptProps:  { label: 'Eliminar todos', severity: 'danger' },
      accept: () => {
        selectAll.value     = false
        selectedItems.value = []
        emit('delete-all-requested-manager')
      },
      reject: () => {}
    })
    return
  }

  const count = selectedItems.value.length
  const base = `¿Está seguro de que desea eliminar ${count} ${count === 1 ? props.title.singular : props.title.plural}?`
  confirm.require({
    message: appendDeleteConfirmExtra(base),
    header: 'Confirmación',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Cancelar',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Eliminar',
      severity: 'danger'
    },
    accept: () => emit('delete-selected-items-requested-manager', selectedItems.value),
    reject: () => {}
  })
}

/**
 * Muestra confirmación y elimina un item individual
 * Detecta automáticamente el identificador del item (orderNumber, name, id)
 */
const confirmDeleteItem = (item) => {


  const itemIdentifier = item.licensePlate || item.vin || item.fullName || item.firstName || item.name || item.id || ''
  
  const base = `¿Está seguro de eliminar ${itemIdentifier ? `"${itemIdentifier}"` : `esta ${props.title.singular}`}?`
  confirm.require({
    message: appendDeleteConfirmExtra(base),
    header: 'Confirmación',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: {
      label: 'Cancelar',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Eliminar',
      severity: 'danger'
    },
    accept: () => emit('delete-item-requested-manager', item),
    reject: () => {}
  })
}

// ===========================
// METHODS - TABLE ACTIONS
// ===========================
/**
 * Exporta los datos de la tabla a formato CSV
 */
const exportToCsv = () => dt.value.exportCSV()

/**
 * Maneja el evento de paginación de PrimeVue.
 * En modo lazy delega al padre; en modo normal PrimeVue ya pagina internamente.
 */
const onPage = (event) => {
  if (props.lazy) {
    emit('page-changed', { page: event.page, rows: event.rows })
  }
}

/**
 * Emite evento cuando se selecciona una fila
 */
const onRowSelect   = (event) => emit('row-select', event)

/**
 * Emite evento cuando se deselecciona una fila
 */
const onRowUnselect = (event) => {
  emit('row-unselect', event)
  if (selectAll.value) selectAll.value = false
}

// ── Select-all across all pages ──────────────────────────────────────────────
/** Reflects whether ALL items (all pages) are currently selected. */
const selectAll = ref(false)

/**
 * Fired when the DataTable header checkbox is toggled.
 * Overrides PrimeVue's default behaviour (current page only) so the header
 * checkbox selects / deselects every item in displayItems.
 */
function onSelectAllChange(event) {
  selectAll.value    = event.checked
  selectedItems.value = event.checked ? displayItems.value.slice() : []
}

// ===========================
// LIFECYCLE HOOKS
// ===========================
/**
 * Inicializa los filtros al montar el componente
 */
onMounted(() => initFilters())
</script>

<template>
  <!-- NOTA: pv-toast eliminado - se usa el global de App.vue para evitar duplicados -->

  <div class="h-full flex flex-column overflow-hidden">

    <!-- Search and Filter Section -->
    <div class="flex flex-column mb-2 border-bottom-1 surface-border">

      <!-- Fila de filtros: stack-sm solo dentro del slot del padre; aquí alineación inferior (IconField + Select) -->
      <div class="app-filters-row dm-filters-row mb-4 w-full">
        <!-- Global Search Input -->
        <pv-icon-field
          v-if="showGlobalSearch"
          class="dm-global-search min-w-0"
        >
          <pv-input-icon class="pi pi-search" />

          <pv-input-text
              v-model="currentGlobalFilterValue"
              :placeholder="searchPlaceholder"
              @input="onGlobalFilterChange"
          />
        </pv-icon-field>

        <div class="dm-filters-slot min-w-0 w-full">
          <slot name="filters" :clear-filters="clearFilters" />
        </div>

        <pv-button
          v-if="showInlineExport"
          icon="pi pi-download"
          :label="exportButtonLabel"
          severity="secondary"
          size="small"
          outlined
          class="flex-shrink-0 w-full md:w-auto"
          @click="exportToCsv"
        />
      </div>

    </div>

    <!-- Action Buttons: izquierda CRUD principal, derecha import/export (+ slot) -->
    <div v-if="showSecondaryToolbar" class="dm-secondary-toolbar mb-3">
      <div class="dm-secondary-toolbar__inner">
        <div class="dm-secondary-toolbar__primary">
          <pv-button
            v-if="showNew"
            icon="pi pi-plus"
            :label="newButtonLabel"
            severity="success"
            size="small"
            class="dm-stoolbar-btn w-full sm:w-auto"
            @click="newItem"
          />

          <pv-button
            v-if="showDelete && showSelection"
            :disabled="!selectedItems || !selectedItems.length"
            icon="pi pi-trash"
            :label="deleteButtonLabel"
            severity="danger"
            size="small"
            class="dm-stoolbar-btn w-full sm:w-auto"
            @click="confirmDeleteSelected"
          />
        </div>

        <div class="dm-secondary-toolbar__secondary">
          <slot name="extra-actions" />

          <pv-button
            v-if="showImport"
            icon="pi pi-upload"
            :label="importButtonLabel"
            severity="info"
            size="small"
            outlined
            class="dm-stoolbar-btn w-full sm:w-auto"
            @click="showImportDialog = true"
          />
          <pv-button
            v-if="showExport && !exportInline"
            icon="pi pi-download"
            :label="exportButtonLabel"
            severity="secondary"
            size="small"
            outlined
            class="dm-stoolbar-btn w-full sm:w-auto"
            @click="exportToCsv"
          />
        </div>
      </div>
    </div>

    <ImportSpreadsheet
      v-if="showImport && showImportDialog"
      v-model:visible="showImportDialog"
      :import-columns="importColumns"
      @import-confirmed="(rows, cols) => emit('import-data-requested-manager', rows, cols)"
    />

    <!-- Data Table Section -->
    <div class="flex-1 flex flex-column overflow-hidden" style="min-height: 0;">

      <pv-data-table
        ref="dt"
        v-model:selection="selectedItems"
        :value="loading ? [] : displayItems"
        :filters="filteredItems ? null : filters"
        :loading="loading"
        :paginator="true"
        :rows="rows"
        :rows-per-page-options="rowsPerPageOptions"
        scrollable
        scroll-height="flex"
        :global-filter-fields="filteredItems ? [] : columns.map(col => col.field)"
        data-key="id"
        paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        current-page-report-template="Mostrando {first} - {last} de {totalRecords} registros"
        hover
        :lazy="lazy"
        :total-records="totalRecords"
        :select-all="selectAll"
        @select-all-change="onSelectAllChange"
        @page="onPage"
        @row-select="onRowSelect"
        @row-unselect="onRowUnselect"
      >
        <!-- Selection Column -->
        <pv-column
            v-if="showSelection"
            :exportable="false"
            selection-mode="multiple"
            header-style="width: 3rem; text-align: center"
            body-style="text-align: center"
        />

        <!-- Custom Slot Columns -->
        <slot name="custom-columns-manager" />

        <!-- Dynamic Columns -->
        <pv-column
          v-if="dynamic"
          v-for="column in columns"
          :key="column.field"
          :field="column.field"
          :header="column.header"
          :sortable="false"
          :style="column.style || 'min-width: 150px;'"
          :header-style="column.headerStyle || 'text-align: center;'"
          :body-style="column.bodyStyle || 'text-align: center;'"
          :header-class="column.headerClass"
          :body-class="column.bodyClass"
        >
          <template v-if="column.template" #body="slotProps">
            <slot :name="column.template" :data="slotProps.data" :value="slotProps.data[column.field]" />
          </template>
        </pv-column>

        <!-- Actions Column -->
        <pv-column
          v-if="showActions"
          :exportable="false"
          header="Acciones"
          :header-style="{ width: '8rem', textAlign: 'center' }"
          :body-style="{ textAlign: 'center' }"
        >
          <template #body="slotProps">
            <div class="flex gap-1 justify-content-center">
              <pv-button
                  v-if="showViewAction && !viewActionIconOnly"
                  :label="viewButtonLabel"
                  link
                  size="small"
                  @click="emit('view-item-requested-manager', slotProps.data)"
              />
              <pv-button
                  v-if="showViewAction && viewActionIconOnly"
                  icon="pi pi-eye"
                  severity="info"
                  text
                  rounded
                  v-tooltip.top="viewButtonLabel"
                  @click="emit('view-item-requested-manager', slotProps.data)"
              />
              <pv-button
                  v-if="showEditAction"
                  icon="pi pi-pencil"
                  severity="warn"
                  text
                  rounded
                  v-tooltip.top="editButtonLabel"
                  @click="emit('edit-item-requested-manager', slotProps.data)"
              />
              <pv-button
                  v-if="showDeleteAction"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="deleteActionLabel"
                  @click="confirmDeleteItem(slotProps.data)"
              />
              <pv-button
                  v-if="showHistoryAction"
                  icon="pi pi-history"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="historyButtonLabel"
                  @click="emit('history-item-requested-manager', slotProps.data)"
              />
              <pv-button
                  v-if="showExitAction && (exitActionCondition ? exitActionCondition(slotProps.data) : true)"
                  icon="pi pi-sign-out"
                  severity="warn"
                  text
                  rounded
                  v-tooltip.top="exitButtonLabel"
                  @click="emit('exit-item-requested-manager', slotProps.data)"
              />
              <pv-button
                  v-if="showReturnAction && (returnActionCondition ? returnActionCondition(slotProps.data) : true)"
                  icon="pi pi-replay"
                  severity="success"
                  text
                  rounded
                  v-tooltip.top="returnButtonLabel"
                  @click="emit('return-item-requested-manager', slotProps.data)"
              />
            </div>
          </template>
        </pv-column>

        <!-- Empty State -->
        <template #empty>
          <div class="flex flex-column align-items-center justify-content-center gap-2 p-4">
            <i class="pi pi-search text-4xl text-400"></i>
            <p class="text-600 m-0">No se encontraron registros</p>
          </div>
        </template>

        <!-- Loading State -->
        <template #loading>
          <div class="flex flex-column align-items-center justify-content-center gap-3 p-4">
            <pv-progress-spinner style="width:50px;height:50px" stroke-width="4" />
            <p class="text-600 m-0">Cargando datos...</p>
          </div>
        </template>
      </pv-data-table>
    </div>
  </div>
</template>

<style>
/*
 * Fila de filtros DataManager:
 * - Con búsqueda global: CSS Grid reparte columnas (evita solape flex IconField + Select).
 * - Sin búsqueda: solo slot a ancho completo.
 */
.app-filters-row.dm-filters-row {
  align-items: center;
}

.app-filters-row.dm-filters-row:has(> .dm-global-search) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

/* Export en línea con filtros (poco usado) */
.app-filters-row.dm-filters-row:has(> .dm-global-search):has(> .pv-button) {
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
}

@media (max-width: 767px) {
  .app-filters-row.dm-filters-row:has(> .dm-global-search) {
    grid-template-columns: 1fr;
  }

  .app-filters-row.dm-filters-row:has(> .dm-global-search):has(> .pv-button) {
    grid-template-columns: 1fr;
  }
}

.dm-global-search {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.dm-global-search :deep(.p-iconfield),
.dm-global-search :deep(.p-inputtext) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.dm-filters-slot {
  min-width: 0;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  box-sizing: border-box;
}

.dm-filters-slot > * {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
}

.dm-secondary-toolbar__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: space-between;
}

.dm-secondary-toolbar__primary,
.dm-secondary-toolbar__secondary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.dm-secondary-toolbar__secondary {
  margin-left: auto;
}

/* Móvil: grupos en rejilla 2 columnas, secundario debajo del primario */
@media (max-width: 575px) {
  .dm-secondary-toolbar__inner {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .dm-secondary-toolbar__secondary {
    margin-left: 0;
  }

  .dm-secondary-toolbar__primary,
  .dm-secondary-toolbar__secondary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }

  .dm-secondary-toolbar__primary .p-button,
  .dm-secondary-toolbar__secondary .p-button {
    width: 100%;
    justify-content: center;
    min-height: 2.75rem;
  }
}

/*
 * Barra de filtros DataManager: controles más bajos y tipografía acorde (no el tamaño “formulario principal”).
 */
.dm-filters-row .p-select,
.dm-filters-row .p-dropdown {
  min-height: 2.5rem !important;
  height: 2.5rem !important;
  display: flex !important;
  align-items: center !important;
  border-width: 1px !important;
}

.dm-filters-row .p-select .p-select-label,
.dm-filters-row .p-dropdown .p-dropdown-label {
  padding: 0 0.625rem !important;
  font-size: 0.875rem !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
}

.dm-filters-row .p-inputtext,
.dm-filters-row input.p-inputtext {
  padding: 0 0.625rem !important;
  font-size: 0.875rem !important;
  line-height: 2.5rem !important;
  height: 2.5rem !important;
  min-height: 2.5rem !important;
  border-width: 1px !important;
  box-sizing: border-box !important;
}

.dm-filters-row .p-iconfield .p-inputtext:not(:first-child),
.dm-filters-row .p-iconfield input.p-inputtext:not(:first-child) {
  padding-inline-start: 1.85rem !important;
}

.dm-filters-row .p-datepicker,
.dm-filters-row .p-calendar {
  height: 2.5rem !important;
  min-height: 2.5rem !important;
  width: 100% !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
}


.dm-filters-row .p-datepicker-input,
.dm-filters-row input.p-datepicker-input {
  padding: 0 0.625rem !important;
  font-size: 0.875rem !important;
  line-height: 2.5rem !important;
  height: 2.5rem !important;
  min-height: 2.5rem !important;
  border-width: 1px !important;
  box-sizing: border-box !important;
  flex: 1 1 0 !important;
}

.dm-filters-row .p-datepicker .p-datepicker-input-icon-container,
.dm-filters-row .p-calendar .p-datepicker-input-icon-container {
  top: 50% !important;
  transform: translateY(-50%) !important;
  display: flex !important;
  align-items: center !important;
}
</style>
