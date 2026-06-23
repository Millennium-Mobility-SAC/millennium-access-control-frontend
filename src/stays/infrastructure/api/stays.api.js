import { BaseApi }      from '../../../shared/infrustructure/base-api.js'
import { BaseEndpoint } from '../../../shared/infrustructure/base-endpoint.js'

export class StaysApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = new BaseEndpoint(this, import.meta.env.VITE_STAYS_ENDPOINT ?? '/stays')
  }

  /** @returns {Promise} */
  getAll(params) {
    return this.#endpoint.getAll(params)
  }

  /** @param {number} id */
  getById(id) {
    return this.#endpoint.getById(id)
  }

  /** @param {Object} resource */
  create(resource) {
    return this.#endpoint.create(resource)
  }

  /** @param {number} id  @param {Object} resource */
  update(id, resource) {
    return this.#endpoint.update(id, resource)
  }

  /** @param {number} id */
  delete(id) {
    return this.#endpoint.delete(id)
  }

  /** @param {number} id  @param {Object} resource */
  registerExit(id, resource) {
    return this.http.patch(`${this.#endpoint.endpointPath}/${id}/salida-permanente`, resource)
  }

  /** @param {number} id  @param {Object} resource */
  registerTemporalExit(id, resource) {
    return this.http.patch(`${this.#endpoint.endpointPath}/${id}/salida-temporal`, resource)
  }

  /** @param {number} id  @param {Object} resource */
  registerReturn(id, resource) {
    return this.http.patch(`${this.#endpoint.endpointPath}/${id}/retorno`, resource)
  }

  /** @param {number} userId */
  getByUserId(userId) {
    return this.http.get(`${this.#endpoint.endpointPath}/by-user/${userId}`)
  }

  /** @param {number} profileId */
  getByProfileId(profileId) {
    return this.http.get(`${this.#endpoint.endpointPath}/by-profile/${profileId}`)
  }

  /** @param {number} vehicleId  @param {Object} [params] */
  getByVehicleId(vehicleId, params = { page: 0, size: 100 }) {
    return this.http.get(`${this.#endpoint.endpointPath}/by-vehicle/${vehicleId}`, { params })
  }

  getAttachments(stayId) {
    return this.http.get(`/integrations/storage/stays/${stayId}/files`)
  }

  deleteAttachment(stayId, fileId) {
    return this.http.delete(`/integrations/storage/stays/${stayId}/files/${fileId}`)
  }

  /** @param {number} stayId  @returns list of WhatsApp delivery attempts */
  getNotificationStatus(stayId) {
    return this.http.get(`${this.#endpoint.endpointPath}/${stayId}/notification-status`)
  }

  /**
   * Export all stays matching the given filters (no pagination, safety-capped at 5000).
   * @param {Object} [params] - Optional filter query params (status, type, entry_reason, search)
   */
  exportAll(params = {}) {
    return this.http.get(`${this.#endpoint.endpointPath}/export`, { params })
  }

  /** @param {number} stayId  @param {string|null} operationType  @param {number|null} temporalExitId  Triggers a manual resend; returns the new attempt */
  resendWhatsApp(stayId, operationType = null, temporalExitId = null) {
    const body = operationType ? { operationType, temporalExitId } : {}
    return this.http.post(`${this.#endpoint.endpointPath}/${stayId}/notify-whatsapp`, body)
  }
}
