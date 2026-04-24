import { defineStore }          from 'pinia'
import { ref, computed }        from 'vue'
import { AccessControlApi }     from '../infrastructure/api/access-control.api.js'
import { AccessEntryAssembler } from '../infrastructure/assemblers/access-entry.assembler.js'

export const useAccessControlStore = defineStore('access-control', () => {
  const api = new AccessControlApi()

  const _items    = ref([])
  const _selected = ref(null)

  const items    = computed(() => _items.value)
  const selected = computed(() => _selected.value)

  async function fetchAll() {
    const response = await api.getAll()
    _items.value = AccessEntryAssembler.toEntitiesFromResponse(response)
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    _selected.value = AccessEntryAssembler.toEntityFromResponse(response)
  }

  async function create(resource) {
    await api.create(AccessEntryAssembler.toResource(resource))
    await fetchAll()
  }

  async function update(id, resource) {
    await api.update(id, AccessEntryAssembler.toResource(resource))
    await fetchAll()
  }

  async function remove(id) {
    await api.delete(id)
    await fetchAll()
  }

  async function registerExit(id, exitForm) {
    if (exitForm.exitType === 'TEMPORAL') {
      await api.registerTemporalExit(id, AccessEntryAssembler.toTemporalExitResource(exitForm))
    } else {
      await api.registerExit(id, AccessEntryAssembler.toExitResource(exitForm))
    }
    await fetchAll()
  }

  async function registerReturn(id, returnForm) {
    await api.registerReturn(id, AccessEntryAssembler.toReturnResource(returnForm))
    await fetchAll()
  }

  async function fetchByVehicleId(vehicleId) {
    const response = await api.getByVehicleId(vehicleId)
    return AccessEntryAssembler.toEntitiesFromResponse(response)
  }

  /**
   * Crea múltiples entradas de acceso (tipo VEHICULO) en paralelo.
   * No lanza si alguno falla — devuelve { success, failed, total }.
   * Solo lanza si TODOS fallan.
   */
  async function bulkCreate(resources) {
    const results = await Promise.allSettled(
      resources.map(r => api.create(AccessEntryAssembler.toResource({ ...r, type: r.type ?? 'VEHICULO' })))
    )
    await fetchAll()
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    if (success === 0) {
      throw new Error('No se pudo importar ningún registro. Verifica los datos e inténtalo de nuevo.')
    }
    return { total: resources.length, success, failed }
  }

  function select(item) {
    _selected.value = item
  }

  function clear() {
    _items.value    = []
    _selected.value = null
  }

  return {
    items,
    selected,
    fetchAll,
    fetchById,
    create,
    update,
    remove,
    bulkCreate,
    registerExit,
    registerReturn,
    fetchByVehicleId,
    select,
    clear,
  }
})
