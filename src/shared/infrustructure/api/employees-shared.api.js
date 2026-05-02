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

  getAttendanceHistory(employeeId) {
    return this.http.get(`${this.#endpoint.endpointPath}/${employeeId}/attendance`)
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
   * Sin `query` / sin filtros de fechas: GET sin parámetros (toda la data en servidor).
   * Con `dateFrom` y `dateTo` (y `search` opcional): listado filtrado.
   * Solo `search` (sin fechas): búsqueda por documento, nombre o cargo.
   *
   * @param {null|undefined|{ dateFrom?: string, dateTo?: string, search?: string }} query
   */
  getAttendanceRecords(query) {
    const path = `${this.#endpoint.endpointPath}/attendance-records`
    if (query == null) {
      return this.http.get(path)
    }
    const search = query.search?.trim() || ''
    const hasRange = Boolean(query.dateFrom && query.dateTo)
    if (!hasRange) {
      if (!search) {
        return this.http.get(path)
      }
      return this.http.get(path, { params: { search } })
    }
    const params = {
      date_from: query.dateFrom,
      date_to: query.dateTo,
    }
    if (search) params.search = search
    return this.http.get(path, { params })
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
