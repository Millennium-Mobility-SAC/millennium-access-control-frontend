<script setup>
/**
 * Papeletas de una unidad del inventario.
 *
 * La cabecera va **arriba de la tabla**: una lista vacía no significa nada por sí sola —puede ser
 * una unidad sin deuda o una cuyo portal falló— y quien mira la pantalla tiene que ver esa
 * distinción, y el periodo del contrato, antes que los importes.
 *
 * Las papeletas con fecha fuera del periodo del contrato van aparte y no suman: suelen ser de
 * quien tenía la unidad antes o después. Se muestran igual para poder discutirlas.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTrafficFinesStore } from '../../application/traffic-fines.store.js'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import ModuleStateFeedback from '@/shared/presentation/components/module-state-feedback.vue'
import TrafficFinesUnitEditDialog from '../components/traffic-fines-unit-edit-dialog.vue'
import { TRAFFIC_FINE_DETAIL_COLUMNS } from '../constants/traffic-fines-ui.constants.js'
import {
  TRAFFIC_FINE_ISSUERS,
  checkStatusSeverity,
  formatCheckStatusLabel,
  formatIssuerLabel,
  formatSoles,
  isMotoBrand,
} from '../../domain/format-issuer-label.js'
import {
  changeTypeSeverity,
  collectionStageSeverity,
  formatChangeTypeLabel,
  formatCollectionStageLabel,
} from '../../domain/format-collection-stage.js'
import { contractStatusSeverity, formatContractStatusLabel } from '../../domain/format-contract-status.js'
import { formatCalendarDateForUi, formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'

const route = useRoute()
const store = useTrafficFinesStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()

const columns = TRAFFIC_FINE_DETAIL_COLUMNS

const includeResolved = ref(false)
const exportLoading = ref(false)

const unitId = computed(() => route.params.unitId)
const detail = computed(() => store.detail)
const unit = computed(() => detail.value?.unit ?? null)
const fines = computed(() => detail.value?.fines ?? [])
const finesOutOfPeriod = computed(() => detail.value?.finesOutOfPeriod ?? [])

/**
 * Estado de cada portal, incluidos los que nunca se consultaron: un portal que falta en la lista
 * no es un portal sin deuda.
 */
const checksByIssuer = computed(() => {
  const checks = detail.value?.checks ?? []
  const moto = isMotoBrand(unit.value?.commercialBrand)
  return TRAFFIC_FINE_ISSUERS
    .filter((issuer) => !(moto && issuer.value === 'ATU'))
    .map((issuer) => ({
      issuer: issuer.value,
      check: checks.find((check) => check.issuer === issuer.value) ?? null,
    }))
})

const periodLabel = computed(() => {
  if (!unit.value) return '—'
  const start = formatCalendarDateForUi(unit.value.contractStart, 'sin inicio')
  const end = formatCalendarDateForUi(detail.value?.periodEnd, 'sin fin')
  return `${start} → ${end}`
})

function load() {
  return run(() => store.fetchUnitDetail(unitId.value, includeResolved.value))
}

watch(includeResolved, load)

async function handleDownloadExport() {
  exportLoading.value = true
  try {
    const fileName = await store.downloadUnitExport(unitId.value, includeResolved.value)
    showSuccess(`Archivo generado: ${fileName}`)
  } catch (e) {
    showError(humanizeApiError(e))
  } finally {
    exportLoading.value = false
  }
}

// ── Contrato ───────────────────────────────────────────────────────────────
const editVisible = ref(false)

async function handleUnitSaved() {
  showSuccess('Contrato actualizado. Las papeletas se reclasificaron según el nuevo periodo.')
  await load()
}

// ── Historial de una papeleta ──────────────────────────────────────────────
const historyPanel = ref(null)
const historyFine = ref(null)

function toggleHistory(event, fine) {
  historyFine.value = fine
  historyPanel.value?.toggle(event)
}

function changeSummary(change) {
  const parts = []
  if (change.previousAmountDue !== change.newAmountDue) {
    parts.push(`${formatSoles(change.previousAmountDue)} → ${formatSoles(change.newAmountDue)}`)
  }
  if (change.previousStage !== change.newStage) {
    parts.push(`${formatCollectionStageLabel(change.previousStage)} → ${formatCollectionStageLabel(change.newStage)}`)
  } else if (change.previousIssuerStatus !== change.newIssuerStatus) {
    parts.push(`${change.previousIssuerStatus ?? '—'} → ${change.newIssuerStatus ?? '—'}`)
  }
  return parts.join(' · ')
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
      <div v-if="detail && unit" class="tf-detail__header">
        <div class="tf-detail__row">
          <span class="tf-detail__plate">{{ unit.licensePlate }}</span>
          <span v-if="unit.hasDifferentRawPlate" class="tf-detail__muted">({{ unit.licensePlateRaw }})</span>
          <span class="tf-detail__muted">{{ unit.commercialBrand || 'Sin marca comercial' }}</span>
          <span v-if="unit.advisor" class="tf-detail__muted">· {{ unit.advisor }}</span>
          <span class="tf-detail__totals">
            <span class="tf-detail__totals-label">Deuda en el periodo</span>
            <span class="tf-detail__amount">{{ formatSoles(detail.totalAmountDue) }}</span>
            <span class="tf-detail__totals-label">({{ detail.pendingCount }})</span>
            <pv-tag
              v-if="detail.worstStage"
              :value="formatCollectionStageLabel(detail.worstStage)"
              :severity="collectionStageSeverity(detail.worstStage)"
            />
          </span>
        </div>

        <div class="tf-detail__row tf-detail__row--separated">
          <span class="tf-detail__section-label">Contrato</span>
          <pv-tag
            :value="formatContractStatusLabel(unit.contractStatus)"
            :severity="contractStatusSeverity(unit.contractStatus)"
          />
          <span class="tf-detail__text">{{ periodLabel }}</span>
          <span v-if="unit.resolutionDate" class="tf-detail__muted">
            termina en la resolución (fin de contrato {{ formatCalendarDateForUi(unit.contractEnd, 'sin fecha') }})
          </span>
          <span v-if="!detail.hasCompleteContractDates" class="tf-detail__warn">
            <i class="pi pi-exclamation-triangle" /> faltan fechas: el extremo que falta queda abierto
          </span>
          <pv-button
            label="Corregir contrato"
            icon="pi pi-pencil"
            size="small"
            text
            class="tf-detail__edit"
            @click="editVisible = true"
          />
        </div>

        <div class="tf-detail__row tf-detail__row--separated">
          <span class="tf-detail__section-label">Última consulta</span>
          <span
            v-for="entry in checksByIssuer"
            :key="entry.issuer"
            class="tf-detail__check"
          >
            <pv-tag :value="formatIssuerLabel(entry.issuer)" severity="secondary" />
            <template v-if="entry.check">
              <pv-tag
                :value="formatCheckStatusLabel(entry.check.status)"
                :severity="checkStatusSeverity(entry.check.status)"
                v-tooltip.top="entry.check.errorMessage"
              />
              <span class="tf-detail__muted">{{ formatDateTimeForUi(entry.check.completedAt) }}</span>
            </template>
            <span v-else class="tf-detail__muted">sin consultar — deuda desconocida, no cero</span>
          </span>
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
          <span class="tf-detail__table-title">En el periodo del contrato</span>
          <div class="tf-detail__spacer" />
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
          <div class="tf-ticket">
            <span class="tf-ticket__number">{{ data.displayTicketNumber }}</span>
            <span v-if="data.offenderType" class="tf-detail__muted">{{ data.offenderType }}</span>
          </div>
        </template>

        <template #fine-code="{ data }">
          <span :class="{ 'tf-detail__muted': !data.infractionCode }">{{ data.infractionCode || '—' }}</span>
        </template>

        <template #fine-date="{ data }">
          <!--
            Cuando el portal no dio una fecha parseable se muestra su texto crudo. Esa papeleta
            cuenta como dentro del periodo: esconder deuda que quizá es del contrato es peor que
            mostrarla marcada.
          -->
          <span v-if="data.infractionDate">{{ formatCalendarDateForUi(data.infractionDate) }}</span>
          <span
            v-else
            class="tf-raw-date"
            v-tooltip.top="'Fecha ilegible en el portal: cuenta como dentro del periodo'"
          >
            {{ data.infractionDateRaw || '—' }}
          </span>
        </template>

        <template #fine-discount="{ data }">
          <span v-if="data.discountAmount == null" class="tf-detail__muted" v-tooltip.top="'El portal no informa descuento'">—</span>
          <span v-else class="tf-amount">{{ formatSoles(data.discountAmount) }}</span>
        </template>

        <template #fine-due="{ data }">
          <span class="tf-amount" :class="{ 'tf-amount--due': data.countsAsDebt && data.amountDue > 0 }">
            {{ formatSoles(data.amountDue) }}
          </span>
        </template>

        <template #fine-issuer-status="{ data }">
          <span class="tf-detail__muted">{{ data.issuerStatus ?? '—' }}</span>
        </template>

        <template #fine-stage="{ data }">
          <pv-tag
            :value="formatCollectionStageLabel(data.collectionStage)"
            :severity="collectionStageSeverity(data.collectionStage)"
          />
        </template>

        <template #fine-status="{ data }">
          <pv-tag
            :value="data.isResolved ? 'Resuelta' : 'Pendiente'"
            :severity="data.isResolved ? 'success' : 'warn'"
            v-tooltip.top="data.isResolved && data.resolvedAt
              ? `Dejó de figurar en el portal el ${formatDateTimeForUi(data.resolvedAt)}`
              : data.reopenedAt ? `Reapareció el ${formatDateTimeForUi(data.reopenedAt)}` : null"
          />
        </template>

        <template #fine-changes="{ data }">
          <pv-button
            v-if="data.changes.length"
            :label="String(data.changes.length)"
            icon="pi pi-history"
            size="small"
            text
            v-tooltip.top="'Ver cambios'"
            @click="toggleHistory($event, data)"
          />
          <span v-else class="tf-detail__muted">—</span>
        </template>
      </DataManager>

      <!--
        Fuera del periodo: plegado por defecto. Son papeletas reales de la placa, pero no de este
        contrato, y no suman a la deuda.
      -->
      <pv-accordion v-if="finesOutOfPeriod.length" class="tf-out">
        <pv-accordion-panel value="out">
          <pv-accordion-header>
            <span class="tf-out__title">
              Fuera del periodo del contrato ({{ finesOutOfPeriod.length }}) — no suman a la deuda
            </span>
          </pv-accordion-header>
          <pv-accordion-content>
            <pv-data-table :value="finesOutOfPeriod" data-key="id" size="small" class="tf-out__table">
              <pv-column header="Emisor">
                <template #body="{ data }">{{ formatIssuerLabel(data.issuer) }}</template>
              </pv-column>
              <pv-column header="N.º papeleta">
                <template #body="{ data }">{{ data.displayTicketNumber }}</template>
              </pv-column>
              <pv-column header="Fecha infracción">
                <template #body="{ data }">{{ formatCalendarDateForUi(data.infractionDate) }}</template>
              </pv-column>
              <pv-column header="Deuda">
                <template #body="{ data }"><span class="tf-amount">{{ formatSoles(data.amountDue) }}</span></template>
              </pv-column>
              <pv-column header="Estado portal">
                <template #body="{ data }">{{ data.issuerStatus ?? '—' }}</template>
              </pv-column>
              <pv-column header="Etapa">
                <template #body="{ data }">
                  <pv-tag
                    :value="formatCollectionStageLabel(data.collectionStage)"
                    :severity="collectionStageSeverity(data.collectionStage)"
                  />
                </template>
              </pv-column>
            </pv-data-table>
          </pv-accordion-content>
        </pv-accordion-panel>
      </pv-accordion>
    </template>

    <pv-popover ref="historyPanel">
      <div v-if="historyFine" class="tf-history">
        <p class="tf-history__title">
          Cambios de {{ formatIssuerLabel(historyFine.issuer) }} {{ historyFine.displayTicketNumber }}
        </p>
        <div v-for="(change, index) in historyFine.changes" :key="index" class="tf-history__row">
          <div class="tf-history__head">
            <pv-tag :value="formatChangeTypeLabel(change.changeType)" :severity="changeTypeSeverity(change.changeType)" />
            <span class="tf-detail__muted">{{ formatDateTimeForUi(change.changedAt) }}</span>
          </div>
          <div v-if="changeSummary(change)" class="tf-history__text">{{ changeSummary(change) }}</div>
        </div>
      </div>
    </pv-popover>

    <TrafficFinesUnitEditDialog
      v-model:visible="editVisible"
      :unit="unit"
      @saved="handleUnitSaved"
    />
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

.tf-detail__row--separated {
  padding-top: 0.35rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}

.tf-detail__plate {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: var(--text-body, #111827);
}

.tf-detail__text {
  font-size: 0.875rem;
  color: var(--text-body, #111827);
}

.tf-detail__muted {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-detail__warn {
  font-size: 0.8125rem;
  color: var(--orange-600, #ea580c);
}

.tf-detail__totals {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
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

.tf-detail__section-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-body-secondary, #6b7280);
}

.tf-detail__edit {
  margin-left: auto;
}

.tf-detail__check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-detail__table-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-body, #111827);
}

.tf-detail__spacer {
  flex: 1 1 auto;
}

.tf-ticket {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tf-ticket__number {
  font-family: monospace;
  font-size: 0.8125rem;
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

.tf-out {
  margin-top: 0.75rem;
}

.tf-out__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-body, #111827);
}

.tf-history {
  width: min(24rem, 90vw);
  max-height: 20rem;
  overflow-y: auto;
}

.tf-history__title {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-body, #111827);
}

.tf-history__row {
  padding: 0.4rem 0;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}

.tf-history__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tf-history__text {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-body, #111827);
}

@media (max-width: 575px) {
  .tf-detail__spacer,
  .tf-detail__table-title {
    display: none;
  }
}
</style>
