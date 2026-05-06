import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EmployeeManagementApi } from '../infrastructure/api/employee-management.api.js'
import { EmployeeAssembler } from '../infrastructure/assemblers/employee.assembler.js'

export const useEmployeeManagementStore = defineStore('employee-management', () => {
  const api = new EmployeeManagementApi()

  // ── Employee list ────────────────────────────────────────────────────────
  const _employees        = ref([])
  const _empPage          = ref(0)
  const _empSize          = ref(20)
  const _empTotalElements = ref(0)
  const _empTotalPages    = ref(0)
  const _empActiveFilters = ref({})

  // ── Selected employee (detail view) ─────────────────────────────────────
  const _selected = ref(null)

  // ── Attendance (detail view) ─────────────────────────────────────────────
  const _attendance           = ref([])
  const _attPage              = ref(0)
  const _attSize              = ref(20)
  const _attTotalElements     = ref(0)
  const _attTotalPages        = ref(0)
  const _attActiveFilters     = ref({})
  const _attCurrentEmployeeId = ref(null)

  // ── Computed ─────────────────────────────────────────────────────────────
  const employees  = computed(() => _employees.value)
  const selected   = computed(() => _selected.value)
  const attendance = computed(() => _attendance.value)

  const empPagination = computed(() => ({
    page:          _empPage.value,
    size:          _empSize.value,
    totalElements: _empTotalElements.value,
    totalPages:    _empTotalPages.value,
  }))

  const attPagination = computed(() => ({
    page:          _attPage.value,
    size:          _attSize.value,
    totalElements: _attTotalElements.value,
    totalPages:    _attTotalPages.value,
  }))

  // ── Employee list actions ─────────────────────────────────────────────────
  async function _fetchEmpPage(page) {
    const params = api.buildParams(_empActiveFilters.value, page, _empSize.value)
    const response = await api.getAll(params)
    const data = response.data
    _employees.value       = EmployeeAssembler.toEntitiesFromResponse({ data: data.content })
    _empPage.value         = data.page
    _empTotalElements.value = data.total_elements
    _empTotalPages.value   = data.total_pages
  }

  async function fetchEmployees(filters = {}) {
    _empActiveFilters.value = filters
    await _fetchEmpPage(0)
  }

  async function goToEmpPage(page) {
    await _fetchEmpPage(page)
  }

  async function exportEmployees() {
    const response = await api.exportEmployees(_empActiveFilters.value)
    return EmployeeAssembler.toEntitiesFromResponse({
      data: Array.isArray(response.data) ? response.data : [],
    })
  }

  async function refreshEmpPage() {
    await _fetchEmpPage(_empPage.value)
  }

  async function fetchById(id) {
    const response = await api.getById(id)
    _selected.value = EmployeeAssembler.toEntityFromResponse(response)
  }

  async function create(resource) {
    await api.create(EmployeeAssembler.toResource(resource))
    await _fetchEmpPage(0)
  }

  async function update(id, resource) {
    const response = await api.update(id, EmployeeAssembler.toResource(resource))
    const updated = EmployeeAssembler.toEntityFromResponse(response)
    if (_selected.value?.id === id) _selected.value = updated
    await _fetchEmpPage(_empPage.value)
  }

  async function remove(id) {
    await api.delete(id)
    const isLast = _employees.value.length === 1 && _empPage.value > 0
    await _fetchEmpPage(isLast ? _empPage.value - 1 : _empPage.value)
  }

  async function bulkCreate(resources) {
    const results = await Promise.allSettled(
      resources.map(r => api.create(EmployeeAssembler.toResource(r)))
    )
    await _fetchEmpPage(0)
    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    if (success === 0) throw new Error('No se pudo importar ningún empleado.')
    return { total: resources.length, success, failed }
  }

  // ── Attendance actions ────────────────────────────────────────────────────
  async function _fetchAttPage(employeeId, page) {
    const params = api.buildAttParams(_attActiveFilters.value, page, _attSize.value)
    const response = await api.getAttendanceHistoryPaged(employeeId, params)
    const data = response.data
    _attendance.value       = EmployeeAssembler.attendanceListFromResponse({ data: data.content })
    _attPage.value          = data.page
    _attTotalElements.value = data.total_elements
    _attTotalPages.value    = data.total_pages
  }

  async function fetchAttendance(employeeId, filters = {}) {
    _attCurrentEmployeeId.value = employeeId
    _attActiveFilters.value     = filters
    await _fetchAttPage(employeeId, 0)
  }

  async function goToAttPage(page) {
    const id = _attCurrentEmployeeId.value
    if (id == null) return
    await _fetchAttPage(id, page)
  }

  async function exportAttendance() {
    const id = _attCurrentEmployeeId.value
    if (id == null) return []
    const response = await api.exportAttendanceHistory(id, _attActiveFilters.value)
    return EmployeeAssembler.attendanceListFromResponse({
      data: Array.isArray(response.data) ? response.data : [],
    })
  }

  return {
    employees,
    selected,
    attendance,
    empPagination,
    attPagination,
    fetchEmployees,
    goToEmpPage,
    exportEmployees,
    refreshEmpPage,
    fetchById,
    create,
    update,
    remove,
    bulkCreate,
    fetchAttendance,
    goToAttPage,
    exportAttendance,
  }
})

