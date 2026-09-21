<script setup>
/**
 * Historial de descargas de papeletas.
 *
 * Cualquier descarga se puede volver a bajar y sale igual que la primera vez: el archivo se arma
 * desde lo que se registró al hacerla. Es lo que evita que un archivo perdido deje papeletas
 * «entregadas» sin que nadie las haya recibido.
 */
import { ref, watch } from 'vue'
import { useTrafficFinesStore } from '../../application/traffic-fines.store.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import { formatSoles } from '../../domain/format-issuer-label.js'
import { formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible'])

const store = useTrafficFinesStore()
const { showSuccess, showError } = useNotification()

const loading = ref(false)
const downloadingId = ref(null)

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    loading.value = true
    try {
      await store.fetchDeliveries()
    } catch (error) {
      showError(humanizeApiError(error))
    } finally {
      loading.value = false
    }
  },
)

async function download(delivery) {
  downloadingId.value = delivery.id
  try {
    const fileName = await store.downloadDelivery(delivery)
    showSuccess(`Archivo generado: ${fileName}`)
  } catch (error) {
    showError(humanizeApiError(error))
  } finally {
    downloadingId.value = null
  }
}

/** Qué llevó una descarga de «nuevas», por tipo; las vacías no se nombran. */
function breakdown(delivery) {
  if (delivery.kind !== 'NEW_ONLY') return null
  const parts = []
  if (delivery.newCount) parts.push(`${delivery.newCount} ${delivery.newCount === 1 ? 'nueva' : 'nuevas'}`)
  if (delivery.changedCount) parts.push(`${delivery.changedCount} con cambios`)
  if (delivery.reappearedCount) {
    parts.push(`${delivery.reappearedCount} ${delivery.reappearedCount === 1 ? 'reaparecida' : 'reaparecidas'}`)
  }
  return parts.join(' · ')
}
</script>

<template>
  <pv-dialog
    :visible="visible"
    :modal="true"
    :draggable="false"
    header="Historial de descargas"
    class="dialog-light"
    style="width: min(96vw, 960px)"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="tfd-note">
      Volver a bajar una descarga da el mismo archivo que la primera vez. Las descargas de
      «todas» quedan registradas pero no cuentan como entrega.
    </p>

    <pv-data-table
      :value="store.deliveries"
      :loading="loading"
      data-key="id"
      size="small"
      scrollable
      scroll-height="60vh"
    >
      <template #empty>
        <span class="tfd-muted">Todavía no se descargó ninguna papeleta.</span>
      </template>

      <pv-column header="N.º">
        <template #body="{ data }">
          <span class="tfd-number">#{{ data.number }}</span>
        </template>
      </pv-column>
      <pv-column header="Fecha">
        <template #body="{ data }">
          <div class="tfd-stack">
            <span>{{ formatDateTimeForUi(data.deliveredAt) }}</span>
            <span class="tfd-muted">{{ data.deliveredBy || '—' }}</span>
          </div>
        </template>
      </pv-column>
      <pv-column header="Tipo">
        <template #body="{ data }">
          <pv-tag
            :value="data.kind === 'NEW_ONLY' ? 'Nuevas' : 'Todas'"
            :severity="data.kind === 'NEW_ONLY' ? 'success' : 'secondary'"
          />
        </template>
      </pv-column>
      <pv-column header="Filtros">
        <template #body="{ data }">
          <span :class="{ 'tfd-muted': !data.filterSummary }">{{ data.filterSummary || 'Todo el inventario' }}</span>
        </template>
      </pv-column>
      <pv-column header="Papeletas">
        <template #body="{ data }">
          <div class="tfd-stack">
            <span>{{ data.itemCount }}</span>
            <span v-if="breakdown(data)" class="tfd-muted">{{ breakdown(data) }}</span>
          </div>
        </template>
      </pv-column>
      <pv-column header="Deuda">
        <template #body="{ data }">
          <span class="tfd-amount">{{ formatSoles(data.totalAmountDue) }}</span>
        </template>
      </pv-column>
      <pv-column header="">
        <template #body="{ data }">
          <pv-button
            icon="pi pi-download"
            label="Bajar"
            size="small"
            text
            :loading="downloadingId === data.id"
            :disabled="downloadingId !== null && downloadingId !== data.id"
            @click="download(data)"
          />
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
.tfd-note {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfd-number {
  font-family: monospace;
  font-weight: 600;
}

.tfd-stack {
  display: flex;
  flex-direction: column;
}

.tfd-muted {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tfd-amount {
  font-variant-numeric: tabular-nums;
}
</style>
