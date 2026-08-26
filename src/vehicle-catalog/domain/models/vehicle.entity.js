import { toIsoDateString } from '../../../shared/domain/employee-attendance-day.js'
import { formatVehicleUbicacion } from '../format-vehicle-ubicacion.js'

export class Vehicle {
  constructor({
    id            = null,
    vin           = null,
    licensePlate  = '',
    brand         = '',
    model         = '',
    year          = null,
    color         = '',
    currentStatus = null,
    lastEntryDate = null,
    lastEntryTime = null,
    catalogFlowEntryReason = null,
    catalogActiveTemporalExitReason = null,
    external        = false,
  } = {}) {
    this.id            = id
    this.vin           = vin
    this.licensePlate  = licensePlate
    this.brand         = brand
    this.model         = model
    this.year          = year
    this.color         = color
    this.currentStatus = currentStatus
    this.lastEntryDate = lastEntryDate
    this.lastEntryTime = lastEntryTime
    this.catalogFlowEntryReason = catalogFlowEntryReason
    this.catalogActiveTemporalExitReason = catalogActiveTemporalExitReason
    this.external = Boolean(external)
  }

  /**
   * Identificador visible de la unidad. Una unidad recién importada de fábrica
   * todavía no tiene matrícula: entonces el VIN es lo único que la identifica.
   */
  get identityLabel() {
    if (this.licensePlate) return this.licensePlate
    if (this.vin) return `VIN ${this.vin}`
    return '—'
  }

  /** true cuando la unidad está en el padrón pero aún no tiene matrícula. */
  get isUnplated() {
    return !this.licensePlate
  }

  get displayName() {
    if (this.external) return 'Vehículo externo'
    return [this.brand, this.model, this.year].filter(Boolean).join(' ')
  }

  /**
   * Días transcurridos desde el último ingreso hasta hoy (sin contar hora).
   * Devuelve null si no hay fecha de ingreso.
   */
  get daysInPlant() {
    if (!this.lastEntryDate) return null
    const iso = toIsoDateString(this.lastEntryDate)
    if (!iso) return null
    const [y, m, d] = iso.split('-').map(Number)
    const entry = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - entry) / (1000 * 60 * 60 * 24))
    return diff >= 0 ? diff : null
  }

  /** Ubicación operativa legible (derivada de currentStatus y salida temporal activa). */
  get catalogUbicacion() {
    return formatVehicleUbicacion(this)
  }
}
