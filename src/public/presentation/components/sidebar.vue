<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIamStore } from '../../../iam/application/iam.store.js'
import { useConfirmDialog } from '../../../shared/composables/use-confirm-dialog.js'

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
const userRole = computed(() => iamStore.userRole || 'Usuario')

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
    <div class="flex align-items-center justify-content-center border-bottom-1 brand-border brand-header">
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
          :class="['menu-link flex align-items-center gap-3 mx-2 my-1 border-round',
                   { 'justify-content-center': !drawer && collapsed }]"
          :title="item.label"
          @click="handleNavClick"
        >
          <i :class="['menu-icon text-center flex-shrink-0', item.icon]"></i>
          <span v-show="drawer || !collapsed" class="white-space-nowrap overflow-hidden menu-label">{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>

    <div v-if="drawer" class="border-top-1 brand-border">
      <div class="flex align-items-center gap-2 px-3 py-3">
        <div class="user-avatar flex-shrink-0">
          <i class="pi pi-user"></i>
        </div>
        <div class="flex flex-column gap-1 flex-1 overflow-hidden">
          <span class="user-name white-space-nowrap overflow-hidden">{{ username }}</span>
          <span class="user-role white-space-nowrap overflow-hidden">{{ userRole }}</span>
        </div>
        <button class="logout-btn flex align-items-center justify-content-center border-round cursor-pointer flex-shrink-0" title="Cerrar sesión" @click="handleSignOut">
          <i class="pi pi-sign-out"></i>
        </button>
      </div>
    </div>

    <div v-if="!drawer" class="flex justify-content-center py-3 border-top-1 brand-border">
      <button
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

/* Desktop collapsed: icon-only strip */
.sidebar--collapsed {
  width: 60px;
  min-width: 60px;
}

/* Drawer mode from layout `drawer` prop — avoids JS/CSS breakpoint mismatch */
.sidebar--drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  height: 100dvh;
  z-index: 1000;
  width: 220px !important;
  min-width: 220px !important;
  transform: translateX(0);
  transition: transform 0.25s ease;
}

.sidebar--drawer-closed {
  transform: translateX(-100%);
}

/* ── Brand ────────────────────────────────────────────────────── */
.brand-border  { border-color: var(--border-color) !important; }
.brand-header  { min-height: 72px; padding: 0.75rem 0.75rem; }

/* Expanded: full logo with icon + wordmark */
.brand-logo-full {
  width: 90px;
  height: auto;
  display: block;
  object-fit: contain;
}

/* Collapsed: show only the M icon — clips the wordmark from below */
.brand-logo-icon-wrap {
  width: 36px;
  height: 22px;   /* ≈ 61% of 36px — covers just the icon portion */
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

/* ── Links ────────────────────────────────────────────────────── */
.menu-link {
  padding: 0.625rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.menu-link:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Active state ─────────────────────────────────────────────── */
.menu-item.active .menu-link {
  background-color: rgba(26, 107, 194, 0.15);
  color: var(--color-primary);
  border-left: 3px solid var(--color-primary);
  padding-left: calc(1rem - 3px);
  font-weight: var(--font-weight-semibold);
}

/* Remove border-left indicator when icon-only (would look off-center) */
.sidebar--collapsed .menu-item.active .menu-link {
  border-left: none;
  padding-left: 1rem;
}

/* ── Icons ────────────────────────────────────────────────────── */
.menu-icon  { font-size: 1rem; min-width: 1rem; }
.menu-label { text-overflow: ellipsis; }

/* ── User section ─────────────────────────────────────────────── */
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px rgba(26, 107, 194, 0.25);
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  text-overflow: ellipsis;
}

.user-role {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
}

/* ── Toggle button ────────────────────────────────────────────── */
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

.logout-btn {
  width: 160px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.toggle-btn:hover,
.logout-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
</style>
