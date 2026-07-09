export const TIPOS_OPERACION_INGRESO = [
  { label: 'Ingreso nuevo', value: 'INGRESO_NUEVO', icon: 'pi pi-sign-in' },
  { label: 'Retorno',       value: 'RETORNO',       icon: 'pi pi-replay'  },
]

export const TIPOS_INGRESO = [
  { label: 'Vehículo', value: 'VEHICULO', icon: 'pi pi-car'  },
  { label: 'Persona',  value: 'PERSONA',  icon: 'pi pi-user' },
]

export const TIPOS_DOCUMENTO = [
  { label: 'DNI',       value: 'DNI'       },
  { label: 'C.E.',      value: 'CE'        },
  { label: 'Pasaporte', value: 'PASAPORTE' },
  { label: 'Otros',     value: 'OTROS'     },
]

export const MOTIVOS_INGRESO = [
  { label: 'Mecánica',      value: 'MECANICA'      },
  { label: 'Área de Ventas', value: 'AREA_VENTAS'   },
  { label: 'Siniestro',     value: 'SINIESTRO'     },
  { label: 'Mantenimiento', value: 'MANTENIMIENTO' },
  { label: 'Custodia',      value: 'CUSTODIA'      },
  { label: '0KM',           value: '0KM'           },
  { label: 'GPS',           value: 'GPS'           },
  { label: 'Otro',          value: 'OTRO'          },
  { label: 'Externo',       value: 'EXTERNO'       },
]

/** Origen del vehículo en ingreso tipo VEHÍCULO */
export const VEHICLE_ORIGIN_OPTIONS = [
  { label: 'Millennium', value: 'MILLENNIUM' },
  { label: 'Externo',  value: 'EXTERNO'    },
]

/** Filtro de listado: origen del vehículo */
export const VEHICLE_ORIGIN_FILTER = [
  { label: 'Millennium', value: 'false' },
  { label: 'Externo',  value: 'true'  },
]

export const MOTIVO_SEVERITY = {
  MECANICA:      'warn',
  SINIESTRO:     'danger',
  MANTENIMIENTO: 'info',
  CUSTODIA:      'secondary',
  '0KM':         'success',
  'KM_0':        'success',
  GPS:           'contrast',
  OTRO:          'secondary',
  AREA_VENTAS:   'primary',
  EXTERNO:       'contrast',
}

export const TIPOS_SALIDA = [
  { label: 'Permanente', value: 'PERMANENTE' },
  { label: 'Temporal',   value: 'TEMPORAL'   },
]

export const MOTIVOS_SALIDA_TEMPORAL = [
  { label: 'Prueba de ruta',  value: 'PRUEBA_RUTA'    },
  { label: 'Taller externo',  value: 'TALLER_EXTERNO' },
  { label: 'Préstamo',        value: 'PRESTAMO'       },
  { label: 'Cochera',         value: 'COCHERA'        },
]

/**
 * Columnas para importar ingresos de VEHÍCULOS desde Excel/CSV.
 * Todos los campos del formulario de ingreso tipo VEHICULO son obligatorios.
 * Motivo: MECANICA | AREA_VENTAS | SINIESTRO | MANTENIMIENTO | CUSTODIA | 0KM | GPS | OTRO
 */
export const ACCESS_IMPORT_COLUMNS_VEHICULO = [
  { key: 'licensePlate',         header: 'Placa',            required: true  },
  { key: 'entryReason',          header: 'Motivo',           required: true,  hint: 'MECANICA · AREA_VENTAS · SINIESTRO · MANTENIMIENTO · CUSTODIA · 0KM · GPS · OTRO' },
  { key: 'brand',                header: 'Marca',            required: true  },
  { key: 'model',                header: 'Modelo',           required: true  },
  { key: 'year',                 header: 'Año',              required: true  },
  { key: 'color',                header: 'Color',            required: true  },
  { key: 'mileage',              header: 'Kilometraje',      required: true  },
  { key: 'entryDate',            header: 'Fecha Ingreso',    required: false, default: null },
  { key: 'entryTime',            header: 'Hora Ingreso',     required: false, default: null },
  { key: 'documentType',         header: 'Tipo Documento',   required: false, default: 'DNI', hint: 'DNI · CE · PASAPORTE · OTROS' },
  { key: 'clientDocumentNumber', header: 'DNI Cliente',      required: false, default: ''   },
  { key: 'firstName',            header: 'Nombre Cliente',   required: false, default: ''   },
  { key: 'lastName',             header: 'Apellido Cliente', required: false, default: ''   },
]

/**
 * Columnas para importar ingresos de PERSONAS desde Excel/CSV.
 * Todos los campos del formulario de ingreso tipo PERSONA son obligatorios.
 * Tipo Documento: DNI | CE | PASAPORTE | OTROS
 */
export const ACCESS_IMPORT_COLUMNS_PERSONA = [
  { key: 'clientDocumentNumber', header: 'Número Documento', required: true  },
  { key: 'firstName',            header: 'Nombre',           required: true  },
  { key: 'lastName',             header: 'Apellido',         required: true  },
  { key: 'entryReason',          header: 'Motivo',           required: true,  hint: 'MECANICA · AREA_VENTAS · SINIESTRO · MANTENIMIENTO · CUSTODIA · 0KM · GPS · OTRO' },
  { key: 'documentType',         header: 'Tipo Documento',   required: true,  hint: 'DNI · CE · PASAPORTE · OTROS' },
  { key: 'entryDate',            header: 'Fecha Ingreso',    required: false, default: null },
  { key: 'entryTime',            header: 'Hora Ingreso',     required: false, default: null },
]

// Fuente canónica en shared — re-exportada aquí para no romper imports existentes.
export { ACCESS_STATUS, ACCESS_STATUS_SEVERITY, ACCESS_STATUS_LABEL, getAccessStatusLabel, getAccessStatusSeverity } from '@/shared/presentation/constants/access-status.constants.js'
