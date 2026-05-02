<script setup>
// ===========================
// IMPORTS
// ===========================
import { ref, computed, watch } from 'vue'
import * as XLSX from 'xlsx'
import { useSpreadsheetImport } from '@/shared/composables/use-spreadsheet-import.js'

// ===========================
// PROPS
// ===========================
const props = defineProps({
  visible:       { type: Boolean, required: true },
  importColumns: { type: Array,   default: () => [] },
  title:         { type: String,  default: 'Importar datos' },
  previewRows:   { type: Number,  default: 5 },
  /** Nombre del .xlsx al descargar la plantilla (debe incluir .xlsx o se añade solo). */
  templateDownloadFileName: { type: String, default: 'plantilla-importacion.xlsx' },
  /** Nombre de la hoja en el Excel de plantilla. */
  templateSheetName: { type: String, default: 'Plantilla' },
  /** Filas de ejemplo: objetos con claves = `key` de cada columna en importColumns. */
  templateSampleRows: { type: Array, default: () => [] },
})

// ===========================
// EMITS
// ===========================
const emit = defineEmits(['update:visible', 'import-confirmed'])

// ===========================
// COMPOSABLE
// ===========================
const { parsedRows, parseErrors, isLoading, fileName, parseFile, reset } = useSpreadsheetImport()

// ===========================
// STATE
// ===========================
const fileInput    = ref(null)
const isDragOver   = ref(false)
const selectedFile = ref(null)

// ===========================
// COMPUTED
// ===========================
const hasFile     = computed(() => !!selectedFile.value)
const canConfirm  = computed(() => parsedRows.value.length > 0 && parseErrors.value.length === 0)
const previewData = computed(() => parsedRows.value.slice(0, props.previewRows))

const requiredCols = computed(() => props.importColumns.filter(c => c.required !== false))
const optionalCols = computed(() => props.importColumns.filter(c => c.required === false))

// ===========================
// METHODS
// ===========================
const processFile = async (file) => {
  selectedFile.value = file
  await parseFile(file, props.importColumns)
}

const onFileInputChange = (e) => {
  const file = e.target.files?.[0]
  if (file) processFile(file)
}

const onDrop = (e) => {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

const confirmImport = () => {
  emit('import-confirmed', parsedRows.value)
  closeDialog()
}

const closeDialog = () => emit('update:visible', false)

/**
 * Genera y descarga un archivo Excel de plantilla con los encabezados configurados.
 * - Sin filas de ejemplo: fila de referencia (hints) + fila vacía (solo orientación; al importar conviene borrar esas filas).
 * - Con templateSampleRows: encabezados + filas de ejemplo importables (sin fila de hints, para que sheet_to_json sea válido).
 */
const downloadTemplate = () => {
  const headers = props.importColumns.map(col => col.header)
  const referenceRow = props.importColumns.map(col => {
    if (col.hint) return col.hint.replaceAll(' · ', ' | ')
    if (col.default !== undefined && col.default !== null && col.default !== '') return `Ej: ${col.default}`
    return `Ej: ${col.header}`
  })

  const aoa = [headers]

  if (props.templateSampleRows?.length) {
    for (const sample of props.templateSampleRows) {
      aoa.push(props.importColumns.map((col) => {
        const raw = sample[col.key]
        if (raw != null && raw !== '') return String(raw)
        if (col.default !== undefined && col.default !== null && col.default !== '') return String(col.default)
        return ''
      }))
    }
  } else {
    aoa.push(referenceRow, props.importColumns.map(() => ''))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Ancho de columna: encabezado, hints o celdas de ejemplo
  ws['!cols'] = props.importColumns.map((col) => {
    const base = col.header.length + 4
    const hint = col.hint ? col.hint.length + 4 : 0
    let sampleLen = 0
    if (props.templateSampleRows?.length) {
      for (const sample of props.templateSampleRows) {
        const cell = sample[col.key]
        if (cell != null && cell !== '') sampleLen = Math.max(sampleLen, String(cell).length + 2)
      }
    }
    return { wch: Math.max(base, hint, sampleLen, 14) }
  })

  const wb = XLSX.utils.book_new()
  const sheetName = (props.templateSheetName || 'Plantilla').slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  let outName = (props.templateDownloadFileName || 'plantilla-importacion.xlsx').trim()
  if (!outName.toLowerCase().endsWith('.xlsx')) outName = `${outName}.xlsx`
  XLSX.writeFile(wb, outName)
}

// ===========================
// WATCHERS
// ===========================
watch(() => props.visible, (val) => {
  if (!val) {
    reset()
    selectedFile.value = null
    isDragOver.value   = false
    if (fileInput.value) fileInput.value.value = ''
  }
})
</script>

<template>
  <pv-dialog
    :visible="visible"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="dialog-light"
    style="width: min(96vw, 660px)"
    :pt="{ content: { style: 'padding: 0' }, header: { style: 'padding: 1rem 1.25rem 0.75rem' } }"
    @update:visible="closeDialog"
  >
    <!-- ── Header ─────────────────────────────────────────────── -->
    <template #header>
      <div class="flex align-items-center gap-2">
        <div class="isd-header-icon">
          <i class="pi pi-file-import" />
        </div>
        <div>
          <p class="m-0 font-semibold" style="font-size:0.95rem; color: var(--text-body)">{{ title }}</p>
          <p class="m-0 text-xs" style="margin-top:2px; color: var(--text-body-secondary)">Excel (.xlsx, .xls) o CSV</p>
        </div>
      </div>
    </template>

    <!-- ── Stepper horizontal ─────────────────────────────────── -->
    <div class="isd-stepper">
      <div class="isd-stepper-item" :class="{ 'isd-stepper-item--done': true }">
        <div class="isd-stepper-dot">1</div>
        <span>Formato</span>
      </div>
      <div class="isd-stepper-line" :class="{ 'isd-stepper-line--done': hasFile }" />
      <div class="isd-stepper-item" :class="{ 'isd-stepper-item--done': hasFile && canConfirm, 'isd-stepper-item--error': hasFile && parseErrors.length > 0, 'isd-stepper-item--active': !hasFile }">
        <div class="isd-stepper-dot">2</div>
        <span>Archivo</span>
      </div>
      <div class="isd-stepper-line" :class="{ 'isd-stepper-line--done': canConfirm }" />
      <div class="isd-stepper-item" :class="{ 'isd-stepper-item--active': canConfirm, 'isd-stepper-item--muted': !canConfirm }">
        <div class="isd-stepper-dot">3</div>
        <span>Confirmar</span>
      </div>
    </div>

    <!-- ── Cuerpo: dos columnas ───────────────────────────────── -->
    <div class="isd-body">

      <!-- Columna izquierda: formato esperado -->
      <div class="isd-panel isd-panel--left">
        <p class="isd-panel-title">Columnas del archivo</p>

        <div v-if="requiredCols.length" class="mb-3">
          <p class="isd-group-label">Requeridas</p>
          <div class="flex flex-column gap-2">
            <div
              v-for="col in requiredCols"
              :key="col.key"
              class="isd-col-row isd-col-row--required"
            >
              <i class="pi pi-lock isd-col-icon" />
              <span class="isd-col-name">{{ col.header }}</span>
              <span class="isd-col-dot isd-col-dot--required" />
            </div>
          </div>
        </div>

        <div v-if="optionalCols.length">
          <p class="isd-group-label">Opcionales</p>
          <div class="flex flex-column gap-2">
            <div
              v-for="col in optionalCols"
              :key="col.key"
              class="isd-col-row isd-col-row--optional"
            >
              <i class="pi pi-minus isd-col-icon" />
              <span class="isd-col-name">{{ col.header }}</span>
            </div>
          </div>
        </div>

        <!-- Tip plantilla -->
        <div class="isd-tip" @click="downloadTemplate">
          <i class="pi pi-download" />
          <span>Descargar plantilla .xlsx</span>
        </div>
      </div>

      <!-- Separador vertical -->
      <div class="isd-v-sep" />

      <!-- Columna derecha: carga + feedback -->
      <div class="isd-panel isd-panel--right">
        <p class="isd-panel-title">Subir archivo</p>

        <!-- Drop zone -->
        <div
          class="isd-drop-zone"
          :class="{
            'isd-drop-zone--drag':    isDragOver,
            'isd-drop-zone--success': hasFile && !isLoading && canConfirm,
            'isd-drop-zone--error':   hasFile && parseErrors.length > 0,
          }"
          role="button"
          tabindex="0"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <!-- Procesando -->
          <template v-if="isLoading">
            <pv-progress-spinner style="width:28px;height:28px" stroke-width="4" />
            <span class="isd-dz-hint">Procesando…</span>
          </template>

          <!-- Éxito -->
          <template v-else-if="hasFile && canConfirm">
            <div class="isd-dz-icon isd-dz-icon--success">
              <i class="pi pi-file-excel" />
            </div>
            <span class="isd-dz-filename">{{ fileName }}</span>
            <span class="isd-dz-hint">Clic para cambiar</span>
          </template>

          <!-- Error -->
          <template v-else-if="hasFile && parseErrors.length > 0">
            <div class="isd-dz-icon isd-dz-icon--error">
              <i class="pi pi-exclamation-triangle" />
            </div>
            <span class="isd-dz-filename">{{ fileName }}</span>
            <span class="isd-dz-hint">Clic para reintentar</span>
          </template>

          <!-- Vacío -->
          <template v-else>
            <div class="isd-dz-icon">
              <i class="pi pi-cloud-upload" />
            </div>
            <span class="isd-dz-label">Arrastra o haz clic</span>
            <span class="isd-dz-hint">.xlsx · .xls · .csv</span>
          </template>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          class="hidden"
          @change="onFileInputChange"
        />

        <!-- Alertas -->
        <div v-if="parseErrors.length > 0" class="mt-2 flex flex-column gap-1">
          <div v-for="(err, i) in parseErrors" :key="i" class="isd-alert isd-alert--error">
            <i class="pi pi-times-circle flex-shrink-0" />
            <span>{{ err }}</span>
          </div>
        </div>

        <div v-if="canConfirm" class="mt-2 isd-alert isd-alert--success">
          <i class="pi pi-check-circle flex-shrink-0" />
          <span>
            <strong>{{ parsedRows.length }}</strong>
            {{ parsedRows.length === 1 ? 'registro listo' : 'registros listos' }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Vista previa ───────────────────────────────────────── -->
    <Transition name="isd-slide">
      <div v-if="previewData.length > 0" class="isd-preview">
        <div class="isd-preview-header">
          <i class="pi pi-table text-500" />
          <span class="text-sm font-medium text-600">Vista previa</span>
          <span class="isd-preview-badge">{{ previewData.length }} / {{ parsedRows.length }} filas</span>
        </div>
        <pv-data-table
          :value="previewData"
          :scrollable="true"
          scroll-height="150px"
          size="small"
          class="isd-preview-table"
        >
          <pv-column
            v-for="col in importColumns"
            :key="col.key"
            :field="col.key"
            :header="col.header"
            style="min-width: 100px"
          />
        </pv-data-table>
      </div>
    </Transition>

    <!-- ── Footer ─────────────────────────────────────────────── -->
    <template #footer>
      <div class="flex align-items-center justify-content-end gap-2 w-full">
        <pv-button label="Cancelar" severity="secondary" outlined @click="closeDialog" />
        <pv-button
          label="Confirmar importación"
          icon="pi pi-check"
          :disabled="!canConfirm"
          @click="confirmImport"
        />
      </div>
    </template>
  </pv-dialog>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════
   HEADER ICON
══════════════════════════════════════════════════════════ */
.isd-header-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--primary-tint-bg);
  border: 1px solid var(--primary-tint-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════════
   STEPPER
══════════════════════════════════════════════════════════ */
.isd-stepper {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.5rem;
  border-bottom: 1px solid var(--border-ui);
  background: var(--surface-light);
  gap: 0;
}

.isd-stepper-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-body-muted);
  white-space: nowrap;
  transition: color 0.2s;
}

.isd-stepper-item--done   { color: var(--color-primary); }
.isd-stepper-item--error  { color: var(--warning-tint-text); }
.isd-stepper-item--active { color: var(--text-body-secondary); }
.isd-stepper-item--muted  { color: var(--border-ui); }

.isd-stepper-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  font-weight: 700;
  background: var(--border-ui);
  color: var(--text-body-secondary);
  transition: background 0.2s, color 0.2s;
}

.isd-stepper-item--done  .isd-stepper-dot { background: var(--color-primary);     color: #fff; }
.isd-stepper-item--error .isd-stepper-dot { background: var(--warning-tint-text); color: #fff; }
.isd-stepper-item--active .isd-stepper-dot { background: var(--text-body-muted);  color: #fff; }

.isd-stepper-line {
  flex: 1;
  height: 2px;
  background: var(--border-ui);
  margin: 0 0.5rem;
  border-radius: 2px;
  transition: background 0.3s;
}
.isd-stepper-line--done { background: var(--color-primary); }

/* ══════════════════════════════════════════════════════════
   BODY — dos columnas
══════════════════════════════════════════════════════════ */
.isd-body {
  display: flex;
  min-height: 220px;
  background: var(--surface-white);
}

.isd-panel {
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  background: var(--surface-white);
}

.isd-panel--left  { width: 46%; }
.isd-panel--right { flex: 1; }

.isd-v-sep {
  width: 1px;
  background: var(--border-ui);
  align-self: stretch;
  flex-shrink: 0;
}

.isd-panel-title {
  margin: 0 0 0.75rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}

.isd-group-label {
  margin: 0 0 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-body-muted);
}

/* ── Column rows ────────────────────────────────── */
.isd-col-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  border: 1px solid;
}

.isd-col-row--required {
  border-color: var(--primary-tint-border);
  background: var(--primary-tint-bg);
  color: var(--color-primary);
}
.isd-col-row--optional {
  border-color: var(--border-ui);
  background: var(--surface-light);
  color: var(--text-body-secondary);
}

.isd-col-icon { font-size: 0.65rem; opacity: 0.7; }
.isd-col-name  { flex: 1; }
.isd-col-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.isd-col-dot--required { background: var(--color-primary); }

/* ── Tip / plantilla ──────────────────────────── */
.isd-tip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.9rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.15s;
  text-decoration: none;
}
.isd-tip:hover { opacity: 1; }
.isd-tip .pi { font-size: 0.78rem; }

/* ══════════════════════════════════════════════════════════
   DROP ZONE
══════════════════════════════════════════════════════════ */
.isd-drop-zone {
  flex: 1;
  min-height: 120px;
  border: 2px dashed var(--text-body-muted);
  border-radius: 10px;
  background: var(--surface-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  user-select: none;
  padding: 1rem;
  text-align: center;
}

.isd-drop-zone:hover:not(.isd-drop-zone--drag):not(.isd-drop-zone--success):not(.isd-drop-zone--error) {
  border-color: var(--color-primary);
  background: var(--primary-tint-bg);
}
.isd-drop-zone--drag    { border-color: var(--color-primary) !important;     background: var(--primary-tint-bg); }
.isd-drop-zone--success { border-color: var(--success-tint-text) !important;  background: var(--success-tint-bg); }
.isd-drop-zone--error   { border-color: var(--warning-tint-text) !important;  background: var(--warning-tint-bg); }

/* Icon circle */
.isd-dz-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--border-ui);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: var(--text-body-muted);
  transition: background 0.18s, color 0.18s;
}
.isd-drop-zone--drag .isd-dz-icon { background: var(--primary-tint-border); color: var(--color-primary); }
.isd-dz-icon--success { background: var(--success-tint-border); color: var(--success-tint-text); }
.isd-dz-icon--error   { background: var(--warning-tint-border); color: var(--warning-tint-text); }

.isd-dz-label    { font-size: 0.85rem; font-weight: 600; color: var(--text-body-secondary); }
.isd-dz-filename { font-size: 0.82rem; font-weight: 600; color: var(--text-body);            word-break: break-all; }
.isd-dz-hint     { font-size: 0.72rem; color: var(--text-body-muted); }

/* ══════════════════════════════════════════════════════════
   ALERTS
══════════════════════════════════════════════════════════ */
.isd-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 7px;
  border: 1px solid;
  font-size: 0.8rem;
}
.isd-alert--error {
  border-color: var(--error-tint-border);
  background: var(--error-tint-bg);
  color: var(--error-tint-text);
}
.isd-alert--success {
  border-color: var(--success-tint-border);
  background: var(--success-tint-bg);
  color: var(--success-tint-text);
}

/* ══════════════════════════════════════════════════════════
   PREVIEW
══════════════════════════════════════════════════════════ */
.isd-preview {
  border-top: 1px solid var(--border-ui);
  background: var(--surface-white);
  padding: 0.75rem 1.25rem 0;
  overflow: hidden;
}

.isd-preview-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
  font-size: 0.78rem;
  color: var(--text-body-secondary);
}

.isd-preview-badge {
  margin-left: auto;
  font-size: 0.7rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-lighter);
  color: var(--text-body-secondary);
  font-weight: 500;
}

/* ── Transition slide-down ──────────────────────── */
.isd-slide-enter-active,
.isd-slide-leave-active { transition: max-height 0.28s ease, opacity 0.22s ease; max-height: 260px; overflow: hidden; }
.isd-slide-enter-from,
.isd-slide-leave-to     { max-height: 0; opacity: 0; }
</style>
