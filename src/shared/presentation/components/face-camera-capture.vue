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

/** 'user' = frontal, 'environment' = trasera */
const facingMode = ref('user')
const canFlipCamera = ref(false)

const canCapture = () =>
  !props.busy && !starting.value && !cameraError.value && !!streamRef.value

async function refreshCameraFlipAvailability() {
  if (!navigator?.mediaDevices?.enumerateDevices) {
    canFlipCamera.value = true
    return
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter((d) => d.kind === 'videoinput')
    canFlipCamera.value = cams.length !== 1
  } catch {
    canFlipCamera.value = true
  }
}

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
        facingMode: { ideal: facingMode.value },
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
    await refreshCameraFlipAvailability()
  } catch (err) {
    const name = err?.name || ''
    if (facingMode.value === 'environment' && name !== 'NotAllowedError' && name !== 'PermissionDeniedError') {
      facingMode.value = 'user'
      starting.value = false
      await startCamera()
      return
    }
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

async function flipCamera() {
  if (starting.value || props.busy || cameraError.value) return
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
  await startCamera()
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

  const maxEdge = 640
  const srcW = video.videoWidth
  const srcH = video.videoHeight
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  // Preview is mirrored; store the natural (non-mirrored) frame for recognition.
  ctx.drawImage(video, 0, 0, w, h)

  canvas.toBlob(
    (blob) => {
      if (!blob) return
      finishWithFile(new File([blob], `face-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    },
    'image/jpeg',
    0.75,
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
            :class="{ 'fcc__video--mirror': facingMode === 'user' }"
            playsinline
            muted
            autoplay
          />
          <button
            v-if="canFlipCamera && !cameraError"
            type="button"
            class="fcc__flip"
            :aria-label="facingMode === 'user' ? 'Usar cámara trasera' : 'Usar cámara frontal'"
            :title="facingMode === 'user' ? 'Cámara trasera' : 'Cámara frontal'"
            :disabled="starting || busy"
            @click="flipCamera"
          >
            <i class="pi pi-sync" aria-hidden="true" />
          </button>
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
}
.fcc__video--mirror {
  transform: scaleX(-1);
}
.fcc__flip {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.65rem;
  height: 2.65rem;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--text-body, #1e293b);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
  cursor: pointer;
  font-size: 1rem;
}
.fcc__flip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
