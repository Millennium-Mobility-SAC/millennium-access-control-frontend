/**
 * Columnas del resumen de papeletas.
 *
 * Misma forma que `VEHICLE_COLUMNS`: `template` nombra un slot del DataManager.
 */
export const TRAFFIC_FINE_SUMMARY_COLUMNS = [
  {
    field: 'licensePlate',
    header: 'Placa',
    sortable: false,
    style: 'min-width: 6rem; max-width: 9rem; font-weight: 700; letter-spacing: 0.04em;',
    template: 'fines-plate',
  },
  {
    field: 'vin',
    header: 'VIN',
    sortable: false,
    style: 'min-width: 9rem; font-family: monospace; font-size: 0.8125rem;',
    template: 'fines-vin',
  },
  { field: 'brand', header: 'Marca', sortable: false, style: 'min-width: 4.75rem' },
  { field: 'model', header: 'Modelo', sortable: false, style: 'min-width: 5.25rem' },
  {
    field: 'fineCount',
    header: 'Papeletas',
    sortable: false,
    style: 'min-width: 5.5rem',
    template: 'fines-count',
  },
  {
    field: 'totalAmountDue',
    header: 'Deuda total',
    sortable: false,
    style: 'min-width: 7rem',
    template: 'fines-amount',
  },
  {
    field: 'callaoAmount',
    header: 'Callao',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fines-callao',
  },
  {
    field: 'satLimaAmount',
    header: 'SAT Lima',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fines-sat-lima',
  },
  {
    field: 'lastCheckedAt',
    header: 'Última consulta',
    sortable: false,
    style: 'min-width: 9.5rem',
    template: 'fines-last-check',
  },
]

/** Columnas del detalle de una unidad. */
export const TRAFFIC_FINE_DETAIL_COLUMNS = [
  {
    field: 'issuer',
    header: 'Emisor',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fine-issuer',
  },
  {
    field: 'ticketNumber',
    header: 'N.º papeleta',
    sortable: false,
    style: 'min-width: 8.5rem; font-family: monospace; font-size: 0.8125rem;',
    template: 'fine-ticket',
  },
  {
    field: 'infractionDate',
    header: 'Fecha infracción',
    sortable: false,
    style: 'min-width: 8rem',
    template: 'fine-date',
  },
  {
    field: 'totalAmount',
    header: 'Importe',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fine-total',
  },
  {
    field: 'discountAmount',
    header: 'Descuento',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fine-discount',
  },
  {
    field: 'amountDue',
    header: 'Deuda',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fine-due',
  },
  {
    field: 'issuerStatus',
    header: 'Estado portal',
    sortable: false,
    style: 'min-width: 10rem',
    template: 'fine-issuer-status',
  },
  {
    field: 'status',
    header: 'Estado',
    sortable: false,
    style: 'min-width: 6rem',
    template: 'fine-status',
  },
]

/** Ordenaciones que admite el backend. La lista es cerrada allí; aquí solo se etiqueta. */
export const TRAFFIC_FINE_SORTS = [
  { label: 'Placa (A-Z)', value: 'plate' },
  { label: 'Placa (Z-A)', value: 'plate_desc' },
  { label: 'Mayor deuda', value: 'debt_desc' },
  { label: 'Menor deuda', value: 'debt_asc' },
  { label: 'Más papeletas', value: 'fines_desc' },
  { label: 'Infracción más antigua', value: 'oldest_infraction' },
]

export const TRAFFIC_FINE_STATE_FILTERS = [
  { label: 'Con deuda', value: 'with_fines' },
  { label: 'Sin deuda', value: 'without_fines' },
  { label: 'Nunca consultadas', value: 'never_checked' },
]

/**
 * Tope de unidades por lote. Debe coincidir con `max-plates-per-batch` del backend: el
 * servicio procesa las placas de una en una y un lote mayor tardaría horas.
 */
export const MAX_VEHICLES_PER_BATCH = 50
