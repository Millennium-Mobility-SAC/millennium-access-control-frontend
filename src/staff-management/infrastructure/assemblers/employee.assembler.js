import { Employee } from '../../domain/models/employee.entity.js'

export class EmployeeAssembler {
  static toEntityFromResource(resource) {
    return new Employee({
      id:             resource.id             ?? null,
      userId:         resource.userId         ?? null,
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
    })
  }

  static toEntityFromResponse(response) {
    if (response.status !== 200) return null
    return EmployeeAssembler.toEntityFromResource(response.data)
  }

  static toEntitiesFromResponse(response) {
    if (response.status !== 200) return []
    return response.data.map(r => EmployeeAssembler.toEntityFromResource(r))
  }

  /**
   * Serializes the form (camelCase) into the snake_case body expected by the API.
   * @param {Object} form
   * @returns {Object}
   */
  static toResource(form) {
    return {
      user_id:         form.userId         ?? null,
      email:           form.email          || null,
      first_name:      form.firstName      || null,
      last_name:       form.lastName       || null,
      phone_number:    form.phoneNumber    || null,
      document_type:   form.documentType   ?? null,
      document_number: form.documentNumber || null,
      position:        form.position       || null,
      department:      form.department     || null,
      active:          form.active         ?? true,
    }
  }
}
