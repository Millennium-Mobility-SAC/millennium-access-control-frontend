<script setup>
import { computed, ref, watch } from 'vue'
import DetailDrawer from '@/shared/presentation/components/detail-drawer.vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useConfirmDialog } from '@/shared/composables/use-confirm-dialog.js'
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
import { useStayAttachmentMedia } from '../composables/use-stay-attachment-media.js'

const {
  driveImgAttrs,
  getOpenUrl,
  getPreviewSrc,
  isImageAttachment,
  onAttachmentImageError,
} = useStayAttachmentMedia()

const props = defineProps({
  visible: { type: Boolean, required: true },
  item:    { type: Object,  default: null  },
  attachments: { type: Array, default: () => [] },
  canManageAttachments: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  deletingAttachmentId: { type: [Number, null], default: null },
  whatsappAttempts: { type: Array, default: () => [] },
  whatsappLoading: { type: Boolean, default: false },
  whatsappResending: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'edit-requested', 'remove-attachment-requested', 'resend-whatsapp-requested', 'refresh-whatsapp-requested'])

const WHATSAPP_STATUS_META = {
  SENT:     { label: 'Enviado',      severity: 'success' },
  PENDING:  { label: 'Pendiente',    severity: 'warn'    },
  FAILED:   { label: 'No enviado',   severity: 'danger'  },
  SKIPPED:  { label: 'Deshabilitado', severity: 'secondary' },
}
const WHATSAPP_OPERATION_LABEL = {
  ENTRY:           'Ingreso',
  TEMPORAL_EXIT:   'Salida temporal',
  PERMANENT_EXIT:  'Salida permanente',
  RETURN:          'Retorno',
}

const latestWhatsappAttempt = computed(() => props.whatsappAttempts?.[0] ?? null)

// Operaciones disponibles para reenviar — derivadas de la estructura real del stay
const availableResendOps = computed(() => {
  if (!props.item) return []
  const ops = []
  const tes = props.item.temporalExits ?? []
  const multiTe = tes.length > 1
  const returns = tes.filter(te => te.returnDate)
  const multiRet = returns.length > 1

  ops.push({ key: 'ENTRY__', operationType: 'ENTRY', temporalExitId: null, label: 'Ingreso' })

  tes.forEach((te, i) => {
    ops.push({
      key: `TEMPORAL_EXIT__${te.id}`,
      operationType: 'TEMPORAL_EXIT',
      temporalExitId: te.id,
      label: multiTe ? `Salida temporal #${i + 1}` : 'Salida temporal'
    })
    if (te.returnDate) {
      const retIdx = returns.findIndex(r => r.id === te.id)
      ops.push({
        key: `RETURN__${te.id}`,
        operationType: 'RETURN',
        temporalExitId: te.id,
        label: multiRet ? `Retorno #${retIdx + 1}` : 'Retorno'
      })
    }
  })

  if (props.item.permanentExitDate) {
    ops.push({ key: 'PERMANENT_EXIT__', operationType: 'PERMANENT_EXIT', temporalExitId: null, label: 'Salida permanente' })
  }

  return ops
})

// Selector de operación — por defecto la del último intento WhatsApp, o la última operación del stay
const selectedResendOpKey = ref(null)
watch(
  [() => props.item, latestWhatsappAttempt],
  () => {
    const a = latestWhatsappAttempt.value
    if (a) {
      selectedResendOpKey.value = `${a.operationType}__${a.temporalExitId ?? ''}`
    } else {
      const ops = availableResendOps.value
      selectedResendOpKey.value = ops[ops.length - 1]?.key ?? null
    }
  },
  { immediate: true }
)

const whatsappBadge = computed(() => {
  const attempt = latestWhatsappAttempt.value
  if (!attempt) return null
  return WHATSAPP_STATUS_META[attempt.status] ?? { label: attempt.status, severity: 'info' }
})

const isWhatsappSent = computed(() => latestWhatsappAttempt.value?.status === 'SENT')
const isWhatsappPending = computed(() => latestWhatsappAttempt.value?.status === 'PENDING')

const resendButtonMeta = computed(() => {
  const attempt = latestWhatsappAttempt.value
  if (!attempt) {
    return { label: 'Enviar por WhatsApp', tone: 'primary' }
  }
  if (attempt.status === 'SENT') {
    return { label: 'Reenviar', tone: 'ghost' }
  }
  if (attempt.status === 'FAILED') {
    return { label: 'Reintentar envío', tone: 'primary' }
  }
  if (attempt.status === 'PENDING') {
    return { label: 'Forzar reenvío', tone: 'warn' }
  }
  return { label: 'Enviar por WhatsApp', tone: 'primary' }
})

function formatWhatsappTimestamp(value) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const datePart = formatCalendarDateForUi(d, '—')
    const timePart = formatTimeHmAmPmForUi(d, { seconds: 'auto' })
    return `${datePart} · ${timePart}`
  } catch (_e) {
    return value
  }
}

const OP_TYPE_ICON = {
  ENTRY:          'pi pi-sign-in',
  TEMPORAL_EXIT:  'pi pi-arrow-right-arrow-left',
  RETURN:         'pi pi-reply',
  PERMANENT_EXIT: 'pi pi-sign-out',
}
function opTypeIcon(type) {
  return OP_TYPE_ICON[type] ?? 'pi pi-circle'
}

function requestResendWhatsapp() {
  if (props.item?.id == null) return
  const op = selectedResendOpKey.value
  const attempt = availableResendOps.value.find(a => a.key === op)
  emit('resend-whatsapp-requested', {
    stayId: props.item.id,
    operationType: attempt?.operationType ?? null,
    temporalExitId: attempt?.temporalExitId ?? null
  })
}

function requestRefreshWhatsapp() {
  if (props.item?.id != null) emit('refresh-whatsapp-requested', props.item.id)
}

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

const { confirmDelete } = useConfirmDialog()

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
      const wasExpanded = expandedHistoryBySection.value[section.key]
      nextExpanded[section.key] = wasExpanded ?? (section.images.length > 0)
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
  if (!attachment) return
  const fileName =
    attachment.file_name ?? attachment.fileName ?? 'esta evidencia'
  confirmDelete('la evidencia', fileName, () => {
    removeAttachment(attachment)
  })
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
                    v-bind="driveImgAttrs"
                    :src="getPreviewSrc(section.latestImage)"
                    :alt="section.latestImage?.file_name ?? section.latestImage?.fileName"
                    class="attachments-hero__image"
                    @error="onAttachmentImageError"
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
                    v-bind="driveImgAttrs"
                    :src="getPreviewSrc(attachment)"
                    :alt="attachment.file_name ?? attachment.fileName"
                    class="attachments-thumb__image"
                    @error="onAttachmentImageError"
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

        <!-- Notificación WhatsApp -->
        <div class="detail-section whatsapp-section">
          <div class="whatsapp-section__header">
            <p class="detail-section-title">Notificación WhatsApp</p>
            <pv-button
              v-if="latestWhatsappAttempt"
              type="button"
              icon="pi pi-refresh"
              :class="['whatsapp-section__refresh', { 'is-spinning': whatsappLoading }]"
              text
              rounded
              size="small"
              severity="secondary"
              aria-label="Actualizar estado"
              v-tooltip.top="'Actualizar estado'"
              :disabled="whatsappLoading"
              @click="requestRefreshWhatsapp"
            />
          </div>
          <div v-if="whatsappLoading && !latestWhatsappAttempt" class="whatsapp-loading">
            <i class="pi pi-spin pi-spinner" />
            <span>Consultando estado…</span>
          </div>
          <template v-else>
            <div v-if="!latestWhatsappAttempt" class="whatsapp-empty">
              <i class="pi pi-whatsapp" />
              <span>Sin notificaciones registradas.</span>
            </div>
            <template v-else>
              <div class="detail-row">
                <span class="detail-label">Estado</span>
                <span class="detail-value whatsapp-status-cell">
                  <pv-tag v-if="whatsappBadge" :value="whatsappBadge.label" :severity="whatsappBadge.severity" />
                  <span v-if="isWhatsappPending" class="whatsapp-inline-hint">
                    <i class="pi pi-spin pi-spinner" /> Procesando…
                  </span>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Operación</span>
                <span class="detail-value">{{ WHATSAPP_OPERATION_LABEL[latestWhatsappAttempt.operationType] ?? latestWhatsappAttempt.operationType }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Intentos</span>
                <span class="detail-value">{{ latestWhatsappAttempt.attempts }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Último intento</span>
                <span class="detail-value">{{ formatWhatsappTimestamp(latestWhatsappAttempt.lastAttemptAt || latestWhatsappAttempt.createdAt) }}</span>
              </div>
              <div v-if="latestWhatsappAttempt.sentAt" class="detail-row">
                <span class="detail-label">Enviado</span>
                <span class="detail-value whatsapp-sent-value">{{ formatWhatsappTimestamp(latestWhatsappAttempt.sentAt) }}</span>
              </div>
              <details v-if="latestWhatsappAttempt.errorMessage" class="whatsapp-error-box">
                <summary>
                  <i class="pi pi-exclamation-triangle" /> Ver detalle del error
                </summary>
                <pre>{{ latestWhatsappAttempt.errorMessage }}</pre>
              </details>
              <div class="whatsapp-actions">
                <div class="whatsapp-op-selector">
                  <label class="whatsapp-op-selector__label">Registro a reenviar</label>
                  <pv-select
                    v-model="selectedResendOpKey"
                    :options="availableResendOps"
                    option-label="label"
                    option-value="key"
                    class="whatsapp-op-select"
                    fluid
                  />
                </div>
                <button
                  type="button"
                  class="whatsapp-resend-btn"
                  :disabled="whatsappResending"
                  @click="requestResendWhatsapp"
                >
                  <i v-if="whatsappResending" class="pi pi-spin pi-spinner" />
                  <i v-else class="pi pi-whatsapp" />
                  {{ resendButtonMeta.label }}
                </button>
              </div>
            </template>
          </template>
        </div>

        <!-- Acciones -->
        <div v-if="canEdit" class="detail-section" style="border-bottom: none; background: #f9fafb;">
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

  <CreateAndEdit
    :visible="previewVisible"
    :header-title-override="'Vista previa de evidencia'"
    size="large"
    hide-footer
    @canceled-shared="closePreview"
  >
    <template #content>
      <div v-if="previewImage" class="preview-dialog">
        <img
          v-bind="driveImgAttrs"
          :src="getPreviewSrc(previewImage)"
          :alt="previewImage.file_name ?? previewImage.fileName"
          class="preview-dialog__image"
          @error="onAttachmentImageError"
        >
        <div class="preview-dialog__footer">
          <div class="preview-dialog__meta">
            <div class="attachment-name">{{ previewImage.file_name ?? previewImage.fileName }}</div>
            <div class="attachment-sub">{{ previewImage.stay_operation_type ?? previewImage.stayOperationType }}</div>
          </div>
          <div class="preview-dialog__actions">
            <pv-button
              v-if="previewSectionImages.length > 1"
              type="button"
              icon="pi pi-chevron-left"
              label="Anterior"
              severity="secondary"
              outlined
              size="small"
              @click="showPreviewPreviousImage"
            />
            <pv-button
              v-if="previewSectionImages.length > 1"
              type="button"
              icon="pi pi-chevron-right"
              icon-pos="right"
              label="Siguiente"
              severity="secondary"
              outlined
              size="small"
              @click="showPreviewNextImage"
            />
            <pv-button
              type="button"
              icon="pi pi-external-link"
              label="Abrir"
              size="small"
              :as="'a'"
              :href="getOpenUrl(previewImage)"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </div>
      </div>
    </template>
  </CreateAndEdit>
</template>

<style scoped>
.attachments-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem 0.75rem;
}
.attachments-operation {
  border: none;
  padding: 0.5rem 0.6rem;
  background: transparent;
  border-left: 4px solid transparent;
  border-radius: 8px;
}
.attachments-operation + .attachments-operation {
  margin-top: 0.2rem;
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
.whatsapp-section {
  position: relative;
}
.whatsapp-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.whatsapp-section__header .detail-section-title {
  margin: 0;
}
.whatsapp-section__refresh.is-spinning :deep(.pi-refresh) {
  animation: whatsapp-spin 0.9s linear infinite;
}
@keyframes whatsapp-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.whatsapp-loading,
.whatsapp-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6b7280);
  padding: 0.4rem 0;
}
.whatsapp-empty .pi-whatsapp {
  color: #25d366;
}
.whatsapp-status-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.whatsapp-inline-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color, #6b7280);
}
.whatsapp-sent-value {
  color: var(--color-success, #15803d) !important;
  font-weight: 600;
}
.whatsapp-error-box {
  margin: 0.5rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
  font-size: 0.82rem;
  color: #991b1b;
}
.whatsapp-error-box summary {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 500;
  list-style: none;
}
.whatsapp-error-box summary::-webkit-details-marker { display: none; }
.whatsapp-error-box pre {
  margin: 0.4rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 0.78rem;
  line-height: 1.35;
}
.whatsapp-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.85rem;
  padding: 0 1rem 1rem;
}
.whatsapp-op-selector__label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 0.35rem;
  display: block;
}
.whatsapp-op-select {
  width: 100%;
}
.whatsapp-resend-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  border: none;
  background: #25d366;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1.4;
}
.whatsapp-resend-btn:hover:not(:disabled) {
  background: #1ebe5d;
}
.whatsapp-resend-btn:active:not(:disabled) {
  background: #19a854;
}
.whatsapp-resend-btn:disabled {
  background: #86efac;
  cursor: not-allowed;
  opacity: 0.75;
}
.whatsapp-resend-btn .pi {
  font-size: 1rem;
}
.preview-dialog__footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-top: 0.85rem;
}
.preview-dialog__meta {
  min-width: 0;
}
.preview-dialog__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .attachments-hero__image {
    height: 210px;
  }
  .preview-dialog__footer {
    flex-direction: column;
    align-items: flex-start;
  }
  .preview-dialog__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
