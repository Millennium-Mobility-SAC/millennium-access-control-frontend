<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="flex align-items-center justify-content-center" style="min-height: 100vh; background: var(--surface-subtle);">
    <div class="surface-card p-6 border-round-lg shadow-2 text-center" style="max-width: 500px;">
      <i class="pi pi-exclamation-triangle text-6xl mb-4" style="color: var(--action-primary);"></i>
      <h1 class="text-5xl font-bold text-900 mb-3">404</h1>
      <h2 class="text-2xl font-semibold text-700 mb-3">Página no encontrada</h2>
      <p class="text-600 mb-4 line-height-3">
        Lo sentimos, la página que buscas no existe o ha sido movida.
      </p>
      <button 
        class="px-4 py-3 bg-red-600 text-white border-none border-round cursor-pointer font-semibold"
        @click="goHome"
        style="background: var(--action-primary);"
      >
        <i class="pi pi-home mr-2"></i>
        Volver al inicio
      </button>
    </div>
  </div>
</template>

<style scoped>
button:hover {
  background: var(--action-primary-hover) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}
</style>