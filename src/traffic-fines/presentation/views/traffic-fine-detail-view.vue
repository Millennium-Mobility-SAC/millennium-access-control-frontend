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
      <!-- Encabezado de la unidad -->
      <div v-if="detail" class="tf-detail__header surface-card border-round p-3 mb-3">
        <div class="flex flex-wrap align-items-center gap-3">
          <div class="tf-detail__identity">
            <span class="tf-detail__plate">{{ identity }}</span>
            <pv-tag v-if="detail.external" value="Externo" severity="danger" />
            <pv-tag
              v-if="!detail.consultable"
              value="No consultable"
              severity="warn"
              v-tooltip.top="'La placa no tiene el formato que acepta el servicio de consultas'"
            />
          </div>
          <span class="text-600">{{ detail.brand }} {{ detail.model }} {{ detail.year }}</span>
          <div class="tf-detail__totals ml-auto">
            <span class="text-600 text-sm mr-2">Deuda pendiente</span>
            <span class="tf-detail__amount">{{ formatSoles(detail.totalAmountDue) }}</span>
            <span class="text-600 text-sm ml-2">({{ detail.pendingCount }} pendientes)</span>
          </div>
        </div>
      </div>

      <!-- Última consulta por portal -->
      <div v-if="detail" class="tf-detail__checks surface-card border-round p-3 mb-3">
        <h3 class="mt-0 mb-2 text-base">Última consulta por portal</h3>
        <p v-if="!detail.checks.length" class="m-0 text-600">
          Esta unidad todavía no se ha consultado en ningún portal, así que su deuda es
          desconocida, no cero.
        </p>
        <div v-else class="flex flex-wrap gap-3">
          <div
            v-for="check in detail.checks"
            :key="check.issuer"
            class="tf-detail__check flex align-items-center gap-2"
          >
            <pv-tag :value="formatIssuerLabel(check.issuer)" severity="secondary" />
            <pv-tag
              :value="formatCheckStatusLabel(check.status)"
              :severity="checkStatusSeverity(check.status)"
            />
            <span class="text-600 text-sm">{{ formatDateTimeForUi(check.completedAt) }}</span>
            <span v-if="check.errorMessage" class="text-orange-600 text-sm">
              {{ check.errorMessage }}
            </span>
          </div>
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
          <span class="text-600 text-sm">{{ data.issuerStatus ?? '—' }}</span>
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
.tf-detail__header,
.tf-detail__checks {
  border: 1px solid var(--surface-border);
}

.tf-detail__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tf-detail__plate {
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
}

.tf-detail__amount {
  font-weight: 700;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
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
  color: var(--text-color-secondary);
}
</style>
