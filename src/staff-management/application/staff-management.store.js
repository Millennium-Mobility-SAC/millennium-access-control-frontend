import { defineStore }       from 'pinia'
import { ref, computed }     from 'vue'
import { StaffManagementApi }  from '../infrastructure/api/staff-management.api.js'
import { EmployeeAssembler }   from '../infrastructure/assemblers/employee.assembler.js'
import { batchSettled }        from '@/shared/infrustructure/batch-settled.js'
import { humanizeApiError }    from '@/shared/infrustructure/api-error-humanizer.js'

export const useStaffManagementStore = defineStore('staff-management', () => {
  const api = new StaffManagementApi()

  const _employees = ref([])
  const _selected  = ref(null)

  const employees = computed(() => _employees.value)
  const selected  = computed(() => _selected.value)

  async function fetchAll() {
    const response = await api.getOthers()
    _employees.value = EmployeeAssembler.toEntitiesFromResponse(response)
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    _selected.value = EmployeeAssembler.toEntityFromResponse(response)
  }

  async function create(resource) {
    const response = await api.create(EmployeeAssembler.toResource(resource))
    const created = EmployeeAssembler.toEntityFromResponse(response)
    if (created) {
      _employees.value = [created, ..._employees.value]
      _selected.value = created
    } else {
      await fetchAll()
    }
  }

  async function update(id, resource) {
    const response = await api.update(id, EmployeeAssembler.toResource(resource))
    const updated = EmployeeAssembler.toEntityFromResponse(response)
    _employees.value = _employees.value.map(employee => employee.id === id ? updated : employee)
    if (_selected.value?.id === id) _selected.value = updated
  }

  async function remove(id) {
    await api.delete(id)
    _employees.value = _employees.value.filter(employee => employee.id !== id)
    if (_selected.value?.id === id) _selected.value = null
  }

  async function bulkCreate(resources) {
    const results = await batchSettled(resources, r => api.create(EmployeeAssembler.toResource(r)))
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    const failedRows = results
      .map((r, i) => r.status === 'rejected'
        ? { row: resources[i], reason: humanizeApiError(r.reason) }
        : null)
      .filter(Boolean)
    try { await fetchAll() } catch { /* ignore */ }
    return { total: resources.length, success, failed, failedRows }
  }

  function select(employee) {
    _selected.value = employee
  }

  function clear() {
    _employees.value = []
    _selected.value  = null
  }

  return {
    employees,
    selected,
    fetchAll,
    fetchById,
    create,
    update,
    remove,
    bulkCreate,
    select,
    clear,
  }
})
