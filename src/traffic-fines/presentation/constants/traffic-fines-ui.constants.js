/**
 * Columnas de la vista principal: el inventario con su deuda.
 *
 * Misma forma que `VEHICLE_COLUMNS`: `template` nombra un slot del DataManager. La marca comercial
 * va bajo la placa y el periodo bajo el estado del contrato, para que la deuda por portal quepa
 * sin desplazamiento en una pantalla normal.
 */
export const TRAFFIC_FINE_SUMMARY_COLUMNS = [
  {
    field: 'licensePlate',
    header: 'Placa',
    sortable: false,
    style: 'min-width: 7.5rem',
    template: 'fines-plate',
  },
  { field: 'advisor', header: 'Asesor', sortable: false, style: 'min-width: 9rem', template: 'fines-advisor' },
  {
    field: 'contractStatus',
    header: 'Contrato',
    sortable: false,
    style: 'min-width: 10rem',
    template: 'fines-contract',
  },
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
    field: 'atuAmount',
    header: 'ATU',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fines-atu',
  },
  {
    field: 'worstStage',
    header: 'Etapa',
    sortable: false,
    style: 'min-width: 8.5rem',
    template: 'fines-stage',
  },
  {
    field: 'lastCheckedAt',
    header: 'Última consulta',
    sortable: false,
    style: 'min-width: 9.5rem',
    template: 'fines-last-check',
  },
]

/** Columnas de las papeletas de una unidad. */
export const TRAFFIC_FINE_DETAIL_COLUMNS = [
  {
    field: 'issuer',
    header: 'Emisor',
    sortable: false,
    style: 'min-width: 6rem',
    template: 'fine-issuer',
  },
  {
    field: 'ticketNumber',
    header: 'N.º papeleta',
    sortable: false,
    style: 'min-width: 8.5rem',
    template: 'fine-ticket',
  },
  {
    field: 'infractionCode',
    header: 'Falta',
    sortable: false,
    style: 'min-width: 4.5rem',
    template: 'fine-code',
  },
  {
    field: 'infractionDate',
    header: 'Fecha infracción',
    sortable: false,
    style: 'min-width: 8rem',
    template: 'fine-date',
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
    style: 'min-width: 9rem',
    template: 'fine-issuer-status',
  },
  {
    field: 'collectionStage',
    header: 'Etapa',
    sortable: false,
    style: 'min-width: 8.5rem',
    template: 'fine-stage',
  },
  {
    field: 'status',
    header: 'Estado',
    sortable: false,
    style: 'min-width: 6.5rem',
    template: 'fine-status',
  },
  {
    field: 'changes',
    header: 'Historial',
    sortable: false,
    style: 'min-width: 5.5rem',
    template: 'fine-changes',
  },
]

/** Ordenaciones que admite el backend. La lista es cerrada allí; aquí solo se etiqueta. */
export const TRAFFIC_FINE_SORTS = [
  { label: 'Placa (A-Z)', value: 'plate' },
  { label: 'Placa (Z-A)', value: 'plate_desc' },
  { label: 'Asesor', value: 'advisor' },
  { label: 'Mayor deuda', value: 'debt_desc' },
  { label: 'Menor deuda', value: 'debt_asc' },
  { label: 'Más papeletas', value: 'fines_desc' },
  { label: 'Infracción más antigua', value: 'oldest_infraction' },
  { label: 'Fin de periodo más próximo', value: 'period_end_asc' },
]

export const TRAFFIC_FINE_STATE_FILTERS = [
  { label: 'Con deuda', value: 'with_fines' },
  { label: 'Sin deuda', value: 'without_fines' },
  { label: 'Nunca consultadas', value: 'never_checked' },
]

/**
 * Tope de unidades por lote de Callao y ATU. Debe coincidir con `max-plates-per-batch` del backend
 * (por defecto 1000): el servicio guarda el lote en su cola y procesa las placas de una en una.
 */
export const MAX_UNITS_PER_BATCH = 1000

/**
 * «Consultar todas» incluye las unidades cuyo periodo terminó en estos últimos días. Debe coincidir
 * con `recently-ended-days` del backend.
 */
export const RECENTLY_ENDED_DAYS = 90

/**
 * Segundos aproximados por placa y portal. Solo para la estimación del diálogo: el plazo real lo
 * devuelve el backend al aceptar el lote.
 */
export const ESTIMATED_SECONDS_PER_QUERY = 40
