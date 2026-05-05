import { defineStore }        from 'pinia'
import { ref, computed }      from 'vue'
import { VehicleCatalogApi }  from '../infrastructure/api/vehicle-catalog.api.js'
import { VehicleAssembler }   from '../infrastructure/assemblers/vehicle.assembler.js'

export const useVehicleCatalogStore = defineStore('vehicle-catalog', () => {
  const api = new VehicleCatalogApi()

  const _vehicles = ref([])
  const _selected = ref(null)

  const vehicles = computed(() => _vehicles.value)
  const selected = computed(() => _selected.value)

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

  async function fetchAll() {
    const response = await api.getAll()
    _vehicles.value = VehicleAssembler.toEntitiesFromResponse(response)
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
    _vehicles.value = [created, ..._vehicles.value]
    _selected.value = created
  }

  async function update(id, resource) {
    const response = await api.update(id, VehicleAssembler.toResource(resource))
    const updated = VehicleAssembler.toEntityFromResponse(response)
    _vehicles.value = _vehicles.value.map(vehicle => vehicle.id === id ? updated : vehicle)
    if (_selected.value?.id === id) _selected.value = updated
  }

  async function remove(id) {
    await api.delete(id)
    _vehicles.value = _vehicles.value.filter(vehicle => vehicle.id !== id)
    if (_selected.value?.id === id) _selected.value = null
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
    await fetchAll()
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
    await fetchAll()
    return result
  }

  function select(vehicle) { _selected.value = vehicle }
  function clear() { _vehicles.value = []; _selected.value = null }

  return { vehicles, selected, fetchByLicensePlate, fetchAll, fetchById, create, update, remove, bulkCreate, bulkUpdate, select, clear }
})
