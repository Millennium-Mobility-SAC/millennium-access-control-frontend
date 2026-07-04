import { Employee } from '../../domain/models/employee.entity.js'

export class EmployeeAssembler {
  static toEntityFromResource(resource) {
    return new Employee({
      id:             resource.id             ?? null,
      userId:         resource.userId         ?? null,
      username:       resource.username       ?? '',
      email:          resource.email          ?? '',
      firstName:      resource.firstName      ?? resource.first_name  ?? '',
      lastName:       resource.lastName       ?? resource.last_name   ?? '',
      fullName:       resource.fullName       ?? resource.full_name   ?? '',
      phoneNumber:    resource.phoneNumber    ?? resource.phone_number ?? '',
      documentType:   resource.documentType   ?? resource.document_type   ?? 'DNI',
      documentNumber: resource.documentNumber ?? resource.document_number ?? '',
      position:       resource.position       ?? '',
      department:     resource.department     ?? '',
      active:         resource.active         ?? true,
      roles:          resource.roles          ?? [],
    })
  }

  static toEntityFromResponse(response) {
    if (response.status !== 200) return null
    return EmployeeAssembler.toEntityFromResource(response.data)
  }

  static toEntitiesFromResponse(response) {
    if (response.status !== 200) return []
    const data = response.data
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.content)
        ? data.content
        : []
    return rows.map(r => EmployeeAssembler.toEntityFromResource(r))
  }

  /**
   * Serializes the form into the camelCase body expected by the API.
   * @param {Object} form
   * @returns {Object}
   */
  static toResource(form) {
    const payload = {
      email:          form.email          || null,
      firstName:      form.firstName      || null,
      lastName:       form.lastName       || null,
      phoneNumber:    form.phoneNumber    || null,
      documentType:   form.documentType   ?? null,
      documentNumber: form.documentNumber || null,
      position:       form.position       || null,
      department:     form.department     || null,
      active:         form.active         ?? true,
      username:       form.username       || null,
      roles:          EmployeeAssembler._normalizeRoles(form.roles),
    }
    // Solo incluir password si viene con valor (no cambiar en edición si está vacío)
    if (form.password) payload.password = form.password
    return payload
  }

  /**
   * Normaliza roles que pueden venir como string (Excel: "ROLE_ADMIN")
   * o como array (formulario: ["ROLE_ADMIN"]).
   * @param {string|string[]|null|undefined} roles
   * @returns {string[]|null}
   */
  static _normalizeRoles(roles) {
    if (!roles) return null
    if (typeof roles === 'string') {
      const arr = roles.split(',').map(r => r.trim()).filter(Boolean)
      return arr.length ? arr : null
    }
    return roles.length ? roles : null
  }
}
