import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EmployeesSharedApi } from '@/shared/infrustructure/api/employees-shared.api.js'
import { EmployeeAssembler } from '@/employee-management/infrastructure/assemblers/employee.assembler.js'
import { AttendanceRecordAssembler } from '../infrastructure/assemblers/attendance-record.assembler.js'
import { sortAttendanceRecordsByRecencyDesc } from '../domain/sort-attendance-records.js'
import { pendingAttendanceAction, todayIsoLocal, findTodayAttendanceRow } from '@/shared/domain/employee-attendance-day.js'

/** Estado de la última carga: «todo» (GET sin params) o rango + búsqueda aplicados por el usuario. */
function initialLastQuery() {
  return {
    all: true,
    dateFrom: null,
    dateTo: null,
    search: '',
  }
}

export const useSecurityCheckpointStore = defineStore('security-checkpoint', () => {
  const api = new EmployeesSharedApi()
  const _records = ref([])
  const _lastQuery = ref(initialLastQuery())

  const attendanceRecords = computed(() => _records.value)

  /**
   * @param {null|undefined|{ dateFrom?: string|null, dateTo?: string|null, search?: string }} query
   * - `{}` o sin args: sin rango (toda la data o solo search si viene en el objeto).
   * - Nunca reutiliza la petición anterior implícitamente (evita lista «pegada» al limpiar filtros).
   * - Con dateFrom + dateTo: GET con filtros (y search opcional).
   */
  async function fetchAttendanceRecords(query = {}) {
    const raw = query ?? {}
    const dateFrom = raw.dateFrom ?? null
    const dateTo = raw.dateTo ?? null
    const search = (raw.search ?? '').trim()
    const hasRange = Boolean(dateFrom && dateTo)

    if (!hasRange) {
      _lastQuery.value = {
        all: true,
        dateFrom: null,
        dateTo: null,
        search,
      }
      const response = await api.getAttendanceRecords(search ? { search } : null)
      const rows = AttendanceRecordAssembler.listFromResponse(response)
      _records.value = sortAttendanceRecordsByRecencyDesc(rows)
      return _records.value
    }

    _lastQuery.value = {
      all: false,
      dateFrom,
      dateTo,
      search,
    }
    const response = await api.getAttendanceRecords({
      dateFrom,
      dateTo,
      search,
    })
    const rows = AttendanceRecordAssembler.listFromResponse(response)
    _records.value = sortAttendanceRecordsByRecencyDesc(rows)
    return _records.value
  }

  async function refreshLastQuery() {
    const q = _lastQuery.value
    if (q.all) {
      return fetchAttendanceRecords({
        dateFrom: null,
        dateTo: null,
        search: q.search ?? '',
      })
    }
    return fetchAttendanceRecords({
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      search: q.search ?? '',
    })
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
    await refreshLastQuery()
  }

  return {
    attendanceRecords,
    lastQuery: computed(() => _lastQuery.value),
    fetchAttendanceRecords,
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
