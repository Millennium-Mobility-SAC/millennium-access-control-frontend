import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EmployeeManagementApi } from '../infrastructure/api/employee-management.api.js'
import { EmployeeAssembler } from '../infrastructure/assemblers/employee.assembler.js'

export const useEmployeeManagementStore = defineStore('employee-management', () => {
  const api = new EmployeeManagementApi()
  const _employees = ref([])
  const _selected = ref(null)
  const _attendance = ref([])

  const employees = computed(() => _employees.value)
  const selected = computed(() => _selected.value)
  const attendance = computed(() => _attendance.value)

  async function fetchAll() {
    const response = await api.getAll()
    _employees.value = EmployeeAssembler.toEntitiesFromResponse(response)
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    _selected.value = EmployeeAssembler.toEntityFromResponse(response)
  }

  async function create(resource) {
    const response = await api.create(EmployeeAssembler.toResource(resource))
    const created = EmployeeAssembler.toEntityFromResponse(response)
    _employees.value = [created, ..._employees.value]
    _selected.value = created
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
    const results = await Promise.allSettled(resources.map(r => api.create(EmployeeAssembler.toResource(r))))
    await fetchAll()
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    if (success === 0) throw new Error('No se pudo importar ningún empleado.')
    return { total: resources.length, success, failed }
  }

  async function fetchAttendance(employeeId) {
    const response = await api.getAttendanceHistory(employeeId)
    _attendance.value = EmployeeAssembler.attendanceListFromResponse(response)
    return _attendance.value
  }

  return {
    employees,
    selected,
    attendance,
    fetchAll,
    fetchById,
    create,
    update,
    remove,
    bulkCreate,
    fetchAttendance,
  }
})
