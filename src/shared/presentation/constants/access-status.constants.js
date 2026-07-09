/**
 * Shared Presentation — Access Status Constants
 *
 * Fuente única de verdad para los estados de estadía (stays) y sus metadatos visuales.
 * Importar desde aquí en TODOS los módulos que necesiten estados de acceso:
 *   - access-control
 *   - vehicle-catalog
 *   - staff-management
 *   - cualquier vista futura
 *
 * NO redefinir estas listas localmente en ningún módulo.
 */

/** Array de opciones para selects / filtros */
export const ACCESS_STATUS = Object.freeze([
  { label: 'En planta',              value: 'EN_PLANTA'          },
  { label: 'En planta (Custodia)',   value: 'EN_PLANTA_CUSTODIA' },
  { label: 'Salida permanente',      value: 'SALIDA_PERMANENTE'  },
  { label: 'Salida temporal',        value: 'SALIDA_TEMPORAL'    },
  { label: 'Retornado',              value: 'RETORNADO'          },
])

/** Mapa valor → severity de PrimeVue tag */
export const ACCESS_STATUS_SEVERITY = Object.freeze({
  EN_PLANTA:          'success',
  EN_PLANTA_CUSTODIA: 'secondary',
  SALIDA_PERMANENTE:  'danger',
  SALIDA_TEMPORAL:    'warn',
  RETORNADO:          'info',
})

/** Mapa valor → etiqueta legible (acceso rápido sin .find()) */
export const ACCESS_STATUS_LABEL = Object.freeze(
  Object.fromEntries(ACCESS_STATUS.map(s => [s.value, s.label]))
)

/**
 * Helper — devuelve la etiqueta de un estado o el propio valor si no existe.
 * @param {string|null} value
 * @returns {string}
 */
export function getAccessStatusLabel(value) {
  return ACCESS_STATUS_LABEL[value] ?? value ?? '—'
}

/**
 * Helper — devuelve la severity PrimeVue de un estado.
 * @param {string|null} value
 * @returns {string}
 */
export function getAccessStatusSeverity(value) {
  return ACCESS_STATUS_SEVERITY[value] ?? 'secondary'
}

/** Estados ocultos en listados/filtros para guardias sin rol administrativo. */
export const SECURITY_GUARD_HIDDEN_ACCESS_STATUSES = Object.freeze(['SALIDA_PERMANENTE'])

/**
 * Opciones de filtro por estado según roles del usuario autenticado.
 * @param {string[]|null|undefined} roleNames
 * @returns {typeof ACCESS_STATUS}
 */
export function getAccessStatusFilterOptions(roleNames) {
  const roles = roleNames ?? []
  const isGuardOnly = roles.includes('ROLE_SECURITY_GUARD')
    && !roles.includes('ROLE_ADMIN')
    && !roles.includes('ROLE_SUPPORT_ADMIN')

  if (!isGuardOnly) {
    return ACCESS_STATUS
  }

  return ACCESS_STATUS.filter(
    status => !SECURITY_GUARD_HIDDEN_ACCESS_STATUSES.includes(status.value),
  )
}
