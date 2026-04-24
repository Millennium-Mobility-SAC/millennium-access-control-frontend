<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBranchesStore } from '../../../branches/application/branches.store.js'
import { useIamStore } from '../../../iam/application/iam.store.js'

const router        = useRouter()
const branchesStore = useBranchesStore()
const iamStore      = useIamStore()
const popoverRef    = ref()
const isOpen        = ref(false)

const activeBranches = computed(() => branchesStore.activeBranches)
const availableCount = computed(() =>
    activeBranches.value.filter(b => b.id !== branchesStore.activeBranchId).length
)
const currentBranch = computed(() =>
    activeBranches.value.find(b => b.id === branchesStore.activeBranchId) ?? null
)

const triggerLabel = computed(() => {
    if (!currentBranch.value) return branchesStore.activeBranchName || 'Sin sucursal'
    const b = currentBranch.value
    const loc = b.distrito || b.departamento || ''
    return loc ? `${b.nombre} - ${loc}` : b.nombre
})

function toggle(event) {
    if (!iamStore.isOwner) return
    popoverRef.value.toggle(event)
}

function selectBranch(branch) {
    if (branch.id === branchesStore.activeBranchId) return
    branchesStore.selectBranch(branch.id, branch.nombre)
    popoverRef.value.hide()
}

function leaveBranch() {
    branchesStore.clearBranch()
    popoverRef.value.hide()
    router.push('/dashboard')
}

function getBranchLocation(branch) {
    return [branch.distrito, branch.departamento].filter(Boolean).join(', ')
}

onMounted(() => {
    if (iamStore.isOwner && !branchesStore.items.length) {
        branchesStore.fetchAll()
    }
})
</script>

<template>
    <div class="bs">
        <!-- Trigger -->
        <div
            class="bs__trigger"
            :class="{ 'bs__trigger--interactive': iamStore.isOwner }"
            @click="toggle"
        >
            <div class="bs__trigger-icon">
                <i class="pi pi-building"></i>
            </div>
            <div class="bs__trigger-text">
                <span class="bs__trigger-label">Sucursal Actual</span>
                <span class="bs__trigger-name">{{ triggerLabel }}</span>
            </div>
            <i
                v-if="iamStore.isOwner"
                class="pi bs__trigger-chevron"
                :class="isOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
            />
        </div>

        <!-- Branch popover -->
        <pv-popover
            ref="popoverRef"
            :pt="{ root: { class: 'bs-popover' }, content: { class: 'bs-popover__content' } }"
            @show="isOpen = true"
            @hide="isOpen = false"
        >
            <div class="bs__panel">
                <!-- Blue header -->
                <div class="bs__header">
                    <span class="bs__header-title">Cambiar de Sucursal</span>
                    <span class="bs__header-count">
                        {{ availableCount }} sucursal{{ availableCount !== 1 ? 'es' : '' }}
                        disponible{{ availableCount !== 1 ? 's' : '' }}
                    </span>
                </div>

                <!-- Branch list -->
                <div class="bs__body">
                    <span class="bs__section-label">SUCURSALES ACTIVAS</span>

                    <!-- Loading -->
                    <div v-if="branchesStore.isLoading" class="bs__loading">
                        <i class="pi pi-spinner pi-spin" /> Cargando sucursales…
                    </div>

                    <!-- Items -->
                    <template v-else>
                        <div
                            v-for="branch in activeBranches"
                            :key="branch.id"
                            class="bs__item"
                            :class="{
                                'bs__item--current':    branch.id === branchesStore.activeBranchId,
                                'bs__item--selectable':  branch.id !== branchesStore.activeBranchId,
                            }"
                            @click="selectBranch(branch)"
                        >
                            <div class="bs__item-icon">
                                <i :class="branch.id === branchesStore.activeBranchId
                                             ? 'pi pi-check'
                                             : 'pi pi-building'" />
                            </div>
                            <div class="bs__item-info">
                                <div class="bs__item-row">
                                    <span class="bs__item-name">{{ branch.nombre }}</span>
                                    <span
                                        v-if="branch.id === branchesStore.activeBranchId"
                                        class="bs__item-badge"
                                    >Actual</span>
                                </div>
                                <span class="bs__item-code">{{ branch.codigo }}</span>
                                <span class="bs__item-location">{{ getBranchLocation(branch) }}</span>
                            </div>
                            <div
                                v-if="branch.id === branchesStore.activeBranchId"
                                class="bs__item-dot"
                            />
                        </div>

                        <!-- Empty -->
                        <div v-if="!activeBranches.length" class="bs__empty">
                            No hay sucursales activas
                        </div>
                    </template>
                </div>

                <!-- Footer -->
                <div class="bs__footer">
                    <span class="bs__footer-hint">Los datos mostrados corresponden a la sucursal seleccionada</span>
                    <button class="bs__leave-btn" @click="leaveBranch">
                        <i class="pi pi-sign-out"></i>
                        Dejar sucursal
                    </button>
                </div>
            </div>
        </pv-popover>
    </div>
</template>

<style scoped>
/* ── Trigger ─────────────────────────────────────────────────────────────── */
.bs__trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-xl);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
    flex-shrink: 0;
    user-select: none;
    transition: background var(--transition-fast), border-color var(--transition-fast);
}

.bs__trigger--interactive {
    cursor: pointer;
}

.bs__trigger--interactive:hover {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    border-color: var(--color-primary);
}

.bs__trigger-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-lg);
    background: var(--color-primary);
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    flex-shrink: 0;
}

.bs__trigger-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.bs__trigger-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    line-height: 1.2;
}

.bs__trigger-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 14rem;
}

.bs__trigger-chevron {
    font-size: 0.65rem;
    color: var(--text-muted);
    transition: transform var(--transition-fast);
    margin-left: 0.25rem;
}
</style>

<!-- Global styles for popover (teleported to body) -->
<style>
.bs-popover.p-popover {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 14px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    padding: 0;
}

.bs-popover .p-popover-content,
.bs-popover .bs-popover__content {
    padding: 0;
}

/* Arrow → match blue header */
.bs-popover.p-popover::before,
.bs-popover.p-popover::after {
    border-bottom-color: #1A6BC2 !important;
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
.bs__panel {
    width: 320px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.bs__header {
    background: linear-gradient(135deg, #1A6BC2, #2563EB);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.bs__header-title {
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
}

.bs__header-count {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.bs__body {
    padding: 1rem 1.25rem;
}

.bs__section-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #9CA3AF;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.75rem;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.bs__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem 0;
    color: #6B7280;
    font-size: 0.875rem;
}

/* ── Branch item ─────────────────────────────────────────────────────────── */
.bs__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 10px;
    transition: background 150ms ease;
}

.bs__item--selectable {
    cursor: pointer;
}

.bs__item--selectable:hover {
    background: #F3F4F6;
}

.bs__item--current {
    background: #EFF6FF;
}

.bs__item + .bs__item {
    margin-top: 0.375rem;
}

.bs__item-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #1A6BC2;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
}

.bs__item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.bs__item-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.bs__item-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bs__item-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: #DCFCE7;
    color: #16A34A;
    font-size: 0.6875rem;
    font-weight: 600;
    flex-shrink: 0;
}

.bs__item-code {
    font-size: 0.75rem;
    color: #6B7280;
}

.bs__item-location {
    font-size: 0.75rem;
    color: #9CA3AF;
}

.bs__item-dot {
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background: #1A6BC2;
    flex-shrink: 0;
}

/* ── Empty ────────────────────────────────────────────────────────────────── */
.bs__empty {
    text-align: center;
    padding: 1rem;
    color: #9CA3AF;
    font-size: 0.875rem;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.bs__footer {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #E5E7EB;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
}

.bs__footer-hint {
    font-size: 0.75rem;
    color: #9CA3AF;
    text-align: center;
    line-height: 1.4;
}

.bs__leave-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.45rem 0;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    background: transparent;
    color: #ef4444;
    border: 1px solid #fca5a5;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.bs__leave-btn:hover {
    background: #fef2f2;
    color: #dc2626;
}
</style>
