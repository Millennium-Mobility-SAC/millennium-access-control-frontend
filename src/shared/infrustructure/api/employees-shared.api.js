import { BaseApi } from '../base-api.js'
import { BaseEndpoint } from '../base-endpoint.js'

const EMPLOYEES_BASE_PATH = import.meta.env.VITE_EMPLOYEE_MANAGEMENT_ENDPOINT ?? '/employees'

/**
 * Lectura del padrón de empleados + registro de asistencia (ingreso/salida).
 * Contrato HTTP estable consumible por cualquier módulo de UI (portería, admin, etc.).
 */
export class EmployeesSharedApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(this, EMPLOYEES_BASE_PATH)
  }

  /** Ruta base `/employees` (para extensiones CRUD en EmployeeManagementApi). */
  get employeesPath() {
    return this.#endpoint.endpointPath
  }

  getAll(params) {
    return this.#endpoint.getAll(params)
  }

  getById(id) {
    return this.#endpoint.getById(id)
  }

  /**
   * Historial de asistencia de un empleado (paginado).
   * @param {number|string} employeeId
   * @param {null|undefined|{ dateFrom?: string, dateTo?: string, search?: string, page?: number, size?: number }} [query]
   */
  getAttendanceHistory(employeeId, query) {
    const params = {}
    if (query?.dateFrom) params.date_from = query.dateFrom
    if (query?.dateTo) params.date_to = query.dateTo
    const search = query?.search?.trim()
    if (search) params.search = search
    if (query?.page != null) params.page = query.page
    if (query?.size != null) params.size = query.size
    return this.http.get(`${this.#endpoint.endpointPath}/${employeeId}/attendance`, { params })
  }

  registerCheckIn(employeeId, payload = {}) {
    return this.http.post(`${this.#endpoint.endpointPath}/${employeeId}/attendance/check-in`, payload)
  }

  registerCheckOut(employeeId, payload = {}) {
    return this.http.post(`${this.#endpoint.endpointPath}/${employeeId}/attendance/check-out`, payload)
  }

  updateAttendance(employeeId, attendanceId, payload) {
    return this.http.put(
      `${this.#endpoint.endpointPath}/${employeeId}/attendance/${attendanceId}`,
      payload
    )
  }

  deleteAttendance(employeeId, attendanceId) {
    return this.http.delete(`${this.#endpoint.endpointPath}/${employeeId}/attendance/${attendanceId}`)
  }

  /**
   * Paginated attendance records. Pass `page` and `size` for pagination.
   * Date range and search are optional filters.
   *
   * @param {null|undefined|{ dateFrom?: string, dateTo?: string, search?: string, page?: number, size?: number }} query
   */
  getAttendanceRecords(query) {
    const path = `${this.#endpoint.endpointPath}/attendance-records`
    const params = {}
    if (query?.dateFrom) params.date_from = query.dateFrom
    if (query?.dateTo) params.date_to = query.dateTo
    const search = query?.search?.trim()
    if (search) params.search = search
    params.page = query?.page ?? 0
    params.size = query?.size ?? 20
    return this.http.get(path, { params })
  }

  /**
   * Export all attendance records matching the given filters (no pagination cap).
   *
   * @param {null|undefined|{ dateFrom?: string, dateTo?: string, search?: string }} query
   */
  exportAttendanceRecords(query) {
    const path = `${this.#endpoint.endpointPath}/attendance-records/export`
    const params = {}
    if (query?.dateFrom) params.date_from = query.dateFrom
    if (query?.dateTo) params.date_to = query.dateTo
    const search = query?.search?.trim()
    if (search) params.search = search
    return Object.keys(params).length > 0
      ? this.http.get(path, { params })
      : this.http.get(path)
  }

  /** @param {string} lookupTerm — documento o nombre (coincidencia por documento primero, luego nombre). */
  lookupForAttendance(lookupTerm) {
    return this.http.get(`${this.#endpoint.endpointPath}/lookup`, {
      params: { q: lookupTerm },
    })
  }

  /** Lista de empleados para autocompletado (mín. 2 caracteres en servidor). */
  getSuggestions(term, limit = 15) {
    return this.http.get(`${this.#endpoint.endpointPath}/suggestions`, {
      params: { term, limit },
    })
  }
}
