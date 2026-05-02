export const EMPLOYEE_STATUS_OPTIONS = [
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Inactivo', value: 'INACTIVE' },
]

export const DOCUMENT_TYPES = [
  { label: 'DNI', value: 'DNI' },
  { label: 'C.E.', value: 'CE' },
  { label: 'Pasaporte', value: 'PASAPORTE' },
  { label: 'Otros', value: 'OTROS' },
]

export const EMPLOYEE_IMPORT_COLUMNS = [
  { key: 'firstName', header: 'Nombres', required: true },
  { key: 'lastName', header: 'Apellidos', required: true },
  { key: 'position', header: 'Cargo', required: true },
  { key: 'documentType', header: 'Tipo Documento', required: true, hint: 'DNI · CE · PASAPORTE · OTROS' },
  { key: 'documentNumber', header: 'Número Documento', required: true },
  { key: 'status', header: 'Estado', required: false, default: 'ACTIVE', hint: 'ACTIVE · INACTIVE' },
]

/** Nombre sugerido del .xlsx de ejemplo (plantilla + filas de muestra). */
export const EMPLOYEE_IMPORT_TEMPLATE_FILENAME = 'empleados-importacion-ejemplo.xlsx'

/** Filas de muestra importables (mismas claves que EMPLOYEE_IMPORT_COLUMNS). Sustituir o borrar antes de producción. */
export const EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS = [
  {
    firstName: 'María',
    lastName: 'González Ruiz',
    position: 'Recepcionista',
    documentType: 'DNI',
    documentNumber: '45678901',
    status: 'ACTIVE',
  },
  {
    firstName: 'Luis',
    lastName: 'Torres Mendoza',
    position: 'Operario de almacén',
    documentType: 'DNI',
    documentNumber: '43219876',
    status: 'ACTIVE',
  },
  {
    firstName: 'Ana',
    lastName: 'Vargas Quispe',
    position: 'Contadora',
    documentType: 'CE',
    documentNumber: '001234567',
    status: 'INACTIVE',
  },
]

