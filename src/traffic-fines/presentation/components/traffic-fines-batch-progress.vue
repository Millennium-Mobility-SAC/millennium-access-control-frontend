<script setup>
/**
 * Avance del lote en curso.
 *
 * Muestra el detalle por unidad y portal en cuanto hay algún fallo: un lote "completado con
 * errores" sin decir cuál portal falló obligaría a abrir cada unidad para averiguarlo, y sin esa
 * información un S/ 0.00 se lee como "no debe nada".
 */
import { computed, ref } from 'vue'
import { formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'
import {
  batchStatusSeverity,
  checkStatusSeverity,
  formatBatchStatusLabel,
  formatCheckStatusLabel,
  formatIssuerLabel,
} from '../../domain/format-issuer-label.js'

const props = defineProps({
  batch: { type: Object, default: null },
})

defineEmits(['dismissed'])

const showItems = ref(false)

const failedItems = computed(
  () => (props.batch?.items ?? []).filter((item) => item.status !== 'COMPLETED' && item.status !== 'PENDING'),
)

/** Solo tiene sentido ofrecer el detalle cuando hay algo que mirar. */
const canExpand = computed(() => failedItems.value.length > 0)
</script>

<template>
  <div v-if="batch" class="tf-progress surface-card border-round p-3 mb-3">
    <div class="flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
      <div class="flex align-items-center gap-2">
        <pv-tag
          :value="formatBatchStatusLabel(batch.status)"
          :severity="batchStatusSeverity(batch.status)"
        />
        <span class="text-600 text-sm">
          {{ batch.totalItems - batch.pendingItems }} de {{ batch.totalItems }} consultas
        </span>
      </div>

      <div class="flex align-items-center gap-2">
        <pv-button
          v-if="canExpand"
          :label="showItems ? 'Ocultar detalle' : `Ver ${failedItems.length} con problemas`"
          :icon="showItems ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          size="small"
          @click="showItems = !showItems"
        />
        <pv-button
          v-if="batch.settled"
          icon="pi pi-times"
          text
          rounded
          size="small"
          v-tooltip.top="'Cerrar'"
          @click="$emit('dismissed')"
        />
      </div>
    </div>

    <pv-progress-bar
      :value="batch.progressPercent"
      :show-value="true"
      style="height: 0.75rem"
    />

    <div class="flex flex-wrap gap-3 mt-2 text-sm text-600">
      <span v-if="!batch.settled">
        <i class="pi pi-clock mr-1" />
        Plazo estimado: {{ formatDateTimeForUi(batch.deadlineAt) }}
      </span>
      <span v-if="batch.settled">
        <i class="pi pi-check-circle mr-1" />
        Terminada: {{ formatDateTimeForUi(batch.completedAt) }}
      </span>
      <span>Nuevas: {{ batch.finesCreated }}</span>
      <span>Actualizadas: {{ batch.finesUpdated }}</span>
      <span>Resueltas: {{ batch.finesResolved }}</span>
      <span v-if="batch.failedItems" class="text-orange-600">
        Con error: {{ batch.failedItems }}
      </span>
    </div>

    <pv-message v-if="batch.errorMessage" severity="error" :closable="false" class="mt-2">
      {{ batch.errorMessage }}
    </pv-message>

    <!--
      El lote no se queda colgado si el servicio se reinicia: el backend lo vence por plazo. Aquí
      solo hay que explicarlo, porque "sin respuesta del servicio" no dice qué hacer.
    -->
    <pv-message
      v-else-if="batch.status === 'TIMED_OUT'"
      severity="warn"
      :closable="false"
      class="mt-2"
    >
      El servicio de consultas dejó de responder antes de terminar. Las unidades sin resultado
      conservan sus papeletas anteriores; puedes volver a consultarlas.
    </pv-message>

    <div v-if="showItems && canExpand" class="tf-progress__items mt-3">
      <div
        v-for="item in failedItems"
        :key="`${item.vehicleId}-${item.issuer}`"
        class="tf-progress__item flex align-items-center gap-2 py-1"
      >
        <span class="tf-progress__plate">{{ item.licensePlate ?? '—' }}</span>
        <pv-tag :value="formatIssuerLabel(item.issuer)" severity="secondary" />
        <pv-tag
          :value="formatCheckStatusLabel(item.status)"
          :severity="checkStatusSeverity(item.status)"
        />
        <span v-if="item.errorMessage" class="text-600 text-sm">{{ item.errorMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tf-progress {
  border: 1px solid var(--surface-border);
}

.tf-progress__items {
  border-top: 1px solid var(--surface-border);
  padding-top: 0.5rem;
  max-height: 14rem;
  overflow-y: auto;
}

.tf-progress__plate {
  font-weight: 700;
  letter-spacing: 0.04em;
  min-width: 6rem;
}
</style>
