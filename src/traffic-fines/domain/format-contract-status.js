/**
 * Estados de contrato del inventario de papeletas, tal como los define el Excel de contratos.
 */
export const CONTRACT_STATUSES = Object.freeze([
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'EN_GESTION_ENTREGADO', label: 'En gestión entregado' },
])

const CONTRACT_STATUS_LABELS = Object.freeze(
  Object.fromEntries(CONTRACT_STATUSES.map((status) => [status.value, status.label])),
)

/**
 * @param {string|null|undefined} status
 * @returns {string} La etiqueta, o el propio código si el backend añade un estado nuevo.
 */
export function formatContractStatusLabel(status) {
  if (!status) return '—'
  return CONTRACT_STATUS_LABELS[status] ?? status
}

export function contractStatusSeverity(status) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'EN_GESTION_ENTREGADO') return 'warn'
  return 'secondary'
}
