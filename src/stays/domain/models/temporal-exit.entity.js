export class TemporalExit {
  /**
   * @param {Object}       data
   * @param {number|null}  data.id
   * @param {string|null}  data.status              - 'EN_SALIDA' | 'RETORNADO'
   * @param {string|null}  data.exitDate            - "YYYY-MM-DD"
   * @param {string}       data.exitTime            - "HH:MM:SS"
   * @param {string|null}  data.exitReason          - PRUEBA_RUTA | TALLER_EXTERNO | PRESTAMO | COCHERA
   * @param {string|null}  data.replacementLicensePlate
   * @param {string|null}  data.returnDate          - "YYYY-MM-DD"
   * @param {string}       data.returnTime          - "HH:MM:SS"
   * @param {number|null}  data.registeredByUserId
   */
  constructor({
    id                      = null,
    status                  = null,
    exitDate                = null,
    exitTime                = '',
    exitReason              = null,
    replacementLicensePlate = null,
    returnDate              = null,
    returnTime              = '',
    registeredByUserId      = null,
  } = {}) {
    this.id                      = id
    this.status                  = status
    this.exitDate                = exitDate
    this.exitTime                = exitTime
    this.exitReason              = exitReason
    this.replacementLicensePlate = replacementLicensePlate
    this.returnDate              = returnDate
    this.returnTime              = returnTime
    this.registeredByUserId      = registeredByUserId
  }

  /** true when this exit has not yet returned */
  get isActive() {
    return this.status === 'EN_SALIDA' || !this.returnDate
  }
}
