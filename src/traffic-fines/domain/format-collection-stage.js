/**
 * Etapas de cobranza de una papeleta, deducidas por el backend del estado que escribe el portal.
 *
 * Mismas etiquetas que el export (`TrafficFineExportService`). El orden de la lista es el de
 * gravedad, de menor a mayor, y es el que se ofrece en el filtro.
 */
export const COLLECTION_STAGES = Object.freeze([
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'FRACCIONADA', label: 'Fraccionada' },
  { value: 'NO_RECONOCIDO', label: 'Estado no reconocido' },
  { value: 'COACTIVA', label: 'Cobranza coactiva' },
  { value: 'MEDIDA_CAUTELAR', label: 'Medida cautelar' },
  { value: 'CERRADA', label: 'Cerrada' },
])

/** Etapa que dispara la alerta: en papeletas suele ser orden de captura del vehículo. */
export const CAUTELAR_STAGE = 'MEDIDA_CAUTELAR'

const STAGE_LABELS = Object.freeze(
  Object.fromEntries(COLLECTION_STAGES.map((stage) => [stage.value, stage.label])),
)

export function formatCollectionStageLabel(stage) {
  if (!stage) return '—'
  return STAGE_LABELS[stage] ?? stage
}

/**
 * «Estado no reconocido» va en amarillo y no en gris: sigue sumando deuda y alguien tiene que
 * mirar qué escribió el portal.
 */
export function collectionStageSeverity(stage) {
  if (stage === 'MEDIDA_CAUTELAR') return 'danger'
  if (stage === 'COACTIVA') return 'warn'
  if (stage === 'NO_RECONOCIDO') return 'warn'
  if (stage === 'CERRADA') return 'success'
  if (stage === 'FRACCIONADA') return 'info'
  return 'secondary'
}

/** Tipo de cambio del historial de una papeleta, en palabras. */
const CHANGE_TYPE_LABELS = Object.freeze({
  UPDATED: 'Cambió',
  REOPENED: 'Reapareció',
  RESOLVED: 'Dejó de figurar',
})

export function formatChangeTypeLabel(changeType) {
  if (!changeType) return '—'
  return CHANGE_TYPE_LABELS[changeType] ?? changeType
}

export function changeTypeSeverity(changeType) {
  if (changeType === 'RESOLVED') return 'success'
  if (changeType === 'REOPENED') return 'danger'
  return 'info'
}
