/**
 * Una fila del resumen: la unidad con sus totales de papeletas pendientes.
 */
export class TrafficFineSummary {
  constructor({
    vehicleId = null,
    vin = null,
    licensePlate = null,
    brand = '',
    model = '',
    year = null,
    external = false,
    consultable = false,
    fineCount = 0,
    totalAmountDue = 0,
    totalDiscount = 0,
    oldestInfractionDate = null,
    issuerTotals = [],
    checks = [],
    lastCheckedAt = null,
    hasCheckErrors = false,
  } = {}) {
    this.vehicleId = vehicleId
    this.vin = vin
    this.licensePlate = licensePlate
    this.brand = brand
    this.model = model
    this.year = year
    this.external = external
    this.consultable = consultable
    this.fineCount = fineCount
    this.totalAmountDue = totalAmountDue
    this.totalDiscount = totalDiscount
    this.oldestInfractionDate = oldestInfractionDate
    this.issuerTotals = issuerTotals
    this.checks = checks
    this.lastCheckedAt = lastCheckedAt
    this.hasCheckErrors = hasCheckErrors
  }

  /** El DataManager usa `data-key="id"`: sin esto la selección múltiple no funciona. */
  get id() {
    return this.vehicleId
  }

  /** Nunca se consultó ningún portal de esta unidad. */
  get neverChecked() {
    return !this.lastCheckedAt
  }

  totalsFor(issuer) {
    return this.issuerTotals.find((totals) => totals.issuer === issuer)
      ?? { issuer, fineCount: 0, amountDue: 0 }
  }
}
