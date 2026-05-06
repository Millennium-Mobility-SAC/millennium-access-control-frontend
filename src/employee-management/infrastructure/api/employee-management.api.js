import { EmployeesSharedApi } from '../../../shared/infrustructure/api/employees-shared.api.js'

export class EmployeeManagementApi extends EmployeesSharedApi {
  create(resource) {
    return this.http.post(this.employeesPath, resource)
  }

  update(id, resource) {
    return this.http.put(`${this.employeesPath}/${id}`, resource)
  }

  delete(id) {
    return this.http.delete(`${this.employeesPath}/${id}`)
  }

  /** Build query params for the paginated employee list. */
  buildParams(filters = {}, page = 0, size = 20) {
    const params = { page, size }
    if (filters.status) params.status = filters.status
    if (filters.search?.trim()) params.search = filters.search.trim()
    return params
  }

  /** Fetch all employees matching the given filters (for client-side XLSX export). */
  exportEmployees(filters = {}) {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.search?.trim()) params.search = filters.search.trim()
    return this.http.get(`${this.employeesPath}/export`, { params })
  }

  /** Build query params for the paginated per-employee attendance list. */
  buildAttParams(filters = {}, page = 0, size = 20) {
    const params = { page, size }
    if (filters.dateFrom) params.date_from = filters.dateFrom
    if (filters.dateTo)   params.date_to   = filters.dateTo
    if (filters.search?.trim()) params.search = filters.search.trim()
    return params
  }

  /** Paged attendance records for a single employee. */
  getAttendanceHistoryPaged(employeeId, params) {
    return this.http.get(`${this.employeesPath}/${employeeId}/attendance`, { params })
  }

  /** Full (unpaginated) attendance records for export. */
  exportAttendanceHistory(employeeId, filters = {}) {
    const params = {}
    if (filters.dateFrom) params.date_from = filters.dateFrom
    if (filters.dateTo)   params.date_to   = filters.dateTo
    if (filters.search?.trim()) params.search = filters.search.trim()
    return this.http.get(`${this.employeesPath}/${employeeId}/attendance/export`, { params })
  }
}

