<script setup>
import { computed, ref, watch } from 'vue'
import DetailDrawer from '@/shared/presentation/components/detail-drawer.vue'
import {
  MOTIVOS_INGRESO,
  MOTIVO_SEVERITY,
  TIPOS_DOCUMENTO,
  ACCESS_STATUS,
  ACCESS_STATUS_SEVERITY,
  MOTIVOS_SALIDA_TEMPORAL,
} from '../constants/stays-ui.constants.js'
import {
  formatCalendarDateForUi,
  formatTimeHmAmPmForUi,
} from '@/shared/domain/format-datetime-ui.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  item:    { type: Object,  default: null  },
  attachments: { type: Array, default: () => [] },
  canManageAttachments: { type: Boolean, default: false },
  deletingAttachmentId: { type: [Number, null], default: null },
})

const emit = defineEmits(['update:visible', 'edit-requested', 'remove-attachment-requested'])

function close() {
  emit('update:visible', false)
}

function requestEdit() {
  emit('update:visible', false)
  emit('edit-requested', props.item)
}

function removeAttachment(attachment) {
  emit('remove-attachment-requested', attachment)
}

const selectedByOperation = ref({})
const previewVisible = ref(false)
const previewImage = ref(null)
const previewSectionKey = ref('ENTRY')
const confirmRemoveVisible = ref(false)
const pendingRemoveAttachment = ref(null)

function resolveProviderFileId(attachment) {
  return attachment?.provider_file_id ?? attachment?.providerFileId ?? null
}

function buildDriveViewUrl(providerFileId) {
  return `https://drive.google.com/file/d/${providerFileId}/view`
}

function buildDrivePreviewUrl(providerFileId) {
  return `https://drive.google.com/thumbnail?id=${providerFileId}&sz=w1600`
}

function getOpenUrl(attachment) {
  const providerFileId = resolveProviderFileId(attachment)
  if (providerFileId) return buildDriveViewUrl(providerFileId)
  return attachment?.public_url ?? attachment?.publicUrl ?? '#'
}

function getPreviewSrc(attachment) {
  const providerFileId = resolveProviderFileId(attachment)
  if (providerFileId) return buildDrivePreviewUrl(providerFileId)
  return attachment?.public_url ?? attachment?.publicUrl ?? ''
}

function isImageAttachment(attachment) {
  const mimeType = attachment?.mime_type ?? attachment?.mimeType ?? ''
  if (mimeType.startsWith('image/')) return true
  const fileName = (attachment?.file_name ?? attachment?.fileName ?? '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileName)
}

const imageAttachments = computed(() =>
  (props.attachments ?? []).filter(isImageAttachment)
)

const OPERATION_SECTIONS = [
  { key: 'ENTRY', title: 'Ingreso' },
  { key: 'TEMPORAL_EXIT', title: 'Salida temporal' },
  { key: 'PERMANENT_EXIT', title: 'Salida permanente' },
  { key: 'RETURN', title: 'Retorno' },
]

function getOperationKey(attachment) {
  return attachment?.stay_operation_type ?? attachment?.stayOperationType ?? 'ENTRY'
}

const groupedImageSections = computed(() =>
  OPERATION_SECTIONS
    .map(section => ({
      ...section,
      images: imageAttachments.value.filter(file => getOperationKey(file) === section.key),
      attachments: (props.attachments ?? []).filter(file => getOperationKey(file) === section.key),
    }))
    .filter(section => section.attachments.length > 0),
)

const expandedHistoryBySection = ref({})

const sectionDisplayState = computed(() =>
  groupedImageSections.value.map((section) => {
    const latestImage = section.images[0] ?? null
    const historicalImages = section.images.slice(1)
    return {
      ...section,
      latestImage,
      historicalImages,
      hasHistory: historicalImages.length > 0,
      hasAnyImage: section.images.length > 0,
      historyExpanded: !!expandedHistoryBySection.value[section.key],
    }
  }),
)

const previewSectionImages = computed(() => {
  const section = groupedImageSections.value.find(s => s.key === previewSectionKey.value)
  return section?.images ?? []
})

watch(
  groupedImageSections,
  (sections) => {
    const nextState = {}
    const nextExpanded = {}
    sections.forEach((section) => {
      nextState[section.key] = selectedByOperation.value[section.key] ?? 0
      if (nextState[section.key] >= section.images.length) nextState[section.key] = 0
      nextExpanded[section.key] = expandedHistoryBySection.value[section.key] ?? false
    })
    selectedByOperation.value = nextState
    expandedHistoryBySection.value = nextExpanded
  },
  { deep: true, immediate: true }
)

function getSelectedIndex(sectionKey) {
  return selectedByOperation.value[sectionKey] ?? 0
}

function getSelectedImage(section) {
  return section.images[getSelectedIndex(section.key)] ?? null
}

function selectAttachment(sectionKey, index) {
  selectedByOperation.value[sectionKey] = index
}

function showPreviousImage(section) {
  if (!section.images.length) return
  const current = getSelectedIndex(section.key)
  selectedByOperation.value[section.key] = current === 0 ? section.images.length - 1 : current - 1
}

function showNextImage(section) {
  if (!section.images.length) return
  const current = getSelectedIndex(section.key)
  selectedByOperation.value[section.key] = current === section.images.length - 1 ? 0 : current + 1
}

function toggleSectionHistory(sectionKey) {
  expandedHistoryBySection.value[sectionKey] = !expandedHistoryBySection.value[sectionKey]
}

function openPreview(section, attachment = null) {
  const image = attachment ?? getSelectedImage(section)
  if (!image) return
  previewSectionKey.value = section.key
  previewImage.value = image
  previewVisible.value = true
}

function showPreviewPreviousImage() {
  if (!previewSectionImages.value.length || !previewImage.value) return
  const current = previewSectionImages.value.findIndex(file => file.id === previewImage.value.id)
  const prevIndex = current <= 0 ? previewSectionImages.value.length - 1 : current - 1
  previewImage.value = previewSectionImages.value[prevIndex]
}

function showPreviewNextImage() {
  if (!previewSectionImages.value.length || !previewImage.value) return
  const current = previewSectionImages.value.findIndex(file => file.id === previewImage.value.id)
  const nextIndex = current === previewSectionImages.value.length - 1 ? 0 : current + 1
  previewImage.value = previewSectionImages.value[nextIndex]
}

function closePreview() {
  previewVisible.value = false
  previewImage.value = null
}

function requestRemoveAttachment(attachment) {
  pendingRemoveAttachment.value = attachment
  confirmRemoveVisible.value = true
}

function cancelRemoveAttachment() {
  confirmRemoveVisible.value = false
  pendingRemoveAttachment.value = null
}

function confirmRemoveAttachment() {
  if (!pendingRemoveAttachment.value) return
  removeAttachment(pendingRemoveAttachment.value)
  cancelRemoveAttachment()
}

// ── Formatters (compartido: `format-datetime-ui.js`) ───────────────────────────
const formatDate = (value) => formatCalendarDateForUi(value, '-')
const formatTime = (value) => formatTimeHmAmPmForUi(value, { seconds: 'auto' })

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
</script>

<template>
  <DetailDrawer :visible="visible" @update:visible="close">
    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="detail-header-icon">
          <i :class="item?.type === 'PERSONA' ? 'pi pi-user' : 'pi pi-car'" />
        </div>
        <div class="flex flex-column gap-1">
          <span class="font-bold text-sm" style="color: #111827">
            {{ item?.type === 'PERSONA' ? (item?.fullName ?? 'Persona') : (item?.licensePlate ?? 'Vehículo') }}
          </span>
          <div class="flex gap-2 flex-wrap">
            <pv-tag
              v-if="item?.status"
              :value="getStatusLabel(item.status)"
              :severity="getStatusSeverity(item.status)"
            />
            <pv-tag
              v-if="item?.entryReason"
              :value="getEntryReasonLabel(item.entryReason)"
              :severity="getEntryReasonSeverity(item.entryReason)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Contenido ──────────────────────────────────────────────── -->
    <template #content>
      <template v-if="item">

        <!-- Registrado por -->
        <div class="detail-section">
          <p class="detail-section-title">Registrado por</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Nombre</span>
              <span class="detail-value">
                {{ [item.registeredByFirstName, item.registeredByLastName].filter(Boolean).join(' ') || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Vehículo -->
        <template v-if="item.type !== 'PERSONA'">
          <div class="detail-section">
            <p class="detail-section-title">Vehículo</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Placa</span>
                <span class="detail-value font-bold">{{ item.licensePlate || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Marca</span>
                <span class="detail-value">{{ item.brand || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Modelo</span>
                <span class="detail-value">{{ item.model || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Año</span>
                <span class="detail-value">{{ item.year || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Kilometraje</span>
                <span class="detail-value">{{ item.mileage != null ? item.mileage + ' km' : '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Color</span>
                <span class="detail-value">{{ item.color || '—' }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Persona -->
        <template v-else>
          <div class="detail-section">
            <p class="detail-section-title">Persona</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Nombre</span>
                <span class="detail-value font-bold">{{ item.firstName || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Apellido</span>
                <span class="detail-value font-bold">{{ item.lastName || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tipo doc.</span>
                <span class="detail-value">{{ getDocumentTypeLabel(item.documentType) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Número</span>
                <span class="detail-value">{{ item.clientDocumentNumber || '—' }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Evidencias -->
        <div class="detail-section">
          <p class="detail-section-title">Evidencias</p>
          <div v-if="!attachments?.length" class="detail-value">Sin evidencias registradas.</div>
          <div v-else class="attachments-block">
            <div
              v-for="section in sectionDisplayState"
              :key="section.key"
              class="attachments-operation"
              :class="`attachments-operation--${section.key.toLowerCase()}`"
            >
              <button
                type="button"
                class="attachments-operation__header"
                @click="section.hasAnyImage && toggleSectionHistory(section.key)"
              >
                <span class="detail-section-title attachments-operation__title">{{ section.title }}</span>
                <span class="attachments-operation__meta">
                  <span class="attachments-operation__count">{{ section.images.length }}</span>
                  <span
                    v-if="section.hasAnyImage"
                    class="attachments-operation__chevron"
                    :class="{ 'attachments-operation__chevron--expanded': section.historyExpanded }"
                    aria-hidden="true"
                  ></span>
                </span>
              </button>

              <div v-if="section.historyExpanded && section.latestImage" class="attachments-viewer">
                <div class="attachments-hero" @click="openPreview(section)">
                  <img
                    :src="getPreviewSrc(section.latestImage)"
                    :alt="section.latestImage?.file_name ?? section.latestImage?.fileName"
                    class="attachments-hero__image"
                  >
                  <button
                    v-if="canManageAttachments && section.latestImage"
                    type="button"
                    class="attachments-hero__remove"
                    :disabled="deletingAttachmentId === section.latestImage?.id"
                    @click.stop="requestRemoveAttachment(section.latestImage)"
                  >
                    {{ deletingAttachmentId === section.latestImage?.id ? '...' : '×' }}
                  </button>
                  <span class="attachments-hero__hint">Toca para ampliar</span>
                </div>
              </div>

              <div
                v-if="section.historyExpanded && section.historicalImages.length"
                class="attachments-thumbs attachments-thumbs--history"
              >
                <button
                  v-for="attachment in section.historicalImages"
                  :key="attachment.id"
                  type="button"
                  class="attachments-thumb"
                  @click="openPreview(section, attachment)"
                >
                  <img
                    :src="getPreviewSrc(attachment)"
                    :alt="attachment.file_name ?? attachment.fileName"
                    class="attachments-thumb__image"
                  >
                  <button
                    v-if="canManageAttachments"
                    type="button"
                    class="attachments-thumb__remove"
                    :disabled="deletingAttachmentId === attachment.id"
                    @click.stop="requestRemoveAttachment(attachment)"
                  >
                    {{ deletingAttachmentId === attachment.id ? '...' : '×' }}
                  </button>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Ingreso -->
        <div class="detail-section">
          <p class="detail-section-title">Ingreso</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Fecha</span>
              <span class="detail-value">{{ formatDate(item.entryDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Hora</span>
              <span class="detail-value">{{ formatTime(item.entryTime) || '—' }}</span>
            </div>
            <div v-if="item.entryReason" class="detail-row">
              <span class="detail-label">Motivo</span>
              <span class="detail-value">{{ getEntryReasonLabel(item.entryReason) }}</span>
            </div>
          </div>
        </div>

        <!-- Salidas temporales -->
        <template v-if="item.temporalExits?.length">
          <div
            v-for="(te, idx) in item.temporalExits"
            :key="te.id ?? idx"
            class="detail-section"
          >
            <p class="detail-section-title">
              Salida temporal {{ item.temporalExits.length > 1 ? `#${idx + 1}` : '' }}
              <pv-tag
                :value="te.status === 'EN_SALIDA' ? 'En salida' : 'Retornado'"
                :severity="te.status === 'EN_SALIDA' ? 'warn' : 'info'"
                style="margin-left: 0.4rem; font-size: 0.7rem;"
              />
            </p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Motivo</span>
                <span class="detail-value">{{ getExitReasonLabel(te.exitReason) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha salida</span>
                <span class="detail-value" style="color: var(--color-success)">{{ formatDate(te.exitDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora salida</span>
                <span class="detail-value" style="color: var(--color-success)">{{ formatTime(te.exitTime) || '—' }}</span>
              </div>
              <template v-if="te.replacementLicensePlate">
                <div class="detail-row">
                  <span class="detail-label">Placa reemplazo</span>
                  <span class="detail-value font-bold">{{ te.replacementLicensePlate }}</span>
                </div>
              </template>
              <template v-if="te.returnDate">
                <div class="detail-row">
                  <span class="detail-label">Fecha retorno</span>
                  <span class="detail-value" style="color: var(--color-info)">{{ formatDate(te.returnDate) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Hora retorno</span>
                  <span class="detail-value" style="color: var(--color-info)">{{ formatTime(te.returnTime) || '—' }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Salida permanente -->
        <template v-if="item.permanentExitDate">
          <div class="detail-section">
            <p class="detail-section-title">Salida permanente</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Fecha</span>
                <span class="detail-value font-semibold" style="color: var(--color-success)">{{ formatDate(item.permanentExitDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora</span>
                <span class="detail-value font-semibold" style="color: var(--color-success)">{{ formatTime(item.permanentExitTime) || '—' }}</span>
              </div>
            </div>
          </div>
          <template v-if="item.clientDocumentNumber || item.firstName || item.lastName || item.customerDni || item.customerFirstName || item.customerLastName">
            <div class="detail-section">
              <p class="detail-section-title">Cliente</p>
              <div class="detail-grid">
                <div class="detail-row">
                  <span class="detail-label">Tipo doc.</span>
                  <span class="detail-value">{{ getDocumentTypeLabel(item.documentType || item.customerDocumentType) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Número</span>
                  <span class="detail-value font-bold">{{ item.clientDocumentNumber || item.customerDni || '—' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Nombre</span>
                  <span class="detail-value">{{ item.firstName || item.customerFirstName || '—' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Apellido</span>
                  <span class="detail-value">{{ item.lastName || item.customerLastName || '—' }}</span>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- Acciones -->
        <div class="detail-section" style="border-bottom: none; background: #f9fafb;">
          <div class="flex gap-2">
            <pv-button
              icon="pi pi-pencil"
              label="Editar"
              size="small"
              class="flex-1"
              @click="requestEdit"
            />
          </div>
        </div>

      </template>
    </template>
  </DetailDrawer>

  <pv-dialog
    v-model:visible="previewVisible"
    modal
    dismissable-mask
    :style="{ width: 'min(900px, 96vw)' }"
    :breakpoints="{ '768px': '96vw' }"
    header="Vista previa"
  >
    <div v-if="previewImage" class="preview-dialog">
      <img
        :src="getPreviewSrc(previewImage)"
        :alt="previewImage.file_name ?? previewImage.fileName"
        class="preview-dialog__image"
      >
      <div class="preview-dialog__footer">
        <div>
          <div class="attachment-name">{{ previewImage.file_name ?? previewImage.fileName }}</div>
          <div class="attachment-sub">{{ previewImage.stay_operation_type ?? previewImage.stayOperationType }}</div>
        </div>
        <div class="preview-dialog__actions">
          <button v-if="previewSectionImages.length > 1" type="button" @click="showPreviewPreviousImage">Anterior</button>
          <button v-if="previewSectionImages.length > 1" type="button" @click="showPreviewNextImage">Siguiente</button>
          <a :href="getOpenUrl(previewImage)" target="_blank" rel="noopener noreferrer">Abrir</a>
        </div>
      </div>
    </div>
    <template #closebutton>
      <button class="preview-dialog__close" type="button" @click="closePreview">
        <i class="pi pi-times" />
      </button>
    </template>
  </pv-dialog>

  <pv-dialog
    v-model:visible="confirmRemoveVisible"
    modal
    header="Confirmar eliminación"
    :style="{ width: 'min(420px, 92vw)' }"
  >
    <p style="margin: 0; color: #374151;">
      ¿Deseas eliminar la evidencia
      <strong>{{ pendingRemoveAttachment?.file_name ?? pendingRemoveAttachment?.fileName ?? '' }}</strong>?
      Esta acción no se puede deshacer.
    </p>
    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <pv-button label="Cancelar" severity="secondary" text @click="cancelRemoveAttachment" />
      <pv-button label="Eliminar" severity="danger" @click="confirmRemoveAttachment" />
    </div>
  </pv-dialog>
</template>

<style scoped>
.attachments-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.35rem 0.45rem 0.15rem;
  margin-top: 0.2rem;
}
.attachments-operation {
  border: none;
  border-radius: 0;
  padding: 0.45rem 0.5rem;
  background: transparent;
  border-left: 4px solid transparent;
  border-radius: 8px;
}
.attachments-operation + .attachments-operation {
  border-top: 1px solid #e5e7eb;
  margin-top: 0.35rem;
  padding-top: 0.6rem;
}
.attachments-operation--entry {
  background: #f0f9ff;
  border-left-color: #0284c7;
}
.attachments-operation--temporal_exit {
  background: #eff6ff;
  border-left-color: #2563eb;
}
.attachments-operation--permanent_exit {
  background: #fef2f2;
  border-left-color: #dc2626;
}
.attachments-operation--return {
  background: #ecfdf5;
  border-left-color: #16a34a;
}
.attachments-operation__header {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 0.2rem 0.55rem 0.2rem 0.1rem;
  border-radius: 8px;
}
.attachments-operation__title {
  margin: 0;
  line-height: 1.2;
  font-size: 0.8rem;
  font-weight: 800;
}
.attachments-operation__meta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  min-width: 3.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  line-height: 1;
  padding-right: 0.15rem;
}
.attachments-operation__count {
  min-width: 1rem;
  text-align: right;
}
.attachments-operation__chevron {
  width: 1.1rem;
  height: 1.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  transform: rotate(45deg);
  transform-origin: center;
  transition: transform 0.18s ease;
  margin-top: 0;
}
.attachments-operation__chevron::before {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  box-sizing: border-box;
  display: block;
}
.attachments-operation__chevron--expanded {
  transform: rotate(225deg);
}
.attachments-viewer {
  position: relative;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  overflow: hidden;
  margin-top: 0.35rem;
}
.attachments-hero {
  display: block;
  width: 100%;
  border: none;
  padding: 0;
  background: #111827;
  cursor: pointer;
  position: relative;
}
.attachments-hero__remove {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
  z-index: 3;
}
.attachments-hero__image {
  width: 100%;
  height: 260px;
  object-fit: contain;
  background: #f3f4f6;
}
.attachments-hero__hint {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  background: rgba(17, 24, 39, 0.7);
  color: #fff;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
}
.attachments-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 2.2rem;
  height: 2.2rem;
  border: none;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.68);
  color: #fff;
  cursor: pointer;
}
.attachments-nav--left { left: 0.75rem; }
.attachments-nav--right { right: 0.75rem; }
.attachments-thumbs {
  display: flex;
  gap: 0.5rem;
  padding: 0.65rem;
  overflow-x: auto;
  background: #fff;
}
.attachments-thumbs--history {
  margin-top: 0.6rem;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
}
.attachments-thumb {
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 0;
  background: transparent;
  cursor: pointer;
  flex: 0 0 auto;
  position: relative;
}
.attachments-thumb--active {
  border-color: #2563eb;
}
.attachments-thumb__image {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.attachments-thumb__remove {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  width: 1rem;
  height: 1rem;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #ffffff;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
}

.preview-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #ffffff;
  color: #111827;
  border-radius: 12px;
  padding: 0.4rem;
}
:deep(.p-dialog-content) {
  background: #ffffff !important;
  color: #111827 !important;
}
:deep(.p-dialog-header) {
  background: #ffffff !important;
  color: #111827 !important;
  border-bottom: 1px solid #e5e7eb !important;
}
:deep(.p-dialog) {
  background: #ffffff !important;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14) !important;
}
:deep(.p-dialog-title) {
  color: #111827 !important;
}
.preview-dialog__image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 12px;
}
.preview-dialog__footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.preview-dialog__actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}
.preview-dialog__actions button,
.preview-dialog__actions a {
  border: none;
  background: transparent;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 0.82rem;
  text-decoration: none;
  padding: 0;
}
.preview-dialog__close {
  border: none;
  background: transparent;
  cursor: pointer;
}

@media (max-width: 640px) {
  .attachments-hero__image {
    height: 210px;
  }
  .preview-dialog__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
