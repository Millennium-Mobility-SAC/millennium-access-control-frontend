<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import { useWhatsAppManagementStore } from '../../application/whatsapp-management.store.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { useConfirm } from 'primevue/useconfirm'

const store     = useWhatsAppManagementStore()
const { showSuccess, showError } = useNotification()
const confirm   = useConfirm()

const showKey   = ref(false)
const copiedMsg = ref(false)
const rawCopied = ref(false)
const qrCanvas  = ref(null)

// Cronómetro de refresco del QR. El microservicio informa cuántos segundos le
// quedan al QR actual, así que el intervalo deja de ser una suposición.
const QR_FALLBACK_SECONDS = 60
const qrTotalSeconds = ref(QR_FALLBACK_SECONDS)
const QR_MAX_AUTO_ROTATIONS = 3
const qrCountdown = ref(QR_FALLBACK_SECONDS)
const qrAutoRotations = ref(0)
const qrManualPause = ref(false)
const qrFlash = ref(false)
let qrFlashTimer = null
let qrCountdownTimer = null

function triggerQrFlash() {
    qrFlash.value = false
    if (qrFlashTimer) clearTimeout(qrFlashTimer)
    // forzar reflujo para reiniciar la animación incluso si ya estaba activa
    requestAnimationFrame(() => {
        qrFlash.value = true
        qrFlashTimer = setTimeout(() => { qrFlash.value = false }, 700)
    })
}

function startQrCountdown() {
    qrTotalSeconds.value = store.qrExpiresInSeconds ?? QR_FALLBACK_SECONDS
    qrCountdown.value = qrTotalSeconds.value
    if (qrCountdownTimer) clearInterval(qrCountdownTimer)
    if (qrManualPause.value) return
    qrCountdownTimer = setInterval(async () => {
        if (qrCountdown.value > 1) {
            qrCountdown.value -= 1
            return
        }
        // Llegamos a 0: pedimos al backend el QR más reciente. Si llega uno
        // nuevo, el watcher de qrString incrementará el contador y decidirá
        // si pausar. Si todavía no rotó en el backend, el watcher no se
        // disparará y mantendremos el contador en 0 hasta que llegue.
        qrCountdown.value = 0
        await store.fetchQr()
    }, 1000)
}

function stopQrCountdown() {
    if (qrCountdownTimer) {
        clearInterval(qrCountdownTimer)
        qrCountdownTimer = null
    }
    qrTotalSeconds.value = store.qrExpiresInSeconds ?? QR_FALLBACK_SECONDS
    qrCountdown.value = qrTotalSeconds.value
}

function resetQrRotationCounter() {
    qrAutoRotations.value = 0
    qrManualPause.value = false
}

async function handleManualQrRefresh() {
    resetQrRotationCounter()
    await store.fetchQr()
    // Si no llega un QR nuevo, igual reiniciamos el cronómetro
    startQrCountdown()
}

const qrCountdownPercent = computed(() => Math.round((qrCountdown.value / (qrTotalSeconds.value || 1)) * 100))
// Mostramos el ciclo actual (1 de 3 al inicio, 2 de 3 tras la 1ª rotación, etc.)
const qrCurrentRotation = computed(() => Math.min(QR_MAX_AUTO_ROTATIONS, qrAutoRotations.value + 1))

// Modelos locales para edición (no mutamos el store directamente)
const groupIdInput = ref('')
const enabledInput = ref(false)
const selectedGroup = ref(null)

watch(() => store.groupId, (val) => { groupIdInput.value = val || '' }, { immediate: true })
watch(() => store.enabled, (val) => { enabledInput.value = !!val }, { immediate: true })

watch(() => store.qrString, async (qr, prev) => {
    if (!qr) {
        stopQrCountdown()
        return
    }
    await nextTick()
    if (qrCanvas.value) {
        QRCode.toCanvas(qrCanvas.value, qr, { width: 240, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
        triggerQrFlash()
    }
    // Detectamos cuándo el QR realmente cambió (rotación real del backend).
    const isFirstLoad = !prev
    const isRotation  = !!prev && prev !== qr

    if (isFirstLoad) {
        // Primera carga o reanudación manual: contador en 0 (mostramos 1 de 3).
        resetQrRotationCounter()
    } else if (isRotation) {
        // El backend rotó el QR. Incrementamos.
        qrAutoRotations.value += 1
        if (qrAutoRotations.value >= QR_MAX_AUTO_ROTATIONS) {
            // Tras la 3ª rotación, pausamos: no permitiremos más automáticas.
            qrManualPause.value = true
            stopQrCountdown()
            return
        }
    }

    // Reiniciamos el cronómetro a 30s para la próxima rotación esperada.
    startQrCountdown()
})

const statusIcon = computed(() => {
    if (store.connected === null) return 'pi pi-spin pi-spinner'
    if (store.serviceUnreachable) return 'pi pi-exclamation-triangle'
    if (store.groupsPending) return 'pi pi-spin pi-spinner'
    if (store.restoringSession) return 'pi pi-spin pi-spinner'
    return store.connected ? 'pi pi-whatsapp' : 'pi pi-times'
})
const statusText = computed(() => {
    if (store.connected === null) return 'Verificando conexión...'
    if (store.serviceUnreachable) return 'El servicio de WhatsApp no responde'
    if (store.groupsPending) return 'Sincronizando chats de WhatsApp...'
    if (store.restoringSession) return 'Restaurando sesión guardada...'
    return store.connected ? 'Conectado a WhatsApp' : 'Desconectado'
})
const statusTextClass = computed(() => {
    if (store.connected === null) return ''
    if (store.serviceUnreachable) return 'wa-status__text--offline'
    if (store.groupsPending) return 'wa-status__text--syncing'
    if (store.restoringSession) return 'wa-status__text--syncing'
    return store.connected ? 'wa-status__text--online' : 'wa-status__text--offline'
})
const statusCardClass = computed(() => {
    if (store.connected === null) return ''
    if (store.serviceUnreachable) return 'wa-card--status-offline'
    if (store.groupsPending) return 'wa-card--status-syncing'
    if (store.restoringSession) return 'wa-card--status-syncing'
    return store.connected ? 'wa-card--status-online' : 'wa-card--status-offline'
})
const statusIndicatorClass = computed(() => {
    if (store.connected === null) return 'wa-status__indicator--loading'
    if (store.serviceUnreachable) return 'wa-status__indicator--offline'
    if (store.groupsPending) return 'wa-status__indicator--syncing'
    if (store.restoringSession) return 'wa-status__indicator--syncing'
    return store.connected ? 'wa-status__indicator--online' : 'wa-status__indicator--offline'
})
const statusPillClass = computed(() => {
    if (store.connected === null) return 'wa-status__pill--loading'
    if (store.serviceUnreachable) return 'wa-status__pill--offline'
    if (store.groupsPending) return 'wa-status__pill--syncing'
    if (store.restoringSession) return 'wa-status__pill--syncing'
    return store.connected ? 'wa-status__pill--online' : 'wa-status__pill--offline'
})
const groupsButtonDisabled = computed(() => !store.connected || store.groupsPending || store.isLoadingGroups)
const groupsButtonTooltip = computed(() => {
    if (!store.connected) return 'Conecta WhatsApp escaneando el QR primero'
    if (store.groupsPending) return 'Espera a que el bot termine de preparar la lista de grupos'
    return undefined
})

/**
 * El bot no puede escribir en grupos de solo-administradores si no es admin.
 * Se listan igualmente, pero deshabilitados: antes se podían elegir y los
 * envíos fallaban después, sin explicación.
 */
const selectableGroups = computed(() =>
    store.groups.map((group) => ({ ...group, disabledForSend: !group.canSend })),
)

onMounted(async () => {
    await Promise.all([store.fetchStatus(), store.fetchConfiguration()])
    if (!store.connected && !store.serviceUnreachable) {
        store.startQrPolling()
    }
})

onUnmounted(() => {
    store.stopQrPolling()
    store.stopStatusPolling()
    stopQrCountdown()
    if (qrFlashTimer) { clearTimeout(qrFlashTimer); qrFlashTimer = null }
})

async function handleGenerate() {
    showKey.value = true
    const key = await store.generateApiKey()
    if (key) {
        showSuccess('Clave propuesta. Aplícala en ambos servicios para que surta efecto.')
    } else {
        showError(store.error || 'No se pudo generar la clave')
    }
}

async function handleSaveGroupId() {
    const value = (groupIdInput.value || '').trim()
    if (!value) {
        showError('El Group ID no puede estar vacío')
        return
    }
    const ok = await store.updateGroupId(value)
    if (ok) showSuccess('Group ID actualizado')
    else    showError(store.error || 'No se pudo actualizar el Group ID')
}

async function handleLoadGroups() {
    if (!store.connected) {
        showError('WhatsApp no está conectado. Escanea el QR primero.')
        return
    }
    if (store.groupsPending) {
        showError('WhatsApp todavía está sincronizando los chats. Espera unos segundos.')
        return
    }
    const ok = await store.fetchGroups()
    if (!ok) {
        showError(store.error || 'No se pudieron obtener los grupos')
    } else if (store.groups.length === 0) {
        showError('No se encontraron grupos en la cuenta vinculada')
    } else {
        showSuccess(`Se encontraron ${store.groups.length} grupo(s)`)
    }
}

function handleGroupSelected(ev) {
    const g = ev?.value
    if (g && g.id) {
        groupIdInput.value = g.id
    }
}

async function handleToggleEnabled() {
    const ok = await store.setEnabled(enabledInput.value)
    if (ok) showSuccess(enabledInput.value ? 'Notificaciones habilitadas' : 'Notificaciones deshabilitadas')
    else {
        // revertir el toggle visual si falló
        enabledInput.value = !enabledInput.value
        showError(store.error || 'No se pudo actualizar')
    }
}

async function copyKey() {
    const key = store.generatedKey
    if (!key) return
    await navigator.clipboard.writeText(key)
    copiedMsg.value = true
    setTimeout(() => { copiedMsg.value = false }, 2500)
}

async function copyRawError() {
    const msg = store.rawError
    if (!msg) return
    await navigator.clipboard.writeText(msg)
    rawCopied.value = true
    setTimeout(() => { rawCopied.value = false }, 2500)
}

async function refresh() {
    store.clearGeneratedKey()
    showKey.value = false
    await Promise.all([store.fetchStatus(), store.fetchConfiguration()])
}

/**
 * Reconecta conservando la vinculación. Es la primera opción ante una caída:
 * a diferencia de reiniciar la sesión, no obliga a escanear el QR de nuevo.
 */
async function handleReconnect() {
    const ok = await store.reconnect()
    if (ok) {
        showSuccess('Reconectando… el estado se actualizará solo.')
    } else {
        showError(store.error || 'No se pudo reconectar')
    }
}

async function handleResetSession() {
    confirm.require({
        header: 'Desvincular WhatsApp',
        message: 'Se borrará la sesión guardada y habrá que escanear un QR nuevo. Si solo se cayó la conexión, usa «Reconectar». ¿Continuar?',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Desvincular',
        acceptClass: 'p-button-danger',
        accept: async () => {
            const ok = await store.resetSession()
            if (ok) {
                showSuccess('Sesión reiniciada. El nuevo QR aparecerá en unos segundos.')
            } else {
                showError(store.error || 'No se pudo reiniciar la sesión')
            }
        }
    })
}
</script>

<template>
    <div class="wa-page">

        <!-- Encabezado -->
        <div class="wa-page__header">
            <div class="wa-page__header-left">
                <div class="wa-page__header-icon">
                    <i class="pi pi-whatsapp" />
                </div>
                <div>
                    <h2 class="wa-page__title">Servicio WhatsApp</h2>
                    <p class="wa-page__subtitle">Gestión del bot de notificaciones y seguridad del API</p>
                </div>
            </div>
            <pv-button
                icon="pi pi-refresh"
                label="Actualizar"
                outlined
                size="small"
                :loading="store.isLoading"
                @click="refresh"
            />
        </div>

        <!-- Error global -->
        <div v-if="store.error" class="wa-error-block">
            <div class="wa-error-block__main">
                <i class="pi pi-times-circle wa-error-block__icon" />
                <span class="wa-error-block__msg">{{ store.error }}</span>
            </div>
            <details v-if="store.rawError && store.rawError !== store.error" class="wa-error-block__details">
                <summary>Detalles técnicos <span class="wa-error-block__copy-hint">(para reportar al administrador)</span></summary>
                <div class="wa-error-block__raw-row">
                    <code class="wa-error-block__raw">{{ store.rawError }}</code>
                    <pv-button
                        :icon="rawCopied ? 'pi pi-check' : 'pi pi-copy'"
                        :severity="rawCopied ? 'success' : 'secondary'"
                        text rounded size="small"
                        v-tooltip="rawCopied ? '¡Copiado!' : 'Copiar mensaje de error'"
                        @click="copyRawError"
                    />
                </div>
            </details>
        </div>

        <!-- Grid de contenido -->
        <div class="wa-grid">

            <!-- Card: Estado -->
            <div class="wa-card wa-card--status" :class="statusCardClass">
                <div class="wa-status">
                    <div class="wa-status__indicator" :class="statusIndicatorClass">
                        <i :class="statusIcon" />
                        <span v-if="store.connected" class="wa-status__pulse" />
                    </div>
                    <div class="wa-status__body">
                        <span class="wa-status__eyebrow">Estado del bot</span>
                        <span class="wa-status__text" :class="statusTextClass">{{ statusText }}</span>
                        <span v-if="store.restoringSession" class="wa-status__hint wa-status__hint--syncing">
                            <i class="pi pi-info-circle" />
                            El servicio está reutilizando la sesión guardada en disco. No escanees un QR nuevo; suele tardar hasta un minuto tras reiniciar los servidores.
                        </span>
                        <span v-else-if="store.serviceUnreachable" class="wa-status__hint wa-status__hint--offline">
                            <i class="pi pi-info-circle" />
                            El API no pudo contactar al microservicio de WhatsApp (timeout o instancia no sana). Revisa los logs del contenedor y espera a que vuelva a responder.
                        </span>
                        <span v-else-if="store.connected === false" class="wa-status__hint">
                            Escanea el código QR que aparece más abajo desde <strong>WhatsApp → Dispositivos vinculados</strong>.
                        </span>
                        <span v-else-if="store.groupsPending" class="wa-status__hint wa-status__hint--syncing">
                            <i class="pi pi-info-circle" />
                            Los chats se están descargando. Podrás buscar tus grupos cuando termine (normalmente unos segundos).
                        </span>
                    </div>
                    <div class="wa-status__pill" :class="statusPillClass">
                        <span v-if="store.connected === null"><i class="pi pi-spin pi-spinner" /> Verificando</span>
                        <span v-else-if="store.serviceUnreachable"><i class="pi pi-exclamation-triangle" /> Sin respuesta</span>
                        <span v-else-if="store.groupsPending"><i class="pi pi-spin pi-spinner" /> Sincronizando</span>
                        <span v-else-if="store.restoringSession"><i class="pi pi-spin pi-spinner" /> Restaurando</span>
                        <span v-else-if="store.connected"><i class="pi pi-check" /> En línea</span>
                        <span v-else><i class="pi pi-times" /> Sin conexión</span>
                    </div>
                </div>
                <div v-if="store.connected" class="wa-status__actions">
                    <p class="wa-status__actions-hint">
                        <i class="pi pi-info-circle" />
                        Para vincular otra cuenta de WhatsApp, cierra la sesión actual y escanea un nuevo QR.
                    </p>
                    <p v-if="store.linkedNumber" class="wa-status__actions-hint">
                        <i class="pi pi-mobile" />
                        Cuenta vinculada: <strong>+{{ store.linkedNumber }}</strong>
                        <span v-if="store.linkedName"> · {{ store.linkedName }}</span>
                    </p>
                    <pv-button
                        label="Reconectar"
                        icon="pi pi-refresh"
                        outlined
                        size="small"
                        :loading="store.isLoading"
                        v-tooltip.top="'Restablece la conexión sin perder la vinculación'"
                        @click="handleReconnect"
                    />
                    <pv-button
                        label="Cerrar sesión activa"
                        icon="pi pi-sign-out"
                        severity="danger"
                        outlined
                        size="small"
                        :loading="store.isLoading"
                        @click="handleResetSession"
                    />
                </div>
            </div>

            <!-- Pair: Configuración (izquierda) + QR (derecha) en pantallas anchas -->
            <div class="wa-grid__pair" :class="{ 'wa-grid__pair--solo': store.connected !== false || store.serviceUnreachable }">
                
                <!-- Card: servicio inalcanzable (no mostrar QR falso) -->
                <div v-if="store.serviceUnreachable" class="wa-card wa-card--qr wa-card--qr-loading">
                    <div class="wa-qr__head">
                        <div class="wa-qr__head-icon">
                            <i class="pi pi-cloud" />
                        </div>
                        <div>
                            <p class="wa-qr__title">Servicio no alcanzable</p>
                            <p class="wa-qr__desc">El backend no pudo hablar con el microservicio de WhatsApp. No es un problema de QR: la instancia no está respondiendo.</p>
                        </div>
                    </div>
                    <div class="wa-qr__canvas-wrap wa-qr__canvas-wrap--empty">
                        <i class="pi pi-exclamation-triangle wa-qr__spinner" />
                        <span class="wa-qr__spinner-text">Revisa los logs del contenedor WhatsApp y pulsa Actualizar.</span>
                    </div>
                </div>

                <!-- Card: QR Code (solo visible cuando desconectado y hay QR disponible) -->
                <div v-else-if="store.connected === false && store.qrString" class="wa-card wa-card--qr">
                    <div class="wa-qr__head">
                        <div class="wa-qr__head-icon">
                            <i class="pi pi-qrcode" />
                        </div>
                        <div>
                            <p class="wa-qr__title">Escanear código QR</p>
                            <p class="wa-qr__desc">Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> y apunta la cámara aquí.</p>
                        </div>
                    </div>
                    <div
                        class="wa-qr__canvas-wrap"
                        :class="{ 'wa-qr__canvas-wrap--flash': qrFlash, 'wa-qr__canvas-wrap--disabled': qrManualPause }"
                    >
                        <canvas ref="qrCanvas" class="wa-qr__canvas" />
                        <button
                            v-if="qrManualPause"
                            type="button"
                            class="wa-qr__overlay"
                            :disabled="store.isLoading"
                            :aria-label="'Solicitar nuevo QR'"
                            @click="handleManualQrRefresh"
                        >
                            <i :class="['wa-qr__overlay-icon', store.isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh']" />
                            <span class="wa-qr__overlay-text">Solicitar nuevo QR</span>
                        </button>
                    </div>
                    <div class="wa-qr__countdown" v-if="!qrManualPause">
                        <div class="wa-qr__countdown-row">
                            <i class="pi pi-clock" />
                            <span class="wa-qr__countdown-text">
                                Próxima renovación en <strong>{{ qrCountdown }}s</strong>
                                <span class="wa-qr__countdown-meta">· {{ qrCurrentRotation }} de {{ QR_MAX_AUTO_ROTATIONS }}</span>
                            </span>
                        </div>
                        <div class="wa-qr__countdown-bar" :aria-valuenow="qrCountdown" :aria-valuemax="qrTotalSeconds" role="progressbar">
                            <div class="wa-qr__countdown-fill" :style="{ width: qrCountdownPercent + '%' }" />
                        </div>
                    </div>
                    <div class="wa-qr__manual" v-else>
                        <p class="wa-qr__manual-hint">
                            <i class="pi pi-info-circle" />
                            Se alcanzó el máximo de {{ QR_MAX_AUTO_ROTATIONS }} renovaciones automáticas. Solicita una actualización manual para obtener un nuevo código.
                        </p>                     
                    </div>
                </div>

                <!-- Card: restaurando sesión guardada (sin QR todavía) -->
                <div v-else-if="store.connected === false && store.restoringSession" class="wa-card wa-card--qr wa-card--qr-loading">
                    <div class="wa-qr__head">
                        <div class="wa-qr__head-icon">
                            <i class="pi pi-history" />
                        </div>
                        <div>
                            <p class="wa-qr__title">Restaurando sesión</p>
                            <p class="wa-qr__desc">Reutilizando la sesión guardada en el servicio WhatsApp. Esto es normal después de reiniciar backend o Node.</p>
                        </div>
                    </div>
                    <div class="wa-qr__canvas-wrap wa-qr__canvas-wrap--empty">
                        <i class="pi pi-spin pi-spinner wa-qr__spinner" />
                        <span class="wa-qr__spinner-text">Conectando con WhatsApp...</span>
                    </div>
                </div>

                <!-- Card: QR pendiente (desconectado, esperando emisión de QR) -->
                <div v-else-if="store.connected === false && !store.qrString" class="wa-card wa-card--qr wa-card--qr-loading">
                    <div class="wa-qr__head">
                        <div class="wa-qr__head-icon">
                            <i class="pi pi-qrcode" />
                        </div>
                        <div>
                            <p class="wa-qr__title">Código QR</p>
                            <p class="wa-qr__desc">Esperando que el servicio genere el QR... Asegúrate de que el servicio WhatsApp esté en ejecución.</p>
                        </div>
                    </div>
                    <div class="wa-qr__canvas-wrap wa-qr__canvas-wrap--empty">
                        <i class="pi pi-spin pi-spinner wa-qr__spinner" />
                        <span class="wa-qr__spinner-text">Obteniendo QR...</span>
                    </div>
                    <div class="wa-qr__stuck">
                        <p class="wa-qr__stuck-hint">
                            <i class="pi pi-info-circle" />
                            Si el QR no aparece después de un minuto, la sesión guardada puede estar corrupta. Reinicia la sesión para forzar un nuevo QR.
                        </p>
                        <pv-button
                            label="Reiniciar sesión"
                            icon="pi pi-refresh"
                            severity="warn"
                            outlined
                            size="small"
                            :loading="store.isLoading"
                            @click="handleResetSession"
                        />
                    </div>
                </div>

                <!-- Card: Configuración (Group ID + Enabled) -->
                <div class="wa-card wa-card--config">
                    <div class="wa-key__head">
                        <div class="wa-key__head-icon">
                            <i class="pi pi-cog" />
                        </div>
                        <div>
                            <p class="wa-key__title">Configuración del bot</p>
                            <p class="wa-key__desc">Grupo destino de las notificaciones y habilitación del envío.</p>
                        </div>
                    </div>
                    <div class="wa-key__divider" />

                    <!-- Toggle enabled -->
                    <div class="wa-config__row">
                        <div class="wa-config__label">
                            <span class="wa-config__label-title">Notificaciones habilitadas</span>
                            <span class="wa-config__label-desc">Si está deshabilitado, el backend no enviará mensajes.</span>
                        </div>
                        <pv-input-switch v-model="enabledInput" @change="handleToggleEnabled" :disabled="store.isLoading" />
                    </div>

                    <!-- Group ID -->
                    <div class="wa-config__row wa-config__row--column">
                        <div class="wa-config__label">
                            <span class="wa-config__label-title">Group ID de WhatsApp</span>
                            <span class="wa-config__label-desc">
                                Selecciona uno de tus grupos o pega el id manualmente (formato <code>xxxxx@g.us</code>).
                            </span>
                        </div>

                        <div class="wa-config__group-input">
                            <div v-if="store.groupsPending" class="wa-sync-banner" role="status" aria-live="polite">
                                <i class="pi pi-spin pi-spinner" />
                                <span>Sincronizando chats de WhatsApp. El botón se habilitará automáticamente al terminar.</span>
                            </div>
                            <pv-button
                                label="Buscar mis grupos"
                                icon="pi pi-search"
                                outlined
                                size="small"
                                :loading="store.isLoadingGroups"
                                :disabled="groupsButtonDisabled"
                                v-tooltip.top="groupsButtonTooltip"
                                @click="handleLoadGroups"
                            />
                        </div>

                        <div v-if="store.groups.length > 0" class="wa-config__group-input" style="margin-top: 0.5rem;">
                            <pv-dropdown
                                v-model="selectedGroup"
                                :options="selectableGroups"
                                option-label="subject"
                                option-disabled="disabledForSend"
                                placeholder="Selecciona un grupo"
                                filter
                                filter-placeholder="Buscar grupo..."
                                class="wa-config__input"
                                @change="handleGroupSelected"
                            >
                                <template #option="slotProps">
                                    <div>
                                        <div style="font-weight:600;">{{ slotProps.option.subject }}</div>
                                        <small style="color:#6b7280;">{{ slotProps.option.id }} · {{ slotProps.option.participants }} participantes</small>
                                        <small v-if="!slotProps.option.canSend" style="display:block;color:#b45309;">
                                            Solo administradores pueden escribir en este grupo y el bot no lo es
                                        </small>
                                    </div>
                                </template>
                            </pv-dropdown>
                        </div>

                        <div class="wa-config__group-input" style="margin-top: 0.5rem;">
                            <pv-input-text v-model="groupIdInput" placeholder="123456789@g.us" class="wa-config__input" />
                            <pv-button
                                label="Guardar"
                                icon="pi pi-save"
                                :loading="store.isLoading"
                                :disabled="!groupIdInput || groupIdInput === store.groupId"
                                @click="handleSaveGroupId"
                            />
                        </div>
                    </div>
                </div>

            </div>

            <!-- Card: API Key -->
            <div class="wa-card wa-card--key">
                <!-- Cabecera de la card -->
                <div class="wa-key__head">
                    <div class="wa-key__head-icon">
                        <i class="pi pi-key" />
                    </div>
                    <div>
                        <p class="wa-key__title">API Key de seguridad</p>
                        <p class="wa-key__desc">Clave que el backend envía al servicio WhatsApp para autenticar cada notificación.</p>
                    </div>
                </div>

                <div class="wa-key__divider" />

                <!-- Sin key -->
                <div v-if="!store.generatedKey && !store.hasKey" class="wa-key__empty">
                    <div class="wa-key__empty-icon-wrap">
                        <i class="pi pi-shield" />
                    </div>
                    <div>
                        <p class="wa-key__empty-title">Sin protección configurada</p>
                        <p class="wa-key__empty-desc">El servicio está expuesto sin autenticación. Genera una key antes de desplegarlo en producción.</p>
                    </div>
                </div>

                <!-- Key configurada (enmascarada) -->
                <div v-if="!store.generatedKey && store.hasKey" class="wa-key__configured">
                    <div class="wa-key__configured-row">
                        <i class="pi pi-lock-open wa-key__lock-icon" />
                        <span class="wa-key__configured-label">Key activa</span>
                    </div>
                    <div class="wa-key__masked-row">
                        <code class="wa-key__masked-value">{{ store.maskedKey }}</code>
                    </div>
                </div>

                <!-- Key recién generada -->
                <div v-if="store.generatedKey" class="wa-key__reveal">
                    <div class="wa-key__reveal-alert">
                        <i class="pi pi-exclamation-triangle" />
                        <span>Cópiala ahora: <strong>no volverá a mostrarse en claro.</strong></span>
                    </div>
                    <div class="wa-key__reveal-input">
                        <pv-input-text
                            :value="showKey ? store.generatedKey : '•'.repeat(store.generatedKey.length)"
                            readonly
                            class="wa-key__reveal-field"
                        />
                        <pv-button :icon="showKey ? 'pi pi-eye-slash' : 'pi pi-eye'" text rounded severity="secondary" @click="showKey = !showKey" v-tooltip="showKey ? 'Ocultar' : 'Mostrar'" />
                        <pv-button :icon="copiedMsg ? 'pi pi-check' : 'pi pi-copy'" :severity="copiedMsg ? 'success' : 'secondary'" text rounded @click="copyKey" v-tooltip="copiedMsg ? '¡Copiado!' : 'Copiar'" />
                    </div>
                    <div class="wa-key__reveal-steps">
                        <p><strong>Esta clave todavía no está en uso.</strong> Para aplicarla:</p>
                        <ol>
                            <li>Ponla como <code>WHATSAPP_API_KEY</code> en el <strong>backend</strong> y en el <strong>servicio de WhatsApp</strong>.</li>
                            <li>Redespliega ambos. Hasta entonces sigue vigente la clave actual.</li>
                        </ol>
                    </div>
                </div>

                <!-- Acción -->
                <pv-button
                    label="Proponer clave nueva"
                    icon="pi pi-key"
                    severity="secondary"
                    outlined
                    :loading="store.isLoading"
                    class="wa-key__action"
                    @click="handleGenerate"
                />
            </div>

        </div>
    </div>
</template>

<style scoped>
/* ── Página ─────────────────────────────────────────────────── */
.wa-page {
    padding: clamp(1rem, 2vw, 1.75rem) clamp(1rem, 2.5vw, 2rem);
    width: 100%;
    max-width: 100%;
    min-height: 100%;
    color: #111827;
    box-sizing: border-box;
}

/* ── Encabezado ─────────────────────────────────────────────── */
.wa-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
}
.wa-page__header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.wa-page__header-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 12px;
    background: #25d366;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
}
.wa-page__title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.2rem;
    line-height: 1.2;
}
.wa-page__subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
}

/* ── Error block ────────────────────────────────────────────── */
.wa-error-block {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid #b91c1c;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    margin-bottom: 1.5rem;
}
.wa-error-block__main {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
}
.wa-error-block__icon {
    color: #b91c1c;
    font-size: 1rem;
    margin-top: 0.1rem;
    flex-shrink: 0;
}
.wa-error-block__msg {
    color: #7f1d1d;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5;
    flex: 1;
}
.wa-error-block__details {
    margin-top: 0.65rem;
    padding-top: 0.65rem;
    border-top: 1px solid #fca5a5;
}
.wa-error-block__details summary {
    font-size: 0.78rem;
    color: #9b1c1c;
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
.wa-error-block__details summary::before {
    content: '►';
    font-size: 0.65rem;
    transition: transform 0.15s;
}
.wa-error-block__details[open] summary::before {
    transform: rotate(90deg);
}
.wa-error-block__copy-hint {
    font-weight: 400;
    color: #b91c1c;
    opacity: 0.8;
}
.wa-error-block__raw-row {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    margin-top: 0.5rem;
}
.wa-error-block__raw {
    flex: 1;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.73rem;
    color: #7f1d1d;
    background: #fff1f2;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
}

/* ── Grid ───────────────────────────────────────────────────── */
.wa-grid {
    display: grid;
    gap: 1.25rem;
}

/* Fila de dos cards lado a lado (config + QR). En mobile colapsa a una columna. */
.wa-grid__pair {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    align-items: start;
}
@media (min-width: 960px) {
    .wa-grid__pair {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .wa-grid__pair--solo {
        grid-template-columns: minmax(0, 1fr);
    }
}

/* ── Cards base ─────────────────────────────────────────────── */
.wa-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    transition: border-color 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}

/* ── Status card ────────────────────────────────────────────── */
.wa-card--status-online  { border-left: 4px solid #22c55e; }
.wa-card--status-offline { border-left: 4px solid #ef4444; }

.wa-status {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.wa-status__indicator {
    position: relative;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
}
.wa-status__indicator--online  { background: #dcfce7; color: #16a34a; }
.wa-status__indicator--offline { background: #fee2e2; color: #dc2626; }
.wa-status__indicator--loading { background: #f3f4f6; color: #9ca3af; }

/* Pulso animado cuando está en línea */
.wa-status__pulse {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #22c55e;
    animation: pulse-ring 2s ease-out infinite;
}
@keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    80%  { transform: scale(1.5); opacity: 0; }
    100% { transform: scale(1.5); opacity: 0; }
}

.wa-status__body   { flex: 1; }
.wa-status__eyebrow {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 0.25rem;
}
.wa-status__text   { display: block; font-size: 1.05rem; font-weight: 600; color: #111827; }
.wa-status__text--online  { color: #15803d; }
.wa-status__text--offline { color: #dc2626; }
.wa-status__text--syncing { color: #b45309; }
.wa-status__text--sync-failed { color: #c2410c; }
.wa-status__hint   {
    display: block;
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.3rem;
    line-height: 1.5;
}
.wa-status__hint--syncing {
    color: #b45309;
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
}
.wa-status__hint--sync-failed {
    color: #c2410c;
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
}
.wa-status__hint--offline {
    color: #b91c1c;
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
}

.wa-card--status-syncing {
    border-color: #fcd34d;
    background: linear-gradient(135deg, #fffbeb 0%, #ffffff 60%);
}
.wa-card--status-sync-failed {
    border-color: #fdba74;
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 60%);
}

.wa-status__indicator--syncing { background: #fef3c7; color: #d97706; }
.wa-status__indicator--sync-failed { background: #ffedd5; color: #c2410c; }

.wa-sync-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    margin-bottom: 0.65rem;
    border-radius: 0.5rem;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    color: #92400e;
    font-size: 0.85rem;
    line-height: 1.45;
}

.wa-sync-banner .pi-spinner {
    margin-top: 0.1rem;
    flex-shrink: 0;
}
.wa-sync-banner--failed {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
}

/* ── QR Card ────────────────────────────────────────────────── */
.wa-card--qr {
    border-left: 4px solid #6366f1;
}
.wa-qr__head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    margin-bottom: 1.25rem;
}
.wa-qr__head-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    background: #eef2ff;
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
}
.wa-qr__title { font-size: 1rem; font-weight: 600; color: var(--text-color); margin: 0 0 0.2rem; }
.wa-qr__desc  { font-size: 0.82rem; color: #6b7280; margin: 0; line-height: 1.5; }
.wa-qr__canvas-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 0.85rem;
    position: relative;
}
.wa-qr__canvas-wrap--flash .wa-qr__canvas {
    animation: wa-qr-flash 0.7s ease-out;
}
.wa-qr__canvas-wrap--disabled .wa-qr__canvas {
    filter: grayscale(0.85) brightness(0.55);
    transition: filter 0.25s ease;
}
@keyframes wa-qr-flash {
    0%   { transform: scale(0.92); opacity: 0; filter: blur(6px); }
    40%  { transform: scale(1.04); opacity: 1; filter: blur(0); box-shadow: 0 0 0 4px rgba(37, 211, 102, 0.35); }
    100% { transform: scale(1);    opacity: 1; filter: blur(0); box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
}
.wa-qr__overlay {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 240px;
    height: 240px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(17, 24, 39, 0.55);
    backdrop-filter: blur(2px);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.15s ease;
    padding: 0;
}
.wa-qr__overlay:hover:not(:disabled) {
    background: rgba(17, 24, 39, 0.7);
    transform: scale(1.02);
}
.wa-qr__overlay:disabled { cursor: progress; opacity: 0.85; }
.wa-qr__overlay-icon { font-size: 2.25rem; }
.wa-qr__overlay-text { font-size: 0.85rem; font-weight: 600; letter-spacing: 0.02em; }
.wa-qr__canvas-wrap--empty {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 0;
    background: #f9fafb;
    border: 1px dashed #e5e7eb;
    border-radius: 10px;
}
.wa-qr__canvas {
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}
.wa-qr__spinner { font-size: 2rem; color: #9ca3af; }
.wa-qr__spinner-text { font-size: 0.85rem; color: #6b7280; }
.wa-qr__refresh-hint {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #6b7280;
    margin: 0;
}
.wa-qr__countdown {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    max-width: 240px;
    margin: 0 auto;
}
.wa-qr__countdown-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #6b7280;
}
.wa-qr__countdown-row strong {
    color: #111827;
    font-variant-numeric: tabular-nums;
    min-width: 2.5ch;
    display: inline-block;
    text-align: right;
}
.wa-qr__countdown-bar {
    width: 100%;
    height: 6px;
    background: #e5e7eb;
    border-radius: 999px;
    overflow: hidden;
}
.wa-qr__countdown-fill {
    height: 100%;
    background: linear-gradient(90deg, #25d366, #128c7e);
    border-radius: 999px;
    transition: width 1s linear;
}
.wa-qr__stuck {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
}
.wa-qr__stuck-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
}
.wa-qr__stuck-hint .pi-info-circle { color: #f59e0b; margin-top: 0.15rem; }

.wa-qr__countdown-meta {
    margin-left: 0.35rem;
    color: #9ca3af;
    font-weight: 500;
}
.wa-qr__manual {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
}
.wa-qr__manual-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
}
.wa-qr__manual-hint .pi-info-circle { color: #25d366; margin-top: 0.15rem; }

.wa-status__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}
.wa-status__pill--online  { background: #dcfce7; color: #15803d; }
.wa-status__pill--offline { background: #fee2e2; color: #b91c1c; }
.wa-status__pill--loading { background: #f3f4f6; color: #6b7280; }
.wa-status__pill--syncing { background: #fef3c7; color: #b45309; }
.wa-status__pill--sync-failed { background: #ffedd5; color: #c2410c; }

.wa-status__actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}
.wa-status__actions-hint {
    margin: 0;
    font-size: 0.85rem;
    color: #6b7280;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1 1 auto;
}

/* ── API Key card ───────────────────────────────────────────── */
.wa-key__head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    margin-bottom: 0;
}
.wa-key__head-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    background: #eff6ff;
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
}
.wa-key__title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0 0 0.2rem; }
.wa-key__desc  { font-size: 0.82rem; color: #6b7280; margin: 0; line-height: 1.5; }

.wa-key__divider {
    height: 1px;
    background: #e5e7eb;
    margin: 1.1rem 0;
}

/* Sin key */
.wa-key__empty {
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    padding: 1rem 1.1rem;
    margin-bottom: 1.25rem;
}
.wa-key__empty-icon-wrap {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 8px;
    background: #ffedd5;
    color: #ea580c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
}
.wa-key__empty-title { font-weight: 600; color: #9a3412; margin: 0 0 0.25rem; font-size: 0.9rem; }
.wa-key__empty-desc  { color: #c2410c; font-size: 0.82rem; margin: 0; line-height: 1.5; }

/* Key configurada */
.wa-key__configured {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
}
.wa-key__configured-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}
.wa-key__lock-icon { color: #16a34a; font-size: 1rem; }
.wa-key__configured-label { font-weight: 600; color: #15803d; font-size: 0.9rem; }
.wa-key__masked-row { padding-left: 1.45rem; }
.wa-key__masked-value {
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    color: #374151;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    display: inline-block;
    letter-spacing: 0.04em;
}

/* Key generada */
.wa-key__reveal {
    margin-bottom: 1.25rem;
}
.wa-key__reveal-alert {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: #fefce8;
    border: 1px solid #fde047;
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    font-size: 0.85rem;
    color: #713f12;
    margin-bottom: 0.85rem;
}
.wa-key__reveal-alert .pi-exclamation-triangle { color: #ca8a04; }
.wa-key__reveal-input {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    margin-bottom: 0.6rem;
}
.wa-key__reveal-field {
    flex: 1;
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
}
.wa-key__reveal-steps {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #4b5563;
    line-height: 1.5;
}
.wa-key__reveal-steps ol {
    margin: 0.35rem 0 0;
    padding-left: 1.15rem;
}
.wa-key__reveal-steps code {
    background: #f3f4f6;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-size: 0.8rem;
}

.wa-key__reveal-note {
    font-size: 0.8rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.55;
}
.wa-key__reveal-note code {
    background: #f3f4f6;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.77rem;
    color: #111827;
}

.wa-key__action { margin-top: 0.25rem; }

/* ── Card de Configuración ──────────────────────────────────── */
.wa-card--config { display: flex; flex-direction: column; gap: 1rem; }
.wa-config__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}
.wa-config__row--column {
    flex-direction: column;
    align-items: stretch;
}
.wa-config__label { display: flex; flex-direction: column; gap: 0.15rem; }
.wa-config__label-title { font-weight: 600; color: #111827; font-size: 0.95rem; }
.wa-config__label-desc  { font-size: 0.8rem; color: #6b7280; }
.wa-config__group-input {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
    flex-wrap: wrap;
}
.wa-config__input { flex: 1 1 220px; min-width: 0; }

/* ── Responsive ───────────────────────────────────── */

/* Tablet (≤ 768px) */
@media (max-width: 768px) {
    .wa-page__header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.85rem;
        margin-bottom: 1.5rem;
    }
    .wa-page__header :deep(.p-button) {
        align-self: stretch;
    }
    .wa-card { padding: 1.15rem; }
    .wa-status {
        flex-wrap: wrap;
    }
    .wa-status__pill {
        order: 3;
        margin-left: auto;
    }
    .wa-status__actions {
        flex-direction: column;
        align-items: stretch;
    }
    .wa-status__actions :deep(.p-button) {
        width: 100%;
    }
    .wa-config__row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.6rem;
    }
    .wa-key__reveal-input {
        flex-wrap: wrap;
    }
    .wa-key__reveal-field { flex: 1 1 100%; }
}

/* Móvil (≤ 480px) */
@media (max-width: 480px) {
    .wa-page__title    { font-size: 1.15rem; }
    .wa-page__subtitle { font-size: 0.8rem; }
    .wa-page__header-icon {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 1.2rem;
    }
    .wa-card { padding: 1rem; border-radius: 10px; }
    .wa-qr__head,
    .wa-key__head {
        gap: 0.6rem;
        margin-bottom: 1rem;
    }
    .wa-qr__head-icon,
    .wa-key__head-icon {
        width: 2.1rem;
        height: 2.1rem;
        font-size: 0.95rem;
    }
    .wa-qr__title,
    .wa-key__title { font-size: 0.95rem; }
    .wa-qr__desc,
    .wa-key__desc { font-size: 0.78rem; }
    /* QR canvas escala manteniendo proporción */
    .wa-qr__canvas {
        max-width: 100%;
        height: auto;
    }
    .wa-qr__canvas-wrap--empty { padding: 1.75rem 0; }
    .wa-status__indicator {
        width: 2.75rem;
        height: 2.75rem;
        font-size: 1.15rem;
    }
    .wa-status__text { font-size: 0.95rem; }
    .wa-status__hint,
    .wa-status__actions-hint { font-size: 0.78rem; }
    .wa-config__group-input :deep(.p-button) {
        width: 100%;
    }
    .wa-key__masked-value {
        word-break: break-all;
        white-space: normal;
        display: block;
    }
    .wa-key__masked-row { padding-left: 0; margin-top: 0.35rem; }
}
</style>
