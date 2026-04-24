export const TIPOS_DOCUMENTO = [
  { label: 'DNI',       value: 'DNI'       },
  { label: 'C.E.',      value: 'CE'        },
  { label: 'Pasaporte', value: 'PASAPORTE' },
  { label: 'Otros',     value: 'OTROS'     },
]

export const DEPARTAMENTOS = [
  { label: 'Administración',      value: 'ADMINISTRACION'   },
  { label: 'Mecánica',            value: 'MECANICA'         },
  { label: 'Carrocería',          value: 'CARROCERIA'       },
  { label: 'Ventas',              value: 'VENTAS'           },
  { label: 'Atención al cliente', value: 'ATENCION_CLIENTE' },
  { label: 'Logística',           value: 'LOGISTICA'        },
  { label: 'Seguridad',           value: 'SEGURIDAD'        },
  { label: 'Sistemas',            value: 'SISTEMAS'         },
  { label: 'Otro',                value: 'OTRO'             },
]

export const ROLES_OPTIONS = [
  { label: 'Administrador',            value: 'ROLE_ADMIN'          },
  { label: 'Administrador de Soporte', value: 'ROLE_SUPPORT_ADMIN'  },
  { label: 'Guardia de Seguridad',     value: 'ROLE_SECURITY_GUARD' },
]

/**
 * Columnas para importar colaboradores desde Excel/CSV.
 */
export const STAFF_IMPORT_COLUMNS = [
  { key: 'firstName',      header: 'Nombre',          required: true                                                                                     },
  { key: 'lastName',       header: 'Apellido',        required: true                                                                                     },
  { key: 'documentType',   header: 'Tipo Documento',  required: true,  hint: 'DNI · CE · PASAPORTE · OTROS'                                            },
  { key: 'documentNumber', header: 'Número Documento', required: true                                                                                     },
  { key: 'email',          header: 'Correo',          required: true                                                                                     },
  { key: 'position',       header: 'Cargo',           required: true                                                                                     },
  { key: 'department',     header: 'Área',             required: true,  hint: 'ADMINISTRACION · MECANICA · CARROCERIA · VENTAS · ATENCION_CLIENTE · LOGISTICA · SEGURIDAD · SISTEMAS · OTRO' },
  { key: 'phoneNumber',    header: 'Teléfono',         required: false, default: '' },
]
