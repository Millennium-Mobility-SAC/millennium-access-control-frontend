export class Employee {
  constructor({
    id             = null,
    userId         = null,
    username       = '',
    email          = '',
    firstName      = '',
    lastName       = '',
    fullName       = '',
    phoneNumber    = '',
    documentType   = 'DNI',
    documentNumber = '',
    position       = '',
    department     = '',
    active         = true,
    roles          = [],
  } = {}) {
    this.id             = id
    this.userId         = userId
    this.username       = username
    this.email          = email
    this.firstName      = firstName
    this.lastName       = lastName
    this.fullName       = fullName || [firstName, lastName].filter(Boolean).join(' ')
    this.phoneNumber    = phoneNumber
    this.documentType   = documentType
    this.documentNumber = documentNumber
    this.position       = position
    this.department     = department
    this.active         = active
    this.roles          = roles
  }
}
