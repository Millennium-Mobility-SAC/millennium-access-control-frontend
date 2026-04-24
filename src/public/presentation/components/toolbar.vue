<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useIamStore } from '../../../iam/application/iam.store.js'
import { useConfirmDialog } from '../../../shared/composables/use-confirm-dialog.js'
import { ROLE_LABELS } from '../../../shared/presentation/constants/roles.constants.js'
const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    showBackButton: {
        type: Boolean,
        default: false,
    },
    backRoute: {
        type: [String, Object],
        default: null,
    },
})

const emit = defineEmits(['back'])

const router    = useRouter()
const iamStore  = useIamStore()
const { showConfirm } = useConfirmDialog()

const userMenu = ref()
const profileVisible = ref(false)

async function openProfile() {
    await iamStore.fetchProfile(iamStore.currentUserId)
    profileVisible.value = true
}

const username = computed(() => iamStore.currentUsername || 'Usuario')
const userRole = computed(() => {
    const raw = iamStore.userRole
    return (raw && ROLE_LABELS[raw]) ? ROLE_LABELS[raw] : (raw || 'Usuario')
})

const menuItems = ref([
    {
        label: 'Perfil',
        icon: 'pi pi-user',
        command: () => openProfile(),
    },
    { separator: true },
    {
        label: 'Cerrar sesión',
        icon: 'pi pi-sign-out',
        command: () => handleSignOut(),
    },
])

const handleBack = () => {
    if (props.backRoute) {
        if (typeof props.backRoute === 'string') {
            router.push({ name: props.backRoute })
        } else {
            router.push(props.backRoute)
        }
    } else {
        emit('back')
        router.back()
    }
}

const handleSignOut = async () => {
    const confirmed = await showConfirm({
        message: '¿Estás seguro que deseas cerrar sesión?',
        header: 'Cerrar sesión',
        icon: 'pi pi-sign-out',
        acceptLabel: 'Cerrar sesión',
        rejectLabel: 'Cancelar',
    })
    if (!confirmed) return
    await iamStore.logout()
    router.push({ name: 'sign-in' })
}

const toggleUserMenu = (event) => {
    userMenu.value.toggle(event)
}
</script>

<template>
    <div class="toolbar flex align-items-center gap-3 px-4 py-3">

        <!-- Back button -->
        <pv-button
            v-if="showBackButton"
            icon="pi pi-arrow-left"
            text
            rounded
            class="toolbar__back-btn"
            aria-label="Volver atrás"
            @click="handleBack"
        />

        <!-- Title + description -->
        <div class="flex-1 flex flex-column gap-1 min-w-0">
            <h2 class="m-0 toolbar__title">{{ title }}</h2>
            <p v-if="description" class="m-0 toolbar__description">{{ description }}</p>
        </div>

        <!-- Slot for extra action buttons -->
        <slot name="actions" />

        <!-- User menu trigger: oculto en móvil, se muestra en el sidebar -->
        <div class="toolbar__user hidden md:flex" @click="toggleUserMenu">
            <div class="toolbar__avatar">
                <i class="pi pi-user"   ></i>
            </div>
            <div class="flex flex-column gap-1 hidden md:flex">
                <span class="toolbar__username">{{ username }}</span>
                <span class="toolbar__role">{{ userRole }}</span>
            </div>
            <i class="pi pi-chevron-down toolbar__chevron" ></i>
        </div>

        <!-- Dropdown -->
        <pv-menu ref="userMenu" :model="menuItems" popup>
            <template #start>
                <div class="flex align-items-center gap-3 px-3 py-3 border-bottom-1" style="border-color: var(--border-color)">
                    <div class="toolbar__avatar">
                        <i class="pi pi-user" ></i>
                    </div>
                    <div class="flex flex-column gap-1">
                        <span class="font-semibold" style="color: #1e293b; font-size: 0.875rem;">{{ username }}</span>
                        <span class="text-xs" style="color: var(--text-secondary)">{{ userRole }}</span>
                    </div>
                </div>
            </template>
        </pv-menu>

        <!-- Profile dialog -->
        <pv-dialog
            v-model:visible="profileVisible"
            header="Mi perfil"
            :modal="true"
            :draggable="false"
            :style="{ width: '420px' }"
            :pt="{
                header:        { style: 'background:#fff; border-bottom:1px solid #e2e8f0; padding:1.25rem 1.5rem;' },
                title:         { style: 'color:#1e293b; font-size:1.05rem; font-weight:700;' },
                content:       { style: 'background:#f8fafc; padding:1rem 1.25rem 1.25rem;' },
                pcCloseButton: { style: 'color:#475569 !important;' },
            }"
        >
            <template v-if="iamStore.currentProfile">
                <!-- Avatar + name card -->
                <div class="flex align-items-center gap-3 px-3 py-3 mb-3"
                     style="background:#fff; border-radius:10px; border:1px solid #e2e8f0;">
                    <div style="width:50px;height:50px;border-radius:50%;
                                background:linear-gradient(135deg,#3b82f6,#6366f1);
                                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="pi pi-user" style="color:#fff;font-size:1.3rem;"></i>
                    </div>
                    <div class="flex flex-column gap-1">
                        <span style="color:#1e293b;font-weight:700;font-size:0.95rem;">
                            {{ iamStore.currentProfile.fullName ||
                               ((iamStore.currentProfile.firstName || '') + ' ' + (iamStore.currentProfile.lastName || '')).trim() ||
                               '—' }}
                        </span>
                        <span style="color:#64748b;font-size:0.78rem;">
                            {{ iamStore.currentProfile.position || userRole }}
                            <template v-if="iamStore.currentProfile.department">
                                · {{ iamStore.currentProfile.department }}
                            </template>
                        </span>
                    </div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-title">Información personal</div>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span class="detail-label">Nombre</span>
                            <span class="detail-value">
                                {{ iamStore.currentProfile.fullName ||
                                   ((iamStore.currentProfile.firstName || '') + ' ' + (iamStore.currentProfile.lastName || '')).trim() ||
                                   '—' }}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Correo</span>
                            <span class="detail-value">{{ iamStore.currentProfile.email || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Teléfono</span>
                            <span class="detail-value">{{ iamStore.currentProfile.phoneNumber || '—' }}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section mt-2">
                    <div class="detail-section-title">Documento</div>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span class="detail-label">Tipo</span>
                            <span class="detail-value">{{ iamStore.currentProfile.documentType || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Número</span>
                            <span class="detail-value">{{ iamStore.currentProfile.documentNumber || '—' }}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section mt-2">
                    <div class="detail-section-title">Cargo y acceso</div>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span class="detail-label">Cargo</span>
                            <span class="detail-value">{{ iamStore.currentProfile.position || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Área</span>
                            <span class="detail-value">{{ iamStore.currentProfile.department || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Rol</span>
                            <span class="detail-value">{{ userRole }}</span>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class="flex justify-content-center align-items-center py-5">
                    <i class="pi pi-spin pi-spinner" style="font-size:2rem;color:var(--primary-color)"></i>
                </div>
            </template>
        </pv-dialog>

    </div>
</template>

<style scoped>
/* ── Toolbar shell ───────────────────────────────────────────────────────── */
.toolbar {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    min-height: 60px;
    position: relative;
    overflow: hidden;
}

.toolbar::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary) 30%,
        var(--color-primary) 70%,
        transparent 100%
    );
    opacity: 0.5;
}

/* ── Back button ─────────────────────────────────────────────────────────── */
.toolbar__back-btn {
    color: var(--text-secondary) !important;
    transition: color var(--transition-fast), transform var(--transition-fast);
}

.toolbar__back-btn:hover {
    color: var(--text-primary) !important;
    transform: translateX(-2px);
}

/* ── Title / description ─────────────────────────────────────────────────── */
.toolbar__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.toolbar__description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── User menu trigger ───────────────────────────────────────────────────── */
.toolbar__user {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    cursor: pointer;
    transition:
        background var(--transition-fast),
        border-color var(--transition-fast),
        transform var(--transition-fast);
    user-select: none;
    flex-shrink: 0;
}

.toolbar__user:hover {
    background: var(--bg-hover);
    border-color: var(--color-primary);
    transform: translateY(-1px);
}

/* ── Avatar circle ───────────────────────────────────────────────────────── */
.toolbar__avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: var(--color-white);
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(26, 107, 194, 0.25);
}

/* ── Username / role labels ──────────────────────────────────────────────── */
.toolbar__username {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    white-space: nowrap;
}

.toolbar__role {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: var(--line-height-tight);
    white-space: nowrap;
}

/* ── Chevron ─────────────────────────────────────────────────────────────── */
.toolbar__chevron {
    font-size: 0.7rem;
    color: var(--text-muted);
    transition: color var(--transition-fast), transform var(--transition-fast);
}

.toolbar__user:hover .toolbar__chevron {
    color: var(--text-secondary);
    transform: translateY(2px);
}
</style>