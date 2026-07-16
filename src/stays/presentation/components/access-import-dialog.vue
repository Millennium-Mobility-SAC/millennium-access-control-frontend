<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import {
  ACCESS_IMPORT_COLUMNS_VEHICULO,
  ACCESS_IMPORT_COLUMNS_PERSONA,
} from '../constants/stays-ui.constants.js'

const ImportSpreadsheet = defineAsyncComponent(() =>
  import('@/shared/presentation/components/import-spreadsheet.vue')
)

// ===========================
// PROPS & EMITS
// ===========================
defineProps({
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['update:visible', 'import-confirmed'])

// ===========================
// STATE
// ===========================
const importType               = ref('VEHICULO')
const importSpreadsheetVisible = ref(false)

// ===========================
// COMPUTED
// ===========================
const importColumns = computed(() =>
  importType.value === 'PERSONA'
    ? ACCESS_IMPORT_COLUMNS_PERSONA
    : ACCESS_IMPORT_COLUMNS_VEHICULO
)

const spreadsheetTitle = computed(() =>
  importType.value === 'PERSONA' ? 'Importar personas' : 'Importar vehículos'
)

// ===========================
// METHODS
// ===========================
function close() {
  emit('update:visible', false)
}

function confirmType() {
  close()
  importSpreadsheetVisible.value = true
}

function onImportConfirmed(rows, columns) {
  // Inyecta el type elegido en cada fila antes de emitir al padre
  const typedRows = rows.map(r => ({ ...r, type: importType.value }))
  emit('import-confirmed', typedRows, columns)
}
</script>

<template>
  <!-- Paso 1: Selector de tipo -->
  <pv-dialog
    :visible="visible"
    modal
    :draggable="false"
    class="dialog-light"
    header="¿Qué tipo de registro deseas importar?"
    style="width: min(96vw, 420px)"
    :pt="{ content: { style: 'padding: 1.25rem' } }"
    @update:visible="close"
  >
    <div class="flex flex-column gap-3">
      <div class="aid-type-switcher">
        <button
          class="aid-type-btn"
          :class="{ 'aid-type-btn--active': importType === 'VEHICULO' }"
          type="button"
          @click="importType = 'VEHICULO'"
        >
          <i class="pi pi-car aid-type-btn__icon" />
          Vehículos
        </button>
        <button
          class="aid-type-btn"
          :class="{ 'aid-type-btn--active': importType === 'PERSONA' }"
          type="button"
          @click="importType = 'PERSONA'"
        >
          <i class="pi pi-user aid-type-btn__icon" />
          Personas
        </button>
      </div>

      <div class="flex justify-content-end gap-2 mt-1">
        <pv-button
          label="Cancelar"
          severity="secondary"
          outlined
          size="small"
          @click="close"
        />
        <pv-button
          label="Continuar"
          severity="info"
          size="small"
          icon="pi pi-arrow-right"
          icon-pos="right"
          @click="confirmType"
        />
      </div>
    </div>
  </pv-dialog>

  <!-- Paso 2: Importador de plantilla -->
  <ImportSpreadsheet
    v-if="importSpreadsheetVisible"
    v-model:visible="importSpreadsheetVisible"
    :import-columns="importColumns"
    :title="spreadsheetTitle"
    @import-confirmed="onImportConfirmed"
  />
</template>

<style scoped>
.aid-type-switcher {
  display: flex;
  border: 1px solid var(--border-ui);
  border-radius: 8px;
  overflow: hidden;
}

.aid-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  background: var(--surface-light);
  color: var(--text-body-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.aid-type-btn + .aid-type-btn {
  border-left: 1px solid var(--border-ui);
}

.aid-type-btn--active {
  background: var(--color-primary);
  color: #ffffff;
}

.aid-type-btn:not(.aid-type-btn--active):hover {
  background: var(--surface-lighter);
  color: var(--text-body);
}

.aid-type-btn__icon {
  font-size: 0.875rem;
}
</style>
