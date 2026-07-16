<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIamStore } from '../../../iam/application/iam.store.js'
import { useConfirmDialog } from '../../../shared/composables/use-confirm-dialog.js'
import { ROLE_LABELS } from '../../../shared/presentation/constants/roles.constants.js'

const props = defineProps({
  menuItems: {
    type: Array,
    required: true
  },
  collapsed: {
    type: Boolean,
    default: false
  },
  /** Fixed drawer on phone/tablet — driven by layout matchMedia, not CSS alone. */
  drawer: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle'])

const route    = useRoute()
const router   = useRouter()
const iamStore = useIamStore()
const { showConfirm } = useConfirmDialog()

const username = computed(() => iamStore.currentUsername || 'Usuario')
const userRole = computed(() => {
  const raw = iamStore.userRole
  return (raw && ROLE_LABELS[raw]) ? ROLE_LABELS[raw] : (raw || 'Usuario')
})

const isActive = (path) => route.path.startsWith(path)

function handleNavClick() {
  if (props.drawer && !props.collapsed) {
    emit('toggle')
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
</script>

<template>
  <nav
    :class="[
      'sidebar flex flex-column h-full overflow-y-auto overflow-x-hidden',
      {
        'sidebar--collapsed': collapsed && !drawer,
        'sidebar--drawer': drawer,
        'sidebar--drawer-closed': drawer && collapsed,
      },
    ]"
  >

    <!-- Brand / Logo -->
    <div
      class="flex align-items-center border-bottom-1 brand-border brand-header"
      :class="drawer ? 'justify-content-between px-3' : 'justify-content-center'"
    >
      <img
        v-show="drawer || !collapsed"
        src="@/assets/img/sidebar-millennium-mobility.png"
        alt="Millennium Mobility"
        class="brand-logo-full"
      />
      <div v-show="!drawer && collapsed" class="brand-logo-icon-wrap">
        <img
          src="@/assets/img/logo-millennium-mobility.png"
          alt="Millennium"
          class="brand-logo-icon-img"
        />
      </div>
      <button
        v-if="drawer"
        type="button"
        class="drawer-close flex align-items-center justify-content-center border-round cursor-pointer flex-shrink-0"
        aria-label="Cerrar menú"
        title="Cerrar menú"
        @click="emit('toggle')"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </div>

    <!-- Navigation -->
    <ul class="list-none m-0 py-2 flex-1">
      <li
        v-for="item in menuItems"
        :key="item.label"
        :class="['menu-item', { active: isActive(item.to) }]"
      >
        <RouterLink
          :to="item.to"
          :class="[
            'menu-link flex align-items-center gap-3 mx-2 my-1 border-round',
            { 'justify-content-center': !drawer && collapsed, 'menu-link--drawer': drawer },
          ]"
          :title="item.label"
          @click="handleNavClick"
        >
          <i :class="['menu-icon text-center flex-shrink-0', item.icon]"></i>
          <span v-show="drawer || !collapsed" class="white-space-nowrap overflow-hidden menu-label">{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>

    <!-- Drawer footer: usuario + cerrar sesión (móvil / tablet) -->
    <div v-if="drawer" class="sidebar-drawer-footer border-top-1 brand-border">
      <div class="sidebar-user">
        <div class="user-avatar flex-shrink-0" aria-hidden="true">
          <i class="pi pi-user"></i>
        </div>
        <div class="sidebar-user__meta min-w-0 flex-1">
          <span class="user-name">{{ username }}</span>
          <span class="user-role">{{ userRole }}</span>
        </div>
      </div>
      <button
        type="button"
        class="logout-btn logout-btn--drawer flex align-items-center justify-content-center gap-2 border-round cursor-pointer"
        @click="handleSignOut"
      >
        <i class="pi pi-sign-out" aria-hidden="true"></i>
        <span>Cerrar sesión</span>
      </button>
    </div>

    <!-- Desktop: collapse strip -->
    <div v-if="!drawer" class="flex justify-content-center py-3 border-top-1 brand-border">
      <button
        type="button"
        class="toggle-btn flex align-items-center justify-content-center gap-2 border-round cursor-pointer"
        :title="collapsed ? 'Expandir menú' : 'Ocultar menú'"
        @click="emit('toggle')"
      >
        <i v-if="collapsed" class="pi pi-chevron-right flex-shrink-0"></i>
        <span v-else class="white-space-nowrap">Ocultar Menú</span>
      </button>
    </div>

  </nav>
</template>

<style scoped>
/* ── Sidebar container ────────────────────────────────────────── */
.sidebar {
  width: 220px;
  min-width: 220px;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  user-select: none;
  transition: width 0.25s ease, min-width 0.25s ease;
}

.sidebar--collapsed {
  width: 60px;
  min-width: 60px;
}

/* Drawer: wider on tablets, touch-friendly, safe-area aware */
.sidebar--drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  height: 100dvh;
  z-index: 1000;
  width: min(20rem, 86vw) !important;
  min-width: min(20rem, 86vw) !important;
  max-width: 22rem;
  transform: translateX(0);
  transition: transform 0.25s ease;
  padding-bottom: env(safe-area-inset-bottom, 0);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35);
}

.sidebar--drawer-closed {
  transform: translateX(-105%);
  box-shadow: none;
}

/* ── Brand ────────────────────────────────────────────────────── */
.brand-border  { border-color: var(--border-color) !important; }
.brand-header  { min-height: 72px; padding: 0.75rem; }

.brand-logo-full {
  width: 90px;
  height: auto;
  display: block;
  object-fit: contain;
}

.brand-logo-icon-wrap {
  width: 36px;
  height: 22px;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
}

.brand-logo-icon-img {
  width: 36px;
  height: auto;
  display: block;
  flex-shrink: 0;
}

.drawer-close {
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 1rem;
}

.drawer-close:hover,
.drawer-close:focus-visible {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Links ────────────────────────────────────────────────────── */
.menu-link {
  padding: 0.625rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.menu-link--drawer {
  min-height: 2.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
}

.menu-link:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.menu-item.active .menu-link {
  background-color: rgba(26, 107, 194, 0.15);
  color: var(--color-primary);
  border-left: 3px solid var(--color-primary);
  padding-left: calc(1rem - 3px);
  font-weight: var(--font-weight-semibold);
}

.sidebar--collapsed .menu-item.active .menu-link {
  border-left: none;
  padding-left: 1rem;
}

.menu-icon  { font-size: 1rem; min-width: 1rem; }
.menu-link--drawer .menu-icon { font-size: 1.1rem; min-width: 1.15rem; }
.menu-label { text-overflow: ellipsis; }

/* ── Drawer user footer ───────────────────────────────────────── */
.sidebar-drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom, 0));
  flex-shrink: 0;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.sidebar-user__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px rgba(26, 107, 194, 0.25);
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn--drawer {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.85rem;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.logout-btn--drawer:hover,
.logout-btn--drawer:focus-visible {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--color-primary);
}

/* ── Desktop toggle ───────────────────────────────────────────── */
.toggle-btn {
  height: 32px;
  padding: 0 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: background-color 0.15s ease, color 0.15s ease;
  font-size: var(--font-size-sm);
}

.sidebar--collapsed .toggle-btn {
  width: 36px;
  padding: 0;
}

.toggle-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
</style>
