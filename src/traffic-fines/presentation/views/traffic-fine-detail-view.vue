<script setup>
/**
 * Papeletas de una unidad.
 *
 * La tarjeta de portales va **arriba de la tabla**, no debajo: una lista de papeletas vacía no
 * significa nada por sí sola —puede ser una unidad sin deuda o una cuyo portal falló— y quien
 * mira la pantalla tiene que ver esa distinción antes que los importes.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTrafficFinesStore } from '../../application/traffic-fines.store.js'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import ModuleStateFeedback from '@/shared/presentation/components/module-state-feedback.vue'
import { TRAFFIC_FINE_DETAIL_COLUMNS } from '../constants/traffic-fines-ui.constants.js'
import {
  checkStatusSeverity,
  formatCheckStatusLabel,
  formatIssuerLabel,
  formatSoles,
} from '../../domain/format-issuer-label.js'
import {
  formatCalendarDateForUi,
  formatDateTimeForUi,
} from '@/shared/domain/format-datetime-ui.js'

const route = useRoute()
const store = useTrafficFinesStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const columns = TRAFFIC_FINE_DETAIL_COLUMNS

const includeResolved = ref(false)
const exportLoading = ref(false)

const vehicleId = computed(() => route.params.vehicleId)
const detail = computed(() => store.detail)
const fines = computed(() => detail.value?.fines ?? [])

/** Identidad de la unidad para el encabezado: la placa, y el VIN cuando no hay placa. */
const identity = computed(() => {
  const plate = detail.value?.licensePlate
  return plate && plate.trim() ? plate : detail.value?.vin ?? '—'
})

function load() {
  return run(() => store.fetchVehicleDetail(vehicleId.value, includeResolved.value))
}

watch(includeResolved, load)

async function handleDownloadExport() {
  exportLoading.value = true
  try {
    const fileName = await store.downloadVehicleExport(vehicleId.value, includeResolved.value)
    showSuccess(`Archivo generado: ${fileName}`)
  } catch (e) {
    showError(humanizeApiError(e))
  } finally {
    exportLoading.value = false
  }
}

onMounted(load)
onUnmounted(() => store.clearDetail())
</script>

<template>
  <div class="tf-detail app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <ModuleStateFeedback
      v-if="error"
      :error="error?.message ?? null"
      @retry="load"
    />

    <template v-else>
      <!--
        Identidad, deuda y estado de los portales en una sola tarjeta de dos líneas. Estaban en
        dos tarjetas apiladas y se comían un tercio de la pantalla antes de que apareciera la
        primera papeleta, que es lo que se viene a ver.

        Lo que no se puede perder al compactar es la distinción entre «no debe nada» y «no se
        pudo consultar»: por eso el estado por portal sigue estando, aunque ahora en una línea.
      -->
      <div v-if="detail" class="tf-detail__header">
        <div class="tf-detail__row">
          <span class="tf-detail__plate">{{ identity }}</span>
          <span class="tf-detail__model">{{ detail.brand }} {{ detail.model }} {{ detail.year }}</span>
          <pv-tag v-if="detail.external" value="Externo" severity="danger" />
          <pv-tag
            v-if="!detail.consultable"
            value="No consultable"
            severity="warn"
            v-tooltip.top="'La placa no tiene el formato que acepta el servicio de consultas'"
          />
          <span class="tf-detail__totals">
            <span class="tf-detail__totals-label">Deuda pendiente</span>
            <span class="tf-detail__amount">{{ formatSoles(detail.totalAmountDue) }}</span>
            <span class="tf-detail__totals-label">({{ detail.pendingCount }})</span>
          </span>
        </div>

        <div class="tf-detail__row tf-detail__row--checks">
          <span class="tf-detail__checks-label">Última consulta</span>
          <span v-if="!detail.checks.length" class="tf-detail__never">
            sin consultar en ningún portal — la deuda es desconocida, no cero
          </span>
          <template v-else>
            <span
              v-for="check in detail.checks"
              :key="check.issuer"
              class="tf-detail__check"
            >
              <pv-tag :value="formatIssuerLabel(check.issuer)" severity="secondary" />
              <pv-tag
                :value="formatCheckStatusLabel(check.status)"
                :severity="checkStatusSeverity(check.status)"
                v-tooltip.top="check.errorMessage"
              />
              <span class="tf-detail__when">{{ formatDateTimeForUi(check.completedAt) }}</span>
            </span>
          </template>
        </div>
      </div>

      <DataManager
        :items="fines"
        :title="{ singular: 'papeleta', plural: 'papeletas' }"
        :columns="columns"
        :dynamic="true"
        :loading="isLoading"
        :rows="20"
        :show-global-search="false"
        :show-selection="false"
        :show-actions="false"
        :show-new="false"
        :show-delete="false"
        :show-export="false"
        :show-import="false"
      >
        <template #extra-actions>
          <div class="flex align-items-center gap-2 mr-2">
            <pv-toggle-switch v-model="includeResolved" input-id="tf-include-resolved" />
            <label for="tf-include-resolved" class="text-sm">Incluir resueltas</label>
          </div>
          <pv-button
            icon="pi pi-download"
            label="Exportar"
            severity="secondary"
            size="small"
            outlined
            :loading="exportLoading"
            class="dm-stoolbar-btn w-full sm:w-auto"
            @click="handleDownloadExport"
          />
        </template>

        <template #fine-issuer="{ data }">
          <pv-tag :value="formatIssuerLabel(data.issuer)" severity="secondary" />
        </template>

        <template #fine-ticket="{ data }">
          {{ data.displayTicketNumber }}
        </template>

        <template #fine-date="{ data }">
          <!--
            Cuando el portal no dio una fecha parseable se muestra su texto crudo. Perderlo sería
            tirar información que ya costó scraping y saldo de captcha.
          -->
          <span v-if="data.infractionDate">{{ formatCalendarDateForUi(data.infractionDate) }}</span>
          <span v-else-if="data.infractionDateRaw" class="tf-raw-date" :title="'Texto original del portal'">
            {{ data.infractionDateRaw }}
          </span>
          <span v-else>—</span>
        </template>

        <template #fine-total="{ data }">
          <span class="tf-amount">{{ formatSoles(data.totalAmount) }}</span>
        </template>

        <template #fine-discount="{ data }">
          <span class="tf-amount">{{ formatSoles(data.discountAmount) }}</span>
        </template>

        <template #fine-due="{ data }">
          <span class="tf-amount" :class="{ 'tf-amount--due': !data.isResolved && data.amountDue > 0 }">
            {{ formatSoles(data.amountDue) }}
          </span>
        </template>

        <template #fine-issuer-status="{ data }">
          <span class="tf-issuer-status">{{ data.issuerStatus ?? '—' }}</span>
        </template>

        <template #fine-status="{ data }">
          <pv-tag
            :value="data.isResolved ? 'Resuelta' : 'Pendiente'"
            :severity="data.isResolved ? 'success' : 'warn'"
            v-tooltip.top="data.isResolved && data.resolvedAt
              ? `Dejó de figurar en el portal el ${formatDateTimeForUi(data.resolvedAt)}`
              : null"
          />
        </template>
      </DataManager>
    </template>
  </div>
</template>

<style scoped>
/*
 * Los grises salen de --text-body-secondary y no de --text-color-secondary: esa última la define
 * el tema de PrimeVue para el layout oscuro y sobre el fondo claro del contenido queda casi
 * invisible. Es el mismo criterio que sigue vc-filters__label en el catálogo de vehículos.
 */
.tf-detail__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: var(--border-radius, 6px);
  background: var(--surface-0, #ffffff);
}

.tf-detail__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.tf-detail__row--checks {
  padding-top: 0.35rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}

.tf-detail__plate {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: var(--text-body, #111827);
}

.tf-detail__model {
  font-size: 0.875rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-detail__totals {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  white-space: nowrap;
}

.tf-detail__totals-label {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-detail__amount {
  font-weight: 700;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-body, #111827);
}

.tf-detail__checks-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-body-secondary, #6b7280);
}

.tf-detail__check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-detail__when,
.tf-detail__never {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-issuer-status {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-amount {
  font-variant-numeric: tabular-nums;
}

.tf-amount--due {
  font-weight: 700;
  color: var(--red-600, #dc2626);
}

.tf-raw-date {
  font-style: italic;
  color: var(--text-body-secondary, #6b7280);
}
</style>
