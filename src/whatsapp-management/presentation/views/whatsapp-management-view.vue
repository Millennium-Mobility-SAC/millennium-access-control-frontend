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
const qrCanvas  = ref(null)

// Cronómetro de refresco del QR (whatsapp-web.js emite uno nuevo ~cada 30s)
const QR_REFRESH_SECONDS = 30
const qrCountdown = ref(QR_REFRESH_SECONDS)
let qrCountdownTimer = null

function startQrCountdown() {
    qrCountdown.value = QR_REFRESH_SECONDS
    if (qrCountdownTimer) clearInterval(qrCountdownTimer)
    qrCountdownTimer = setInterval(() => {
        if (qrCountdown.value > 0) qrCountdown.value -= 1
    }, 1000)
}

function stopQrCountdown() {
    if (qrCountdownTimer) {
        clearInterval(qrCountdownTimer)
        qrCountdownTimer = null
    }
    qrCountdown.value = QR_REFRESH_SECONDS
}

const qrCountdownPercent = computed(() => Math.round((qrCountdown.value / QR_REFRESH_SECONDS) * 100))

// Modelos locales para edición (no mutamos el store directamente)
const groupIdInput = ref('')
const enabledInput = ref(false)
const selectedGroup = ref(null)

watch(() => store.groupId, (val) => { groupIdInput.value = val || '' }, { immediate: true })
watch(() => store.enabled, (val) => { enabledInput.value = !!val }, { immediate: true })

watch(() => store.qrString, async (qr) => {
    if (!qr) {
        stopQrCountdown()
        return
    }
    await nextTick()
    if (qrCanvas.value) {
        QRCode.toCanvas(qrCanvas.value, qr, { width: 240, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
    }
    // Cada vez que cambia el QR, reiniciamos el cronómetro a 30s
    startQrCountdown()
})

const statusIcon = computed(() => {
    if (store.connected === null) return 'pi pi-spin pi-spinner'
    return store.connected ? 'pi pi-whatsapp' : 'pi pi-times'
})
const statusText = computed(() => {
    if (store.connected === null) return 'Verificando conexión...'
    return store.connected ? 'Conectado a WhatsApp' : 'Desconectado'
})
const statusTextClass = computed(() => {
    if (store.connected === null) return ''
    return store.connected ? 'wa-status__text--online' : 'wa-status__text--offline'
})
const statusCardClass = computed(() => {
    if (store.connected === null) return ''
    return store.connected ? 'wa-card--status-online' : 'wa-card--status-offline'
})
const statusIndicatorClass = computed(() => {
    if (store.connected === null) return 'wa-status__indicator--loading'
    return store.connected ? 'wa-status__indicator--online' : 'wa-status__indicator--offline'
})
const statusPillClass = computed(() => {
    if (store.connected === null) return 'wa-status__pill--loading'
    return store.connected ? 'wa-status__pill--online' : 'wa-status__pill--offline'
})

onMounted(async () => {
    await Promise.all([store.fetchStatus(), store.fetchConfiguration()])
    if (!store.connected) {
        store.startQrPolling()
    }
})

onUnmounted(() => {
    store.stopQrPolling()
    stopQrCountdown()
})

async function handleGenerate() {
    confirm.require({
        header: 'Rotar API Key',
        message: 'La key actual dejará de funcionar inmediatamente. ¿Continuar?',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Rotar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            showKey.value = true
            const key = await store.rotateApiKey()
            if (key) {
                showSuccess('Nueva API Key generada. Cópiala antes de cerrar.')
            } else {
                showError(store.error || 'Error al rotar la key')
            }
        }
    })
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

async function refresh() {
    store.clearGeneratedKey()
    showKey.value = false
    await Promise.all([store.fetchStatus(), store.fetchConfiguration()])
}

async function handleResetSession() {
    confirm.require({
        header: 'Reiniciar sesión de WhatsApp',
        message: 'Se borrará la sesión guardada y se generará un nuevo código QR. ¿Continuar?',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancelar',
        acceptLabel: 'Reiniciar',
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
        <pv-message v-if="store.error" severity="error" class="wa-page__error" :closable="false">
            {{ store.error }}
        </pv-message>

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
                        <span v-if="store.connected === false" class="wa-status__hint">
                            Escanea el código QR que aparece más abajo desde <strong>WhatsApp → Dispositivos vinculados</strong>.
                        </span>
                    </div>
                    <div class="wa-status__pill" :class="statusPillClass">
                        <span v-if="store.connected === null"><i class="pi pi-spin pi-spinner" /> Verificando</span>
                        <span v-else-if="store.connected"><i class="pi pi-check" /> En línea</span>
                        <span v-else><i class="pi pi-times" /> Sin conexión</span>
                    </div>
                </div>
                <div v-if="store.connected" class="wa-status__actions">
                    <p class="wa-status__actions-hint">
                        <i class="pi pi-info-circle" />
                        Para vincular otra cuenta de WhatsApp, cierra la sesión actual y escanea un nuevo QR.
                    </p>
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

            <!-- Card: QR Code (solo visible cuando desconectado y hay QR disponible) -->
            <div v-if="store.connected === false && store.qrString" class="wa-card wa-card--qr">
                <div class="wa-qr__head">
                    <div class="wa-qr__head-icon">
                        <i class="pi pi-qrcode" />
                    </div>
                    <div>
                        <p class="wa-qr__title">Escanear código QR</p>
                        <p class="wa-qr__desc">Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> y apunta la cámara aquí.</p>
                    </div>
                </div>
                <div class="wa-qr__canvas-wrap">
                    <canvas ref="qrCanvas" class="wa-qr__canvas" />
                </div>
                <div class="wa-qr__countdown">
                    <div class="wa-qr__countdown-row">
                        <i class="pi pi-clock" />
                        <span class="wa-qr__countdown-text">
                            Próxima renovación en <strong>{{ qrCountdown }}s</strong>
                        </span>
                    </div>
                    <div class="wa-qr__countdown-bar" :aria-valuenow="qrCountdown" :aria-valuemax="QR_REFRESH_SECONDS" role="progressbar">
                        <div class="wa-qr__countdown-fill" :style="{ width: qrCountdownPercent + '%' }" />
                    </div>
                </div>
            </div>

            <!-- Card: QR pendiente (desconectado pero QR aún no disponible) -->
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
                        <pv-button
                            label="Buscar mis grupos"
                            icon="pi pi-search"
                            outlined
                            size="small"
                            :loading="store.isLoadingGroups"
                            :disabled="!store.connected"
                            @click="handleLoadGroups"
                        />
                    </div>

                    <div v-if="store.groups.length > 0" class="wa-config__group-input" style="margin-top: 0.5rem;">
                        <pv-dropdown
                            v-model="selectedGroup"
                            :options="store.groups"
                            option-label="name"
                            placeholder="Selecciona un grupo"
                            class="wa-config__input"
                            @change="handleGroupSelected"
                        >
                            <template #option="slotProps">
                                <div>
                                    <div style="font-weight:600;">{{ slotProps.option.name }}</div>
                                    <small style="color:#6b7280;">{{ slotProps.option.id }} · {{ slotProps.option.participants }} participantes</small>
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
                        <span>Guarda esta key ahora. <strong>No volverá a mostrarse en claro.</strong></span>
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
                    <p class="wa-key__reveal-note">
                        La key se sincronizó automáticamente con el servicio Node y se guardó en la base de datos.
                    </p>
                </div>

                <!-- Acción -->
                <pv-button
                    :label="store.hasKey ? 'Rotar API Key' : 'Generar API Key'"
                    :icon="store.hasKey ? 'pi pi-sync' : 'pi pi-plus'"
                    :severity="store.hasKey ? 'danger' : 'primary'"
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
    padding: 1.75rem 2rem;
    width: 100%;
    min-height: 100%;
    color: #111827;
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
.wa-page__error { margin-bottom: 1.5rem; }

/* ── Grid ───────────────────────────────────────────────────── */
.wa-grid {
    display: grid;
    gap: 1.25rem;
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
.wa-status__hint   {
    display: block;
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.3rem;
    line-height: 1.5;
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
}
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
}
.wa-config__input { flex: 1; }
</style>
