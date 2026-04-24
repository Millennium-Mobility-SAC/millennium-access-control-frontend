export class Vehicle {
  constructor({
    id            = null,
    licensePlate  = '',
    brand         = '',
    model         = '',
    year          = null,
    color         = '',
    currentStatus = null,
    lastEntryDate = null,
    lastEntryTime = null,
  } = {}) {
    this.id            = id
    this.licensePlate  = licensePlate
    this.brand         = brand
    this.model         = model
    this.year          = year
    this.color         = color
    this.currentStatus = currentStatus
    this.lastEntryDate = lastEntryDate
    this.lastEntryTime = lastEntryTime
  }

  get displayName() {
    return [this.brand, this.model, this.year].filter(Boolean).join(' ')
  }

  /**
   * Días transcurridos desde el último ingreso hasta hoy (sin contar hora).
   * Devuelve null si no hay fecha de ingreso.
   */
  get daysInPlant() {
    if (!this.lastEntryDate) return null
    const [y, m, d] = this.lastEntryDate.split('-').map(Number)
    const entry = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - entry) / (1000 * 60 * 60 * 24))
    return diff >= 0 ? diff : null
  }
}
