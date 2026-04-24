import { BaseApi }      from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

export class StaffManagementApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(this, import.meta.env.VITE_STAFF_MANAGEMENT_ENDPOINT ?? '/profiles')
  }

  /** GET /profiles */
  getAll(params) {
    return this.#endpoint.getAll(params)
  }

  /** GET /profiles/others — returns all profiles except the authenticated user's */
  getOthers() {
    return this.http.get(`${this.#endpoint.endpointPath}/others`)
  }

  /** GET /profiles/{profileId} */
  getById(id) {
    return this.#endpoint.getById(id)
  }

  /** GET /profiles/user/{userId} */
  getByUserId(userId) {
    return this.http.get(`${this.#endpoint.endpointPath}/user/${userId}`)
  }

  /** POST /profiles */
  create(resource) {
    return this.#endpoint.create(resource)
  }

  /** PUT /profiles/{profileId} */
  update(id, resource) {
    return this.#endpoint.update(id, resource)
  }

  /** PATCH /profiles/{profileId} */
  patch(id, resource) {
    return this.http.patch(`${this.#endpoint.endpointPath}/${id}`, resource)
  }

  /** DELETE /profiles/{profileId} */
  delete(id) {
    return this.#endpoint.delete(id)
  }
}
