import { defineStore }        from 'pinia'
import { ref, computed }      from 'vue'
import { VehicleCatalogApi }  from '../infrastructure/api/vehicle-catalog.api.js'
import { VehicleAssembler }   from '../infrastructure/assemblers/vehicle.assembler.js'

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
  async function fetchVehicleSuggestions(term) {
    const response = await api.getSuggestions(term.trim(), 15)
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

  /** Export all vehicles matching current filters (no pagination). */
  async function exportAll() {
    const response = await api.exportVehicles(_activeFilters.value)
    return Array.isArray(response.data)
      ? response.data.map(r => VehicleAssembler.toEntityFromResource(r))
      : []
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
   * No lanza si alguno falla — devuelve { success, failed, total }.
   * Solo lanza si TODOS fallan.
   */
  async function bulkCreate(resources) {
    const results = await Promise.allSettled(
      resources.map(r => api.create(VehicleAssembler.toResource(r)))
    )
    await fetchPage(0)
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    if (success === 0) {
      throw new Error('No se pudo importar ningún registro. Verifica que las placas no estén duplicadas.')
    }
    return { total: resources.length, success, failed }
  }

  /**
   * Actualiza múltiples vehículos en el backend (un PATCH /bulk-update).
   * El backend procesa cada fila de forma independiente y devuelve un reporte detallado.
   * @param {Array} rows — filas del Excel ya mapeadas con claves current_plate, new_plate, brand, model, year, color
   * @returns {{ total, updated, ignored, failed, results: Array }}
   */
  async function bulkUpdate(rows) {
    const payload = rows.map(r => ({
      current_plate: r.currentPlate  ?? r.current_plate,
      new_plate:     r.newPlate      ?? r.new_plate      ?? null,
      brand:         r.brand         || null,
      model:         r.model         || null,
      year:          r.year          ? Number(r.year) : null,
      color:         r.color         || null,
    }))
    const result = await api.bulkUpdate(payload)
    await fetchPage(_page.value)
    return result
  }

  function select(vehicle) { _selected.value = vehicle }
  function clear() { _vehicles.value = []; _selected.value = null }

  return {
    vehicles, selected, pagination,
    fetchByLicensePlate, fetchVehicleSuggestions, fetchVehicles, goToPage, exportAll, refreshLastQuery,
    fetchById, create, update, remove, bulkCreate, bulkUpdate,
    select, clear,
  }
})
