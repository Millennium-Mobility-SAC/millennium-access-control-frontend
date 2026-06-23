import { MOTIVOS_SALIDA_TEMPORAL } from '@/stays/presentation/constants/stays-ui.constants.js'

export const VEHICLE_UBICACION_EN_PLANTA = 'En planta'
export const VEHICLE_UBICACION_EN_CIRCULACION = 'En circulación'

function labelMotivoSalidaTemporal(value) {
  if (value == null || value === '') return null
  return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === value)?.label ?? value
}

/**
 * Etiqueta de ubicación operativa derivada del estado del catálogo.
 * SALIDA_PERMANENTE → fuera del recinto (en circulación).
 * SALIDA_TEMPORAL   → motivo de la salida temporal activa.
 * En planta         → EN_PLANTA y EN_PLANTA_CUSTODIA.
 *
 * @param {{ currentStatus?: string|null, catalogActiveTemporalExitReason?: string|null }|null|undefined} vehicle
 * @returns {string}
 */
export function formatVehicleUbicacion(vehicle) {
  if (!vehicle) return '—'
  if (vehicle.currentStatus === 'SALIDA_PERMANENTE') {
    return VEHICLE_UBICACION_EN_CIRCULACION
  }
  if (vehicle.catalogActiveTemporalExitReason) {
    return labelMotivoSalidaTemporal(vehicle.catalogActiveTemporalExitReason)
  }
  return VEHICLE_UBICACION_EN_PLANTA
}
