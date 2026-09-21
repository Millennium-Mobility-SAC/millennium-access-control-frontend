<script setup>
/**
 * Historial de cargas del Excel de inventario: quién subió qué archivo y qué resultó.
 *
 * Va en un diálogo, igual que el historial de descargas: se abre desde el menú de «Importar Excel»
 * y un panel flotante necesitaría un botón propio donde anclarse.
 */
import { ref, watch } from 'vue'
import { useTrafficFinesInventoryStore } from '../../application/traffic-fines-inventory.store.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible'])

const store = useTrafficFinesInventoryStore()
const { showError } = useNotification()

const loading = ref(false)

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    loading.value = true
    try {
      await store.fetchImports()
    } catch {
      showError('No se pudo cargar el historial de importaciones.')
    } finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <pv-dialog
    :visible="visible"
    :modal="true"
    :draggable="false"
    header="Historial de importaciones"
    class="dialog-light"
    style="width: min(96vw, 820px)"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="tfi-note">
      Cada carga solo agrega las placas nuevas. Las que ya estaban no se modifican aunque el archivo
      traiga otros datos: esas se cuentan como «con otros datos» y se corrigen a mano.
    </p>

    <pv-data-table
      :value="store.imports"
      :loading="loading"
      data-key="id"
      size="small"
      scrollable
      scroll-height="60vh"
    >
      <template #empty>
        <span class="tfi-muted">Todavía no se importó ningún archivo.</span>
      </template>

      <pv-column header="Archivo">
        <template #body="{ data }">
          <div class="tfi-file">
            <i class="pi pi-file-excel" />
            <span :title="data.fileName">{{ data.fileName }}</span>
          </div>
        </template>
      </pv-column>
      <pv-column header="Fecha">
        <template #body="{ data }">
          <div class="tfi-stack">
            <span>{{ formatDateTimeForUi(data.importedAt) }}</span>
            <span class="tfi-muted">{{ data.importedBy || '—' }}</span>
          </div>
        </template>
      </pv-column>
      <pv-column header="Filas">
        <template #body="{ data }">{{ data.totalRows }}</template>
      </pv-column>
      <pv-column header="Nuevas">
        <template #body="{ data }">
          <span :class="{ 'tfi-strong': data.createdCount > 0 }">{{ data.createdCount }}</span>
        </template>
      </pv-column>
      <pv-column header="Ya estaban">
        <template #body="{ data }">
          {{ data.unchangedCount }}
          <span v-if="data.differingCount" class="tfi-muted"> ({{ data.differingCount }} con otros datos)</span>
        </template>
      </pv-column>
      <pv-column header="Rechazadas">
        <template #body="{ data }">
          <span :class="{ 'tfi-warn': data.rejectedCount > 0 }">{{ data.rejectedCount }}</span>
        </template>
      </pv-column>
    </pv-data-table>
  </pv-dialog>
</template>

<style scoped>
/*
 * Los grises salen de --text-body-secondary y no de --text-color-secondary: esa última la define
 * el tema de PrimeVue para el layout oscuro y sobre el fondo claro queda casi invisible.
 */
.tfi-note {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-file {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 18rem;
  font-weight: 600;
}

.tfi-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tfi-stack {
  display: flex;
  flex-direction: column;
}

.tfi-muted {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfi-strong {
  font-weight: 700;
}

.tfi-warn {
  font-weight: 700;
  color: var(--orange-600, #ea580c);
}
</style>
