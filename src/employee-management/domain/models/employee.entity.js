export class Employee {
  constructor({
    id = null,
    firstName = '',
    lastName = '',
    position = '',
    documentType = 'DNI',
    documentNumber = '',
    status = 'ACTIVE',
  } = {}) {
    this.id = id
    this.firstName = firstName
    this.lastName = lastName
    this.position = position
    this.documentType = documentType
    this.documentNumber = documentNumber
    this.status = status
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  get isActive() {
    return this.status === 'ACTIVE'
  }
}

