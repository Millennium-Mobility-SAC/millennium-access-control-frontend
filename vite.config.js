import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Vite 8 default is chrome111+; older Android tablet Chrome often lags behind
    // phone Chrome and fails to parse the bundle → blank purple #app screen.
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    sourcemap: false,   // nunca exponer código fuente en producción
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/primevue/') || id.includes('/@primeuix/')) {
            const lower = id.toLowerCase()

            // Tema Aura (@primeuix) — grande por sí solo
            if (lower.includes('/@primeuix/')) {
              return 'vendor-pv-theme'
            }

            // Componentes de datos pesados
            if (
              lower.includes('/primevue/datatable') ||
              lower.includes('/primevue/column') ||
              lower.includes('/primevue/columngroup') ||
              lower.includes('/primevue/row') ||
              lower.includes('/primevue/dataview') ||
              lower.includes('/primevue/paginator') ||
              lower.includes('/primevue/virtualscroller')
            ) {
              return 'vendor-pv-data'
            }

            // Componentes de selección / pickers pesados
            if (
              lower.includes('/primevue/autocomplete') ||
              lower.includes('/primevue/multiselect') ||
              lower.includes('/primevue/select') ||
              lower.includes('/primevue/dropdown') ||
              lower.includes('/primevue/datepicker') ||
              lower.includes('/primevue/calendar') ||
              lower.includes('/primevue/cascadeselect') ||
              lower.includes('/primevue/treeselect')
            ) {
              return 'vendor-pv-select'
            }

            // Overlays (Dialog, Drawer, Popover, Menu, ConfirmDialog)
            if (
              lower.includes('/primevue/dialog') ||
              lower.includes('/primevue/confirmdialog') ||
              lower.includes('/primevue/drawer') ||
              lower.includes('/primevue/popover') ||
              lower.includes('/primevue/menu') ||
              lower.includes('/primevue/tieredmenu') ||
              lower.includes('/primevue/overlaypanel') ||
              lower.includes('/primevue/sidebar')
            ) {
              return 'vendor-pv-overlay'
            }

            // Core de PrimeVue + resto de componentes simples
            return 'vendor-pv-core'
          }

          if (id.includes('/primeicons/') || id.includes('/primeflex/')) {
            return 'vendor-prime-assets'
          }

          if (
            id.includes('/vue-router/') ||
            id.includes('/vue/') ||
            id.includes('/pinia/')
          ) {
            return 'vendor-vue'
          }

          if (id.includes('/axios/')) {
            return 'vendor-axios'
          }
        },
      },
    },
  },
})






