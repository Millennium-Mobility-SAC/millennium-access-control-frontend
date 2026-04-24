/**
 * Columnas esperadas al importar vehículos desde Excel/CSV.
 * El campo `header` debe coincidir exactamente con el encabezado de la columna en el archivo.
 */
export const VEHICLE_IMPORT_COLUMNS = [
  { key: 'licensePlate', header: 'Placa',   required: true  },
  { key: 'brand',        header: 'Marca',   required: true  },
  { key: 'model',        header: 'Modelo',  required: true  },
  { key: 'year',         header: 'Año',     required: false, default: null },
  { key: 'color',        header: 'Color',   required: false, default: ''  },
]

export const VEHICLE_COLUMNS = [
  { field: 'licensePlate',  header: 'Placa',          sortable: true, style: 'min-width: 120px; font-weight: 700; letter-spacing: 0.06em;' },
  { field: 'brand',         header: 'Marca',          sortable: true, style: 'min-width: 120px' },
  { field: 'model',         header: 'Modelo',         sortable: true, style: 'min-width: 120px' },
  { field: 'year',          header: 'Año',            sortable: true, style: 'min-width: 80px'  },
  { field: 'color',         header: 'Color',          sortable: true, style: 'min-width: 100px' },
  { field: 'currentStatus', header: 'Estado',         sortable: true, style: 'min-width: 150px', template: 'vehicle-status' },
  { field: 'lastEntryDate', header: 'Últ. ingreso',   sortable: true, style: 'min-width: 140px', template: 'vehicle-entry' },
  { field: 'daysInPlant',   header: 'Días en planta', sortable: true, style: 'min-width: 120px', template: 'vehicle-days'  },
]

