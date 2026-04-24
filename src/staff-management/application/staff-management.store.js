import { defineStore }       from 'pinia'
import { ref, computed }     from 'vue'
import { StaffManagementApi }  from '../infrastructure/api/staff-management.api.js'
import { EmployeeAssembler }   from '../infrastructure/assemblers/employee.assembler.js'

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
    await api.create(EmployeeAssembler.toResource(resource))
    await fetchAll()
  }

  async function update(id, resource) {
    await api.update(id, EmployeeAssembler.toResource(resource))
    await fetchAll()
  }

  async function remove(id) {
    await api.delete(id)
    await fetchAll()
  }

  async function bulkCreate(resources) {
    const results = await Promise.allSettled(
      resources.map(r => api.create(EmployeeAssembler.toResource(r)))
    )
    await fetchAll()
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    if (success === 0) throw new Error('No se pudo importar ningún colaborador.')
    return { total: resources.length, success, failed }
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
