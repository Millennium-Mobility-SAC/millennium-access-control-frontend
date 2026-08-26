import { defineStore }        from 'pinia'
import { ref, computed }      from 'vue'
import { VehicleCatalogApi }  from '../infrastructure/api/vehicle-catalog.api.js'
import { VehicleAssembler }   from '../infrastructure/assemblers/vehicle.assembler.js'
import { batchSettled }       from '@/shared/infrustructure/batch-settled.js'
import { humanizeApiError }   from '@/shared/infrustructure/api-error-humanizer.js'
import { downloadBlob, fileNameFromContentDisposition } from '@/shared/infrustructure/download-blob.js'
import { todayIsoLocal }      from '@/shared/domain/employee-attendance-day.js'

export const useVehicleCatalogStore = defineStore('vehicle-catalog', () => {
  const api = new VehicleCatalogApi()

  const _vehicles      = ref([])
  const _selected      = ref(null)
  const _page          = ref(0)
  const _size          = ref(20)
  const _totalElements = ref(0)
  const _totalPages    = ref(0)
  const _activeFilters = ref({})

  const vehicles   = computed(() => _vehicles.value)
  const selected   = computed(() => _selected.value)
  const pagination = computed(() => ({
    page:          _page.value,
    size:          _size.value,
    totalElements: _totalElements.value,
    totalPages:    _totalPages.value,
  }))

  /** Busca un vehículo por placa contra el backend. Retorna el entity o null. */
  async function fetchByLicensePlate(plate) {
    if (!plate) return null
    try {
      const response = await api.getByLicensePlate(plate.trim().toUpperCase())
      return VehicleAssembler.toEntityFromResponse(response)
    } catch {
      return null
    }
  }

  /** @param {string} term */
  async function fetchVehicleSuggestions(term, { external = null } = {}) {
    const response = await api.getSuggestions(term.trim(), 15, external)
    return VehicleAssembler.toEntitiesFromResponse(response)
  }

  /** Fetch a specific page using the currently active filters. */
  async function fetchPage(page) {
    const params = api.buildParams(_activeFilters.value, page, _size.value)
    const response = await api.getAll(params)
    const data = response.data
    _vehicles.value      = (data.content ?? []).map(r => VehicleAssembler.toEntityFromResource(r))
    _page.value          = data.page           ?? page
    _totalElements.value = data.total_elements ?? 0
    _totalPages.value    = data.total_pages    ?? 0
  }

  /** Apply new filter criteria and reload from page 0. */
  async function fetchVehicles(filters = {}) {
    _activeFilters.value = { ...filters }
    await fetchPage(0)
  }

  /** Navigate to a specific page (filters stay the same). */
  async function goToPage(page) {
    await fetchPage(page)
  }

  /**
   * Descarga el XLSX del catálogo con los filtros activos y dispara el guardado.
   * El archivo lo arma el backend: el cliente solo lo entrega al navegador.
   */
  async function downloadExport() {
    const response = await api.downloadExport(_activeFilters.value)
    // Fecha local, no toISOString: en Lima (UTC-5) el UTC ya es del dia
    // siguiente a partir de las 19:00 y el archivo saldria fechado mañana.
    const fallback = `catalogo-vehiculos-${todayIsoLocal()}.xlsx`
    const fileName = fileNameFromContentDisposition(
      response.headers?.['content-disposition'], fallback)
    downloadBlob(response.data, fileName)
    return fileName
  }

  /**
   * Todas las entidades que coinciden con los filtros activos.
   *
   * Separado de {@link downloadExport} a propósito: comparten filtros pero no
   * respuesta, y "eliminar todos" necesita ids, no un archivo.
   *
   * Recorre las páginas porque el backend topa `size` en 100: pedir una sola
   * página dejaría el borrado a medias y reportando éxito.
   */
  async function fetchAllMatching() {
    const PAGE_SIZE = 100
    const MAX_PAGES = 200          // 20 000 filas; salvaguarda contra un bucle infinito
    const all = []
    let page = 0
    let totalPages = 1

    while (page < totalPages && page < MAX_PAGES) {
      const { data } = await api.fetchMatchingPage(_activeFilters.value, page, PAGE_SIZE)
      const rows = data?.content ?? []
      all.push(...rows.map(r => VehicleAssembler.toEntityFromResource(r)))
      totalPages = data?.total_pages ?? 1
      if (rows.length === 0) break
      page++
    }
    return all
  }

  /** Reload the current page (used after mutations). */
  async function refreshLastQuery() {
    await fetchPage(_page.value)
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    const entity = VehicleAssembler.toEntityFromResponse(response)
    if (entity) _selected.value = entity
    return entity
  }

  async function create(resource) {
    const response = await api.create(VehicleAssembler.toResource(resource))
    const created = VehicleAssembler.toEntityFromResponse(response)
    _selected.value = created
    await fetchPage(0)
    return created
  }

  async function update(id, resource) {
    const response = await api.update(id, VehicleAssembler.toResource(resource))
    const updated = VehicleAssembler.toEntityFromResponse(response)
    if (_selected.value?.id === id) _selected.value = updated
    await fetchPage(_page.value)
  }

  async function remove(id) {
    await api.delete(id)
    if (_selected.value?.id === id) _selected.value = null
    const newPage = (_vehicles.value.length === 1 && _page.value > 0)
      ? _page.value - 1
      : _page.value
    await fetchPage(newPage)
  }

  /**
   * Crea múltiples vehículos en paralelo.
   * No lanza si alguno falla — devuelve { success, failed, total, failedRows }.
   */
  async function bulkCreate(resources) {
    const results = await batchSettled(resources, r => api.create(VehicleAssembler.toResource(r)))
    await fetchPage(0)
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    const failedRows = results
      .map((r, i) => r.status === 'rejected'
        ? { row: resources[i], reason: humanizeApiError(r.reason) }
        : null)
      .filter(Boolean)
    return { total: resources.length, success, failed, failedRows }
  }

  /**
   * Elimina todos los vehículos que coincidan con los filtros activos.
   * Va por tandas: cada DELETE arrastra además el historial de estancias de la
   * unidad, así que no son peticiones baratas y lanzarlas todas a la vez satura
   * el pool de conexiones del navegador y el servidor.
   */
  async function deleteAll() {
    const all = await fetchAllMatching()
    if (all.length === 0) return 0
    const results = await batchSettled(all, item => api.delete(item.id))
    const deleted = results.filter(r => r.status === 'fulfilled').length
    try { await fetchPage(0) } catch { /* ignore */ }
    return deleted
  }

  /**
   * Reconcilia VIN y placa de varias unidades (un PATCH /bulk-update).
   *
   * Ya no es un reemplazo de placa: cada fila identifica la unidad por VIN —o
   * por placa, como respaldo— y completa la identidad que falte. El backend
   * procesa las filas de forma independiente y devuelve un reporte detallado.
   *
   * @param {Array} rows — filas del Excel con claves vin, licensePlate, brand, model, year, color
   * @returns {{ total, updated, ignored, failed, results: Array }}
   */
  async function bulkUpdate(rows) {
    const payload = rows.map(r => ({
      vin:           normalizeIdentity(r.vin ?? r.VIN),
      license_plate: normalizeIdentity(r.licensePlate ?? r.license_plate ?? r.plate),
      brand:         r.brand || null,
      model:         r.model || null,
      year:          r.year ? Number(r.year) : null,
      color:         r.color || null,
    }))
    const { data } = await api.bulkUpdate(payload)
    await fetchPage(_page.value)
    return data
  }

  /** Forma canónica de placa y VIN, igual que en el assembler. */
  function normalizeIdentity(v) {
    if (v == null || v === '') return null
    const s = String(v).trim()
    return s.length ? s.toUpperCase() : null
  }

  function select(vehicle) { _selected.value = vehicle }
  function clear() { _vehicles.value = []; _selected.value = null }

  return {
    vehicles, selected, pagination,
    fetchByLicensePlate, fetchVehicleSuggestions, fetchVehicles, goToPage, downloadExport, fetchAllMatching, refreshLastQuery,
    fetchById, create, update, remove, bulkCreate, bulkUpdate, deleteAll,
    select, clear,
  }
})
