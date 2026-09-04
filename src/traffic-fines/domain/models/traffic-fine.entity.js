/**
 * Una papeleta.
 */
export class TrafficFine {
  constructor({
    id = null,
    issuer = null,
    ticketNumber = null,
    infractionDate = null,
    infractionDateRaw = null,
    totalAmount = 0,
    discountAmount = 0,
    amountDue = 0,
    issuerStatus = null,
    status = null,
    firstSeenAt = null,
    resolvedAt = null,
    updatedAt = null,
  } = {}) {
    this.id = id
    this.issuer = issuer
    this.ticketNumber = ticketNumber
    this.infractionDate = infractionDate
    this.infractionDateRaw = infractionDateRaw
    this.totalAmount = totalAmount
    this.discountAmount = discountAmount
    this.amountDue = amountDue
    this.issuerStatus = issuerStatus
    this.status = status
    this.firstSeenAt = firstSeenAt
    this.resolvedAt = resolvedAt
    this.updatedAt = updatedAt
  }

  get isResolved() {
    return this.status === 'RESUELTA'
  }

  /**
   * El portal no siempre da un número: cuando falta se muestra un guion, nunca una cadena
   * vacía que parecería un fallo de carga.
   */
  get displayTicketNumber() {
    return this.ticketNumber?.trim() || '—'
  }
}
