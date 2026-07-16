<script setup>
import { nextTick, ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Título del diálogo */
  header: { type: String, default: 'Capturar rostro' },
  /** true mientras el padre procesa la foto */
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'captured', 'canceled'])

const videoRef = ref(null)
const fileInputRef = ref(null)
const streamRef = ref(null)
const starting = ref(false)
const cameraError = ref('')
/** Evita emitir `canceled` al cerrar tras una captura exitosa. */
const closingAfterCapture = ref(false)

const canCapture = () =>
  !props.busy && !starting.value && !cameraError.value && !!streamRef.value

async function startCamera() {
  cameraError.value = ''
  stopCamera()
  if (!navigator?.mediaDevices?.getUserMedia) {
    cameraError.value = 'Este navegador no permite acceso a la cámara. Usa «Subir archivo» o prueba HTTPS / localhost.'
    return
  }
  starting.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    streamRef.value = stream
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
    }
  } catch (err) {
    const name = err?.name || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      cameraError.value = 'Permiso de cámara denegado. Habilítalo en el navegador o usa «Subir archivo».'
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      cameraError.value = 'No se encontró una cámara en este dispositivo. Usa «Subir archivo».'
    } else {
      cameraError.value = 'No se pudo abrir la cámara. Usa «Subir archivo» o revisa los permisos del navegador.'
    }
  } finally {
    starting.value = false
  }
}

function stopCamera() {
  const stream = streamRef.value
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    streamRef.value = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

function onDialogCanceled() {
  if (props.busy) return
  stopCamera()
  emit('update:visible', false)
  if (!closingAfterCapture.value) emit('canceled')
  closingAfterCapture.value = false
}

function finishWithFile(file) {
  if (!file) return
  closingAfterCapture.value = true
  stopCamera()
  emit('update:visible', false)
  emit('captured', file)
}

function capturePhoto() {
  const video = videoRef.value
  if (!video || !video.videoWidth || !canCapture()) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  // Preview is mirrored; store the natural (non-mirrored) frame for recognition.
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  canvas.toBlob(
    (blob) => {
      if (!blob) return
      finishWithFile(new File([blob], `face-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    },
    'image/jpeg',
    0.92,
  )
}

function openFileFallback() {
  if (props.busy) return
  fileInputRef.value?.click?.()
}

function onFileSelected(event) {
  const file = event?.target?.files?.[0]
  if (event?.target) event.target.value = ''
  if (!file) return
  finishWithFile(file)
}

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      closingAfterCapture.value = false
      await nextTick()
      await startCamera()
    } else {
      stopCamera()
    }
  },
)
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    :header-title-override="header"
    entity-name=""
    size="standard"
    custom-button-label="Capturar"
    :submit-loading="busy"
    :submit-disabled="!canCapture()"
    @canceled-shared="onDialogCanceled"
    @saved-shared="capturePhoto"
  >
    <template #content>
      <div class="fcc flex flex-column gap-3">
        <p class="fcc__hint m-0 text-sm" style="color: var(--text-body-secondary)">
          Centra el rostro frente a la cámara con buena luz. Evita gorras u oclusiones.
        </p>

        <div class="fcc__stage">
          <video
            ref="videoRef"
            class="fcc__video"
            playsinline
            muted
            autoplay
          />
          <div v-if="starting" class="fcc__overlay">
            <pv-progress-spinner style="width: 2rem; height: 2rem" stroke-width="4" />
            <span>Abriendo cámara…</span>
          </div>
          <div v-else-if="cameraError" class="fcc__overlay fcc__overlay--error">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            <span>{{ cameraError }}</span>
          </div>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          hidden
          @change="onFileSelected"
        />
      </div>
    </template>

    <template #footer="{ cancel, submit }">
      <div class="fcc__footer flex flex-column-reverse sm:flex-row justify-content-between align-items-stretch sm:align-items-center gap-2 w-full">
        <pv-button
          type="button"
          label="Subir archivo"
          icon="pi pi-upload"
          severity="secondary"
          text
          size="small"
          class="w-full sm:w-auto"
          :disabled="busy"
          @click="openFileFallback"
        />
        <div class="flex flex-column-reverse sm:flex-row gap-2 w-full sm:w-auto">
          <pv-button
            type="button"
            label="Cancelar"
            text
            size="small"
            class="w-full sm:w-auto"
            :disabled="busy"
            @click="cancel"
          />
          <pv-button
            type="button"
            label="Capturar"
            icon="pi pi-camera"
            size="small"
            class="w-full sm:w-auto"
            :loading="busy"
            :disabled="!canCapture()"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </CreateAndEdit>
</template>

<style scoped>
.fcc__stage {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: var(--text-body);
  border: 1px solid var(--border-ui);
}
.fcc__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* preview espejo (selfie) */
}
.fcc__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  text-align: center;
  background: color-mix(in srgb, var(--text-body) 72%, transparent);
  color: var(--surface-white);
  font-size: 0.875rem;
}
.fcc__overlay--error {
  color: #fecaca;
}
.fcc__overlay--error .pi {
  font-size: 1.5rem;
}
</style>
