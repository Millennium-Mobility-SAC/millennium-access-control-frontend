import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EmployeesSharedApi } from '@/shared/infrustructure/api/employees-shared.api.js'
import { EmployeeAssembler } from '@/employee-management/infrastructure/assemblers/employee.assembler.js'
import { AttendanceRecordAssembler } from '../infrastructure/assemblers/attendance-record.assembler.js'
import { pendingAttendanceAction, todayIsoLocal, findTodayAttendanceRow } from '@/shared/domain/employee-attendance-day.js'

export const useSecurityCheckpointStore = defineStore('security-checkpoint', () => {
  const api = new EmployeesSharedApi()

  // Paginated state
  const _records = ref([])
  const _page = ref(0)
  const _size = ref(20)
  const _totalElements = ref(0)
  const _totalPages = ref(0)
  const _activeFilters = ref({ dateFrom: null, dateTo: null, search: '' })

  const attendanceRecords = computed(() => _records.value)
  const pagination = computed(() => ({
    page: _page.value,
    size: _size.value,
    totalElements: _totalElements.value,
    totalPages: _totalPages.value,
  }))

  async function fetchPage(page) {
    const { dateFrom, dateTo, search } = _activeFilters.value
    const response = await api.getAttendanceRecords({
      dateFrom,
      dateTo,
      search,
      page,
      size: _size.value,
    })
    const data = response.data
    const content = data?.content ?? data
    const rows = (Array.isArray(content) ? content : []).map(r => AttendanceRecordAssembler.fromResource(r))
    _records.value = rows
    _page.value = data?.page ?? page
    _totalElements.value = data?.total_elements ?? rows.length
    _totalPages.value = data?.total_pages ?? 1
    return rows
  }

  /**
   * Sets active filters and fetches page 0.
   * @param {null|undefined|{ dateFrom?: string|null, dateTo?: string|null, search?: string }} query
   */
  async function fetchAttendanceRecords(query = {}) {
    const raw = query ?? {}
    _activeFilters.value = {
      dateFrom: raw.dateFrom ?? null,
      dateTo: raw.dateTo ?? null,
      search: (raw.search ?? '').trim(),
    }
    return fetchPage(0)
  }

  async function goToPage(page) {
    return fetchPage(page)
  }

  /** Exports all records matching the current active filters (no pagination). */
  async function exportAll() {
    const { dateFrom, dateTo, search } = _activeFilters.value
    const response = await api.exportAttendanceRecords({ dateFrom, dateTo, search })
    if (!Array.isArray(response?.data)) return []
    return response.data.map(r => AttendanceRecordAssembler.fromResource(r))
  }

  async function refreshLastQuery() {
    return fetchPage(_page.value)
  }

  async function lookupEmployeeForAttendance(lookupTerm) {
    const response = await api.lookupForAttendance(lookupTerm.trim())
    return EmployeeAssembler.toEntityFromResponse(response)
  }

  /** @param {string} term */
  async function fetchEmployeeSuggestions(term) {
    const response = await api.getSuggestions(term.trim(), 15)
    return EmployeeAssembler.toEntitiesFromResponse(response)
  }

  /** @returns {Promise<{ action: 'INGRESO' | 'SALIDA' | null, todayRow: object|null }>} */
  async function getPendingActionForEmployee(employeeId) {
    const response = await api.getAttendanceHistory(employeeId)
    const rows = EmployeeAssembler.attendanceListFromResponse(response)
    const day = todayIsoLocal()
    return {
      action: pendingAttendanceAction(day, rows),
      todayRow: findTodayAttendanceRow(day, rows),
    }
  }

  async function registerCheckIn(employeeId) {
    await api.registerCheckIn(employeeId, { attendance_date: null, attendance_time: null })
    await refreshLastQuery()
  }

  async function registerCheckOut(employeeId) {
    await api.registerCheckOut(employeeId, { attendance_date: null, attendance_time: null })
    await refreshLastQuery()
  }

  async function updateAttendanceRecord(employeeId, attendanceId, payload) {
    await api.updateAttendance(employeeId, attendanceId, payload)
    await refreshLastQuery()
  }

  async function removeAttendanceRecord(employeeId, attendanceId) {
    await api.deleteAttendance(employeeId, attendanceId)
    // If removing the last item on a non-first page, go back one page
    if (_records.value.length <= 1 && _page.value > 0) {
      return fetchPage(_page.value - 1)
    }
    return fetchPage(_page.value)
  }

  return {
    attendanceRecords,
    pagination,
    fetchAttendanceRecords,
    goToPage,
    exportAll,
    refreshLastQuery,
    lookupEmployeeForAttendance,
    fetchEmployeeSuggestions,
    getPendingActionForEmployee,
    registerCheckIn,
    registerCheckOut,
    updateAttendanceRecord,
    removeAttendanceRecord,
  }
})

