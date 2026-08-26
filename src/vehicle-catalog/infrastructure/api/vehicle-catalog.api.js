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
    if (filters.flowEntryReasons?.length)     params.flow_entry_reasons    = filters.flowEntryReasons.join(',')
    if (filters.temporalExitReasons?.length)  params.temporal_exit_reasons = filters.temporalExitReasons.join(',')
    if (filters.external?.length)             params.external              = filters.external.join(',')
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

  /** @param {string} vin */
  getByVin(vin) {
    return this.http.get(`${this.#endpoint.endpointPath}/vin/${encodeURIComponent(vin)}`)
  }

  /** Lista de vehículos para autocompletado (mín. 2 caracteres en servidor). */
  getSuggestions(term, limit = 15, external = null) {
    const params = { term, limit }
    if (external === true) params.external = true
    if (external === false) params.external = false
    return this.http.get(`${this.#endpoint.endpointPath}/suggestions`, {
      params,
    })
  }

  #exportParams(filters = {}) {
    const params = {}
    if (filters.statuses?.length)            params.statuses              = filters.statuses.join(',')
    if (filters.flowEntryReasons?.length)    params.flow_entry_reasons    = filters.flowEntryReasons.join(',')
    if (filters.temporalExitReasons?.length) params.temporal_exit_reasons = filters.temporalExitReasons.join(',')
    if (filters.external?.length)            params.external              = filters.external.join(',')
    if (filters.daysRange)                   params.days_range            = filters.daysRange
    if (filters.search?.trim())              params.search                = filters.search.trim()
    return params
  }

  /**
   * Descarga el XLSX del catálogo filtrado, ya armado por el backend.
   * Llega como blob porque el JWT viaja en cabecera: un enlace directo no se
   * autenticaría solo.
   */
  downloadExport(filters = {}) {
    return this.http.get(`${this.#endpoint.endpointPath}/export`, {
      params: this.#exportParams(filters),
      responseType: 'blob',
    })
  }

  /**
   * Una página del listado con los filtros de exportación aplicados.
   * Lo usa "eliminar todos" para enumerar ids: no puede compartir camino con la
   * descarga, que desde ahora devuelve un archivo y no filas.
   *
   * El backend topa `size` en 100 (GetPagedVehiclesQuery), así que quien
   * necesite el conjunto completo tiene que recorrer las páginas.
   */
  fetchMatchingPage(filters = {}, page = 0, size = 100) {
    return this.#endpoint.getAll({ ...this.#exportParams(filters), page, size })
  }

  /**
   * Sends a batch of vehicle update rows to the backend.
   * @param {Array<{current_plate:string, new_plate?:string, brand?:string, model?:string, year?:number, color?:string}>} items
   */
  bulkUpdate(items) {
    return this.http.patch(`${this.#endpoint.endpointPath}/bulk-update`, items)
  }
}
