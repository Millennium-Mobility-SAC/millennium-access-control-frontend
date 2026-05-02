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
}
