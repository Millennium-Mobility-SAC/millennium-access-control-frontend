/**
 * Columnas esperadas al importar vehículos desde Excel/CSV.
 * El campo `header` debe coincidir exactamente con el encabezado de la columna en el archivo.
 */
export const VEHICLE_IMPORT_COLUMNS = [
  { key: 'licensePlate', header: 'Placa',   required: true  },
  { key: 'brand',        header: 'Marca',   required: true  },
  { key: 'model',        header: 'Modelo',  required: true  },
  { key: 'year',         header: 'Año',     required: false, default: null },
]

export const VEHICLE_COLUMNS = [
  { field: 'licensePlate',  header: 'Placa',          sortable: true, style: 'min-width: 80px; font-weight: 700; letter-spacing: 0.06em;' },
  { field: 'brand',         header: 'Marca',          sortable: true, style: 'min-width: 100px' },
  { field: 'model',         header: 'Modelo',         sortable: true, style: 'min-width: 120px' },
  { field: 'currentStatus', header: 'Estado',         sortable: true, style: 'min-width: 158px', template: 'vehicle-status' },
  { field: 'catalogFlowEntryReason', header: 'Motivo ingreso', sortable: true, style: 'min-width: 145px', template: 'vehicle-flow-motivo' },
  { field: 'catalogUbicacion', header: 'Ubicación', sortable: false, style: 'min-width: 168px', template: 'vehicle-ubicacion' },
  { field: 'lastEntryDate', header: 'Últ. ingreso',   sortable: true, style: 'min-width: 152px', template: 'vehicle-entry' },
  { field: 'daysInPlant',   header: 'Días', sortable: true, style: 'min-width: 60px', template: 'vehicle-days'  },
]

