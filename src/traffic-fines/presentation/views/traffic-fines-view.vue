<script setup>
/**
 * Resumen de papeletas por unidad.
 *
 * Lista **todas** las unidades, tengan papeletas o no: es también la tabla desde la que se
 * seleccionan las unidades a consultar, y no se podría elegir una que nunca se ha consultado si
 * solo aparecieran las que ya deben algo.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTrafficFinesStore } from '../../application/traffic-fines.store.js'
import { useAsyncAction } from '@/shared/composables/use-async-action.js'
import { useNotification } from '@/shared/composables/use-notification.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'
import DataManager from '@/shared/presentation/components/data-manager.vue'
import TrafficFinesBatchProgress from '../components/traffic-fines-batch-progress.vue'
import TrafficFinesLaunchDialog from '../components/traffic-fines-launch-dialog.vue'
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
import { formatDateTimeForUi } from '@/shared/domain/format-datetime-ui.js'
import { TRAFFIC_FINE_ROUTE_NAMES } from '../traffic-fines.routes.js'

const router = useRouter()
const store = useTrafficFinesStore()
const { isLoading, run } = useAsyncAction()
const { showSuccess, showError, showWarning } = useNotification()

const columns = TRAFFIC_FINE_SUMMARY_COLUMNS

// ── Filtros ────────────────────────────────────────────────────────────────
const searchText = ref('')
const filterIssuers = ref([])
const filterState = ref(null)
const filterSort = ref('plate')

function buildFilters() {
  return {
    search: searchText.value.trim() || undefined,
    issuers: filterIssuers.value.length ? [...filterIssuers.value] : undefined,
    hasFines: filterState.value === 'with_fines'
      ? true
      : filterState.value === 'without_fines' ? false : undefined,
    neverChecked: filterState.value === 'never_checked' ? true : undefined,
    sort: filterSort.value ?? undefined,
  }
}

function reload() {
  return run(() => store.fetchSummary(buildFilters()))
}

watch([filterIssuers, filterState, filterSort], reload, { deep: true })

let _searchTimer = null
watch(searchText, () => {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(reload, 350)
})

function clearAllFilters() {
  searchText.value = ''
  filterIssuers.value = []
  filterState.value = null
  filterSort.value = 'plate'
}

function handlePageChange({ page }) {
  run(() => store.goToPage(page))
}

// ── Lanzamiento ────────────────────────────────────────────────────────────
const launchDialogVisible = ref(false)
const launchLoading = ref(false)
const selectedForLaunch = ref([])
/** Se guarda para poder vaciar la tabla desde fuera del slot cuando la consulta se acepta. */
let _clearTableSelection = null

const batch = computed(() => store.batch)

function openLaunchDialog(selectedItems, clearSelection) {
  if (!selectedItems?.length) {
    showWarning('Selecciona al menos una unidad para consultar.')
    return
  }
  selectedForLaunch.value = [...selectedItems]
  _clearTableSelection = clearSelection
  launchDialogVisible.value = true
}

async function handleLaunch({ vehicleIds, issuers }) {
  launchLoading.value = true
  try {
    const result = await store.launchQuery(vehicleIds, issuers)
    launchDialogVisible.value = false
    _clearTableSelection?.()
    selectedForLaunch.value = []
    showSuccess(`Consulta encolada para ${vehicleIds.length} ${vehicleIds.length === 1 ? 'unidad' : 'unidades'}.`)
    // Las unidades omitidas se avisan aparte: callarlas haría creer que la selección entera
    // está cubierta, y esas unidades seguirían con su deuda sin actualizar.
    if (result.skipped.length) {
      showWarning(`${result.skipped.length} ${result.skipped.length === 1 ? 'unidad omitida' : 'unidades omitidas'}: `
        + result.skipped.map((item) => `${item.licensePlate ?? item.vehicleId} (${item.reason})`).join('; '))
    }
  } catch (error) {
    showError(humanizeApiError(error))
  } finally {
    launchLoading.value = false
  }
}

// ── Exportación ────────────────────────────────────────────────────────────
const exportLoading = ref(false)

async function handleDownloadExport() {
  exportLoading.value = true
  try {
    const fileName = await store.downloadSummaryExport()
    showSuccess(`Archivo generado: ${fileName}`)
  } catch (error) {
    showError(humanizeApiError(error))
  } finally {
    exportLoading.value = false
  }
}

// ── Navegación ─────────────────────────────────────────────────────────────
function goToDetail(item) {
  if (item?.vehicleId == null) return
  router.push({
    name: TRAFFIC_FINE_ROUTE_NAMES.DETAIL,
    params: { vehicleId: String(item.vehicleId) },
  })
}

// ── Presentación ───────────────────────────────────────────────────────────
function issuerTotals(row, issuer) {
  return row.totalsFor(issuer)
}

/** Texto del icono de aviso: dice qué portal falló, no solo que algo falló. */
function checkErrorsTooltip(row) {
  return row.checks
    .filter((check) => !check.succeeded)
    .map((check) => `${formatIssuerLabel(check.issuer)}: ${formatCheckStatusLabel(check.status)}`)
    .join(' · ')
}

onMounted(async () => {
  await reload()
  // El lote sigue corriendo en el servidor aunque se cierre el navegador: al volver se recupera
  // y, si no ha terminado, el sondeo se reanuda solo.
  await run(() => store.resumePolling())
})

onUnmounted(() => {
  store.stopPolling()
})
</script>

<template>
  <div class="tf-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
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
      :show-edit-action="false"
      :show-delete-action="false"
      @view-item-requested-manager="goToDetail"
      @clear-filters="clearAllFilters"
      @page-changed="handlePageChange"
    >
      <!--
        El avance vive en el toolbar, no en una tarjeta propia sobre la tabla: el lote puede durar
        más de una hora y durante ese rato lo que hace falta es la tabla, no el indicador.
      -->
      <template #extra-actions="{ selectedItems, clearSelection }">
        <TrafficFinesBatchProgress :batch="batch" @dismissed="store.clearBatch()" />
        <!-- Sin lote en curso no hay tira que empuje: este hueco mantiene los botones a la derecha. -->
        <div v-if="!batch" class="tf-toolbar-spacer" />

        <pv-button
          icon="pi pi-search"
          :label="selectedItems.length ? `Consultar (${selectedItems.length})` : 'Consultar papeletas'"
          severity="success"
          size="small"
          :disabled="!selectedItems.length || store.isBatchRunning"
          v-tooltip.top="store.isBatchRunning ? 'Ya hay una consulta en curso' : null"
          class="dm-stoolbar-btn w-full sm:w-auto"
          @click="openLaunchDialog(selectedItems, clearSelection)"
        />
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

      <!--
        Todo en una fila. Las etiquetas van dentro del propio control como placeholder en vez de
        encima: con solo tres filtros, una segunda fila de rótulos costaría más alto del que
        aporta claridad.
      -->
      <template #filters="{ clearFilters }">
        <div class="tf-filters w-full">
          <pv-icon-field class="tf-filters__search">
            <pv-input-icon class="pi pi-search" />
            <pv-input-text
              v-model="searchText"
              placeholder="Buscar por placa, VIN, marca o modelo"
              class="w-full"
              autocomplete="off"
            />
          </pv-icon-field>

          <pv-multi-select
            id="tf-filter-issuers"
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
            id="tf-filter-state"
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
            id="tf-filter-sort"
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
          <span v-if="data.licensePlate" class="tf-plate" :title="data.licensePlate">
            {{ data.licensePlate }}
          </span>
          <pv-tag v-else value="Sin placa" severity="secondary" />
          <!--
            Una placa que el portal no acepta no es un detalle estético: seleccionarla solo
            gastaría tiempo de lote, así que se marca aquí y el diálogo la separa.
          -->
          <pv-tag
            v-if="data.licensePlate && !data.consultable"
            value="No consultable"
            severity="warn"
            v-tooltip.top="'La placa no tiene el formato que acepta el servicio de consultas'"
          />
          <pv-tag v-if="data.external" value="Ext." severity="danger" />
        </div>
      </template>

      <template #fines-vin="{ data }">
        <span v-if="data.vin" :title="data.vin">{{ data.vin }}</span>
        <span v-else class="tf-dash">—</span>
      </template>

      <template #fines-count="{ data }">
        <pv-tag
          :value="String(data.fineCount)"
          :severity="data.fineCount > 0 ? 'danger' : 'success'"
        />
      </template>

      <template #fines-amount="{ data }">
        <span class="tf-amount" :class="{ 'tf-amount--due': data.totalAmountDue > 0 }">
          {{ formatSoles(data.totalAmountDue) }}
        </span>
      </template>

      <template #fines-callao="{ data }">
        <span class="tf-amount">{{ formatSoles(issuerTotals(data, 'CALLAO').amountDue) }}</span>
      </template>

      <template #fines-sat-lima="{ data }">
        <span class="tf-amount">{{ formatSoles(issuerTotals(data, 'SAT_LIMA').amountDue) }}</span>
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

    <TrafficFinesLaunchDialog
      v-model:visible="launchDialogVisible"
      :selected="selectedForLaunch"
      :loading="launchLoading"
      @confirmed="handleLaunch"
    />
  </div>
</template>

<style scoped>
/*
 * La barra secundaria del DataManager se encoge a su contenido y se pega a la derecha con
 * `margin-left: auto`. Eso vale cuando solo lleva botones, pero aquí lleva además el avance del
 * lote: al no caber, el grupo se parte en dos líneas y deja medio toolbar vacío. Se le da la fila
 * completa, y la tira absorbe el hueco mientras los botones conservan su tamaño.
 *
 * Va con `:deep` y acotado a esta vista: es un componente compartido por todos los módulos y el
 * comportamiento por defecto es el correcto para los que solo ponen botones.
 */
@media (min-width: 576px) {
  .tf-page :deep(.dm-secondary-toolbar__secondary) {
    flex: 1 1 100%;
    margin-left: 0;
    flex-wrap: nowrap;
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
  flex: 1 1 9.5rem;
  min-width: 0;
}

.tf-filters__clear {
  flex-shrink: 0;
}

.tf-plate-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tf-plate {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tf-amount {
  font-variant-numeric: tabular-nums;
}

.tf-amount--due {
  font-weight: 700;
  color: var(--red-600, #dc2626);
}

.tf-last-check {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  justify-content: center;
}

/*
 * Los grises salen de --text-body-secondary, no de --text-color-secondary: esa última la define
 * el tema de PrimeVue para el layout oscuro y sobre el fondo claro del contenido queda casi
 * invisible. Es el mismo criterio que sigue vc-filters__label en el catálogo de vehículos.
 */
.tf-dash {
  color: var(--text-body-secondary, #6b7280);
}
</style>
