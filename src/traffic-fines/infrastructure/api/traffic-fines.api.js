import { BaseApi } from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

export class TrafficFinesApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(
      this,
      import.meta.env.VITE_TRAFFIC_FINES_ENDPOINT ?? '/traffic-fines',
    )
  }

  /**
   * Parámetros del resumen.
   *
   * Las listas viajan separadas por comas, igual que en `VehicleCatalogApi.buildParams`: es lo
   * que espera la conversión de `@RequestParam List<T>` de Spring.
   */
  #summaryParams(filters = {}) {
    const params = {}
    if (filters.issuers?.length) params.issuers = filters.issuers.join(',')
    if (filters.search?.trim()) params.search = filters.search.trim()
    if (filters.hasFines != null) params.has_fines = filters.hasFines
    if (filters.neverChecked != null) params.never_checked = filters.neverChecked
    if (filters.sort) params.sort = filters.sort
    return params
  }

  buildParams(filters = {}, page = 0, size = 20) {
    return { ...this.#summaryParams(filters), page, size }
  }

  getSummary(params) {
    return this.http.get(`${this.#endpoint.endpointPath}/summary`, { params })
  }

  getVehicleDetail(vehicleId, includeResolved = false) {
    return this.http.get(`${this.#endpoint.endpointPath}/vehicles/${vehicleId}`, {
      params: { include_resolved: includeResolved },
    })
  }

  /** Encola la consulta. Responde 202 con el lote: el resultado llega por sondeo. */
  launchQuery(vehicleIds, issuers = []) {
    return this.http.post(`${this.#endpoint.endpointPath}/queries`, {
      vehicle_ids: vehicleIds,
      issuers,
    })
  }

  getBatch(batchId) {
    return this.http.get(`${this.#endpoint.endpointPath}/queries/${batchId}`)
  }

  /**
   * Suelta un lote sin esperar a su plazo. Devuelve el lote ya cerrado, así que la vista no
   * necesita volver a preguntar por él.
   */
  cancelBatch(batchId) {
    return this.http.post(`${this.#endpoint.endpointPath}/queries/${batchId}/cancel`)
  }

  /**
   * Último lote del sistema. Responde 204 si nunca se lanzó ninguno, así que quien lo llame
   * tiene que mirar el estado y no solo el cuerpo.
   */
  getLatestBatch() {
    return this.http.get(`${this.#endpoint.endpointPath}/queries/latest`)
  }

  /**
   * El XLSX lo arma el backend. Llega como blob porque el JWT viaja en cabecera: un enlace
   * directo no se autenticaría solo.
   */
  downloadSummaryExport(filters = {}) {
    return this.http.get(`${this.#endpoint.endpointPath}/summary/export`, {
      params: this.#summaryParams(filters),
      responseType: 'blob',
    })
  }

  downloadVehicleExport(vehicleId, includeResolved = false) {
    return this.http.get(`${this.#endpoint.endpointPath}/vehicles/${vehicleId}/export`, {
      params: { include_resolved: includeResolved },
      responseType: 'blob',
    })
  }
}
