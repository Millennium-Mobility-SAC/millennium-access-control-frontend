import { Employee } from '../../domain/models/employee.entity.js'
import { Attendance } from '../../domain/models/attendance.entity.js'

function normalizeEmployeeStatus(raw) {
  if (raw == null || raw === '') return 'ACTIVE'
  const u = String(raw).trim().toUpperCase()
  return u === 'ACTIVE' || u === 'INACTIVE' ? u : 'ACTIVE'
}

export class EmployeeAssembler {
  static toEntityFromResource(resource) {
    return new Employee({
      id: resource.id ?? null,
      firstName: resource.firstName ?? resource.first_name ?? '',
      lastName: resource.lastName ?? resource.last_name ?? '',
      position: resource.position ?? '',
      documentType: resource.documentType ?? resource.document_type ?? 'DNI',
      documentNumber: resource.documentNumber ?? resource.document_number ?? '',
      status: normalizeEmployeeStatus(resource.status),
      faceEnrolled: resource.faceEnrolled ?? resource.face_enrolled ?? false,
    })
  }

  static toEntityFromResponse(response) {
    if (!response?.data) return null
    return EmployeeAssembler.toEntityFromResource(response.data)
  }

  static toEntitiesFromResponse(response) {
    if (!Array.isArray(response?.data)) return []
    return response.data.map(r => EmployeeAssembler.toEntityFromResource(r))
  }

  static toResource(form) {
    return {
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      position: form.position || null,
      documentType: form.documentType ?? null,
      documentNumber: form.documentNumber || null,
      status: normalizeEmployeeStatus(form.status),
    }
  }

  static attendanceFromResource(resource) {
    return new Attendance({
      id: resource.id ?? null,
      employeeId: resource.employeeId ?? resource.employee_id ?? null,
      attendanceDate: resource.attendanceDate ?? resource.attendance_date ?? null,
      checkInTime: resource.checkInTime ?? resource.check_in_time ?? null,
      checkOutTime: resource.checkOutTime ?? resource.check_out_time ?? null,
    })
  }

  static attendanceListFromResponse(response) {
    const data = response?.data
    let body = null
    if (Array.isArray(data)) {
      body = data
    } else if (Array.isArray(data?.content)) {
      body = data.content
    } else if (Array.isArray(response)) {
      body = response
    }
    if (!Array.isArray(body)) return []
    return body.map(r => EmployeeAssembler.attendanceFromResource(r))
  }
}

