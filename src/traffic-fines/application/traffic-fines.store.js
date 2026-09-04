import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TrafficFinesApi } from '../infrastructure/api/traffic-fines.api.js'
import { TrafficFineAssembler } from '../infrastructure/assemblers/traffic-fine.assembler.js'
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

export const useTrafficFinesStore = defineStore('traffic-fines', () => {
  const api = new TrafficFinesApi()

  const _summary = ref([])
  const _page = ref(0)
  const _size = ref(20)
  const _totalElements = ref(0)
  const _totalPages = ref(0)
  const _activeFilters = ref({})

  const _detail = ref(null)
  const _batch = ref(null)
  const _pollErrors = ref(0)

  let _pollTimer = null

  const summary = computed(() => _summary.value)
  const detail = computed(() => _detail.value)
  const batch = computed(() => _batch.value)
  const pagination = computed(() => ({
    page: _page.value,
    size: _size.value,
    totalElements: _totalElements.value,
    totalPages: _totalPages.value,
  }))
  /** Hay un lote en curso: mientras dure, el botón de consultar queda bloqueado. */
  const isBatchRunning = computed(() => !!_batch.value && !_batch.value.settled)

  // ── Resumen ────────────────────────────────────────────────────────────────

  async function fetchPage(page) {
    const params = api.buildParams(_activeFilters.value, page, _size.value)
    const { data } = await api.getSummary(params)
    _summary.value = (data.content ?? []).map((r) => TrafficFineAssembler.toSummaryFromResource(r))
    _page.value = data.page ?? page
    _totalElements.value = data.total_elements ?? 0
    _totalPages.value = data.total_pages ?? 0
  }

  async function fetchSummary(filters = {}) {
    _activeFilters.value = { ...filters }
    await fetchPage(0)
  }

  async function goToPage(page) {
    await fetchPage(page)
  }

  async function refreshCurrentPage() {
    await fetchPage(_page.value)
  }

  // ── Detalle ────────────────────────────────────────────────────────────────

  async function fetchVehicleDetail(vehicleId, includeResolved = false) {
    const { data } = await api.getVehicleDetail(vehicleId, includeResolved)
    _detail.value = TrafficFineAssembler.toDetailFromResource(data)
    return _detail.value
  }

  function clearDetail() {
    _detail.value = null
  }

  // ── Lotes ──────────────────────────────────────────────────────────────────

  /**
   * Lanza la consulta y arranca el sondeo.
   *
   * Devuelve el acuse completo para que la vista pueda mostrar las unidades omitidas: si se
   * descartaran aquí, el usuario creería que su selección entera está cubierta.
   */
  async function launchQuery(vehicleIds, issuers = []) {
    const { data } = await api.launchQuery(vehicleIds, issuers)
    const result = TrafficFineAssembler.toLaunchResultFromResource(data)
    _batch.value = result.batch
    startPolling()
    return result
  }

  async function fetchBatch(batchId) {
    const { data } = await api.getBatch(batchId)
    _batch.value = TrafficFineAssembler.toBatchFromResource(data)
    return _batch.value
  }

  /**
   * Recupera el último lote del sistema, si lo hay.
   *
   * Es lo que permite reanudar el sondeo tras recargar la página: el lote sigue corriendo en el
   * servidor aunque el navegador se haya cerrado.
   */
  async function fetchLatestBatch() {
    const response = await api.getLatestBatch()
    if (response.status === 204 || !response.data) {
      _batch.value = null
      return null
    }
    _batch.value = TrafficFineAssembler.toBatchFromResource(response.data)
    return _batch.value
  }

  /** Recupera el lote en curso y reanuda el sondeo si todavía no ha terminado. */
  async function resumePolling() {
    const current = await fetchLatestBatch()
    if (current && !current.settled) startPolling()
    return current
  }

  function startPolling() {
    stopPolling()
    _pollErrors.value = 0
    _pollTimer = setInterval(tick, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
  }

  async function tick() {
    const batchId = _batch.value?.batchId
    if (!batchId) {
      stopPolling()
      return
    }
    try {
      const updated = await fetchBatch(batchId)
      _pollErrors.value = 0
      if (updated.settled) {
        stopPolling()
        // Recargar la página del resumen al cerrar: los importes recién obtenidos no aparecerían
        // hasta que el usuario navegara a otra parte y volviera.
        await refreshCurrentPage()
      }
    } catch {
      _pollErrors.value += 1
      if (_pollErrors.value >= MAX_CONSECUTIVE_POLL_ERRORS) stopPolling()
    }
  }

  function clearBatch() {
    stopPolling()
    _batch.value = null
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

  async function downloadVehicleExport(vehicleId, includeResolved = false) {
    const response = await api.downloadVehicleExport(vehicleId, includeResolved)
    const fallback = `papeletas-unidad-${todayIsoLocal()}.xlsx`
    const fileName = fileNameFromContentDisposition(
      response.headers?.['content-disposition'], fallback)
    downloadBlob(response.data, fileName)
    return fileName
  }

  return {
    summary,
    detail,
    batch,
    pagination,
    isBatchRunning,
    fetchSummary,
    goToPage,
    refreshCurrentPage,
    fetchVehicleDetail,
    clearDetail,
    launchQuery,
    fetchBatch,
    fetchLatestBatch,
    resumePolling,
    startPolling,
    stopPolling,
    clearBatch,
    downloadSummaryExport,
    downloadVehicleExport,
  }
})
