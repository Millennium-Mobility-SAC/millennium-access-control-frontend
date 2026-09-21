/**
 * Una papeleta.
 *
 * `discountAmount` es `null` cuando el portal no informa descuento (SAT Lima y ATU): no es lo
 * mismo que un descuento de S/ 0.00, y se muestra distinto.
 */
export class TrafficFine {
  constructor({
    id = null,
    issuer = null,
    ticketNumber = null,
    offenderType = null,
    infractionCode = null,
    infractionDate = null,
    infractionDateRaw = null,
    discountAmount = null,
    amountDue = 0,
    issuerStatus = null,
    collectionStage = null,
    status = null,
    inPeriod = true,
    firstSeenAt = null,
    resolvedAt = null,
    reopenedAt = null,
    updatedAt = null,
    changes = [],
  } = {}) {
    this.id = id
    this.issuer = issuer
    this.ticketNumber = ticketNumber
    this.offenderType = offenderType
    this.infractionCode = infractionCode
    this.infractionDate = infractionDate
    this.infractionDateRaw = infractionDateRaw
    this.discountAmount = discountAmount
    this.amountDue = amountDue
    this.issuerStatus = issuerStatus
    this.collectionStage = collectionStage
    this.status = status
    this.inPeriod = inPeriod
    this.firstSeenAt = firstSeenAt
    this.resolvedAt = resolvedAt
    this.reopenedAt = reopenedAt
    this.updatedAt = updatedAt
    this.changes = changes
  }

  get isResolved() {
    return this.status === 'RESUELTA'
  }

  /** Pagada, cancelada o anulada según el portal: sigue listada pero ya no se debe. */
  get isClosedByIssuer() {
    return this.collectionStage === 'CERRADA'
  }

  /** Si hoy suma a la deuda de la unidad. */
  get countsAsDebt() {
    return !this.isResolved && !this.isClosedByIssuer && this.inPeriod
  }

  /**
   * El portal no siempre da un número: cuando falta se muestra un guion, nunca una cadena
   * vacía que parecería un fallo de carga.
   */
  get displayTicketNumber() {
    return this.ticketNumber?.trim() || '—'
  }
}
