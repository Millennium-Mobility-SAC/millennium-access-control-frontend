<script setup>
/**
 * Importación del Excel de inventario, en dos pasos: vista previa y confirmación.
 *
 * La vista previa la calcula el backend sin escribir nada: cuántas placas se agregarían, cuáles ya
 * están y qué filas se rechazan y por qué. Confirmar vuelve a subir el mismo archivo con el hash de
 * la vista previa, así que lo que se aplica es exactamente lo que se revisó.
 *
 * Solo se agregan placas nuevas. Las que ya están no se modifican aunque el archivo traiga otros
 * datos: se muestran como «con diferencias» para que se vean, nada más.
 */
import { computed, ref, watch } from 'vue'
import { useTrafficFinesInventoryStore } from '../../application/traffic-fines-inventory.store.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import { formatCalendarDateForUi } from '@/shared/domain/format-datetime-ui.js'
import { contractStatusSeverity, formatContractStatusLabel } from '../../domain/format-contract-status.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'imported'])

/** Mismo tope que `spring.servlet.multipart.max-file-size` en producción. */
const MAX_FILE_BYTES = 8 * 1024 * 1024

const store = useTrafficFinesInventoryStore()

const fileInput = ref(null)
const file = ref(null)
const preview = ref(null)
const previewing = ref(false)
const applying = ref(false)
const errorMessage = ref(null)
const isDragOver = ref(false)
const activeTab = ref('new')

const busy = computed(() => previewing.value || applying.value)
const canApply = computed(() => !!preview.value && preview.value.newCount > 0 && !busy.value)
const applyLabel = computed(() => {
  const count = preview.value?.newCount ?? 0
  return count === 1 ? 'Importar 1 unidad' : `Importar ${count} unidades`
})

function reset() {
  file.value = null
  preview.value = null
  previewing.value = false
  applying.value = false
  errorMessage.value = null
  isDragOver.value = false
  activeTab.value = 'new'
  if (fileInput.value) fileInput.value.value = ''
}

watch(() => props.visible, (open) => {
  if (!open) reset()
})

function close() {
  // Cerrar a mitad de la aplicación no la cancela: solo escondería el resultado.
  if (applying.value) return
  emit('update:visible', false)
}

/**
 * Los mensajes de este flujo ya vienen redactados para el usuario desde el backend. El
 * humanizador genérico les antepondría «Ya existe un registro con esos datos» en un 409, que aquí
 * no es lo que pasó.
 */
function errorText(error) {
  const message = error?.response?.data?.message
  return typeof message === 'string' && message.trim() ? message : humanizeApiError(error)
}

async function selectFile(selected) {
  if (!selected || busy.value) return
  errorMessage.value = null
  preview.value = null
  file.value = null

  if (!/\.xlsx$/i.test(selected.name)) {
    errorMessage.value = /\.xls$/i.test(selected.name)
      ? 'El archivo está en formato .xls. Ábrelo en Excel, guárdalo como .xlsx y vuelve a subirlo.'
      : 'Selecciona un archivo de Excel (.xlsx).'
    return
  }
  if (selected.size > MAX_FILE_BYTES) {
    errorMessage.value = 'El archivo supera los 8 MB. Quita hojas o formatos que no sean el inventario.'
    return
  }

  file.value = selected
  previewing.value = true
  try {
    preview.value = await store.previewImport(selected)
    // Si no hay nada que agregar, lo útil es ver por qué.
    activeTab.value = preview.value.newCount > 0
      ? 'new'
      : preview.value.rejectedCount > 0 ? 'rejected' : 'differing'
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    previewing.value = false
  }
}

function onFileInputChange(event) {
  selectFile(event.target.files?.[0])
  event.target.value = ''
}

function onDrop(event) {
  isDragOver.value = false
  selectFile(event.dataTransfer?.files?.[0])
}

async function apply() {
  if (!canApply.value) return
  applying.value = true
  errorMessage.value = null
  try {
    const result = await store.applyImport(file.value, preview.value.fileHash)
    emit('imported', result)
    emit('update:visible', false)
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    applying.value = false
  }
}

/** Las listas llegan recortadas: se dice cuántas faltan en vez de dar a entender que son todas. */
function truncationNote(listed, total) {
  return listed < total ? `Se muestran las primeras ${listed} de ${total}.` : null
}

const formatDate = (value) => formatCalendarDateForUi(value)
</script>

<template>
  <pv-dialog
    :visible="visible"
    :modal="true"
    :closable="!applying"
    :draggable="false"
    class="dialog-light"
    style="width: min(96vw, 880px)"
    @update:visible="close"
  >
    <template #header>
      <div class="flex align-items-center gap-2">
        <div class="tfi-header-icon"><i class="pi pi-file-import" /></div>
        <div>
          <p class="m-0 font-semibold tfi-title">Importar inventario de papeletas</p>
          <p class="m-0 text-xs tfi-subtitle">
            Excel (.xlsx) con PLACA y ESTADO. Opcionales: MARCA COMERCIAL, ASESOR, INICIO DE CONTRATO,
            FIN DE CONTRATO y FECHA DE RESOLUCION.
          </p>
        </div>
      </div>
    </template>

    <div class="flex flex-column gap-3">
      <div
        class="tfi-drop-zone"
        :class="{ 'tfi-drop-zone--drag': isDragOver, 'tfi-drop-zone--ready': !!preview }"
        role="button"
        tabindex="0"
        @click="!busy && fileInput?.click()"
        @keydown.enter.prevent="!busy && fileInput?.click()"
        @keydown.space.prevent="!busy && fileInput?.click()"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="onDrop"
      >
        <template v-if="previewing">
          <pv-progress-spinner style="width: 28px; height: 28px" stroke-width="4" />
          <span class="tfi-dz-hint">Leyendo el archivo…</span>
        </template>
        <template v-else-if="file">
          <i class="pi pi-file-excel tfi-dz-icon tfi-dz-icon--ready" />
          <span class="tfi-dz-filename">{{ file.name }}</span>
          <span class="tfi-dz-hint">Clic o arrastra otro archivo para cambiarlo</span>
        </template>
        <template v-else>
          <i class="pi pi-cloud-upload tfi-dz-icon" />
          <span class="tfi-dz-label">Arrastra el Excel o haz clic para elegirlo</span>
          <span class="tfi-dz-hint">Solo .xlsx · hasta 8 MB</span>
        </template>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        class="hidden"
        @change="onFileInputChange"
      />

      <pv-message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</pv-message>

      <template v-if="preview">
        <div class="tfi-counters">
          <div class="tfi-counter">
            <span class="tfi-counter__value">{{ preview.totalRows }}</span>
            <span class="tfi-counter__label">Filas leídas</span>
          </div>
          <div class="tfi-counter tfi-counter--new">
            <span class="tfi-counter__value">{{ preview.newCount }}</span>
            <span class="tfi-counter__label">Nuevas</span>
          </div>
          <div class="tfi-counter">
            <span class="tfi-counter__value">{{ preview.unchangedCount }}</span>
            <span class="tfi-counter__label">Ya en el inventario</span>
          </div>
          <div class="tfi-counter tfi-counter--warn">
            <span class="tfi-counter__value">{{ preview.differingCount }}</span>
            <span class="tfi-counter__label">Ya están con otros datos</span>
          </div>
          <div class="tfi-counter tfi-counter--error">
            <span class="tfi-counter__value">{{ preview.rejectedCount }}</span>
            <span class="tfi-counter__label">Rechazadas</span>
          </div>
        </div>

        <pv-message v-if="preview.missingColumns.length" severity="warn" :closable="false">
          El archivo no trae {{ preview.missingColumns.length === 1 ? 'la columna' : 'las columnas' }}
          <strong>{{ preview.missingColumns.join(', ') }}</strong>: esos datos se importarán vacíos.
        </pv-message>

        <pv-message v-if="preview.differingCount" severity="info" :closable="false">
          Solo se agregan placas nuevas. Las {{ preview.differingCount }} que ya están en el inventario con
          otros datos <strong>no se modifican</strong>; se listan para que las revises.
        </pv-message>

        <pv-tabs v-model:value="activeTab">
          <pv-tab-list>
            <pv-tab value="new">Nuevas ({{ preview.newCount }})</pv-tab>
            <pv-tab value="rejected">Rechazadas ({{ preview.rejectedCount }})</pv-tab>
            <pv-tab value="differing">Con otros datos ({{ preview.differingCount }})</pv-tab>
          </pv-tab-list>
          <pv-tab-panels>
            <pv-tab-panel value="new">
              <p class="tfi-panel-hint">
                Comprueba que las fechas y el estado se leyeron bien antes de confirmar.
                <span v-if="preview.newUnits.length < preview.newCount">
                  Se muestran las primeras {{ preview.newUnits.length }} de {{ preview.newCount }}.
                </span>
              </p>
              <pv-data-table :value="preview.newUnits" size="small" scrollable scroll-height="240px" data-key="rowNumber">
                <pv-column field="rowNumber" header="Fila" style="width: 4rem" />
                <pv-column header="Placa">
                  <template #body="{ data }">
                    <span class="tfi-plate">{{ data.licensePlate }}</span>
                    <span v-if="data.hasDifferentRawPlate" class="tfi-raw"> ({{ data.licensePlateRaw }})</span>
                  </template>
                </pv-column>
                <pv-column field="commercialBrand" header="Marca comercial" />
                <pv-column field="advisor" header="Asesor" />
                <pv-column header="Inicio">
                  <template #body="{ data }">{{ formatDate(data.contractStart) }}</template>
                </pv-column>
                <pv-column header="Fin">
                  <template #body="{ data }">{{ formatDate(data.contractEnd) }}</template>
                </pv-column>
                <pv-column header="Resolución">
                  <template #body="{ data }">{{ formatDate(data.resolutionDate) }}</template>
                </pv-column>
                <pv-column header="Estado">
                  <template #body="{ data }">
                    <pv-tag :value="formatContractStatusLabel(data.contractStatus)" :severity="contractStatusSeverity(data.contractStatus)" />
                  </template>
                </pv-column>
                <template #empty>No hay placas nuevas en este archivo.</template>
              </pv-data-table>
            </pv-tab-panel>

            <pv-tab-panel value="rejected">
              <p class="tfi-panel-hint">
                Estas filas no se importan. Corrígelas en el Excel y vuelve a subirlo: las placas que ya
                estén no se duplican.
                <span v-if="truncationNote(preview.rejectedRows.length, preview.rejectedCount)">
                  {{ truncationNote(preview.rejectedRows.length, preview.rejectedCount) }}
                </span>
              </p>
              <pv-data-table :value="preview.rejectedRows" size="small" scrollable scroll-height="240px" data-key="rowNumber">
                <pv-column field="rowNumber" header="Fila" style="width: 4rem" />
                <pv-column header="Placa" style="width: 9rem">
                  <template #body="{ data }">{{ data.plate || '—' }}</template>
                </pv-column>
                <pv-column header="Motivo">
                  <template #body="{ data }">
                    <div v-for="(message, index) in data.messages" :key="index">{{ message }}</div>
                  </template>
                </pv-column>
                <template #empty>Ninguna fila rechazada.</template>
              </pv-data-table>
            </pv-tab-panel>

            <pv-tab-panel value="differing">
              <p class="tfi-panel-hint">
                Estas placas ya están en el inventario y el archivo trae otros datos. No se modifican.
                <span v-if="truncationNote(preview.differingRows.length, preview.differingCount)">
                  {{ truncationNote(preview.differingRows.length, preview.differingCount) }}
                </span>
              </p>
              <pv-data-table :value="preview.differingRows" size="small" scrollable scroll-height="240px" data-key="rowNumber">
                <pv-column field="rowNumber" header="Fila" style="width: 4rem" />
                <pv-column header="Placa" style="width: 9rem">
                  <template #body="{ data }">{{ data.plate || '—' }}</template>
                </pv-column>
                <pv-column header="Diferencias">
                  <template #body="{ data }">
                    <div v-for="(message, index) in data.messages" :key="index">{{ message }}</div>
                  </template>
                </pv-column>
                <template #empty>Ninguna placa con datos distintos.</template>
              </pv-data-table>
            </pv-tab-panel>
          </pv-tab-panels>
        </pv-tabs>
      </template>
    </div>

    <template #footer>
      <div class="flex align-items-center justify-content-end gap-2 w-full">
        <pv-button label="Cancelar" severity="secondary" outlined :disabled="applying" @click="close" />
        <pv-button
          :label="applyLabel"
          icon="pi pi-check"
          :loading="applying"
          :disabled="!canApply"
          @click="apply"
        />
      </div>
    </template>
  </pv-dialog>
</template>

<style scoped>
.tfi-header-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--primary-tint-bg);
  border: 1px solid var(--primary-tint-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.tfi-title {
  font-size: 0.95rem;
  color: var(--text-body);
}

.tfi-subtitle {
  margin-top: 2px;
  color: var(--text-body-secondary);
}

.tfi-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 7rem;
  padding: 1rem;
  border: 1.5px dashed var(--border-ui, #d1d5db);
  border-radius: 10px;
  background: var(--surface-light, #f9fafb);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}

.tfi-drop-zone:hover,
.tfi-drop-zone--drag {
  border-color: var(--color-primary);
  background: var(--primary-tint-bg);
}

.tfi-drop-zone--ready {
  border-style: solid;
}

.tfi-dz-icon {
  font-size: 1.6rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-dz-icon--ready {
  color: var(--green-600, #16a34a);
}

.tfi-dz-label,
.tfi-dz-filename {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-body, #111827);
}

.tfi-dz-hint {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-counters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
}

.tfi-counter {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-ui, #e5e7eb);
  border-radius: 8px;
  background: var(--surface-0, #ffffff);
}

.tfi-counter__value {
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-body, #111827);
}

.tfi-counter__label {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-counter--new .tfi-counter__value { color: var(--green-700, #15803d); }
.tfi-counter--warn .tfi-counter__value { color: var(--orange-600, #ea580c); }
.tfi-counter--error .tfi-counter__value { color: var(--red-600, #dc2626); }

.tfi-panel-hint {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-plate {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tfi-raw {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
}

@media (max-width: 767px) {
  .tfi-counters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
