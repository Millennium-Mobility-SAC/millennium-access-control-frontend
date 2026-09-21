import { BaseApi } from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

/**
 * Inventario de unidades a consultar: importación del Excel de contratos y corrección manual de
 * una unidad. El listado es el resumen del módulo (`TrafficFinesApi.getSummary`).
 *
 * El Excel se sube tal cual y lo lee el backend. No se parsea aquí con ExcelJS: las celdas de fecha
 * llegan como `Date` a medianoche UTC y, formateadas en hora de Lima, se corren un día.
 */
export class TrafficFinesInventoryApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(
      this,
      `${import.meta.env.VITE_TRAFFIC_FINES_ENDPOINT ?? '/traffic-fines'}/inventory`,
    )
  }

  /**
   * Corrige el contrato de una unidad. Volver a subir el Excel solo agrega placas nuevas, así que
   * el estado y las fechas de una existente se cambian por aquí. Las fechas van como `YYYY-MM-DD`
   * y `null` deja la fecha vacía.
   */
  updateUnit(unitId, { contractStatus, contractStart, contractEnd, resolutionDate }) {
    return this.http.patch(`${this.#endpoint.endpointPath}/units/${unitId}`, {
      contract_status: contractStatus,
      contract_start: contractStart ?? null,
      contract_end: contractEnd ?? null,
      resolution_date: resolutionDate ?? null,
    })
  }

  /** Lee el archivo y lo compara con el inventario sin escribir nada. */
  previewImport(file) {
    const form = new FormData()
    form.append('file', file)
    // Sin Content-Type manual: el navegador/Axios tienen que añadir el boundary del multipart.
    return this.http.post(`${this.#endpoint.endpointPath}/imports/preview`, form)
  }

  /**
   * Aplica la importación. `expectedHash` es el que devolvió la vista previa: el backend responde
   * 409 si el archivo no es el mismo que se revisó.
   */
  applyImport(file, expectedHash) {
    const form = new FormData()
    form.append('file', file)
    if (expectedHash) form.append('expected_hash', expectedHash)
    return this.http.post(`${this.#endpoint.endpointPath}/imports`, form)
  }

  /** Asesores y marcas comerciales del inventario, para los filtros exactos. */
  getFacets() {
    return this.http.get(`${this.#endpoint.endpointPath}/facets`)
  }

  getImports(limit = 20) {
    return this.http.get(`${this.#endpoint.endpointPath}/imports`, { params: { limit } })
  }
}
