/**
 * Etiquetas de los portales de papeletas.
 *
 * Las mismas que usa el export del backend (`TrafficFineExportService`): el archivo descargado
 * y la pantalla tienen que llamar igual a las cosas, o parecerán datos distintos.
 */

export const TRAFFIC_FINE_ISSUERS = Object.freeze([
  { value: 'CALLAO', label: 'Callao' },
  { value: 'SAT_LIMA', label: 'SAT Lima' },
])

const ISSUER_LABELS = Object.freeze(
  Object.fromEntries(TRAFFIC_FINE_ISSUERS.map((issuer) => [issuer.value, issuer.label])),
)

/**
 * @param {string|null|undefined} issuer
 * @returns {string} La etiqueta, o el propio código si el backend añade un portal nuevo.
 */
export function formatIssuerLabel(issuer) {
  if (!issuer) return '—'
  return ISSUER_LABELS[issuer] ?? issuer
}

/**
 * Estado de la consulta de un portal, en palabras.
 *
 * `FAILED` y `TIMED_OUT` no se resumen como "sin papeletas": es justo la confusión que hace
 * leer un S/ 0.00 como "esta unidad no debe nada" cuando en realidad el portal no respondió.
 */
const CHECK_STATUS_LABELS = Object.freeze({
  PENDING: 'En curso',
  COMPLETED: 'Consultada',
  FAILED: 'No se pudo consultar',
  TIMED_OUT: 'Sin respuesta',
  SKIPPED: 'Omitida',
  CANCELLED: 'Cancelada',
})

export function formatCheckStatusLabel(status) {
  if (!status) return '—'
  return CHECK_STATUS_LABELS[status] ?? status
}

export function checkStatusSeverity(status) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'PENDING') return 'info'
  if (status === 'SKIPPED' || status === 'CANCELLED') return 'secondary'
  return 'danger'
}

/** Estado del lote, en palabras. */
const BATCH_STATUS_LABELS = Object.freeze({
  PENDING: 'Preparando',
  RUNNING: 'Consultando',
  COMPLETED: 'Completada',
  COMPLETED_WITH_ERRORS: 'Completada con errores',
  FAILED: 'Fallida',
  TIMED_OUT: 'Sin respuesta del servicio',
  CANCELLED: 'Cancelada',
})

export function formatBatchStatusLabel(status) {
  if (!status) return '—'
  return BATCH_STATUS_LABELS[status] ?? status
}

export function batchStatusSeverity(status) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'RUNNING' || status === 'PENDING') return 'info'
  if (status === 'COMPLETED_WITH_ERRORS' || status === 'CANCELLED') return 'warn'
  return 'danger'
}

/** Importe en soles, siempre con dos decimales. */
export function formatSoles(amount) {
  const value = Number(amount ?? 0)
  if (!Number.isFinite(value)) return 'S/ 0.00'
  return `S/ ${value.toFixed(2)}`
}
