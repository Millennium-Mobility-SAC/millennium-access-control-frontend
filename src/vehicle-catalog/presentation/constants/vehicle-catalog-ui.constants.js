/**
 * Columnas esperadas al importar vehículos desde Excel/CSV.
 * El campo `header` debe coincidir exactamente con el encabezado de la columna en el archivo.
 */
export const VEHICLE_IMPORT_COLUMNS = [
  {
    key: 'vin',
    header: 'VIN',
    required: false,
    hint: 'Identidad de fábrica. Se requiere VIN o placa (al menos uno)',
  },
  {
    key: 'licensePlate',
    header: 'Placa',
    required: false,
    hint: 'Dejar en blanco si la unidad aún no está matriculada',
  },
  { key: 'brand',        header: 'Marca',   required: false },
  { key: 'model',        header: 'Modelo',  required: false },
  { key: 'year',         header: 'Año',     required: false, default: null },
  {
    key: 'operationalStatus',
    header: 'Estado operativo',
    required: false,
    hint: 'EN_PLANTA · SALIDA_PERMANENTE · EN_PLANTA_CUSTODIA · vacío = solo catálogo',
  },
  { key: 'entryDate', header: 'Fecha ingreso', required: false, hint: 'AAAA-MM-DD o DD/MM/AAAA o serial Excel' },
  { key: 'entryTime', header: 'Hora ingreso', required: false, hint: 'HH:mm:ss o fracción Excel del día' },
  { key: 'entryReason', header: 'Motivo ingreso', required: false, hint: 'Ej: KM_0 · OTRO' },
  { key: 'permanentExitDate', header: 'Fecha salida permanente', required: false },
  { key: 'permanentExitTime', header: 'Hora salida permanente', required: false },
  { key: 'customerDocumentType', header: 'Tipo doc. salida', required: false, hint: 'DNI · CE · PASAPORTE · OTROS' },
  { key: 'customerDocumentNumber', header: 'Documento salida', required: false },
  { key: 'customerFirstName', header: 'Nombre salida', required: false },
  { key: 'customerLastName', header: 'Apellido salida', required: false },
]

/**
 * Columnas del archivo Excel para reconciliar VIN y placa.
 *
 * La operación identifica la unidad por VIN y, si no lo encuentra, por placa;
 * después completa la identidad que falte. Una fila útil trae las dos, o la que
 * falte junto a la que ya está registrada.
 */
export const VEHICLE_BULK_UPDATE_COLUMNS = [
  {
    key: 'vin',
    header: 'VIN',
    required: false,
    hint: 'Clave de búsqueda preferente. Si la unidad no lo tiene, se le asigna',
  },
  {
    key: 'licensePlate',
    header: 'Placa',
    required: false,
    hint: 'Se asigna a la unidad encontrada por VIN. También sirve como clave de respaldo',
  },
  { key: 'brand', header: 'Marca',  required: false, hint: 'Dejar en blanco si no cambia' },
  { key: 'model', header: 'Modelo', required: false, hint: 'Dejar en blanco si no cambia' },
  { key: 'year',  header: 'Año',    required: false, hint: 'Dejar en blanco si no cambia' },
  { key: 'color', header: 'Color',  required: false, hint: 'Dejar en blanco si no cambia' },
]

export const VEHICLE_COLUMNS = [
  {
    field: 'licensePlate',
    header: 'Placa',
    sortable: true,
    style: 'min-width: 5.25rem; max-width: 9rem; font-weight: 700; letter-spacing: 0.04em;',
    template: 'vehicle-plate-template',
  },
  {
    field: 'vin',
    header: 'VIN',
    sortable: true,
    style: 'min-width: 9rem; font-family: monospace; font-size: 0.8125rem;',
    template: 'vehicle-vin-template',
  },
  { field: 'brand', header: 'Marca', sortable: true, style: 'min-width: 4.75rem' },
  { field: 'model', header: 'Modelo', sortable: true, style: 'min-width: 5.25rem' },
  { field: 'currentStatus', header: 'Estado', sortable: true, style: 'min-width: 6rem', template: 'vehicle-status' },
  {
    field: 'catalogFlowEntryReason',
    header: 'Motivo ingreso',
    sortable: true,
    style: 'min-width: 5.75rem',
    template: 'vehicle-flow-motivo',
  },
  { field: 'catalogUbicacion', header: 'Ubicación', sortable: false, style: 'min-width: 6.5rem', template: 'vehicle-ubicacion' },
  { field: 'lastEntryDate', header: 'Últ. ingreso', sortable: true, style: 'min-width: 6.25rem', template: 'vehicle-entry' },
  { field: 'daysInPlant', header: 'Días', sortable: true, style: 'min-width: 3rem', template: 'vehicle-days' },
]

