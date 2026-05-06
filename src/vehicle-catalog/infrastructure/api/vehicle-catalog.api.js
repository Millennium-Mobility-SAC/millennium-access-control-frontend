import { BaseApi }      from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

export class VehicleCatalogApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(this, import.meta.env.VITE_VEHICLE_CATALOG_ENDPOINT ?? '/vehicles')
  }

  /**
   * Build query params for the paginated GET /vehicles endpoint.
   * Arrays are serialised as comma-separated strings so Spring's
   * @RequestParam List<T> conversion picks them up correctly.
   */
  buildParams(filters = {}, page = 0, size = 20) {
    const params = { page, size }
    if (filters.statuses?.length)             params.statuses              = filters.statuses.join(',')
    if (filters.temporalExitReasons?.length)  params.temporal_exit_reasons = filters.temporalExitReasons.join(',')
    if (filters.daysRange)                    params.days_range            = filters.daysRange
    if (filters.search?.trim())              params.search                = filters.search.trim()
    return params
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

  /** Export all vehicles matching the given filters (no pagination). */
  exportVehicles(filters = {}) {
    const params = {}
    if (filters.statuses?.length)            params.statuses              = filters.statuses.join(',')
    if (filters.temporalExitReasons?.length) params.temporal_exit_reasons = filters.temporalExitReasons.join(',')
    if (filters.daysRange)                   params.days_range            = filters.daysRange
    if (filters.search?.trim())             params.search                = filters.search.trim()
    return this.http.get(`${this.#endpoint.endpointPath}/export`, { params })
  }

  /**
   * Sends a batch of vehicle update rows to the backend.
   * @param {Array<{current_plate:string, new_plate?:string, brand?:string, model?:string, year?:number, color?:string}>} items
   */
  bulkUpdate(items) {
    return this.http.patch(`${this.#endpoint.endpointPath}/bulk-update`, items)
  }
}
