/**
 * Una unidad del inventario de papeletas: la placa que se consulta y su contrato.
 *
 * `licensePlate` es la placa sanitizada (sin guion, en mayúsculas), la que se envía al servicio de
 * consultas; `licensePlateRaw` es lo que se escribió en el Excel.
 */
export class TrafficFineUnit {
  constructor({
    id = null,
    rowNumber = null,
    licensePlate = null,
    licensePlateRaw = null,
    commercialBrand = null,
    advisor = null,
    contractStart = null,
    contractEnd = null,
    resolutionDate = null,
    contractStatus = null,
    importId = null,
    createdAt = null,
  } = {}) {
    this.id = id
    /** Solo en la vista previa de una importación: la fila del Excel de la que sale. */
    this.rowNumber = rowNumber
    this.licensePlate = licensePlate
    this.licensePlateRaw = licensePlateRaw
    this.commercialBrand = commercialBrand
    this.advisor = advisor
    this.contractStart = contractStart
    this.contractEnd = contractEnd
    this.resolutionDate = resolutionDate
    this.contractStatus = contractStatus
    this.importId = importId
    this.createdAt = createdAt
  }

  /** La placa como se escribió, si difiere de la consultable (p. ej. con guion). */
  get hasDifferentRawPlate() {
    return !!this.licensePlateRaw && this.licensePlateRaw !== this.licensePlate
  }

  /**
   * Último día del periodo del contrato: la resolución si la hay, sea anterior o posterior al fin
   * de contrato; si no, el fin de contrato. Misma regla que el backend.
   */
  get periodEnd() {
    return this.resolutionDate ?? this.contractEnd
  }
}
