import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TrafficFinesApi } from '../infrastructure/api/traffic-fines.api.js'
import { TrafficFineAssembler } from '../infrastructure/assemblers/traffic-fine.assembler.js'
import { CAUTELAR_STAGE } from '../domain/format-collection-stage.js'
import { downloadBlob, fileNameFromContentDisposition } from '@/shared/infrustructure/download-blob.js'
import { todayIsoLocal } from '@/shared/domain/employee-attendance-day.js'

/**
 * Cada consulta tarda decenas de segundos por placa: el servicio de bots las procesa de una en
 * una entre captcha y navegación. Sondear más rápido solo produce peticiones que devuelven lo
 * mismo.
 */
const POLL_INTERVAL_MS = 4000

/**
 * Tope de sondeos fallidos seguidos antes de rendirse.
 *
 * Sin él, un backend caído dejaría al navegador pidiendo el estado para siempre. El lote no se
 * pierde: al recargar, `GET /queries/latest` lo recupera.
 */
const MAX_CONSECUTIVE_POLL_ERRORS = 5

/** Los dos tipos de lote: Callao y ATU por placa, y SAT Lima por RUC. Corren a la vez. */
export const BATCH_KINDS = Object.freeze({ PLATES: 'PLATES', SAT_RUC: 'SAT_RUC' })

/**
 * El último lote terminado que el usuario cerró, por tipo.
 *
 * Al entrar se recupera el último lote de cada tipo; sin recordar cuál se cerró, un lote ya visto
 * volvía a aparecer en cada visita hasta que se lanzara otro. Solo hace falta el último: es el
 * único que se recupera. Es comodidad de este navegador: si el almacenamiento no está disponible,
 * la tira simplemente reaparece.
 */
const DISMISSED_BATCHES_KEY = 'traffic-fines.dismissed-batches'

function readDismissedBatches() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_BATCHES_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

function rememberDismissedBatch(kind, batchId) {
  try {
    localStorage.setItem(DISMISSED_BATCHES_KEY, JSON.stringify({ ...readDismissedBatches(), [kind]: batchId }))
  } catch {
    // Sin almacenamiento solo se pierde el recuerdo: la tira vuelve en la próxima visita.
  }
}

export const useTrafficFinesStore = defineStore('traffic-fines', () => {
  const api = new TrafficFinesApi()

  const _summary = ref([])
  const _page = ref(0)
  const _size = ref(20)
  const _totalElements = ref(0)
  const _totalPages = ref(0)
  const _activeFilters = ref({})
  const _cautelarCount = ref(0)
  const _pendingDeliveries = ref({ newCount: 0, changedCount: 0, reappearedCount: 0, total: 0 })
  const _deliveries = ref([])
  const _nightly = ref(null)

  const _detail = ref(null)

  const summary = computed(() => _summary.value)
  const detail = computed(() => _detail.value)
  const cautelarCount = computed(() => _cautelarCount.value)
  const pendingDeliveries = computed(() => _pendingDeliveries.value)
  const deliveries = computed(() => _deliveries.value)
  const nightly = computed(() => _nightly.value)
  const activeFilters = computed(() => _activeFilters.value)
  const pagination = computed(() => ({
    page: _page.value,
    size: _size.value,
    totalElements: _totalElements.value,
    totalPages: _totalPages.value,
  }))

  // ── Resumen ────────────────────────────────────────────────────────────────

  async function fetchPage(page) {
    const params = api.buildParams(_activeFilters.value, page, _size.value)
    const { data } = await api.getSummary(params)
    _summary.value = (data.content ?? []).map((r) => TrafficFineAssembler.toSummaryFromResource(r))
    _page.value = data.page ?? page
    _totalElements.value = data.total_elements ?? 0
    _totalPages.value = data.total_pages ?? 0
  }

  /**
   * Cuántas unidades de todo el inventario tienen una medida cautelar, sin mirar los filtros de
   * la tabla: la alerta no puede desaparecer porque alguien filtró otra cosa.
   */
  async function fetchCautelarCount() {
    const { data } = await api.getSummary(api.buildParams({ stage: CAUTELAR_STAGE }, 0, 1))
    _cautelarCount.value = data.total_elements ?? 0
  }

  /**
   * La alerta y el contador de descargas acompañan a la tabla pero no la bloquean: si alguno
   * fallara, la tabla tiene que verse igual.
   */
  function refreshCounters() {
    return Promise.allSettled([fetchCautelarCount(), fetchPendingDeliveries()])
  }

  async function fetchSummary(filters = {}) {
    _activeFilters.value = { ...filters }
    await Promise.all([fetchPage(0), refreshCounters()])
  }

  async function goToPage(page) {
    await fetchPage(page)
  }

  /** Tras una consulta o una descarga cambian los importes, la alerta y lo que falta entregar. */
  async function refreshCurrentPage() {
    await Promise.all([fetchPage(_page.value), refreshCounters()])
  }

  /** La consulta automatica diaria. Informativo: si falla, la pantalla sigue igual. */
  async function fetchNightlyStatus() {
    const { data } = await api.getNightlyStatus()
    _nightly.value = TrafficFineAssembler.toNightlyStatusFromResource(data)
    return _nightly.value
  }

  // ── Detalle ────────────────────────────────────────────────────────────────

  async function fetchUnitDetail(unitId, includeResolved = false) {
    const { data } = await api.getUnitDetail(unitId, includeResolved)
    _detail.value = TrafficFineAssembler.toDetailFromResource(data)
    return _detail.value
  }

  function clearDetail() {
    _detail.value = null
  }

  // ── Lotes ──────────────────────────────────────────────────────────────────

  /**
   * Estado y sondeo de un tipo de lote. Callao/ATU y SAT son independientes: pueden correr a la
   * vez y cada uno se cierra por su cuenta.
   */
  function createBatchTracker(kind) {
    const batch = ref(null)
    let pollTimer = null
    let pollErrors = 0

    function start() {
      stop()
      pollErrors = 0
      pollTimer = setInterval(tick, POLL_INTERVAL_MS)
    }

    function stop() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    async function fetch(batchId) {
      const { data } = await api.getBatch(batchId)
      batch.value = TrafficFineAssembler.toBatchFromResource(data)
      return batch.value
    }

    async function tick() {
      const batchId = batch.value?.batchId
      if (!batchId) {
        stop()
        return
      }
      try {
        const updated = await fetch(batchId)
        pollErrors = 0
        if (updated.settled) {
          stop()
          // Recargar la tabla al cerrar: los importes recién obtenidos no aparecerían hasta que el
          // usuario navegara a otra parte y volviera.
          await refreshCurrentPage()
        }
      } catch {
        pollErrors += 1
        if (pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) stop()
      }
    }

    /**
     * Recupera el último lote de este tipo y reanuda el sondeo si todavía no ha terminado. Uno
     * terminado que el usuario ya cerró no se vuelve a mostrar; uno en curso, siempre.
     */
    async function resume() {
      const response = await api.getLatestBatch(kind)
      if (response.status === 204 || !response.data) {
        batch.value = null
        return null
      }
      const latest = TrafficFineAssembler.toBatchFromResource(response.data)
      if (latest.settled && readDismissedBatches()[kind] === latest.batchId) {
        batch.value = null
        return null
      }
      batch.value = latest
      if (!latest.settled) start()
      return latest
    }

    function adopt(launched) {
      batch.value = launched
      start()
    }

    /**
     * Se detiene el sondeo antes de llamar: si un tick cayera entre la cancelación y la respuesta,
     * pintaría el lote todavía «consultando» justo después de haberlo parado. Si la cancelación
     * falla, el lote sigue vivo en el servidor y el sondeo se reanuda.
     */
    async function cancel() {
      const batchId = batch.value?.batchId
      if (!batchId) return null
      stop()
      try {
        const { data } = await api.cancelBatch(batchId)
        batch.value = TrafficFineAssembler.toBatchFromResource(data)
      } catch (error) {
        if (batch.value && !batch.value.settled) start()
        throw error
      }
      // Las papeletas que sí llegaron antes de cancelar son datos buenos que hay que mostrar.
      await refreshCurrentPage()
      return batch.value
    }

    /** Cierra la tira y recuerda el lote, para que no vuelva al entrar otra vez. */
    function clear() {
      stop()
      if (batch.value?.settled && batch.value.batchId) rememberDismissedBatch(kind, batch.value.batchId)
      batch.value = null
    }

    const isRunning = computed(() => !!batch.value && !batch.value.settled)

    return { batch, isRunning, start, stop, resume, adopt, cancel, clear }
  }

  const _platesTracker = createBatchTracker(BATCH_KINDS.PLATES)
  const _satTracker = createBatchTracker(BATCH_KINDS.SAT_RUC)

  function trackerFor(kind) {
    return kind === BATCH_KINDS.SAT_RUC ? _satTracker : _platesTracker
  }

  const platesBatch = computed(() => _platesTracker.batch.value)
  const satBatch = computed(() => _satTracker.batch.value)
  const isPlatesBatchRunning = computed(() => _platesTracker.isRunning.value)
  const isSatBatchRunning = computed(() => _satTracker.isRunning.value)

  /**
   * Consulta Callao y ATU de las unidades elegidas, o de «todas» si `all` es true (el backend
   * elige cuáles). Devuelve el acuse completo para que la vista pueda mostrar las omitidas: si se
   * descartaran aquí, el usuario creería que su selección entera está cubierta.
   */
  async function launchQuery({ unitIds = [], all = false, issuers = [] } = {}) {
    const { data } = await api.launchQuery({ unitIds, all, issuers })
    const result = TrafficFineAssembler.toLaunchResultFromResource(data)
    _platesTracker.adopt(result.batch)
    return result
  }

  async function refreshSat() {
    const { data } = await api.refreshSat()
    const result = TrafficFineAssembler.toLaunchResultFromResource(data)
    _satTracker.adopt(result.batch)
    return result
  }

  /** El lote sigue corriendo en el servidor aunque se cierre el navegador: al volver se recupera. */
  async function resumePolling() {
    await Promise.allSettled([_platesTracker.resume(), _satTracker.resume()])
  }

  function stopPolling() {
    _platesTracker.stop()
    _satTracker.stop()
  }

  function cancelBatch(kind) {
    return trackerFor(kind).cancel()
  }

  function clearBatch(kind) {
    trackerFor(kind).clear()
  }

  // ── Descargas de papeletas ─────────────────────────────────────────────────

  /** Lo que llevaría ahora «descargar nuevas» con los filtros de la tabla. */
  async function fetchPendingDeliveries() {
    const { data } = await api.getPendingDeliveries(_activeFilters.value)
    _pendingDeliveries.value = TrafficFineAssembler.toPendingDeliveriesFromResource(data)
    return _pendingDeliveries.value
  }

  /**
   * Registra una descarga con los filtros de la tabla. No baja el archivo: si el archivo fallara,
   * la descarga ya está registrada y quien llama tiene que poder decirlo y ofrecer bajarla otra vez.
   */
  async function createDelivery(kind) {
    const { data } = await api.createDelivery(kind, _activeFilters.value)
    const result = TrafficFineAssembler.toDeliveryResultFromResource(data)
    if (result.created) {
      // Las etiquetas «por entregar» de la tabla y el contador del botón ya no valen.
      await Promise.allSettled([fetchPage(_page.value), fetchPendingDeliveries()])
    }
    return result
  }

  async function downloadDelivery(delivery) {
    const response = await api.downloadDeliveryFile(delivery.id)
    const fallback = delivery.fileName ?? `papeletas-${delivery.number}.xlsx`
    const fileName = fileNameFromContentDisposition(
      response.headers?.['content-disposition'], fallback)
    downloadBlob(response.data, fileName)
    return fileName
  }

  async function fetchDeliveries(limit = 30) {
    const { data } = await api.getDeliveries(limit)
    _deliveries.value = (Array.isArray(data) ? data : [])
      .map((r) => TrafficFineAssembler.toDeliveryFromResource(r))
    return _deliveries.value
  }

  // ── Exportación ────────────────────────────────────────────────────────────

  async function downloadSummaryExport() {
    const response = await api.downloadSummaryExport(_activeFilters.value)
    // Fecha local y no `toISOString`: en Lima (UTC-5) el UTC ya es del día siguiente a partir de
    // las 19:00 y el archivo saldría fechado mañana.
    const fallback = `papeletas-${todayIsoLocal()}.xlsx`
    const fileName = fileNameFromContentDisposition(
      response.headers?.['content-disposition'], fallback)
    downloadBlob(response.data, fileName)
    return fileName
  }

  async function downloadUnitExport(unitId, includeResolved = false) {
    const response = await api.downloadUnitExport(unitId, includeResolved)
    const fallback = `papeletas-unidad-${todayIsoLocal()}.xlsx`
    const fileName = fileNameFromContentDisposition(
      response.headers?.['content-disposition'], fallback)
    downloadBlob(response.data, fileName)
    return fileName
  }

  return {
    summary,
    detail,
    pagination,
    cautelarCount,
    pendingDeliveries,
    deliveries,
    nightly,
    activeFilters,
    platesBatch,
    satBatch,
    isPlatesBatchRunning,
    isSatBatchRunning,
    fetchSummary,
    goToPage,
    refreshCurrentPage,
    fetchUnitDetail,
    clearDetail,
    launchQuery,
    refreshSat,
    resumePolling,
    stopPolling,
    cancelBatch,
    clearBatch,
    fetchPendingDeliveries,
    fetchNightlyStatus,
    createDelivery,
    downloadDelivery,
    fetchDeliveries,
    downloadSummaryExport,
    downloadUnitExport,
  }
})
