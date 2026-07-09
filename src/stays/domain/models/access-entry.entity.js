import { TemporalExit } from './temporal-exit.entity.js'

export class AccessEntry {
  /**
   * @param {Object}         data
   * @param {number|null}    data.id
   * @param {'VEHICULO'|'PERSONA'} data.type
   * @param {'EN_PLANTA'|'SALIDA_PERMANENTE'|'SALIDA_TEMPORAL'|'RETORNADO'|null} data.status
   * @param {string|null}    data.entryDate              - "YYYY-MM-DD"
   * @param {string}         data.entryTime              - "HH:MM:SS"
   * @param {string|null}    data.entryReason
   * @param {string|null}    data.licensePlate
   * @param {string|null}    data.brand
   * @param {string|null}    data.model
   * @param {number|null}    data.year
   * @param {number|null}    data.mileage
   * @param {string|null}    data.color
   * @param {string|null}    data.documentType           - DNI | CE | PASAPORTE | OTROS
   * @param {string}         data.clientDocumentNumber
   * @param {string|null}    data.firstName
   * @param {string|null}    data.lastName
   * @param {number|null}    data.vehicleId
   * @param {number|null}    data.registeredByUserId
   * @param {number|null}    data.registeredByProfileId
   * @param {string|null}    data.registeredByFirstName
   * @param {string|null}    data.registeredByLastName
   * @param {string|null}    data.permanentExitDate      - "YYYY-MM-DD"
   * @param {string|null}    data.permanentExitTime      - "HH:MM:SS"
   * @param {string|null}    data.customerDocumentType   - DNI | CE | PASAPORTE | OTROS
   * @param {string|null}    data.customerDni
   * @param {string|null}    data.customerFirstName
   * @param {string|null}    data.customerLastName
  /** @param {boolean}        data.external
   * @param {string|null}    data.externalDescription
   */
  constructor({
    id                       = null,
    type                     = 'VEHICULO',
    status                   = null,
    entryDate                = null,
    entryTime                = '',
    entryReason              = null,
    licensePlate             = null,
    brand                    = null,
    model                    = null,
    year                     = null,
    mileage                  = null,
    color                    = null,
    documentType             = 'DNI',
    clientDocumentNumber     = '',
    firstName                = null,
    lastName                 = null,
    vehicleId                = null,
    registeredByUserId       = null,
    registeredByProfileId    = null,
    registeredByFirstName    = null,
    registeredByLastName     = null,
    permanentExitDate        = null,
    permanentExitTime        = '',
    customerDocumentType     = 'DNI',
    customerDni              = null,
    customerFirstName        = null,
    customerLastName         = null,
    external                 = false,
    externalDescription      = null,
    temporalExits            = [],
  } = {}) {
    this.id                    = id
    this.type                  = type
    this.status                = status
    this.entryDate             = entryDate
    this.entryTime             = entryTime
    this.entryReason           = entryReason
    this.licensePlate          = licensePlate
    this.brand                 = brand
    this.model                 = model
    this.year                  = year
    this.mileage               = mileage
    this.color                 = color
    this.documentType          = documentType
    this.clientDocumentNumber  = clientDocumentNumber
    this.firstName             = firstName
    this.lastName              = lastName
    this.vehicleId             = vehicleId
    this.registeredByUserId    = registeredByUserId
    this.registeredByProfileId = registeredByProfileId
    this.registeredByFirstName = registeredByFirstName
    this.registeredByLastName  = registeredByLastName
    this.permanentExitDate     = permanentExitDate
    this.permanentExitTime     = permanentExitTime
    this.customerDocumentType  = customerDocumentType
    this.customerDni           = customerDni
    this.customerFirstName     = customerFirstName
    this.customerLastName      = customerLastName
    this.external              = Boolean(external)
    this.externalDescription   = externalDescription
    this.temporalExits         = Array.isArray(temporalExits)
      ? temporalExits.map(t => (t instanceof TemporalExit ? t : new TemporalExit(t)))
      : []
  }

  // ── Derived / backward-compat getters ──────────────────────────────

  /** The currently active temporal exit (no return yet), or the last one */
  get activeTemporalExit() {
    const active = this.temporalExits.find(t => t.isActive)
    return active ?? this.temporalExits[this.temporalExits.length - 1] ?? null
  }

  /** 'PERMANENTE' | 'TEMPORAL' | null — derived from status + temporalExits */
  get exitType() {
    if (this.status === 'SALIDA_PERMANENTE') return 'PERMANENTE'
    if (this.temporalExits.length > 0)      return 'TEMPORAL'
    return null
  }

  /** Effective exit date — permanent exit or active temporal exit */
  get exitDate() {
    return this.permanentExitDate ?? this.activeTemporalExit?.exitDate ?? null
  }

  /** Effective exit time — permanent exit or active temporal exit */
  get exitTime() {
    return this.permanentExitTime || this.activeTemporalExit?.exitTime || ''
  }

  /** Return date from the active temporal exit */
  get returnDate() {
    return this.activeTemporalExit?.returnDate ?? null
  }

  /** Return time from the active temporal exit */
  get returnTime() {
    return this.activeTemporalExit?.returnTime ?? ''
  }

  /** Exit reason from the active temporal exit */
  get temporaryExitReason() {
    return this.activeTemporalExit?.exitReason ?? null
  }

  /** Replacement plate from the active temporal exit */
  get replacementLicensePlate() {
    return this.activeTemporalExit?.replacementLicensePlate ?? null
  }

  /** Full name of the associated person / customer */
  get fullName() {
    const parts = [this.firstName, this.lastName].filter(Boolean)
    return parts.length ? parts.join(' ') : null
  }

  /** Full name of the collaborator who registered the entry */
  get registeredByFullName() {
    const parts = [this.registeredByFirstName, this.registeredByLastName].filter(Boolean)
    return parts.length ? parts.join(' ') : null
  }
}

