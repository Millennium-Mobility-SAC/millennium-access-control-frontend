export class AttendanceRecord {
  constructor({
    id = null,
    employeeId = null,
    firstName = '',
    lastName = '',
    position = '',
    documentType = 'DNI',
    documentNumber = '',
    attendanceDate = null,
    checkInTime = null,
    checkOutTime = null,
  } = {}) {
    this.id = id
    this.employeeId = employeeId
    this.firstName = firstName
    this.lastName = lastName
    this.position = position
    this.documentType = documentType
    this.documentNumber = documentNumber
    this.attendanceDate = attendanceDate
    this.checkInTime = checkInTime
    this.checkOutTime = checkOutTime
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }
}
