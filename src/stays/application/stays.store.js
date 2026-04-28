import { defineStore }          from 'pinia'
import { ref, computed }        from 'vue'
import { StaysApi }             from '../infrastructure/api/stays.api.js'
import { AccessEntryAssembler } from '../infrastructure/assemblers/access-entry.assembler.js'

export const useStaysStore = defineStore('stays', () => {
  const api = new StaysApi()

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
    const response = await api.create(AccessEntryAssembler.toResource(resource))
    const created = AccessEntryAssembler.toEntityFromResponse(response)
    _items.value = [created, ..._items.value]
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
    if (_selected.value?.id === id) _selected.value = null
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

  async function fetchAttachments(stayId) {
    const response = await api.getAttachments(stayId)
    return Array.isArray(response?.data) ? response.data : []
  }

  async function deleteAttachment(stayId, fileId) {
    await api.deleteAttachment(stayId, fileId)
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
    fetchAttachments,
    deleteAttachment,
    select,
    clear,
  }
})
