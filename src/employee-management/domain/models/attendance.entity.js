export class Attendance {
  constructor({
    id = null,
    employeeId = null,
    attendanceDate = null,
    checkInTime = null,
    checkOutTime = null,
  } = {}) {
    this.id = id
    this.employeeId = employeeId
    this.attendanceDate = attendanceDate
    this.checkInTime = checkInTime
    this.checkOutTime = checkOutTime
  }
}

