<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '../components/sidebar.vue'
import Toolbar from '../components/toolbar.vue'
import { getMenuItemsByRole } from '../constants/layout.constants-ui.js'
import { useIamStore } from '../../../iam/application/iam.store.js'

const route    = useRoute()
const router   = useRouter()
const iamStore = useIamStore()
const collapsed = ref(window.innerWidth < 768)
const toggleSidebar = () => { collapsed.value = !collapsed.value }

function handleResize() {
  if (window.innerWidth >= 768) collapsed.value = false
  else if (window.innerWidth < 768 && !collapsed.value) collapsed.value = true
}
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// Cuando la sesión expira (401 → _clearSession() → isSignedIn = false)
// redirige al sign-in desde la capa de presentación, sin que el store conozca el router.
watch(() => iamStore.isSignedIn, (isSignedIn) => {
  if (!isSignedIn) router.replace('/sign-in')
})

const filteredMenuItems = computed(() => getMenuItemsByRole(iamStore.userRole))
</script>

<template>
  <div class="app-layout">

    <!-- Overlay oscuro para móvil cuando sidebar está abierto -->
    <transition name="fade">
      <div v-if="!collapsed" class="sidebar-overlay" @click="toggleSidebar" />
    </transition>

    <sidebar :menu-items="filteredMenuItems" :collapsed="collapsed" @toggle="toggleSidebar" />

    <main class="app-content">
      <Toolbar
        :title="route.meta.module || ''"
        :description="route.meta.description || ''"
        :show-back-button="route.meta.showBackButton ?? false"
      >
        <!-- Botón hamburguesa: solo visible en móvil para abrir el drawer -->
        <template #actions>
          <pv-button
            icon="pi pi-bars"
            text
            rounded
            class="block md:hidden"
            aria-label="Abrir menú"
            @click="toggleSidebar"
          />
        </template>
      </Toolbar>
      <div class="content-area">
        <router-view />
      </div>
    </main>

  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.app-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: whitesmoke;
}

/* Overlay — solo visible en móvil */
.sidebar-overlay {
  display: none;
}

@media (max-width: 767px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>