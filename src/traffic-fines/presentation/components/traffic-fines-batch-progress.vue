<script setup>
/**
 * Avance del lote, en una sola línea dentro del toolbar.
 *
 * Va compacto a propósito: el lote puede tardar más de una hora y durante todo ese rato el
 * usuario necesita la tabla, no el indicador. Lo que no cabe en la línea —el plazo y el detalle
 * de los portales que fallaron— se consulta bajo demanda, no ocupa alto de forma permanente.
 *
 * El detalle de fallos no se resume en «hubo errores»: sin saber qué portal falló, un S/ 0.00 se
 * lee como «no debe nada» cuando en realidad no se pudo consultar.
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

const failuresPanel = ref(null)

const failedItems = computed(
  () => (props.batch?.items ?? []).filter(
    (item) => item.status !== 'COMPLETED' && item.status !== 'PENDING',
  ),
)

const done = computed(() => (props.batch?.totalItems ?? 0) - (props.batch?.pendingItems ?? 0))

/** El plazo mientras corre; la hora de cierre cuando terminó. Va en el tooltip del estado. */
const timingHint = computed(() => {
  if (!props.batch) return null
  return props.batch.settled
    ? `Terminada el ${formatDateTimeForUi(props.batch.completedAt)}`
    : `Plazo estimado: ${formatDateTimeForUi(props.batch.deadlineAt)}`
})

function toggleFailures(event) {
  failuresPanel.value?.toggle(event)
}
</script>

<template>
  <div v-if="batch" class="tf-strip">
    <pv-tag
      :value="formatBatchStatusLabel(batch.status)"
      :severity="batchStatusSeverity(batch.status)"
      v-tooltip.top="timingHint"
    />

    <span class="tf-strip__count">{{ done }}/{{ batch.totalItems }}</span>

    <pv-progress-bar
      :value="batch.progressPercent"
      :show-value="false"
      class="tf-strip__bar"
    />

    <span class="tf-strip__counters">
      Nuevas {{ batch.finesCreated }} · Act. {{ batch.finesUpdated }} · Res. {{ batch.finesResolved }}
    </span>

    <pv-button
      v-if="failedItems.length"
      :label="`${failedItems.length} con problemas`"
      icon="pi pi-exclamation-triangle"
      severity="warn"
      text
      size="small"
      class="tf-strip__failures"
      @click="toggleFailures"
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

    <!--
      El detalle va en un panel flotante y no en un bloque desplegable: dentro del toolbar, un
      desplegable empujaría la tabla hacia abajo cada vez que se abre.
    -->
    <pv-popover ref="failuresPanel">
      <div class="tf-strip__panel">
        <p v-if="batch.errorMessage" class="tf-strip__error">{{ batch.errorMessage }}</p>
        <p v-else-if="batch.status === 'TIMED_OUT'" class="tf-strip__error">
          El servicio dejó de responder antes de terminar. Las unidades sin resultado conservan
          sus papeletas anteriores; puedes volver a consultarlas.
        </p>
        <div
          v-for="item in failedItems"
          :key="`${item.vehicleId}-${item.issuer}`"
          class="tf-strip__row"
        >
          <span class="tf-strip__plate">{{ item.licensePlate ?? '—' }}</span>
          <pv-tag :value="formatIssuerLabel(item.issuer)" severity="secondary" />
          <pv-tag
            :value="formatCheckStatusLabel(item.status)"
            :severity="checkStatusSeverity(item.status)"
          />
          <span v-if="item.errorMessage" class="tf-strip__reason">{{ item.errorMessage }}</span>
        </div>
      </div>
    </pv-popover>
  </div>
</template>

<style scoped>
/*
 * Los colores se fijan con las variables --text-body*, no con --text-color-secondary ni con las
 * clases text-NNN: esas vienen del tema de PrimeVue, calibrado para el layout oscuro, y sobre el
 * fondo claro del contenido quedan casi invisibles. Es el mismo criterio que vc-filters__label.
 */
.tf-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* Absorbe todo el hueco libre del toolbar; los botones conservan su tamaño. */
  flex: 1 1 auto;
  min-width: 0;
}

.tf-strip__count {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-body, #111827);
  white-space: nowrap;
}

.tf-strip__bar {
  flex: 1 1 6rem;
  min-width: 4rem;
  height: 0.5rem;
}

.tf-strip__counters {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
  white-space: nowrap;
}

.tf-strip__failures {
  flex-shrink: 0;
}

.tf-strip__panel {
  max-width: min(32rem, 90vw);
  max-height: 18rem;
  overflow-y: auto;
}

.tf-strip__error {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-body, #111827);
}

.tf-strip__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  flex-wrap: wrap;
}

.tf-strip__plate {
  font-weight: 700;
  letter-spacing: 0.04em;
  min-width: 5.5rem;
  color: var(--text-body, #111827);
}

.tf-strip__reason {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

/* En pantallas estrechas la tira ocupa su propia fila en vez de pelearse con los botones. */
@media (max-width: 767px) {
  .tf-strip {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }

  .tf-strip__counters {
    width: 100%;
  }
}

/*
 * Por debajo de 576px el DataManager pasa su barra secundaria a una rejilla de dos columnas, y
 * ahi `flex` ya no dice nada: hay que reservar la fila entera con grid-column.
 */
@media (max-width: 575px) {
  .tf-strip {
    grid-column: 1 / -1;
  }
}
</style>
