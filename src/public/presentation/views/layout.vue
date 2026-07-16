<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '../components/sidebar.vue'
import Toolbar from '../components/toolbar.vue'
import { getMenuItemsByRole } from '../constants/layout.constants-ui.js'
import { useIamStore } from '../../../iam/application/iam.store.js'

/** Phones + tablets: drawer. Desktops (≥1024): persistent sidebar. */
const NARROW_QUERY = '(max-width: 1023px)'

const route    = useRoute()
const router   = useRouter()
const iamStore = useIamStore()

const isNarrow = ref(
  typeof window !== 'undefined' ? window.matchMedia(NARROW_QUERY).matches : false,
)
const collapsed = ref(isNarrow.value)

let narrowMq = null

function applyNarrow(matches) {
  isNarrow.value = matches
  collapsed.value = matches
}

function onNarrowChange(event) {
  applyNarrow(event.matches)
}

const toggleSidebar = () => {
  collapsed.value = !collapsed.value
}

const showOverlay = computed(() => isNarrow.value && !collapsed.value)

onMounted(() => {
  narrowMq = window.matchMedia(NARROW_QUERY)
  applyNarrow(narrowMq.matches)
  if (narrowMq.addEventListener) narrowMq.addEventListener('change', onNarrowChange)
  else narrowMq.addListener(onNarrowChange)
})

onUnmounted(() => {
  if (!narrowMq) return
  if (narrowMq.removeEventListener) narrowMq.removeEventListener('change', onNarrowChange)
  else narrowMq.removeListener(onNarrowChange)
})

watch(() => iamStore.isSignedIn, (isSignedIn) => {
  if (!isSignedIn) router.replace('/sign-in')
})

const filteredMenuItems = computed(() => getMenuItemsByRole(iamStore.userRole))
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--narrow': isNarrow }">
    <div
      v-if="showOverlay"
      class="sidebar-overlay"
      aria-hidden="true"
      @click="toggleSidebar"
    />

    <sidebar
      :menu-items="filteredMenuItems"
      :collapsed="collapsed"
      :drawer="isNarrow"
      @toggle="toggleSidebar"
    />

    <main class="app-content">
      <Toolbar
        :title="route.meta.module || ''"
        :description="route.meta.description || ''"
        :show-back-button="route.meta.showBackButton ?? false"
        :narrow="isNarrow"
      >
        <template #actions>
          <pv-button
            v-if="isNarrow"
            icon="pi pi-bars"
            text
            rounded
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
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.app-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: whitesmoke;
}

.sidebar-overlay {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}
</style>
