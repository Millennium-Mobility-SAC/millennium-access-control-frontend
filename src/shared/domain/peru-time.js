/**
 * Utilidades de fecha/hora para la zona horaria de Perú (America/Lima, UTC-5).
 *
 * Todas las funciones de "ahora" derivan la hora a partir del reloj del dispositivo
 * pero la interpretan en la zona horaria de Perú, independientemente de la
 * configuración regional del dispositivo del usuario.
 *
 * Esto garantiza consistencia aunque el backend esté desplegado en otro país.
 */

const PERU_TZ = 'America/Lima'

function peruParts(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone:  PERU_TZ,
    year:      'numeric',
    month:     '2-digit',
    day:       '2-digit',
    hour:      '2-digit',
    minute:    '2-digit',
    second:    '2-digit',
    hour12:    false,
  }).formatToParts(date)
}

function get(parts, type) {
  return parts.find(p => p.type === type)?.value ?? '00'
}

/**
 * Devuelve la hora actual en Perú como string 24 h: "HH:mm:ss".
 * Equivalente a reemplazar `nowTimeString()` en los componentes Vue.
 */
export function nowPeruTimeString() {
  const parts = peruParts()
  return `${get(parts, 'hour')}:${get(parts, 'minute')}:${get(parts, 'second')}`
}

/**
 * Devuelve un objeto `Date` JS cuya fecha calendario (year/month/day)
 * coincide con la fecha actual en Perú, a medianoche local del dispositivo.
 * Úsalo para inicializar campos `<pv-calendar>` (que espera un `Date`).
 */
export function nowPeruDate() {
  const parts = peruParts()
  const y  = Number(get(parts, 'year'))
  const mo = Number(get(parts, 'month')) - 1   // mes 0-based para Date
  const d  = Number(get(parts, 'day'))
  return new Date(y, mo, d)
}

/**
 * Convierte cualquier valor de fecha (Date JS, string ISO, array Jackson)
 * al string YYYY-MM-DD usando la zona horaria de Perú.
 *
 * Reemplaza la función `toBackendCalendarDate` del assembler, que usa
 * la zona local del dispositivo y puede ser incorrecta si el dispositivo
 * está configurado en otra zona horaria.
 */
export function toPeruCalendarDate(value) {
  if (value == null || value === '') return null

  let d
  if (value instanceof Date) {
    d = value
  } else if (Array.isArray(value) && value.length >= 3) {
    // Array Jackson: [year, month, day]
    const [y, mo, da] = value
    d = new Date(y, mo - 1, da)
  } else if (typeof value === 'object') {
    const y  = value.year ?? value.y
    const mo = value.monthValue ?? value.month ?? value.mo
    const da = value.dayOfMonth ?? value.day ?? value.d
    if (y != null && mo != null && da != null) {
      d = new Date(Number(y), Number(mo) - 1, Number(da))
    }
  } else {
    d = new Date(value)
  }

  if (!d || Number.isNaN(d.getTime())) return null

  const parts = peruParts(d)
  return `${get(parts, 'year')}-${get(parts, 'month')}-${get(parts, 'day')}`
}
