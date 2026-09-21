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
   * Filtros de unidades, comunes al resumen y a las descargas: «descargar nuevas» con la tabla
   * filtrada tiene que llevar exactamente las unidades que se ven.
   *
   * Las listas viajan separadas por comas, igual que en `VehicleCatalogApi.buildParams`: es lo
   * que espera la conversión de `@RequestParam List<T>` de Spring.
   */
  #unitParams(filters = {}) {
    const params = {}
    if (filters.search?.trim()) params.search = filters.search.trim()
    if (filters.contractStatuses?.length) params.contract_statuses = filters.contractStatuses.join(',')
    if (filters.issuers?.length) params.issuers = filters.issuers.join(',')
    if (filters.advisor) params.advisor = filters.advisor
    if (filters.commercialBrand) params.commercial_brand = filters.commercialBrand
    return params
  }

  /** Parámetros del resumen: los de unidades más situación, etapa y orden. */
  #summaryParams(filters = {}) {
    const params = this.#unitParams(filters)
    if (filters.hasFines != null) params.has_fines = filters.hasFines
    if (filters.neverChecked != null) params.never_checked = filters.neverChecked
    if (filters.stage) params.stage = filters.stage
    if (filters.sort) params.sort = filters.sort
    return params
  }

  buildParams(filters = {}, page = 0, size = 20) {
    return { ...this.#summaryParams(filters), page, size }
  }

  getSummary(params) {
    return this.http.get(`${this.#endpoint.endpointPath}/summary`, { params })
  }

  getUnitDetail(unitId, includeResolved = false) {
    return this.http.get(`${this.#endpoint.endpointPath}/units/${unitId}`, {
      params: { include_resolved: includeResolved },
    })
  }

  /**
   * Encola la consulta de Callao y ATU. Con `all` el backend elige las unidades: activas y de
   * periodo recién terminado, las que llevan más tiempo sin consultarse primero. Responde 202 con
   * el lote; el resultado llega por sondeo.
   */
  launchQuery({ unitIds = [], all = false, issuers = [] } = {}) {
    return this.http.post(`${this.#endpoint.endpointPath}/queries`, {
      unit_ids: unitIds,
      all,
      issuers,
    })
  }

  /** SAT Lima para todo el inventario, por el RUC de la empresa. Corre en segundo plano. */
  refreshSat() {
    return this.http.post(`${this.#endpoint.endpointPath}/sat/refresh`)
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
   * Último lote de ese tipo (`PLATES` o `SAT_RUC`). Responde 204 si nunca se lanzó ninguno, así
   * que quien lo llame tiene que mirar el estado y no solo el cuerpo.
   */
  getLatestBatch(kind) {
    return this.http.get(`${this.#endpoint.endpointPath}/queries/latest`, { params: { kind } })
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

  downloadUnitExport(unitId, includeResolved = false) {
    return this.http.get(`${this.#endpoint.endpointPath}/units/${unitId}/export`, {
      params: { include_resolved: includeResolved },
      responseType: 'blob',
    })
  }

  // ── Descargas de papeletas (una fila por papeleta, con registro) ───────────

  /**
   * Cuánto llevaría ahora una descarga de «nuevas» con esos filtros. Situación y etapa no se
   * aplican: una descarga lleva todo lo que se debe de las unidades filtradas.
   */
  getPendingDeliveries(filters = {}) {
    return this.http.get(`${this.#endpoint.endpointPath}/deliveries/pending`, {
      params: this.#unitParams(filters),
    })
  }

  /**
   * Registra una descarga. `NEW_ONLY` deja lo que llevó como entregado para todos; `ALL` no.
   * Responde 201 con la descarga, o 200 sin descarga y con la última de «nuevas» si no había nada
   * que entregar. El archivo se baja aparte con `downloadDeliveryFile`.
   */
  createDelivery(kind, filters = {}) {
    return this.http.post(`${this.#endpoint.endpointPath}/deliveries`, {
      kind,
      search: filters.search?.trim() || null,
      contract_statuses: filters.contractStatuses ?? [],
      issuers: filters.issuers ?? [],
      advisor: filters.advisor ?? null,
      commercial_brand: filters.commercialBrand ?? null,
    })
  }

  getDeliveries(limit = 20) {
    return this.http.get(`${this.#endpoint.endpointPath}/deliveries`, { params: { limit } })
  }

  /** El archivo se regenera desde lo registrado: bajarlo otra vez da exactamente el mismo. */
  downloadDeliveryFile(deliveryId) {
    return this.http.get(`${this.#endpoint.endpointPath}/deliveries/${deliveryId}/file`, {
      responseType: 'blob',
    })
  }
}
