import { MOTIVOS_SALIDA_TEMPORAL } from '@/stays/presentation/constants/stays-ui.constants.js'

export const VEHICLE_UBICACION_EN_PLANTA = 'En planta'
export const VEHICLE_UBICACION_EN_CIRCULACION = 'En circulación'

export const VEHICLE_UBICACION_KIND = Object.freeze({
  EN_PLANTA:        'en_planta',
  EN_CIRCULACION:   'en_circulacion',
  SALIDA_TEMPORAL:  'salida_temporal',
})

function labelMotivoSalidaTemporal(value) {
  if (value == null || value === '') return null
  return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === value)?.label ?? value
}

/**
 * @param {{ currentStatus?: string|null, catalogActiveTemporalExitReason?: string|null }|null|undefined} vehicle
 * @returns {'en_planta'|'en_circulacion'|'salida_temporal'|null}
 */
export function getVehicleUbicacionKind(vehicle) {
  if (!vehicle) return null
  if (vehicle.currentStatus === 'SALIDA_PERMANENTE') return VEHICLE_UBICACION_KIND.EN_CIRCULACION
  if (vehicle.catalogActiveTemporalExitReason) return VEHICLE_UBICACION_KIND.SALIDA_TEMPORAL
  return VEHICLE_UBICACION_KIND.EN_PLANTA
}

/** Severity PrimeVue para resaltar ubicación en tabla y drawer. */
export function getVehicleUbicacionTagSeverity(kind) {
  switch (kind) {
    case VEHICLE_UBICACION_KIND.EN_PLANTA:       return 'success'
    case VEHICLE_UBICACION_KIND.EN_CIRCULACION:  return 'info'
    case VEHICLE_UBICACION_KIND.SALIDA_TEMPORAL: return 'warn'
    default:                                     return 'secondary'
  }
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

/**
 * @param {{ currentStatus?: string|null, catalogActiveTemporalExitReason?: string|null }|null|undefined} vehicle
 * @returns {{ label: string, kind: string|null, severity: string }}
 */
export function resolveVehicleUbicacion(vehicle) {
  const kind = getVehicleUbicacionKind(vehicle)
  return {
    label:    formatVehicleUbicacion(vehicle),
    kind,
    severity: getVehicleUbicacionTagSeverity(kind),
  }
}
