<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import {
  formatCalendarDateForUi,
  formatTimeOfDayForUi,
} from '@/shared/domain/format-datetime-ui.js'
import { DOCUMENT_TYPES } from '@/employee-management/presentation/constants/employee-management-ui.constants.js'
import { useSecurityCheckpointStore } from '../../application/security-checkpoint.store.js'

const emit = defineEmits(['registered', 'back-requested'])

const store = useSecurityCheckpointStore()
const { showSuccess, showError } = useNotification()

const videoRef = ref(null)
const streamRef = ref(null)
const starting = ref(false)
const processing = ref(false)
const cameraError = ref('')
const statusText = ref('Mantén tu rostro centrado y mira al frente')
const lastResult = ref(null)
const previewPerson = ref(null)
/** idle | scanning | success | warn | error */
const statusTone = ref('idle')

const SCAN_INTERVAL_MS = 900
const HOLD_MS = 1600
const SUCCESS_COOLDOWN_MS = 7000
const SOFT_COOLDOWN_MS = 2200
const HARD_COOLDOWN_MS = 5000
/** Max longest edge for upload — smaller payload, faster InsightFace on CPU. */
const CAPTURE_MAX_EDGE = 640
const CAPTURE_JPEG_QUALITY = 0.72

const holdProgress = ref(0)

let scanTimer = null
let cooldownUntil = 0
let destroyed = false
/** @type {{ employeeId: number, employeeName: string, action: string, since: number } | null} */
let holdCandidate = null
/** @type {Float32Array | null} */
let prevMotionGray = null

const MOTION_SAMPLE = 48
const MOTION_MAX_MAE = 16

const displayPerson = computed(() => lastResult.value || previewPerson.value)

const initials = computed(() => {
  const name = displayPerson.value?.employeeName || ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
})

const docTypeLabel = computed(() => {
  const t = displayPerson.value?.documentType
  if (!t) return 'Doc.'
  return DOCUMENT_TYPES.find((d) => d.value === t)?.label ?? t
})

const attendanceView = computed(() => {
  const att = lastResult.value?.attendance ?? previewPerson.value?.attendance
  if (!att) return null
  const a = att
  const checkInRaw = a.check_in_time ?? a.checkInTime
  const checkOutRaw = a.check_out_time ?? a.checkOutTime
  return {
    date: formatCalendarDateForUi(a.attendance_date ?? a.attendanceDate),
    checkIn: formatTimeOfDayForUi(checkInRaw),
    checkOut: formatTimeOfDayForUi(checkOutRaw),
    hasCheckIn: checkInRaw != null && checkInRaw !== '',
    hasCheckOut: checkOutRaw != null && checkOutRaw !== '',
  }
})

const welcomeTitle = computed(() => {
  if (statusTone.value !== 'success' || !lastResult.value) return null
  return lastResult.value.action === 'CHECK_OUT' ? '¡Hasta luego!' : '¡Bienvenido!'
})

const bannerTone = computed(() => {
  if (cameraError.value) return 'error'
  if (starting.value) return 'scanning'
  return statusTone.value || 'idle'
})

const bannerIcon = computed(() => {
  switch (bannerTone.value) {
    case 'success': return 'pi pi-check-circle'
    case 'warn': return 'pi pi-exclamation-triangle'
    case 'error': return 'pi pi-times-circle'
    case 'scanning': return 'pi pi-spin pi-spinner'
    default: return 'pi pi-info-circle'
  }
})

const stageHint = computed(() => {
  if (cameraError.value) return cameraError.value
  if (starting.value) return 'Abriendo cámara…'
  if (holdProgress.value > 0 && holdProgress.value < 1) return statusText.value
  if (statusTone.value === 'warn' || statusTone.value === 'error' || statusTone.value === 'success') {
    return statusText.value
  }
  return 'Mantén tu rostro centrado y mira al frente'
})

const sideTitle = computed(() => {
  if (statusTone.value === 'success' && lastResult.value) return welcomeTitle.value
  if (previewPerson.value) return 'Reconociendo…'
  if (lastResult.value?.action === 'COMPLETE' && statusTone.value === 'warn') return 'Jornada completa'
  if (statusTone.value === 'warn') return 'Atención'
  if (statusTone.value === 'error') return 'No se pudo marcar'
  return 'Listo para marcar'
})

const sideSubtitle = computed(() => {
  if (statusTone.value === 'success' && lastResult.value) return 'Tu asistencia ha sido registrada'
  if (previewPerson.value) {
    return `Mantén quieto para ${actionLabel(previewPerson.value.action).toLowerCase()}`
  }
  if (lastResult.value?.action === 'COMPLETE' && statusTone.value === 'warn') {
    return 'Ya tiene ingreso y salida hoy'
  }
  if (statusTone.value === 'warn' || statusTone.value === 'error') return statusText.value
  return 'El sistema usa el rostro más cercano. Quédate quieto ~1,6 s.'
})

const sideIconToneClass = computed(() => {
  if (cameraError.value || statusTone.value === 'error') return 'fak__status-icon--error'
  if (statusTone.value === 'success' && lastResult.value) return 'fak__status-icon--success'
  if (previewPerson.value || statusTone.value === 'scanning') return 'fak__status-icon--scanning'
  if (statusTone.value === 'warn') return 'fak__status-icon--warn'
  return 'fak__status-icon--idle'
})

const sideIconClass = computed(() => {
  if (cameraError.value || statusTone.value === 'error') return 'pi pi-times'
  if (statusTone.value === 'success' && lastResult.value) return 'pi pi-check'
  if (previewPerson.value || statusTone.value === 'scanning') return 'pi pi-spin pi-spinner'
  if (statusTone.value === 'warn') return 'pi pi-exclamation-triangle'
  return 'pi pi-face-smile'
})

function faceCodeFromError(err) {
  const data = err?.response?.data
  const code = typeof data?.code === 'string' ? data.code : ''
  const message = typeof data?.message === 'string' ? data.message : ''
  const raw = code || message || ''
  const match = raw.match(/FACE_[A-Z_]+/)
  return match ? match[0] : ''
}

function setStatus(text, tone = 'idle') {
  statusText.value = text
  statusTone.value = tone
}

function resetHold() {
  holdCandidate = null
  holdProgress.value = 0
  previewPerson.value = null
}

function actionLabel(action) {
  return action === 'CHECK_OUT' ? 'Salida' : 'Ingreso'
}

function measureMotion() {
  const video = videoRef.value
  if (!video || !video.videoWidth) return { moving: false, mae: 0 }
  const canvas = document.createElement('canvas')
  canvas.width = MOTION_SAMPLE
  canvas.height = MOTION_SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { moving: false, mae: 0 }
  ctx.drawImage(video, 0, 0, MOTION_SAMPLE, MOTION_SAMPLE)
  const { data } = ctx.getImageData(0, 0, MOTION_SAMPLE, MOTION_SAMPLE)
  const gray = new Float32Array(MOTION_SAMPLE * MOTION_SAMPLE)
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  if (!prevMotionGray || prevMotionGray.length !== gray.length) {
    prevMotionGray = gray
    return { moving: false, mae: 0 }
  }
  let sum = 0
  for (let i = 0; i < gray.length; i += 1) {
    sum += Math.abs(gray[i] - prevMotionGray[i])
  }
  const mae = sum / gray.length
  prevMotionGray = gray
  return { moving: mae > MOTION_MAX_MAE, mae }
}

async function startCamera() {
  cameraError.value = ''
  stopCamera()
  if (!navigator?.mediaDevices?.getUserMedia) {
    cameraError.value = 'Este navegador no permite acceso a la cámara.'
    return
  }
  starting.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    if (destroyed) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    streamRef.value = stream
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
    }
    setStatus('Mantén tu rostro centrado y mira al frente', 'scanning')
  } catch (err) {
    const name = err?.name || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      cameraError.value = 'Permiso de cámara denegado.'
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      cameraError.value = 'No se encontró una cámara.'
    } else {
      cameraError.value = 'No se pudo abrir la cámara.'
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
  if (videoRef.value) videoRef.value.srcObject = null
}

function captureFrameFile() {
  const video = videoRef.value
  if (!video || !video.videoWidth) return null
  const srcW = video.videoWidth
  const srcH = video.videoHeight
  const scale = Math.min(1, CAPTURE_MAX_EDGE / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(video, 0, 0, w, h)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) resolve(null)
        else resolve(new File([blob], `face-live-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY,
    )
  })
}

function mapPerson(preview) {
  return {
    employeeId: preview.employeeId,
    employeeName: preview.employeeName,
    documentNumber: preview.documentNumber,
    documentType: preview.documentType,
    position: preview.position,
    action: preview.action,
    attendance: preview.attendance,
  }
}

async function scanOnce() {
  if (destroyed || processing.value || cameraError.value || starting.value) return
  if (Date.now() < cooldownUntil) return
  if (!streamRef.value) return

  processing.value = true
  try {
    const motion = measureMotion()
    if (motion.moving) {
      resetHold()
      setStatus('Quédate quieto frente a la cámara…', 'warn')
      return
    }

    const file = await captureFrameFile()
    if (!file) {
      setStatus('Ajustando cámara…', 'scanning')
      return
    }

    // Hold already satisfied from prior dry-runs → single round-trip to register (no double extract).
    const holdReady = !!holdCandidate && (Date.now() - holdCandidate.since) >= HOLD_MS
    if (holdReady) {
      setStatus('Confirmando marcación…', 'scanning')
      const result = await store.identifyAndRegisterFacialAttendance(file, { dryRun: false })
      if (destroyed) return
      if (result.action === 'COMPLETE') {
        resetHold()
        lastResult.value = result
        setStatus('Ya tiene ingreso y salida hoy', 'warn')
        cooldownUntil = Date.now() + HARD_COOLDOWN_MS
        return
      }
      if (holdCandidate && result.employeeId !== holdCandidate.employeeId) {
        resetHold()
        setStatus('Persona distinta detectada; mantén quieto…', 'warn')
        return
      }
      resetHold()
      lastResult.value = result
      setStatus(`${actionLabel(result.action)} registrada`, 'success')
      showSuccess(`${actionLabel(result.action)}: ${result.employeeName}`)
      cooldownUntil = Date.now() + SUCCESS_COOLDOWN_MS
      emit('registered', result)
      return
    }

    const preview = await store.identifyAndRegisterFacialAttendance(file, { dryRun: true })
    if (destroyed) return

    const motionAfter = measureMotion()
    if (motionAfter.moving) {
      resetHold()
      setStatus('Quédate quieto frente a la cámara…', 'warn')
      return
    }

    if (preview.action === 'COMPLETE') {
      resetHold()
      lastResult.value = preview
      previewPerson.value = null
      setStatus('Ya tiene ingreso y salida hoy', 'warn')
      cooldownUntil = Date.now() + HARD_COOLDOWN_MS
      return
    }

    previewPerson.value = mapPerson(preview)

    const now = Date.now()
    if (!holdCandidate || holdCandidate.employeeId !== preview.employeeId) {
      holdCandidate = {
        employeeId: preview.employeeId,
        employeeName: preview.employeeName,
        action: preview.action,
        since: now,
      }
      holdProgress.value = 0
    } else {
      holdCandidate.action = preview.action
      holdCandidate.employeeName = preview.employeeName
    }

    const heldFor = now - holdCandidate.since
    holdProgress.value = Math.min(1, heldFor / HOLD_MS)
    const secondsLeft = Math.max(0, (HOLD_MS - heldFor) / 1000).toFixed(1)
    setStatus(
      `Mantén quieto… ${actionLabel(preview.action)} (${secondsLeft}s)`,
      'scanning',
    )
    // Next scan commits with a single extract (avoid dry_run + register in the same tick).
  } catch (err) {
    if (destroyed) return
    const code = faceCodeFromError(err)
    if (code === 'FACE_NOT_DETECTED') {
      resetHold()
      setStatus('Mantén tu rostro centrado y mira al frente', 'idle')
      return
    }
    if (code === 'FACE_TOO_FAR') {
      resetHold()
      setStatus('Acércate a la cámara', 'warn')
      return
    }
    if (code === 'FACE_NOT_DOMINANT') {
      resetHold()
      setStatus('Acércate más; ignora personas al fondo', 'warn')
      return
    }
    if (code === 'FACE_LOW_QUALITY') {
      resetHold()
      setStatus('Mejora la luz y mira de frente', 'warn')
      return
    }
    if (code === 'FACE_MULTIPLE_FACES') {
      resetHold()
      setStatus('Que solo una persona se acerque', 'warn')
      cooldownUntil = Date.now() + SOFT_COOLDOWN_MS
      return
    }
    if (code === 'FACE_NO_MATCH') {
      resetHold()
      setStatus('Rostro no reconocido', 'warn')
      cooldownUntil = Date.now() + SOFT_COOLDOWN_MS
      return
    }
    if (code === 'FACE_ATTENDANCE_COMPLETE') {
      resetHold()
      setStatus('Ya tiene ingreso y salida hoy', 'warn')
      cooldownUntil = Date.now() + HARD_COOLDOWN_MS
      return
    }
    if (code === 'FACE_AMBIGUOUS') {
      resetHold()
      setStatus('Coincidencia ambigua', 'warn')
      cooldownUntil = Date.now() + HARD_COOLDOWN_MS
      return
    }
    resetHold()
    setStatus(humanizeApiError(err), 'error')
    cooldownUntil = Date.now() + HARD_COOLDOWN_MS
    if (code === 'FACE_SERVICE_UNAVAILABLE') showError(statusText.value)
  } finally {
    processing.value = false
  }
}

function startScanLoop() {
  stopScanLoop()
  scanTimer = setInterval(() => { scanOnce() }, SCAN_INTERVAL_MS)
}

function stopScanLoop() {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

onMounted(async () => {
  destroyed = false
  await startCamera()
  startScanLoop()
})

onUnmounted(() => {
  destroyed = true
  stopScanLoop()
  stopCamera()
})
</script>

<template>
  <section class="fak" aria-live="polite">
    <header class="fak__top">
      <pv-button
        type="button"
        class="fak__back"
        label="Volver al listado"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        size="small"
        @click="emit('back-requested')"
      />
    </header>

    <div class="fak__grid">
      <div class="fak__left">
        <div class="fak__intro">
          <h2 class="fak__headline m-0">Acércate a la cámara</h2>
          <p class="fak__sub m-0">para registrar tu asistencia</p>
        </div>

        <div class="fak__stage" :data-tone="bannerTone">
          <video
            ref="videoRef"
            class="fak__video"
            playsinline
            muted
            autoplay
          />
          <div class="fak__frame" aria-hidden="true">
            <span class="fak__corner fak__corner--tl" />
            <span class="fak__corner fak__corner--tr" />
            <span class="fak__corner fak__corner--bl" />
            <span class="fak__corner fak__corner--br" />
          </div>
          <div v-if="starting" class="fak__overlay">
            <pv-progress-spinner style="width: 2rem; height: 2rem" stroke-width="4" />
            <span>Abriendo cámara…</span>
          </div>
          <div v-else-if="cameraError" class="fak__overlay fak__overlay--error">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            <span>{{ cameraError }}</span>
          </div>
          <div class="fak__banner" :data-tone="bannerTone">
            <i :class="bannerIcon" aria-hidden="true" />
            <span>{{ stageHint }}</span>
          </div>
          <div v-if="holdProgress > 0 && holdProgress < 1" class="fak__hold" aria-hidden="true">
            <div class="fak__hold-bar" :style="{ width: `${Math.round(holdProgress * 100)}%` }" />
          </div>
        </div>

        <p class="fak__privacy m-0">
          <i class="pi pi-shield" aria-hidden="true" />
          Tus datos biométricos se usan solo para marcación de asistencia.
        </p>
      </div>

      <aside class="fak__right" :data-tone="bannerTone">
        <div
          class="fak__status-icon"
          :class="sideIconToneClass"
          aria-hidden="true"
        >
          <i :class="sideIconClass" />
        </div>
        <h3 class="fak__welcome m-0">{{ sideTitle }}</h3>
        <p class="fak__welcome-sub m-0" :data-tone="bannerTone">{{ sideSubtitle }}</p>

        <div v-if="displayPerson" class="fak__card">
          <div class="fak__avatar" aria-hidden="true">{{ initials }}</div>
          <div class="fak__card-text min-w-0">
            <p class="fak__name m-0">{{ displayPerson.employeeName }}</p>
            <p class="fak__role m-0">{{ displayPerson.position?.trim() || 'Sin cargo' }}</p>
            <p class="fak__doc m-0">{{ docTypeLabel }}: {{ displayPerson.documentNumber || '—' }}</p>
          </div>
        </div>

        <div class="fak__punches">
          <div
            class="fak__punch fak__punch--in"
            :class="{ 'fak__punch--active': !!attendanceView?.hasCheckIn }"
          >
            <i class="pi pi-sign-in" aria-hidden="true" />
            <div class="fak__punch-body min-w-0">
              <span class="fak__punch-label">
                {{ attendanceView?.hasCheckIn ? 'Ingreso registrado' : 'Ingreso' }}
              </span>
              <strong>
                <template v-if="attendanceView?.hasCheckIn">
                  {{ attendanceView.checkIn }}
                  <template v-if="attendanceView.date">
                    <span class="fak__punch-date"> · {{ attendanceView.date }}</span>
                  </template>
                </template>
                <template v-else>—:—:—</template>
              </strong>
            </div>
          </div>
          <div
            class="fak__punch fak__punch--out"
            :class="{ 'fak__punch--active': !!attendanceView?.hasCheckOut }"
          >
            <i class="pi pi-sign-out" aria-hidden="true" />
            <div class="fak__punch-body min-w-0">
              <span class="fak__punch-label">
                {{ attendanceView?.hasCheckOut ? 'Salida registrada' : 'Salida' }}
              </span>
              <strong>
                <template v-if="attendanceView?.hasCheckOut">
                  {{ attendanceView.checkOut }}
                  <template v-if="attendanceView.date">
                    <span class="fak__punch-date"> · {{ attendanceView.date }}</span>
                  </template>
                </template>
                <template v-else>—:—:—</template>
              </strong>
            </div>
          </div>
        </div>

        <div class="fak__tip">
          <i class="pi pi-info-circle" aria-hidden="true" />
          <div>
            <strong>Consejo</strong>
            <p class="m-0">Usa buena luz, acércate y mira de frente. Personas al fondo se ignoran si tú estás más cerca.</p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.fak {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  min-height: min(72vh, 46rem);
  padding: 0.85rem 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-ui);
  background: var(--surface-white);
}

.fak__top {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.fak__back :deep(.p-button-label) {
  white-space: nowrap;
}

.fak__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  flex: 1;
  min-height: 0;
  align-content: start;
}

.fak__left {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

.fak__intro {
  text-align: center;
}

.fak__headline {
  color: var(--text-body);
  font-size: clamp(1.1rem, 2.8vw, 1.4rem);
  font-weight: 700;
  line-height: 1.2;
}

.fak__sub {
  color: var(--text-body-secondary);
  font-size: clamp(0.85rem, 2.2vw, 0.95rem);
  margin-top: 0.15rem !important;
}

.fak__stage {
  position: relative;
  width: 100%;
  margin-inline: auto;
  aspect-ratio: 4 / 3;
  max-height: min(52vh, 26rem);
  border-radius: 16px;
  overflow: hidden;
  background: var(--text-body);
  border: 1px solid var(--border-ui);
}

.fak__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.fak__frame {
  pointer-events: none;
  position: absolute;
  inset: 12% 28%;
}

.fak__corner {
  position: absolute;
  width: 1.35rem;
  height: 1.35rem;
  border: 3px solid var(--success-tint-text);
  transition: border-color 0.2s ease;
}

.fak__stage[data-tone='warn'] .fak__corner { border-color: var(--warning-tint-text); }
.fak__stage[data-tone='error'] .fak__corner { border-color: var(--error-tint-text); }
.fak__stage[data-tone='scanning'] .fak__corner { border-color: var(--color-primary); }
.fak__corner--tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-radius: 6px 0 0 0; }
.fak__corner--tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-radius: 0 6px 0 0; }
.fak__corner--bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 6px; }
.fak__corner--br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-radius: 0 0 6px 0; }

.fak__overlay {
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

.fak__overlay--error { color: #fecaca; }

.fak__banner {
  position: absolute;
  left: 50%;
  bottom: 0.75rem;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  max-width: calc(100% - 1.25rem);
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border-ui);
  background: var(--surface-white);
  color: var(--text-body);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--text-body) 12%, transparent);
}

.fak__banner span {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.fak__banner .pi { color: var(--color-primary); flex-shrink: 0; }
.fak__banner[data-tone='idle'] {
  background: var(--surface-white);
  border-color: var(--border-ui);
  color: var(--text-body);
}
.fak__banner[data-tone='idle'] .pi { color: var(--color-primary); }
.fak__banner[data-tone='scanning'] {
  background: var(--primary-tint-bg);
  border-color: var(--primary-tint-border);
  color: var(--color-primary);
}
.fak__banner[data-tone='scanning'] .pi { color: var(--color-primary); }
.fak__banner[data-tone='success'] {
  background: var(--success-tint-bg);
  border-color: var(--success-tint-border);
  color: var(--success-tint-text);
}
.fak__banner[data-tone='success'] .pi { color: var(--success-tint-text); }
.fak__banner[data-tone='warn'] {
  background: var(--warning-tint-bg);
  border-color: var(--warning-tint-border);
  color: var(--warning-tint-text);
}
.fak__banner[data-tone='warn'] .pi { color: var(--warning-tint-text); }
.fak__banner[data-tone='error'] {
  background: var(--error-tint-bg);
  border-color: var(--error-tint-border);
  color: var(--error-tint-text);
}
.fak__banner[data-tone='error'] .pi { color: var(--error-tint-text); }

.fak__hold {
  position: absolute;
  left: 0.85rem;
  right: 0.85rem;
  bottom: 3rem;
  height: 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-white) 28%, transparent);
  overflow: hidden;
}

.fak__hold-bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s linear;
}

.fak__privacy {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0.35rem;
  color: var(--text-body-muted);
  font-size: 0.72rem;
  line-height: 1.35;
  text-align: center;
  padding-inline: 0.25rem;
}

.fak__privacy .pi {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.fak__right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.15rem 0.15rem;
  text-align: center;
  min-width: 0;
}

.fak__status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  font-size: 1.5rem;
  background: var(--surface-light);
  color: var(--text-body-secondary);
}

.fak__status-icon--success {
  background: var(--success-tint-bg);
  color: var(--success-tint-text);
}
.fak__status-icon--scanning {
  background: var(--primary-tint-bg);
  color: var(--color-primary);
}
.fak__status-icon--warn {
  background: var(--warning-tint-bg);
  color: var(--warning-tint-text);
}
.fak__status-icon--error {
  background: var(--error-tint-bg);
  color: var(--error-tint-text);
}
.fak__status-icon--idle {
  background: var(--surface-light);
  color: var(--text-body-secondary);
}

.fak__welcome {
  color: var(--text-body);
  font-size: clamp(1.15rem, 2.6vw, 1.35rem);
  font-weight: 700;
  line-height: 1.2;
}

.fak__welcome-sub {
  color: var(--text-body-secondary);
  font-size: 0.875rem;
  margin-top: -0.25rem !important;
  line-height: 1.35;
  max-width: 24rem;
}

.fak__welcome-sub[data-tone='warn'] { color: var(--warning-tint-text); }
.fak__welcome-sub[data-tone='error'] { color: var(--error-tint-text); }
.fak__welcome-sub[data-tone='success'] { color: var(--success-tint-text); }

.fak__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 14px;
  background: var(--surface-light);
  border: 1px solid var(--border-ui);
  text-align: left;
}

.fak__avatar {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
}

.fak__name {
  color: var(--text-body);
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.25;
  word-break: break-word;
}

.fak__role,
.fak__doc {
  color: var(--text-body-secondary);
  font-size: 0.8rem;
  margin-top: 0.12rem !important;
  word-break: break-word;
}

.fak__punches {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.55rem;
  width: 100%;
}

.fak__punch {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border-ui);
  background: var(--surface-light);
  text-align: left;
  color: var(--text-body-secondary);
  min-width: 0;
}

.fak__punch .pi { font-size: 1.05rem; flex-shrink: 0; }
.fak__punch-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
}
.fak__punch strong {
  display: block;
  margin-top: 0.12rem;
  font-size: 0.88rem;
  color: var(--text-body);
  word-break: break-word;
}

.fak__punch--in.fak__punch--active {
  background: var(--success-tint-bg);
  border-color: var(--success-tint-border);
  color: var(--success-tint-text);
}
.fak__punch--in.fak__punch--active strong { color: var(--success-tint-text); }
.fak__punch--out.fak__punch--active {
  background: var(--primary-tint-bg);
  border-color: var(--primary-tint-border);
  color: var(--color-primary);
}
.fak__punch--out.fak__punch--active strong { color: var(--color-primary); }

.fak__tip {
  display: flex;
  gap: 0.6rem;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  background: var(--primary-tint-bg);
  border: 1px solid var(--primary-tint-border);
  text-align: left;
  color: var(--text-body);
  font-size: 0.8rem;
  line-height: 1.4;
}

.fak__tip .pi { color: var(--color-primary); margin-top: 0.1rem; flex-shrink: 0; }
.fak__tip strong {
  display: block;
  color: var(--color-primary);
  font-weight: 700;
  margin-bottom: 0.15rem;
}
.fak__tip p {
  color: var(--text-body);
  opacity: 1;
}

/* —— Teléfono (portrait / angosto) —— */
@media (max-width: 767px) {
  .fak {
    gap: 0.55rem;
    min-height: calc(100dvh - 5.25rem);
    padding: 0.55rem 0.55rem 0.85rem;
    border-radius: 12px;
  }

  .fak__grid {
    gap: 0.75rem;
  }

  .fak__intro {
    padding-inline: 0.25rem;
  }

  .fak__stage {
    aspect-ratio: 3 / 4;
    max-height: min(52dvh, 24rem);
    border-radius: 14px;
  }

  .fak__frame {
    inset: 14% 18%;
  }

  .fak__corner {
    width: 1.15rem;
    height: 1.15rem;
    border-width: 2.5px;
  }

  .fak__banner {
    bottom: 0.55rem;
    font-size: 0.75rem;
    padding: 0.45rem 0.7rem;
    max-width: calc(100% - 0.9rem);
  }

  .fak__hold {
    left: 0.65rem;
    right: 0.65rem;
    bottom: 2.65rem;
  }

  .fak__right {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'icon title'
      'icon sub'
      'card card'
      'punches punches'
      'tip tip';
    column-gap: 0.7rem;
    row-gap: 0.2rem;
    align-items: center;
    text-align: left;
    padding: 0.15rem 0 0;
  }

  .fak__status-icon {
    grid-area: icon;
    width: 3rem;
    height: 3rem;
    font-size: 1.2rem;
  }

  .fak__welcome {
    grid-area: title;
    align-self: end;
  }

  .fak__welcome-sub {
    grid-area: sub;
    align-self: start;
    max-width: none;
    margin-top: 0 !important;
    font-size: 0.8rem;
  }

  .fak__card { grid-area: card; margin-top: 0.45rem; }

  .fak__punches {
    grid-area: punches;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
    margin-top: 0.35rem;
  }

  .fak__punch {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    padding: 0.65rem 0.6rem;
  }

  .fak__punch-date {
    display: none;
  }

  .fak__tip {
    grid-area: tip;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    padding: 0.7rem 0.75rem;
  }
}

/* —— Teléfono muy angosto —— */
@media (max-width: 380px) {
  .fak__back :deep(.p-button-label) {
    font-size: 0.8rem;
  }

  .fak__stage {
    max-height: min(48dvh, 20rem);
  }

  .fak__punches {
    grid-template-columns: 1fr;
  }
}

/* —— Tablet portrait —— */
@media (min-width: 768px) and (max-width: 959px) and (orientation: portrait) {
  .fak {
    min-height: calc(100dvh - 6rem);
    padding: 1rem 1.1rem 1.25rem;
  }

  .fak__stage {
    aspect-ratio: 4 / 3;
    max-height: min(46vh, 28rem);
    max-width: 40rem;
  }

  .fak__frame {
    inset: 12% 26%;
  }

  .fak__right {
    max-width: 36rem;
    margin-inline: auto;
    width: 100%;
  }

  .fak__punches {
    grid-template-columns: 1fr 1fr;
  }

  .fak__status-icon {
    width: 4rem;
    height: 4rem;
    font-size: 1.6rem;
  }
}

/* —— Tablet landscape / desktop angosto —— */
@media (min-width: 768px) and (max-width: 959px) and (orientation: landscape) {
  .fak {
    min-height: calc(100dvh - 4.5rem);
    padding: 0.75rem 0.9rem;
  }

  .fak__grid {
    grid-template-columns: minmax(0, 1.25fr) minmax(15rem, 0.85fr);
    gap: 0.9rem;
    align-items: start;
  }

  .fak__stage {
    aspect-ratio: 16 / 10;
    max-height: min(72dvh, 28rem);
  }

  .fak__frame {
    inset: 10% 30%;
  }

  .fak__right {
    padding-top: 0.25rem;
  }

  .fak__punches {
    grid-template-columns: 1fr;
  }

  .fak__tip {
    font-size: 0.75rem;
  }
}

/* —— Desktop —— */
@media (min-width: 960px) {
  .fak {
    gap: 1rem;
    min-height: min(70vh, 44rem);
    padding: 1rem 1.1rem 1.25rem;
  }

  .fak__grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(16rem, 0.85fr);
    gap: 1.25rem;
    align-items: stretch;
  }

  .fak__stage {
    aspect-ratio: 4 / 3;
    max-height: min(52vh, 26rem);
  }

  .fak__frame {
    inset: 12% 32%;
  }

  .fak__status-icon {
    width: 4.25rem;
    height: 4.25rem;
    font-size: 1.75rem;
  }

  .fak__punches {
    grid-template-columns: 1fr;
  }
}

/* —— Altura corta (teclado / landscape phone) —— */
@media (max-height: 640px) {
  .fak {
    min-height: auto;
  }

  .fak__stage {
    max-height: min(42dvh, 18rem);
  }

  .fak__tip {
    display: none;
  }

  .fak__privacy {
    display: none;
  }
}
</style>
