import { AttendanceRecord } from '../../domain/models/attendance-record.entity.js'

export class AttendanceRecordAssembler {
  static fromResource(r) {
    return new AttendanceRecord({
      id: r.id ?? null,
      employeeId: r.employeeId ?? r.employee_id ?? null,
      firstName: r.firstName ?? r.first_name ?? '',
      lastName: r.lastName ?? r.last_name ?? '',
      position: r.position ?? '',
      documentType: r.documentType ?? r.document_type ?? 'DNI',
      documentNumber: r.documentNumber ?? r.document_number ?? '',
      attendanceDate: r.attendanceDate ?? r.attendance_date ?? null,
      checkInTime: r.checkInTime ?? r.check_in_time ?? null,
      checkOutTime: r.checkOutTime ?? r.check_out_time ?? null,
    })
  }

  static listFromResponse(response) {
    if (!Array.isArray(response?.data)) return []
    return response.data.map(r => AttendanceRecordAssembler.fromResource(r))
  }
}
