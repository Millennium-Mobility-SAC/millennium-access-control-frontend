import { defineStore }          from 'pinia'
import { ref, computed }        from 'vue'
import { StaysApi }             from '../infrastructure/api/stays.api.js'
import { AccessEntryAssembler } from '../infrastructure/assemblers/access-entry.assembler.js'
import { batchSettled }         from '@/shared/infrustructure/batch-settled.js'
import { humanizeApiError }     from '@/shared/infrustructure/api-error-humanizer.js'

export const useStaysStore = defineStore('stays', () => {
  const api = new StaysApi()

  const _items    = ref([])
  const _selected = ref(null)

  // ── Pagination state ──────────────────────────────────────────────
  const _page          = ref(0)
  const _size          = ref(20)
  const _totalElements = ref(0)
  const _totalPages    = ref(0)

  // Active filter criteria — single source of truth for fetchPage + exportAll
  const _activeFilters = ref({
    statuses:     [],
    types:        [],
    entryReasons: [],
    search:       '',
  })

  // ── Getters ───────────────────────────────────────────────────────
  const items    = computed(() => _items.value)
  const selected = computed(() => _selected.value)
  const pagination = computed(() => ({
    page:          _page.value,
    size:          _size.value,
    totalElements: _totalElements.value,
    totalPages:    _totalPages.value,
  }))
  const activeFilters = computed(() => _activeFilters.value)

  // ── Internal helpers ──────────────────────────────────────────────
  function _buildQueryParams(filters, page, size, sort = 'entryDate', direction = 'DESC') {
    const params = { page, size, sort, direction }
    if (filters.statuses?.length)     params.status       = filters.statuses.join(',')
    if (filters.types?.length)        params.type         = filters.types.join(',')
    if (filters.entryReasons?.length) params.entry_reason = filters.entryReasons.join(',')
    if (filters.search?.trim())       params.search       = filters.search.trim()
    return params
  }

  // ── Query actions ─────────────────────────────────────────────────

  /** Fetch one page from the backend with the currently active filters. */
  async function fetchPage(page = 0) {
    const params   = _buildQueryParams(_activeFilters.value, page, _size.value)
    const response = await api.getAll(params)
    const data     = response.data
    _items.value         = (data.content ?? []).map(r => AccessEntryAssembler.toEntityFromResource(r))
    _page.value          = data.page          ?? 0
    _totalElements.value = data.total_elements ?? 0
    _totalPages.value    = data.total_pages    ?? 0
  }

  /** Apply new filter criteria and reload from page 0. */
  async function applyFilters(filters) {
    _activeFilters.value = { ...filters }
    _page.value          = 0
    await fetchPage(0)
  }

  /** Navigate to a specific page (filters stay the same). */
  async function goToPage(page) {
    _page.value = page
    await fetchPage(page)
  }

  /** Load the first page with no active filters (used on mount). */
  async function fetchAll() {
    _activeFilters.value = { statuses: [], types: [], entryReasons: [], search: '' }
    await fetchPage(0)
  }

  /** Export all records matching the current active filters (no pagination). */
  async function exportAll() {
    const f      = _activeFilters.value
    const params = {}
    if (f.statuses?.length)     params.status       = f.statuses.join(',')
    if (f.types?.length)        params.type         = f.types.join(',')
    if (f.entryReasons?.length) params.entry_reason = f.entryReasons.join(',')
    if (f.search?.trim())       params.search       = f.search.trim()
    const response = await api.exportAll(params)
    return Array.isArray(response.data)
      ? response.data.map(r => AccessEntryAssembler.toEntityFromResource(r))
      : []
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    _selected.value = AccessEntryAssembler.toEntityFromResponse(response)
  }

  async function create(resource) {
    const response = await api.create(AccessEntryAssembler.toResource(resource))
    const created = AccessEntryAssembler.toEntityFromResponse(response)
    // Prepend to visible page and bump the total count
    _items.value = [created, ..._items.value]
    _totalElements.value += 1
    _selected.value = created
  }

  async function update(id, resource) {
    const response = await api.update(id, AccessEntryAssembler.toResource(resource))
    const updated = AccessEntryAssembler.toEntityFromResponse(response)
    _items.value = _items.value.map(item => item.id === id ? updated : item)
    if (_selected.value?.id === id) _selected.value = updated
  }

  async function remove(id) {
    await api.delete(id)
    _items.value = _items.value.filter(item => item.id !== id)
    _totalElements.value = Math.max(0, _totalElements.value - 1)
    if (_selected.value?.id === id) _selected.value = null
    // If the page is now empty and we're not on the first page, go back one page
    if (_items.value.length === 0 && _page.value > 0) {
      await fetchPage(_page.value - 1)
    }
  }

  async function registerExit(id, exitForm) {
    if (exitForm.exitType === 'TEMPORAL') {
      const response = await api.registerTemporalExit(id, AccessEntryAssembler.toTemporalExitResource(exitForm))
      const updated = AccessEntryAssembler.toEntityFromResponse(response)
      _items.value = _items.value.map(item => item.id === id ? updated : item)
      if (_selected.value?.id === id) _selected.value = updated
    } else {
      const response = await api.registerExit(id, AccessEntryAssembler.toExitResource(exitForm))
      const updated = AccessEntryAssembler.toEntityFromResponse(response)
      _items.value = _items.value.map(item => item.id === id ? updated : item)
      if (_selected.value?.id === id) _selected.value = updated
    }
  }

  async function registerReturn(id, returnForm) {
    const response = await api.registerReturn(id, AccessEntryAssembler.toReturnResource(returnForm))
    const updated = AccessEntryAssembler.toEntityFromResponse(response)
    _items.value = _items.value.map(item => item.id === id ? updated : item)
    if (_selected.value?.id === id) _selected.value = updated
  }

  async function fetchByVehicleId(vehicleId) {
    const response = await api.getByVehicleId(vehicleId)
    return AccessEntryAssembler.toEntitiesFromResponse(response)
  }

  /**
   * Returns the last mileage and last client data for a vehicle from its stay history.
   * Uses a single API call and handles errors gracefully.
   * @param {number} vehicleId
   * @returns {{ lastMileage: number|null, lastClient: object|null }}
   */
  async function fetchVehicleContext(vehicleId) {
    try {
      const stays = await fetchByVehicleId(vehicleId)
      const lastMileage = stays.find(s => s.mileage != null)?.mileage ?? null
      const clientStay  = stays.find(s => s.clientDocumentNumber && s.clientDocumentNumber.trim())
      const lastClient  = clientStay
        ? {
            documentType:         clientStay.documentType          ?? 'DNI',
            clientDocumentNumber: clientStay.clientDocumentNumber,
            firstName:            clientStay.firstName             ?? null,
            lastName:             clientStay.lastName              ?? null,
          }
        : null
      return { lastMileage, lastClient }
    } catch {
      return { lastMileage: null, lastClient: null }
    }
  }

  async function fetchAttachments(stayId) {
    const response = await api.getAttachments(stayId)
    return Array.isArray(response?.data) ? response.data : []
  }

  async function deleteAttachment(stayId, fileId) {
    await api.deleteAttachment(stayId, fileId)
  }

  async function fetchNotificationStatus(stayId) {
    const response = await api.getNotificationStatus(stayId)
    return Array.isArray(response?.data) ? response.data : []
  }

  async function resendWhatsApp(stayId, operationType = null, temporalExitId = null) {
    const response = await api.resendWhatsApp(stayId, operationType, temporalExitId)
    return response?.data ?? null
  }

  /**
   * Crea múltiples entradas de acceso (tipo VEHICULO) en paralelo.
   * No lanza si alguno falla — devuelve { success, failed, total, failedRows }.
   */
  async function bulkCreate(resources) {
    const results = await batchSettled(
      resources,
      r => api.create(AccessEntryAssembler.toResource({ ...r, type: r.type ?? 'VEHICULO' }))
    )
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    const failedRows = results
      .map((r, i) => r.status === 'rejected'
        ? { row: resources[i], reason: humanizeApiError(r.reason) }
        : null)
      .filter(Boolean)
    // Reload page — don't let a refresh error mask the import result
    try { await fetchPage(0) } catch { /* ignore */ }
    return { total: resources.length, success, failed, failedRows }
  }

  /**
   * Elimina un subconjunto de registros en lotes para no saturar la conexión.
   * No lanza si alguno falla — devuelve { success, failed, total }.
   */
  async function bulkRemove(items) {
    const results = await batchSettled(items, item => api.delete(item.id))
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    try { await fetchPage(0) } catch { /* ignore */ }
    return { total: items.length, success, failed }
  }

  /** Elimina todos los registros que coincidan con los filtros activos (sin paginación). */
  async function deleteAll() {
    const all = await exportAll()
    if (all.length === 0) return 0
    await batchSettled(all, item => api.delete(item.id))
    try { await fetchPage(0) } catch { /* ignore */ }
    return all.length
  }

  function select(item) {
  }

  function clear() {
    _items.value         = []
    _selected.value      = null
    _page.value          = 0
    _totalElements.value = 0
    _totalPages.value    = 0
    _activeFilters.value = { statuses: [], types: [], entryReasons: [], search: '' }
  }

  return {
    items,
    selected,
    pagination,
    activeFilters,
    fetchAll,
    fetchPage,
    applyFilters,
    goToPage,
    exportAll,
    fetchById,
    create,
    update,
    remove,
    bulkCreate,
    bulkRemove,
    deleteAll,
    registerExit,
    registerReturn,
    fetchByVehicleId,
    fetchVehicleContext,
    fetchAttachments,
    deleteAttachment,
    fetchNotificationStatus,
    resendWhatsApp,
    select,
    clear,
  }
})
