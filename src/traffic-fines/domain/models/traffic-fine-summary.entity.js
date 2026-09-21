import { isMotoBrand } from '../format-issuer-label.js'

/**
 * Una fila de la vista principal: la unidad del inventario, su contrato y su deuda.
 *
 * La deuda solo cuenta papeletas pendientes y dentro del periodo del contrato; eso lo resuelve el
 * backend. Aquí no se vuelve a sumar nada.
 */
export class TrafficFineSummary {
  constructor({
    unitId = null,
    licensePlate = null,
    licensePlateRaw = null,
    commercialBrand = null,
    advisor = null,
    contractStatus = null,
    contractStart = null,
    contractEnd = null,
    resolutionDate = null,
    periodEnd = null,
    fineCount = 0,
    totalAmountDue = 0,
    oldestInfractionDate = null,
    worstStage = null,
    issuerTotals = [],
    checks = [],
    lastCheckedAt = null,
    hasCheckErrors = false,
    undeliveredCount = 0,
  } = {}) {
    this.unitId = unitId
    this.licensePlate = licensePlate
    this.licensePlateRaw = licensePlateRaw
    this.commercialBrand = commercialBrand
    this.advisor = advisor
    this.contractStatus = contractStatus
    this.contractStart = contractStart
    this.contractEnd = contractEnd
    this.resolutionDate = resolutionDate
    this.periodEnd = periodEnd
    this.fineCount = fineCount
    this.totalAmountDue = totalAmountDue
    this.oldestInfractionDate = oldestInfractionDate
    this.worstStage = worstStage
    this.issuerTotals = issuerTotals
    this.checks = checks
    this.lastCheckedAt = lastCheckedAt
    this.hasCheckErrors = hasCheckErrors
    /** Papeletas que faltan por entregar: nuevas, que cambiaron o que reaparecieron. */
    this.undeliveredCount = undeliveredCount
  }

  /** El DataManager usa `data-key="id"`: sin esto la selección múltiple no funciona. */
  get id() {
    return this.unitId
  }

  /** Nunca se consultó ningún portal de esta unidad. */
  get neverChecked() {
    return !this.lastCheckedAt
  }

  get hasCautelar() {
    return this.worstStage === 'MEDIDA_CAUTELAR'
  }

  /** Solo se consulta en Callao. */
  get isMoto() {
    return isMotoBrand(this.commercialBrand)
  }

  /** La placa como se escribió en el Excel, si difiere de la consultable (p. ej. con guion). */
  get hasDifferentRawPlate() {
    return !!this.licensePlateRaw && this.licensePlateRaw !== this.licensePlate
  }

  /** El periodo termina en la resolución, no en el fin de contrato. */
  get periodEndsByResolution() {
    return !!this.resolutionDate
  }

  totalsFor(issuer) {
    return this.issuerTotals.find((totals) => totals.issuer === issuer)
      ?? { issuer, fineCount: 0, amountDue: 0 }
  }

  checkFor(issuer) {
    return this.checks.find((check) => check.issuer === issuer) ?? null
  }
}
