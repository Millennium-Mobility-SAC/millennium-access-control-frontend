<script setup>
/**
 * Papeletas: el inventario de unidades con su deuda.
 *
 * El inventario se carga desde el Excel de contratos y es propio del módulo, no el catálogo de
 * vehículos de la planta. La tabla lista **todas** las unidades, deban o no: es también desde
 * donde se eligen las que se consultan.
 *
 * La deuda solo cuenta papeletas pendientes con fecha dentro del periodo del contrato; eso lo
 * resuelve el backend. Callao y ATU se consultan por placa («Consultar»); SAT Lima para toda la
 * flota por el RUC de la empresa («Actualizar SAT»). Las dos consultas pueden correr a la vez y
 * cada una tiene su propia tira de avance.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { BATCH_KINDS, useTrafficFinesStore } from '../../application/traffic-fines.store.js'
import { useTrafficFinesInventoryStore } from '../../application/traffic-fines-inventory.store.js'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import TrafficFinesBatchProgress from '../components/traffic-fines-batch-progress.vue'
import TrafficFinesLaunchDialog from '../components/traffic-fines-launch-dialog.vue'
import TrafficFinesInventoryImportDialog from '../components/traffic-fines-inventory-import-dialog.vue'
import TrafficFinesUnitEditDialog from '../components/traffic-fines-unit-edit-dialog.vue'
import TrafficFinesDeliveriesDialog from '../components/traffic-fines-deliveries-dialog.vue'
import {
  TRAFFIC_FINE_SORTS,
  TRAFFIC_FINE_STATE_FILTERS,
  TRAFFIC_FINE_SUMMARY_COLUMNS,
} from '../constants/traffic-fines-ui.constants.js'
import {
  TRAFFIC_FINE_ISSUERS,
  formatCheckStatusLabel,
  formatIssuerLabel,
  formatSoles,
} from '../../domain/format-issuer-label.js'
import {
  CAUTELAR_STAGE,
  COLLECTION_STAGES,
  collectionStageSeverity,
  formatCollectionStageLabel,
} from '../../domain/format-collection-stage.js'
import {
  CONTRACT_STATUSES,
  contractStatusSeverity,
  formatContractStatusLabel,
} from '../../domain/format-contract-status.js'
import { formatCalendarDateForUi, formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'
import { TRAFFIC_FINE_ROUTE_NAMES } from '../traffic-fines.routes.js'

const router = useRouter()
const confirm = useConfirm()
const store = useTrafficFinesStore()
const inventoryStore = useTrafficFinesInventoryStore()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError, showWarning } = useNotification()

const columns = TRAFFIC_FINE_SUMMARY_COLUMNS

/** Los mensajes de estos flujos ya vienen redactados para el usuario desde el backend. */
function errorText(e) {
  const message = e?.response?.data?.message
  return typeof message === 'string' && message.trim() ? message : humanizeApiError(e)
}

// ── Filtros ────────────────────────────────────────────────────────────────
const searchText = ref('')
const filterContractStatuses = ref([])
const filterIssuers = ref([])
const filterAdvisor = ref(null)
const filterBrand = ref(null)
const filterState = ref(null)
const filterStage = ref(null)
const filterSort = ref('plate')

const hasActiveFilters = computed(() => !!searchText.value.trim()
  || filterContractStatuses.value.length > 0
  || filterIssuers.value.length > 0
  || !!filterAdvisor.value
  || !!filterBrand.value
  || !!filterState.value
  || !!filterStage.value)

function buildFilters() {
  return {
    search: searchText.value.trim() || undefined,
    contractStatuses: filterContractStatuses.value.length ? [...filterContractStatuses.value] : undefined,
    issuers: filterIssuers.value.length ? [...filterIssuers.value] : undefined,
    advisor: filterAdvisor.value || undefined,
    commercialBrand: filterBrand.value || undefined,
    hasFines: filterState.value === 'with_fines'
      ? true
      : filterState.value === 'without_fines' ? false : undefined,
    neverChecked: filterState.value === 'never_checked' ? true : undefined,
    stage: filterStage.value ?? undefined,
    sort: filterSort.value ?? undefined,
  }
}

/** El error se muestra: una tabla vacía por un fallo de red se leería como «inventario vacío». */
async function reload() {
  await run(() => store.fetchSummary(buildFilters()), {
    errorMessage: 'No se pudo cargar el inventario de papeletas.',
  })
  if (error.value) showError(error.value.message)
}

watch(
  [filterContractStatuses, filterIssuers, filterAdvisor, filterBrand, filterState, filterStage, filterSort],
  reload,
  { deep: true },
)

let _searchTimer = null
watch(searchText, () => {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(reload, 350)
})

function clearAllFilters() {
  searchText.value = ''
  filterContractStatuses.value = []
  filterIssuers.value = []
  filterAdvisor.value = null
  filterBrand.value = null
  filterState.value = null
  filterStage.value = null
  filterSort.value = 'plate'
}

function showCautelarOnly() {
  filterStage.value = CAUTELAR_STAGE
}

async function handlePageChange({ page }) {
  await run(() => store.goToPage(page))
  if (error.value) showError(error.value.message)
}

// ── Consultar Callao y ATU ─────────────────────────────────────────────────
const launchDialogVisible = ref(false)
const launchMode = ref('selected')
const launchLoading = ref(false)
const selectedForLaunch = ref([])
/** Se guarda para poder vaciar la tabla desde fuera del slot cuando la consulta se acepta. */
let _clearTableSelection = null

function openLaunchDialog(selectedItems, clearSelection) {
  if (!selectedItems?.length) {
    showWarning('Selecciona al menos una unidad para consultar.')
    return
  }
  launchMode.value = 'selected'
  selectedForLaunch.value = [...selectedItems]
  _clearTableSelection = clearSelection
  launchDialogVisible.value = true
}

function openLaunchAllDialog() {
  launchMode.value = 'all'
  selectedForLaunch.value = []
  _clearTableSelection = null
  launchDialogVisible.value = true
}

async function handleLaunch({ unitIds, all, issuers }) {
  launchLoading.value = true
  try {
    const result = await store.launchQuery({ unitIds, all, issuers })
    launchDialogVisible.value = false
    _clearTableSelection?.()
    selectedForLaunch.value = []
    const units = result.requestedUnits
    showSuccess(`Consulta encolada para ${units} ${units === 1 ? 'unidad' : 'unidades'}.`)
    // Las omitidas se avisan aparte: callarlas haría creer que la selección entera está cubierta.
    if (result.skipped.length) {
      const listed = result.skipped.slice(0, 10)
        .map((item) => `${item.licensePlate ?? `#${item.unitId}`} (${item.reason})`).join('; ')
      const more = result.skipped.length > listed.length ? '…' : ''
      showWarning(`${result.skipped.length} ${result.skipped.length === 1 ? 'unidad omitida' : 'unidades omitidas'}: ${listed}${more}`)
    }
  } catch (e) {
    showError(errorText(e))
  } finally {
    launchLoading.value = false
  }
}

// ── Actualizar SAT ─────────────────────────────────────────────────────────
const satLoading = ref(false)

/** Se pregunta: consulta el portal para toda la flota y gasta captcha aunque no haya cambios. */
function confirmSatRefresh() {
  confirm.require({
    header: 'Actualizar SAT Lima',
    message: 'Se consultarán las papeletas de SAT Lima de todo el inventario con el RUC de la empresa. '
      + 'Tarda unos minutos y corre en segundo plano: puedes seguir usando la pantalla.',
    icon: 'pi pi-refresh',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Actualizar SAT', severity: 'success' },
    accept: handleSatRefresh,
    reject: () => {},
  })
}

async function handleSatRefresh() {
  satLoading.value = true
  try {
    const result = await store.refreshSat()
    showSuccess(`Actualización de SAT Lima lanzada para ${result.requestedUnits} unidades.`)
  } catch (e) {
    showError(errorText(e))
  } finally {
    satLoading.value = false
  }
}

// ── Cancelación ────────────────────────────────────────────────────────────
const cancellingKind = ref(null)

async function handleCancel(kind) {
  cancellingKind.value = kind
  try {
    await store.cancelBatch(kind)
    showSuccess('Consulta cancelada. Ya puedes lanzar otra.')
  } catch (e) {
    showError(errorText(e))
  } finally {
    cancellingKind.value = null
  }
}

// ── Inventario ─────────────────────────────────────────────────────────────
const importVisible = ref(false)

async function handleImported(result) {
  const added = result.newCount === 1 ? '1 unidad agregada' : `${result.newCount} unidades agregadas`
  showSuccess(`${added} al inventario.`)
  // Lo que no entró se avisa aparte: callarlo haría creer que el archivo entero está cubierto.
  if (result.rejectedCount) {
    showWarning(`${result.rejectedCount} ${result.rejectedCount === 1 ? 'fila rechazada' : 'filas rechazadas'}. `
      + 'Corrígelas en el Excel y vuelve a subirlo.')
  }
  // Las unidades nuevas pueden traer asesores y marcas que los filtros todavía no ofrecen.
  inventoryStore.fetchFacets().catch(() => {})
  await reload()
}

const historyPanel = ref(null)
const historyLoading = ref(false)

async function toggleHistory(event) {
  historyPanel.value?.toggle(event)
  historyLoading.value = true
  try {
    await inventoryStore.fetchImports()
  } catch {
    showError('No se pudo cargar el historial de importaciones.')
  } finally {
    historyLoading.value = false
  }
}

const editVisible = ref(false)
const unitToEdit = ref(null)

function openEdit(item) {
  unitToEdit.value = item
  editVisible.value = true
}

async function handleUnitSaved(unit) {
  showSuccess(`Contrato de ${unit.licensePlate} actualizado.`)
  await run(() => store.refreshCurrentPage())
}

// ── Descargas de papeletas ─────────────────────────────────────────────────
const deliveryLoading = ref(false)
const deliveriesVisible = ref(false)

const pendingLabel = computed(() => {
  const total = store.pendingDeliveries.total
  return total ? `Descargar nuevas (${total})` : 'Descargar nuevas'
})

/** Los filtros que sí se aplican a la descarga, en palabras, para el aviso de confirmación. */
function deliveryFiltersText() {
  const parts = []
  if (filterAdvisor.value) parts.push(`asesor ${filterAdvisor.value}`)
  if (filterBrand.value) parts.push(`marca ${filterBrand.value}`)
  if (filterIssuers.value.length) parts.push(`portal ${filterIssuers.value.map(formatIssuerLabel).join(', ')}`)
  if (filterContractStatuses.value.length) {
    parts.push(`contrato ${filterContractStatuses.value.map(formatContractStatusLabel).join(', ')}`)
  }
  if (searchText.value.trim()) parts.push(`búsqueda «${searchText.value.trim()}»`)
  return parts.join(' · ')
}

/**
 * «Nuevas» es para todos: lo que se baje aquí deja de salir como nuevo a cualquiera. Por eso se
 * pregunta, con el desglose y los filtros a la vista. Sin nada pendiente no se pregunta: el
 * backend responde quién se llevó lo último y cuándo.
 */
function confirmDeliverNew() {
  const pending = store.pendingDeliveries
  if (!pending.total) {
    deliver('NEW_ONLY')
    return
  }
  const parts = [`${pending.newCount} ${pending.newCount === 1 ? 'nueva' : 'nuevas'}`]
  if (pending.changedCount) parts.push(`${pending.changedCount} con cambios desde su última entrega`)
  if (pending.reappearedCount) parts.push(`${pending.reappearedCount} que reaparecieron`)
  const filters = deliveryFiltersText()
  const ignored = filterState.value || filterStage.value
    ? ' Los filtros de situación y etapa no se aplican a la descarga.'
    : ''
  confirm.require({
    header: 'Descargar papeletas nuevas',
    message: `Se entregarán ${pending.total} ${pending.total === 1 ? 'papeleta' : 'papeletas'} (${parts.join(', ')})`
      + `${filters ? ` con ${filters}` : ' de todo el inventario'}. Quedarán como entregadas para todos: `
      + `no volverán a salir como nuevas salvo que cambien.${ignored}`,
    icon: 'pi pi-download',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Descargar', severity: 'success' },
    accept: () => deliver('NEW_ONLY'),
    reject: () => {},
  })
}

/**
 * Registra la descarga y baja el archivo. Son dos pasos a propósito: si el archivo fallara, la
 * descarga ya está registrada y se puede volver a bajar desde el historial, sin perder nada.
 */
async function deliver(kind) {
  deliveryLoading.value = true
  try {
    const result = await store.createDelivery(kind)
    if (!result.created) {
      const last = result.lastDelivery
      showWarning(last
        ? `No hay papeletas nuevas. La última descarga fue la #${last.number}`
          + `${last.deliveredBy ? `, de ${last.deliveredBy},` : ''} el ${formatDateTimeForUi(last.deliveredAt)}. `
          + 'Puedes volver a bajarla desde el historial.'
        : 'No hay papeletas para descargar con estos filtros.')
      return
    }
    try {
      const fileName = await store.downloadDelivery(result.delivery)
      showSuccess(`Descarga #${result.delivery.number}: ${result.delivery.itemCount} papeletas en ${fileName}`)
    } catch {
      showWarning(`La descarga #${result.delivery.number} quedó registrada pero el archivo no se pudo bajar. `
        + 'Vuelve a bajarla desde el historial.')
      deliveriesVisible.value = true
    }
  } catch (e) {
    showError(errorText(e))
  } finally {
    deliveryLoading.value = false
  }
}

const downloadMenu = computed(() => [
  {
    label: 'Descargar todas las papeletas',
    icon: 'pi pi-list',
    command: () => deliver('ALL'),
  },
  {
    label: 'Exportar resumen por unidad',
    icon: 'pi pi-table',
    command: handleDownloadExport,
  },
  { separator: true },
  {
    label: 'Historial de descargas',
    icon: 'pi pi-history',
    command: () => { deliveriesVisible.value = true },
  },
])

// ── Exportación del resumen ────────────────────────────────────────────────

async function handleDownloadExport() {
  deliveryLoading.value = true
  try {
    const fileName = await store.downloadSummaryExport()
    showSuccess(`Archivo generado: ${fileName}`)
  } catch (e) {
    showError(humanizeApiError(e))
  } finally {
    deliveryLoading.value = false
  }
}

// ── Navegación ─────────────────────────────────────────────────────────────
function goToDetail(item) {
  if (item?.unitId == null) return
  router.push({
    name: TRAFFIC_FINE_ROUTE_NAMES.DETAIL,
    params: { unitId: String(item.unitId) },
  })
}

// ── Presentación ───────────────────────────────────────────────────────────
const isInventoryEmpty = computed(
  () => !isLoading.value && !error.value && !hasActiveFilters.value && store.pagination.totalElements === 0,
)

/** Una consulta fallida del portal: el importe de esa columna no es fiable. */
function failedCheck(row, issuer) {
  const check = row.checkFor(issuer)
  return check && !check.succeeded ? check : null
}

function failedCheckTooltip(check) {
  return `${formatCheckStatusLabel(check.status)}${check.errorMessage ? `: ${check.errorMessage}` : ''}`
}

/** Texto del icono de aviso: dice qué portal falló, no solo que algo falló. */
function checkErrorsTooltip(row) {
  return row.checks
    .filter((check) => !check.succeeded)
    .map((check) => `${formatIssuerLabel(check.issuer)}: ${formatCheckStatusLabel(check.status)}`)
    .join(' · ')
}

function periodLabel(row) {
  if (!row.contractStart && !row.periodEnd) return 'Sin fechas de contrato'
  return `${formatCalendarDateForUi(row.contractStart, '…')} → ${formatCalendarDateForUi(row.periodEnd, '…')}`
}

onMounted(async () => {
  // Los filtros de asesor y marca pueden quedar vacíos si esto falla; la tabla no depende de ellos.
  inventoryStore.fetchFacets().catch(() => {})
  await reload()
  // Los lotes siguen corriendo en el servidor aunque se cierre el navegador: al volver se
  // recuperan y, si no han terminado, el sondeo se reanuda solo.
  await store.resumePolling()
})

onUnmounted(() => {
  store.stopPolling()
})
</script>

<template>
  <div class="tf-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <!--
      La alerta cuenta todo el inventario, no la página ni los filtros: una medida cautelar suele
      ser orden de captura, y no puede quedar escondida porque alguien filtró otra cosa.
    -->
    <pv-message
      v-if="store.cautelarCount > 0"
      severity="error"
      :closable="false"
      class="tf-alert"
    >
      <div class="tf-alert__body">
        <i class="pi pi-exclamation-circle" />
        <span>
          <strong>{{ store.cautelarCount }}</strong>
          {{ store.cautelarCount === 1 ? 'unidad tiene' : 'unidades tienen' }}
          papeletas en medida cautelar.
        </span>
        <pv-button
          v-if="filterStage !== CAUTELAR_STAGE"
          label="Ver"
          size="small"
          severity="danger"
          text
          @click="showCautelarOnly"
        />
      </div>
    </pv-message>

    <pv-message v-if="isInventoryEmpty" severity="info" :closable="false" class="tf-alert">
      <div class="tf-alert__body">
        <span>El inventario está vacío. Importa el Excel de contratos para empezar a consultar papeletas.</span>
        <pv-button label="Importar Excel" icon="pi pi-upload" size="small" @click="importVisible = true" />
      </div>
    </pv-message>

    <!-- Una tira por consulta en curso: Callao/ATU y SAT pueden correr a la vez. -->
    <div v-if="store.platesBatch || store.satBatch" class="tf-batches">
      <TrafficFinesBatchProgress
        v-if="store.platesBatch"
        :batch="store.platesBatch"
        label="Callao / ATU"
        :cancelling="cancellingKind === BATCH_KINDS.PLATES"
        @dismissed="store.clearBatch(BATCH_KINDS.PLATES)"
        @cancel-requested="handleCancel(BATCH_KINDS.PLATES)"
      />
      <TrafficFinesBatchProgress
        v-if="store.satBatch"
        :batch="store.satBatch"
        label="SAT Lima"
        :cancelling="cancellingKind === BATCH_KINDS.SAT_RUC"
        @dismissed="store.clearBatch(BATCH_KINDS.SAT_RUC)"
        @cancel-requested="handleCancel(BATCH_KINDS.SAT_RUC)"
      />
    </div>

    <DataManager
      :items="store.summary"
      :total-records="store.pagination.totalElements"
      :rows="20"
      :lazy="true"
      :title="{ singular: 'unidad', plural: 'unidades' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      :show-global-search="false"
      :show-new="false"
      :show-delete="false"
      :show-export="false"
      :show-import="false"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver papeletas"
      :show-edit-action="true"
      edit-button-label="Corregir contrato"
      :show-delete-action="false"
      @view-item-requested-manager="goToDetail"
      @edit-item-requested-manager="openEdit"
      @clear-filters="clearAllFilters"
      @page-changed="handlePageChange"
    >
      <template #extra-actions="{ selectedItems, clearSelection }">
        <pv-button
          icon="pi pi-search"
          :label="selectedItems.length ? `Consultar (${selectedItems.length})` : 'Consultar'"
          severity="success"
          size="small"
          :disabled="!selectedItems.length || store.isPlatesBatchRunning"
          v-tooltip.top="store.isPlatesBatchRunning ? 'Ya hay una consulta de Callao / ATU en curso' : 'Callao y ATU de las unidades seleccionadas'"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="openLaunchDialog(selectedItems, clearSelection)"
        />
        <pv-button
          icon="pi pi-list-check"
          label="Consultar todas"
          severity="success"
          size="small"
          outlined
          :disabled="store.isPlatesBatchRunning || isInventoryEmpty"
          v-tooltip.top="store.isPlatesBatchRunning ? 'Ya hay una consulta de Callao / ATU en curso' : 'Activas y de periodo recién terminado, las más antiguas primero'"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="openLaunchAllDialog"
        />
        <pv-button
          icon="pi pi-refresh"
          label="Actualizar SAT"
          severity="info"
          size="small"
          outlined
          :loading="satLoading"
          :disabled="store.isSatBatchRunning || isInventoryEmpty"
          v-tooltip.top="store.isSatBatchRunning ? 'Ya hay una actualización de SAT en curso' : 'SAT Lima de toda la flota por el RUC de la empresa'"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="confirmSatRefresh"
        />
        <div class="tf-toolbar-spacer" />
        <!--
          Descargar nuevas es la acción de todos los días; descargar todas, el resumen por unidad y
          el historial van en el menú para no llenar la barra.
        -->
        <pv-split-button
          :label="pendingLabel"
          icon="pi pi-download"
          :model="downloadMenu"
          size="small"
          :disabled="deliveryLoading || isInventoryEmpty"
          v-tooltip.top="'Papeletas nuevas, con cambios o reaparecidas desde su última entrega, con los filtros de la tabla'"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="confirmDeliverNew"
        />
        <pv-button
          icon="pi pi-upload"
          label="Importar Excel"
          severity="secondary"
          size="small"
          outlined
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="importVisible = true"
        />
        <pv-button
          icon="pi pi-history"
          severity="secondary"
          size="small"
          outlined
          aria-label="Historial de importaciones"
          v-tooltip.top="'Historial de importaciones'"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="toggleHistory"
        />
      </template>

      <template #filters="{ clearFilters }">
        <div class="tf-filters w-full">
          <pv-icon-field class="tf-filters__search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por placa, asesor o marca comercial"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>

          <pv-multi-select
            v-model="filterContractStatuses"
            :options="CONTRACT_STATUSES"
            option-label="label"
            option-value="value"
            placeholder="Contrato"
            :max-selected-labels="1"
            selected-items-label="{0} estados"
            class="tf-filters__control"
            aria-label="Estado de contrato"
          />

          <pv-select
            v-model="filterAdvisor"
            :options="inventoryStore.facets.advisors"
            placeholder="Asesor"
            filter
            show-clear
            class="tf-filters__control"
            aria-label="Asesor"
          />

          <pv-select
            v-model="filterBrand"
            :options="inventoryStore.facets.commercialBrands"
            placeholder="Marca comercial"
            filter
            show-clear
            class="tf-filters__control"
            aria-label="Marca comercial"
          />

          <pv-multi-select
            v-model="filterIssuers"
            :options="TRAFFIC_FINE_ISSUERS"
            option-label="label"
            option-value="value"
            placeholder="Portal"
            :max-selected-labels="1"
            selected-items-label="{0} portales"
            class="tf-filters__control"
            aria-label="Portal"
          />

          <pv-select
            v-model="filterState"
            :options="TRAFFIC_FINE_STATE_FILTERS"
            option-label="label"
            option-value="value"
            placeholder="Situación"
            show-clear
            class="tf-filters__control"
            aria-label="Situación"
          />

          <pv-select
            v-model="filterStage"
            :options="COLLECTION_STAGES.filter((stage) => stage.value !== 'CERRADA')"
            option-label="label"
            option-value="value"
            placeholder="Etapa"
            show-clear
            class="tf-filters__control"
            aria-label="Etapa de cobranza"
          />

          <pv-select
            v-model="filterSort"
            :options="TRAFFIC_FINE_SORTS"
            option-label="label"
            option-value="value"
            placeholder="Ordenar por"
            class="tf-filters__control"
            aria-label="Ordenar por"
          />

          <pv-button
            type="button"
            label="Limpiar"
            icon="pi pi-filter-slash"
            text
            size="small"
            class="tf-filters__clear"
            @click="clearFilters"
          />
        </div>
      </template>

      <template #fines-plate="{ data }">
        <div class="tf-plate-cell">
          <div class="tf-plate-cell__line">
            <span class="tf-plate">{{ data.licensePlate }}</span>
            <pv-tag
              v-if="data.isMoto"
              value="Moto"
              severity="secondary"
              v-tooltip.top="'Solo se consulta en Callao'"
            />
          </div>
          <span class="tf-sub" :title="data.hasDifferentRawPlate ? `En el Excel: ${data.licensePlateRaw}` : null">
            {{ data.commercialBrand || '—' }}
          </span>
        </div>
      </template>

      <template #fines-advisor="{ data }">
        <span :class="{ 'tf-dash': !data.advisor }">{{ data.advisor || '—' }}</span>
      </template>

      <template #fines-contract="{ data }">
        <div class="tf-contract-cell">
          <pv-tag
            :value="formatContractStatusLabel(data.contractStatus)"
            :severity="contractStatusSeverity(data.contractStatus)"
          />
          <span
            class="tf-sub"
            v-tooltip.top="data.periodEndsByResolution ? 'El periodo termina en la fecha de resolución' : null"
          >
            {{ periodLabel(data) }}<span v-if="data.periodEndsByResolution"> (res.)</span>
          </span>
        </div>
      </template>

      <template #fines-count="{ data }">
        <div class="tf-count-cell">
          <pv-tag
            :value="String(data.fineCount)"
            :severity="data.fineCount > 0 ? 'danger' : 'success'"
          />
          <!-- Dónde está lo que falta entregar, sin tener que descargar para saberlo. -->
          <span
            v-if="data.undeliveredCount"
            class="tf-undelivered"
            v-tooltip.top="'Nuevas, con cambios o reaparecidas desde su última entrega'"
          >
            {{ data.undeliveredCount }} por entregar
          </span>
        </div>
      </template>

      <template #fines-amount="{ data }">
        <span class="tf-amount" :class="{ 'tf-amount--due': data.totalAmountDue > 0 }">
          {{ formatSoles(data.totalAmountDue) }}
        </span>
      </template>

      <template #fines-callao="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('CALLAO').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'CALLAO')"
            class="pi pi-exclamation-triangle text-orange-500"
            v-tooltip.top="failedCheckTooltip(failedCheck(data, 'CALLAO'))"
          />
        </span>
      </template>

      <template #fines-sat-lima="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('SAT_LIMA').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'SAT_LIMA')"
            class="pi pi-exclamation-triangle text-orange-500"
            v-tooltip.top="failedCheckTooltip(failedCheck(data, 'SAT_LIMA'))"
          />
        </span>
      </template>

      <template #fines-atu="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('ATU').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'ATU')"
            class="pi pi-exclamation-triangle text-orange-500"
            v-tooltip.top="failedCheckTooltip(failedCheck(data, 'ATU'))"
          />
        </span>
      </template>

      <template #fines-stage="{ data }">
        <pv-tag
          v-if="data.worstStage"
          :value="formatCollectionStageLabel(data.worstStage)"
          :severity="collectionStageSeverity(data.worstStage)"
          :icon="data.hasCautelar ? 'pi pi-exclamation-circle' : null"
        />
        <span v-else class="tf-dash">—</span>
      </template>

      <template #fines-last-check="{ data }">
        <div class="tf-last-check">
          <span v-if="data.lastCheckedAt">{{ formatDateTimeForUi(data.lastCheckedAt) }}</span>
          <span v-else class="tf-dash">Sin consultar</span>
          <!--
            El aviso es lo que impide leer un S/ 0.00 como "no debe nada" cuando en realidad el
            portal no respondió.
          -->
          <i
            v-if="data.hasCheckErrors"
            class="pi pi-exclamation-triangle text-orange-500"
            v-tooltip.top="checkErrorsTooltip(data)"
          />
        </div>
      </template>
    </DataManager>

    <pv-popover ref="historyPanel">
      <div class="tf-history">
        <p class="tf-history__title">Importaciones recientes</p>
        <div v-if="historyLoading" class="tf-history__empty">Cargando…</div>
        <div v-else-if="!inventoryStore.imports.length" class="tf-history__empty">
          Todavía no se importó ningún archivo.
        </div>
        <template v-else>
          <div v-for="record in inventoryStore.imports" :key="record.id" class="tf-history__row">
            <div class="tf-history__file">
              <i class="pi pi-file-excel" />
              <span :title="record.fileName">{{ record.fileName }}</span>
            </div>
            <div class="tf-history__meta">
              {{ formatDateTimeForUi(record.importedAt) }}<span v-if="record.importedBy"> · {{ record.importedBy }}</span>
            </div>
            <div class="tf-history__counts">
              {{ record.totalRows }} filas · {{ record.createdCount }} nuevas · {{ record.unchangedCount }} ya estaban
              <span v-if="record.differingCount"> · {{ record.differingCount }} con otros datos</span>
              <span v-if="record.rejectedCount"> · {{ record.rejectedCount }} rechazadas</span>
            </div>
          </div>
        </template>
      </div>
    </pv-popover>

    <TrafficFinesLaunchDialog
      v-model:visible="launchDialogVisible"
      :mode="launchMode"
      :selected="selectedForLaunch"
      :loading="launchLoading"
      @confirmed="handleLaunch"
    />

    <TrafficFinesInventoryImportDialog
      v-model:visible="importVisible"
      @imported="handleImported"
    />

    <TrafficFinesUnitEditDialog
      v-model:visible="editVisible"
      :unit="unitToEdit"
      @saved="handleUnitSaved"
    />

    <TrafficFinesDeliveriesDialog v-model:visible="deliveriesVisible" />
  </div>
</template>

<style scoped>
/*
 * Los grises salen de --text-body-secondary, no de --text-color-secondary: esa última la define
 * el tema de PrimeVue para el layout oscuro y sobre el fondo claro del contenido queda casi
 * invisible. Es el mismo criterio que sigue vc-filters__label en el catálogo de vehículos.
 */
.tf-alert {
  margin-bottom: 0.5rem;
}

.tf-alert__body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tf-batches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: var(--border-radius, 6px);
  background: var(--surface-0, #ffffff);
}

/*
 * La barra secundaria del DataManager se encoge a su contenido y se pega a la derecha con
 * `margin-left: auto`. Aquí lleva dos grupos —consultar a la izquierda, inventario y export a la
 * derecha— y necesita la fila completa para que el separador los aparte.
 *
 * Va con `:deep` y acotado a esta vista: es un componente compartido por todos los módulos y el
 * comportamiento por defecto es el correcto para los que solo ponen botones.
 */
@media (min-width: 576px) {
  .tf-page :deep(.dm-secondary-toolbar__secondary) {
    flex: 1 1 100%;
    margin-left: 0;
  }

  .tf-page :deep(.dm-secondary-toolbar__secondary .p-button) {
    flex-shrink: 0;
  }
}

.tf-toolbar-spacer {
  flex: 1 1 auto;
}

/*
 * Búsqueda, filtros y botón en una sola fila. Se envuelven en pantallas estrechas en vez de
 * comprimirse hasta ser inservibles.
 */
.tf-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.tf-filters__search {
  flex: 2 1 14rem;
  min-width: 0;
}

.tf-filters__control {
  flex: 1 1 8.5rem;
  min-width: 0;
}

.tf-filters__clear {
  flex-shrink: 0;
}

.tf-plate-cell,
.tf-contract-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.tf-plate-cell__line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-plate {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tf-sub {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
  white-space: nowrap;
}

.tf-count-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.tf-undelivered {
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--blue-600, #2563eb);
}

.tf-amount {
  font-variant-numeric: tabular-nums;
}

.tf-amount--due {
  font-weight: 700;
  color: var(--red-600, #dc2626);
}

.tf-issuer-amount,
.tf-last-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: center;
}

.tf-dash {
  color: var(--text-body-secondary, #6b7280);
}

.tf-history {
  width: min(28rem, 90vw);
  max-height: 22rem;
  overflow-y: auto;
}

.tf-history__title {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-body, #111827);
}

.tf-history__empty {
  font-size: 0.8125rem;
  color: var(--text-body-secondary, #6b7280);
}

.tf-history__row {
  padding: 0.5rem 0;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}

.tf-history__file {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-body, #111827);
  min-width: 0;
}

.tf-history__file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tf-history__meta,
.tf-history__counts {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
}

@media (max-width: 575px) {
  .tf-toolbar-spacer {
    display: none;
  }
}
</style>
