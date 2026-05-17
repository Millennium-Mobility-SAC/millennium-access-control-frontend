<script setup>
import { computed, ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useStayAttachmentMedia } from '@/stays/presentation/composables/use-stay-attachment-media.js'

const OPERATION_LABEL = {
  ENTRY: 'Ingreso',
  TEMPORAL_EXIT: 'Salida temporal',
  PERMANENT_EXIT: 'Salida permanente',
  RETURN: 'Retorno',
}

const props = defineProps({
  visible: { type: Boolean, required: true },
  attachments: { type: Array, default: () => [] },
  title: { type: String, default: 'Evidencias fotográficas' },
})

const emit = defineEmits(['update:visible'])

const { driveImgAttrs, getOpenUrl, getPreviewSrc, isImageAttachment, onAttachmentImageError } =
  useStayAttachmentMedia()

const currentIndex = ref(0)

const images = computed(() => (props.attachments ?? []).filter(isImageAttachment))

const currentImage = computed(() => images.value[currentIndex.value] ?? null)

const hasMultiple = computed(() => images.value.length > 1)

const counterLabel = computed(() => {
  if (!images.value.length) return ''
  return `${currentIndex.value + 1} / ${images.value.length}`
})

watch(
  () => props.visible,
  (open) => {
    if (open) currentIndex.value = 0
  },
)

watch(images, (list) => {
  if (currentIndex.value >= list.length) currentIndex.value = 0
})

function attachmentName(file) {
  return file?.file_name ?? file?.fileName ?? 'Imagen'
}

function operationLabel(file) {
  const key = file?.stay_operation_type ?? file?.stayOperationType ?? ''
  return OPERATION_LABEL[key] ?? key ?? '—'
}

function showPrevious() {
  if (!images.value.length) return
  currentIndex.value =
    currentIndex.value <= 0 ? images.value.length - 1 : currentIndex.value - 1
}

function showNext() {
  if (!images.value.length) return
  currentIndex.value =
    currentIndex.value >= images.value.length - 1 ? 0 : currentIndex.value + 1
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    :header-title-override="title"
    size="large"
    hide-footer
    @canceled-shared="close"
  >
    <template #content>
      <div v-if="currentImage" class="attachment-carousel">
        <img
          v-bind="driveImgAttrs"
          :src="getPreviewSrc(currentImage)"
          :alt="attachmentName(currentImage)"
          class="attachment-carousel__image"
          @error="onAttachmentImageError"
        >
        <div class="attachment-carousel__footer">
          <div class="attachment-carousel__meta">
            <div class="attachment-carousel__name">{{ attachmentName(currentImage) }}</div>
            <div class="attachment-carousel__sub">{{ operationLabel(currentImage) }}</div>
            <div v-if="hasMultiple" class="attachment-carousel__counter">{{ counterLabel }}</div>
          </div>
          <div class="attachment-carousel__actions">
            <pv-button
              v-if="hasMultiple"
              type="button"
              icon="pi pi-chevron-left"
              label="Anterior"
              severity="secondary"
              outlined
              size="small"
              @click="showPrevious"
            />
            <pv-button
              v-if="hasMultiple"
              type="button"
              icon="pi pi-chevron-right"
              icon-pos="right"
              label="Siguiente"
              severity="secondary"
              outlined
              size="small"
              @click="showNext"
            />
            <pv-button
              type="button"
              icon="pi pi-external-link"
              label="Abrir"
              size="small"
              :as="'a'"
              :href="getOpenUrl(currentImage)"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </div>
      </div>
      <p v-else class="attachment-carousel__empty">No hay imágenes para mostrar.</p>
    </template>
  </CreateAndEdit>
</template>

<style scoped>
.attachment-carousel {
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

.attachment-carousel__image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 12px;
}

.attachment-carousel__footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-top: 0.85rem;
}

.attachment-carousel__meta {
  min-width: 0;
}

.attachment-carousel__name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #111827;
  word-break: break-word;
}

.attachment-carousel__sub {
  font-size: 0.78rem;
  color: #6b7280;
  margin-top: 0.15rem;
}

.attachment-carousel__counter {
  font-size: 0.72rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.attachment-carousel__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.attachment-carousel__empty {
  margin: 0;
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .attachment-carousel__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .attachment-carousel__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
