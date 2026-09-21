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
import TrafficFinesImportsDialog from '../components/traffic-fines-imports-dialog.vue'
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
      const shown = 10
      const listed = result.skipped.slice(0, shown)
        .map((item) => `${item.licensePlate ?? `#${item.unitId}`} (${item.reason})`).join('; ')
      const more = result.skipped.length > shown ? '…' : ''
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

const importsVisible = ref(false)
const inventoryMenuRef = ref(null)

const inventoryMenu = [
  {
    label: 'Historial de importaciones',
    icon: 'pi pi-history',
    command: () => { importsVisible.value = true },
  },
]

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
const downloadMenuRef = ref(null)

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
/** Evita que el estado vacío asome un instante antes de la primera carga. */
const loadedOnce = ref(false)

/**
 * Sin unidades no hay nada que filtrar, consultar ni descargar: en vez de la tabla vacía con toda
 * su barra de acciones deshabilitada, se muestra solo lo que se puede hacer, que es importar.
 */
const isInventoryEmpty = computed(
  () => loadedOnce.value && !isLoading.value && !error.value && !hasActiveFilters.value
    && store.pagination.totalElements === 0,
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
  loadedOnce.value = true
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

      No es un pv-message: su texto sale de --text-primary, el tinte claro del shell oscuro, y
      sobre el fondo del contenido no se lee.
    -->
    <div v-if="store.cautelarCount > 0" class="tf-alert tf-alert--danger" role="alert">
      <i class="pi pi-exclamation-circle tf-alert__icon" />
      <span class="tf-alert__text">
        <strong>{{ store.cautelarCount }}</strong>
        {{ store.cautelarCount === 1 ? 'unidad tiene' : 'unidades tienen' }}
        papeletas en medida cautelar.
      </span>
      <pv-button
        v-if="filterStage !== CAUTELAR_STAGE"
        label="Ver unidades"
        icon="pi pi-filter"
        size="small"
        severity="danger"
        text
        class="tf-alert__action"
        @click="showCautelarOnly"
      />
    </div>

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

    <!--
      Sin unidades no hay nada que filtrar, consultar ni descargar: en vez de la tabla vacía con la
      barra entera deshabilitada, solo lo que se puede hacer.
    -->
    <section v-if="isInventoryEmpty" class="tf-empty">
      <div class="tf-empty__icon"><i class="pi pi-file-import" /></div>
      <h2 class="tf-empty__title">Todavía no hay unidades en el inventario</h2>
      <p class="tf-empty__text">
        Importa el Excel de contratos para empezar a consultar papeletas. Necesita las columnas
        <strong>PLACA</strong> y <strong>ESTADO</strong>; marca comercial, asesor y las fechas de
        contrato y resolución son opcionales.
      </p>
      <div class="tf-empty__actions">
        <pv-button label="Importar Excel" icon="pi pi-upload" @click="importVisible = true" />
        <pv-button
          label="Historial de importaciones"
          icon="pi pi-history"
          severity="secondary"
          text
          @click="importsVisible = true"
        />
      </div>
    </section>

    <DataManager
      v-else
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
      <!--
        Dos grupos: a la izquierda lo que consulta los portales, a la derecha lo que entra y sale
        como archivo. Lo menos frecuente de cada archivo va en el menú de su botón.
      -->
      <template #extra-actions="{ selectedItems, clearSelection }">
        <!--
          Los tres con el mismo estilo; «Consultar» pasa a relleno cuando hay unidades
          seleccionadas, que es cuando se puede usar.
        -->
        <div class="tf-actions" role="group" aria-label="Consultas a los portales">
          <pv-button
            icon="pi pi-search"
            :label="selectedItems.length ? `Consultar (${selectedItems.length})` : 'Consultar'"
            size="small"
            :outlined="!selectedItems.length"
            :disabled="!selectedItems.length || store.isPlatesBatchRunning"
            v-tooltip.top="store.isPlatesBatchRunning
              ? 'Ya hay una consulta de Callao / ATU en curso'
              : selectedItems.length ? 'Callao y ATU de las unidades seleccionadas' : 'Selecciona unidades en la tabla'"
            class="dm-stoolbar-btn"
            @click="openLaunchDialog(selectedItems, clearSelection)"
          />
          <pv-button
            icon="pi pi-list-check"
            label="Consultar todas"
            size="small"
            outlined
            :disabled="store.isPlatesBatchRunning"
            v-tooltip.top="store.isPlatesBatchRunning
              ? 'Ya hay una consulta de Callao / ATU en curso'
              : 'Activas y de periodo recién terminado, las más antiguas primero'"
            class="dm-stoolbar-btn"
            @click="openLaunchAllDialog"
          />
          <pv-button
            icon="pi pi-refresh"
            label="Actualizar SAT"
            size="small"
            outlined
            :loading="satLoading"
            :disabled="store.isSatBatchRunning"
            v-tooltip.top="store.isSatBatchRunning
              ? 'Ya hay una actualización de SAT en curso'
              : 'SAT Lima de toda la flota por el RUC de la empresa'"
            class="dm-stoolbar-btn"
            @click="confirmSatRefresh"
          />
        </div>

        <div class="tf-toolbar-spacer" />

        <!--
          Botón con flecha pegada en vez de pv-split-button: los estilos globales de botones fijan
          relleno y bordes con !important, y con ellos la flecha del split quedaba en blanco y las
          dos mitades separadas.
        -->
        <div class="tf-actions" role="group" aria-label="Archivos">
          <div class="tf-split" role="group" aria-label="Descargar papeletas">
            <pv-button
              :label="pendingLabel"
              icon="pi pi-download"
              size="small"
              :loading="deliveryLoading"
              class="tf-split__main"
              v-tooltip.top="'Nuevas, con cambios o reaparecidas desde su última entrega, con los filtros de la tabla'"
              @click="confirmDeliverNew"
            />
            <pv-button
              icon="pi pi-chevron-down"
              size="small"
              :disabled="deliveryLoading"
              class="tf-split__toggle"
              aria-label="Más opciones de descarga"
              aria-haspopup="true"
              v-tooltip.top="'Más opciones de descarga'"
              @click="downloadMenuRef?.toggle($event)"
            />
          </div>
          <div class="tf-split" role="group" aria-label="Inventario">
            <pv-button
              label="Importar Excel"
              icon="pi pi-upload"
              severity="secondary"
              size="small"
              outlined
              class="tf-split__main"
              @click="importVisible = true"
            />
            <pv-button
              icon="pi pi-chevron-down"
              severity="secondary"
              size="small"
              outlined
              class="tf-split__toggle"
              aria-label="Más opciones del inventario"
              aria-haspopup="true"
              v-tooltip.top="'Más opciones del inventario'"
              @click="inventoryMenuRef?.toggle($event)"
            />
          </div>
        </div>
      </template>

      <!--
        Mismo esquema que el catálogo de vehículos: la búsqueda en su propia fila y debajo los
        filtros en rejilla, con su etiqueta encima y todos a la misma altura.
      -->
      <template #filters="{ clearFilters }">
        <div class="tf-filters">
          <pv-icon-field class="tf-filters__search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por placa, asesor o marca comercial"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>

          <div class="tf-filters__row">
            <div class="tf-filters__fields">
              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-contract">Contrato</label>
                <pv-multi-select
                  id="tf-filter-contract"
                  v-model="filterContractStatuses"
                  :options="CONTRACT_STATUSES"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} estados"
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-advisor">Asesor</label>
                <pv-select
                  id="tf-filter-advisor"
                  v-model="filterAdvisor"
                  :options="inventoryStore.facets.advisors"
                  placeholder="Todos"
                  filter
                  show-clear
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-brand">Marca comercial</label>
                <pv-select
                  id="tf-filter-brand"
                  v-model="filterBrand"
                  :options="inventoryStore.facets.commercialBrands"
                  placeholder="Todas"
                  filter
                  show-clear
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-issuers">Portal</label>
                <pv-multi-select
                  id="tf-filter-issuers"
                  v-model="filterIssuers"
                  :options="TRAFFIC_FINE_ISSUERS"
                  option-label="label"
                  option-value="value"
                  placeholder="Todos"
                  :max-selected-labels="1"
                  selected-items-label="{0} portales"
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-state">Situación</label>
                <pv-select
                  id="tf-filter-state"
                  v-model="filterState"
                  :options="TRAFFIC_FINE_STATE_FILTERS"
                  option-label="label"
                  option-value="value"
                  placeholder="Todas"
                  show-clear
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-stage">Etapa</label>
                <pv-select
                  id="tf-filter-stage"
                  v-model="filterStage"
                  :options="COLLECTION_STAGES.filter((stage) => stage.value !== 'CERRADA')"
                  option-label="label"
                  option-value="value"
                  placeholder="Todas"
                  show-clear
                />
              </div>

              <div class="tf-filters__field">
                <label class="tf-filters__label" for="tf-filter-sort">Ordenar por</label>
                <pv-select
                  id="tf-filter-sort"
                  v-model="filterSort"
                  :options="TRAFFIC_FINE_SORTS"
                  option-label="label"
                  option-value="value"
                />
              </div>
            </div>

            <pv-button
              type="button"
              label="Limpiar"
              icon="pi pi-filter-slash"
              text
              size="small"
              class="tf-filters__clear"
              :disabled="!hasActiveFilters && filterSort === 'plate'"
              @click="clearFilters"
            />
          </div>
        </div>
      </template>

      <template #fines-plate="{ data }">
        <div class="tf-cell">
          <div class="tf-cell__line">
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
        <span class="tf-advisor" :class="{ 'tf-dash': !data.advisor }" :title="data.advisor">
          {{ data.advisor || '—' }}
        </span>
      </template>

      <template #fines-contract="{ data }">
        <div class="tf-cell">
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

      <template #fines-amount="{ data }">
        <div class="tf-cell">
          <span class="tf-amount" :class="{ 'tf-amount--due': data.totalAmountDue > 0 }">
            {{ formatSoles(data.totalAmountDue) }}
          </span>
          <span class="tf-sub">
            {{ data.fineCount }} {{ data.fineCount === 1 ? 'papeleta' : 'papeletas' }}
          </span>
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

      <template #fines-callao="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('CALLAO').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'CALLAO')"
            class="pi pi-exclamation-triangle tf-warn-icon"
            v-tooltip.top="failedCheckTooltip(failedCheck(data, 'CALLAO'))"
          />
        </span>
      </template>

      <template #fines-sat-lima="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('SAT_LIMA').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'SAT_LIMA')"
            class="pi pi-exclamation-triangle tf-warn-icon"
            v-tooltip.top="failedCheckTooltip(failedCheck(data, 'SAT_LIMA'))"
          />
        </span>
      </template>

      <template #fines-atu="{ data }">
        <span class="tf-issuer-amount">
          <span class="tf-amount">{{ formatSoles(data.totalsFor('ATU').amountDue) }}</span>
          <i
            v-if="failedCheck(data, 'ATU')"
            class="pi pi-exclamation-triangle tf-warn-icon"
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
        <div class="tf-issuer-amount">
          <span v-if="data.lastCheckedAt" class="tf-date">{{ formatDateTimeForUi(data.lastCheckedAt) }}</span>
          <span v-else class="tf-dash">Sin consultar</span>
          <!--
            El aviso es lo que impide leer un S/ 0.00 como "no debe nada" cuando en realidad el
            portal no respondió.
          -->
          <i
            v-if="data.hasCheckErrors"
            class="pi pi-exclamation-triangle tf-warn-icon"
            v-tooltip.top="checkErrorsTooltip(data)"
          />
        </div>
      </template>
    </DataManager>

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

    <TrafficFinesImportsDialog v-model:visible="importsVisible" />

    <pv-menu ref="downloadMenuRef" :model="downloadMenu" popup class="tf-menu" />
    <pv-menu ref="inventoryMenuRef" :model="inventoryMenu" popup class="tf-menu" />
  </div>
</template>

<style scoped>
/*
 * Los colores del contenido salen de --text-body / --text-body-secondary y no de las variables del
 * tema de PrimeVue ni de --text-primary: esas están calibradas para el shell oscuro y sobre el
 * fondo claro del contenido quedan casi invisibles.
 */

/* ── Alertas y avance ─────────────────────────────────────────────────── */

.tf-alert {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border-radius: var(--border-radius, 6px);
  border: 1px solid transparent;
  color: var(--text-body, #111827);
  font-size: 0.875rem;
}

.tf-alert--danger {
  background: #fef2f2;
  border-color: #fecaca;
  border-left: 4px solid var(--red-600, #dc2626);
}

.tf-alert__icon {
  color: var(--red-600, #dc2626);
  font-size: 1.1rem;
}

.tf-alert__text {
  flex: 1 1 auto;
  min-width: 0;
}

.tf-alert__action {
  flex-shrink: 0;
}

.tf-batches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: var(--border-radius, 6px);
  background: var(--surface-0, #ffffff);
}

/* ── Estado vacío ─────────────────────────────────────────────────────── */

.tf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  border: 1px dashed #c2d9f5;
  border-radius: var(--border-radius, 6px);
  background: var(--surface-0, #ffffff);
}

.tf-empty__icon {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: #e8f0fb;
  color: #1a5fa8;
  font-size: 1.5rem;
}

.tf-empty__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-body, #111827);
}

.tf-empty__text {
  margin: 0;
  max-width: 36rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-body-secondary, #6b7280);
}

.tf-empty__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

/* ── Barra de acciones ────────────────────────────────────────────────── */

/*
 * La barra secundaria del DataManager se encoge a su contenido y se pega a la derecha con
 * `margin-left: auto`. Aquí lleva dos grupos y necesita la fila completa para que el separador
 * los aparte. Va con `:deep` y acotado a esta vista: el componente es compartido y el
 * comportamiento por defecto es el correcto para los módulos que solo ponen botones.
 */
.tf-page :deep(.dm-secondary-toolbar__secondary) {
  flex: 1 1 100%;
  margin-left: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.tf-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.tf-actions :deep(.p-button) {
  flex-shrink: 0;
}

.tf-toolbar-spacer {
  flex: 1 1 auto;
}

/*
 * Botón con flecha pegada. Los estilos globales fijan relleno y bordes con !important, así que
 * aquí también: con más especificidad y cargados después, ganan solo en esta vista.
 */
.tf-split {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
}

.tf-split .tf-split__main {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.tf-split .tf-split__toggle {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  padding: 0 0.625rem !important;
  min-width: 2.25rem;
}

/* Con relleno, una línea clara separa la flecha; con contorno, los dos bordes se solapan en uno. */
.tf-split .tf-split__toggle:not(.p-button-outlined) {
  border-left: 1px solid rgba(255, 255, 255, 0.4) !important;
}

.tf-split .tf-split__toggle.p-button-outlined {
  margin-left: -2px;
}

/* ── Filtros ──────────────────────────────────────────────────────────── */

.tf-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.tf-filters__search,
.tf-filters__search :deep(.p-inputtext) {
  width: 100%;
}

.tf-filters__row {
  display: flex;
  align-items: flex-end;
  gap: 0.625rem;
  width: 100%;
  min-width: 0;
}

.tf-filters__fields {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem 0.625rem;
  flex: 1 1 auto;
  min-width: 0;
}

.tf-filters__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.tf-filters__label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-body-secondary, #6b7280);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tf-filters__clear {
  flex-shrink: 0;
  white-space: nowrap;
  margin-bottom: 0.125rem;
}

/* Select y MultiSelect salen de fábrica con alturas y tamaños de letra distintos. */
.tf-filters :deep(.p-select),
.tf-filters :deep(.p-multiselect) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 2.5rem;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.tf-filters :deep(.p-select-label),
.tf-filters :deep(.p-multiselect-label) {
  padding: 0 0.625rem !important;
  font-size: 0.875rem !important;
  line-height: 1;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 0;
  min-width: 0;
}

@media (max-width: 1439px) {
  .tf-filters__fields {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1099px) {
  .tf-filters__fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 899px) {
  .tf-filters__row {
    flex-direction: column;
    align-items: stretch;
  }

  .tf-filters__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tf-filters__clear {
    align-self: flex-end;
    margin-bottom: 0;
  }
}

@media (max-width: 479px) {
  .tf-filters__fields {
    grid-template-columns: 1fr;
  }
}

/* ── Tabla ────────────────────────────────────────────────────────────── */

/*
 * Celdas más compactas que el resto de la app: la tabla lleva diez columnas y con el relleno
 * general la de acciones quedaba fuera de la vista en una pantalla normal.
 */
.tf-page :deep(.p-datatable .p-datatable-thead > tr > th) {
  padding: 0.625rem 0.5rem !important;
}

.tf-page :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.5rem !important;
}

.tf-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.tf-cell__line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-plate {
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.tf-sub {
  font-size: 0.75rem;
  color: var(--text-body-secondary, #6b7280);
  white-space: nowrap;
}

.tf-advisor {
  display: inline-block;
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.tf-amount {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tf-amount--due {
  font-weight: 700;
  color: var(--red-600, #dc2626);
}

.tf-undelivered {
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--blue-600, #2563eb);
}

.tf-issuer-amount {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: center;
}

.tf-date {
  white-space: nowrap;
}

.tf-warn-icon {
  color: var(--orange-500, #f97316);
}

.tf-dash {
  color: var(--text-body-secondary, #6b7280);
}

/* ── Pantallas estrechas ──────────────────────────────────────────────── */

@media (max-width: 575px) {
  .tf-toolbar-spacer {
    display: none;
  }

  .tf-actions {
    width: 100%;
  }

  .tf-actions > :deep(.p-button),
  .tf-split {
    flex: 1 1 auto;
  }

  .tf-split .tf-split__main {
    flex: 1 1 auto;
  }
}
</style>

<style>
/*
 * Menús de la barra, sin scoped: PrimeVue los monta en el <body>. El estilo global de .p-menu es el
 * oscuro del menú de usuario del encabezado; estos se abren sobre el contenido claro.
 */
.tf-menu.p-menu {
  min-width: 16rem;
  padding: 0.25rem;
  font-size: 0.875rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
}

.tf-menu .p-menu-item-link {
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  color: #111827;
}

.tf-menu .p-menu-item-icon {
  color: #6b7280;
}

.tf-menu .p-menu-item:not(.p-disabled) > .p-menu-item-content:hover,
.tf-menu .p-menu-item.p-focus > .p-menu-item-content {
  background: #f3f4f6;
}

.tf-menu .p-menu-separator {
  margin: 0.25rem 0;
  border-top: 1px solid #e5e7eb;
}
</style>
