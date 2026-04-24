import { BaseApi }      from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

export class VehicleCatalogApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(this, import.meta.env.VITE_VEHICLE_CATALOG_ENDPOINT ?? '/vehicles')
  }

  getAll(params)        { return this.#endpoint.getAll(params) }
  getById(id)           { return this.#endpoint.getById(id) }
  create(resource)      { return this.#endpoint.create(resource) }
  update(id, resource)  { return this.#endpoint.update(id, resource) }
  delete(id)            { return this.#endpoint.delete(id) }

  /** @param {string} licensePlate */
  getByLicensePlate(licensePlate) {
    return this.http.get(`${this.#endpoint.endpointPath}/license-plate/${encodeURIComponent(licensePlate)}`)
  }
}
