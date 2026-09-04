/**
 * Un lote de consulta: una pulsación del botón sobre las unidades seleccionadas.
 */
export class TrafficFineBatch {
  constructor({
    batchId = null,
    providerJobId = null,
    status = null,
    settled = false,
    issuers = [],
    requestedAt = null,
    deadlineAt = null,
    completedAt = null,
    totalItems = 0,
    completedItems = 0,
    failedItems = 0,
    pendingItems = 0,
    finesCreated = 0,
    finesUpdated = 0,
    finesResolved = 0,
    errorMessage = null,
    items = [],
  } = {}) {
    this.batchId = batchId
    this.providerJobId = providerJobId
    this.status = status
    this.settled = settled
    this.issuers = issuers
    this.requestedAt = requestedAt
    this.deadlineAt = deadlineAt
    this.completedAt = completedAt
    this.totalItems = totalItems
    this.completedItems = completedItems
    this.failedItems = failedItems
    this.pendingItems = pendingItems
    this.finesCreated = finesCreated
    this.finesUpdated = finesUpdated
    this.finesResolved = finesResolved
    this.errorMessage = errorMessage
    this.items = items
  }

  /**
   * Porcentaje de avance.
   *
   * Se calcula sobre lo que ya no está pendiente y no sobre `completedItems`: las filas
   * omitidas y las fallidas nunca van a completarse, y contarlas como pendientes dejaría la
   * barra clavada por debajo del 100 % en un lote que ya terminó.
   */
  get progressPercent() {
    if (!this.totalItems) return 0
    const done = this.totalItems - this.pendingItems
    return Math.min(100, Math.max(0, Math.round((done / this.totalItems) * 100)))
  }

  get hasErrors() {
    return this.failedItems > 0 || this.status === 'FAILED' || this.status === 'TIMED_OUT'
  }
}
