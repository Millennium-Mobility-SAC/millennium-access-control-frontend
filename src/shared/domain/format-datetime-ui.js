/**
 * Punto único para fechas y horas en UI y exportes (Perú / es-PE).
 *
 * - Fechas calendario del API (`LocalDate` como `YYYY-MM-DD`, arrays Jackson, etc.):
 *   sin el desfase de `new Date('YYYY-MM-DD')` interpretado en UTC.
 * - Horas de reloj (`LocalTime` / `HH:mm` / `HH:mm:ss`): 12 h con AM/PM.
 */

import { toIsoDateString } from './employee-attendance-day.js'

// ── Fechas (día civil) ───────────────────────────────────────────────────────

/**
 * @param {unknown} value - Fecha API u objeto compatible con `toIsoDateString`.
 * @param {string} [emptyLabel='—'] - Texto si no hay fecha.
 * @returns {string}
 */
export function formatCalendarDateForUi(value, emptyLabel = '—') {
  const iso = toIsoDateString(value)
  if (!iso) return emptyLabel
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return emptyLabel
  return `${d}/${m}/${y}`
}

/**
 * Igual que `formatCalendarDateForUi` pero devuelve `null` si no hay dato (plantillas `?? '—'`).
 * @returns {string|null}
 */
export function formatCalendarDateForUiNullable(value) {
  const iso = toIsoDateString(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return null
  return `${d}/${m}/${y}`
}

/**
 * Fecha del calendario **local** a partir de un `Date` (p. ej. reloj en vivo del dispositivo).
 * @param {Date} date
 * @param {string} [emptyLabel='—']
 */
export function formatLocalCalendarDateForUi(date, emptyLabel = '—') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return emptyLabel
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${d}/${mo}/${y}`
}

/**
 * Valor para celda Excel tipo fecha: mediodía local del día civil (evita corrimiento UTC).
 * @returns {Date|''}
 */
export function calendarDateToExcelLocalDate(value) {
  const iso = toIsoDateString(value)
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

// ── Horas (muro / API) ──────────────────────────────────────────────────────

function parseWallClockFromInput(input) {
  if (input == null || input === '') return null
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return {
      h: input.getHours(),
      m: input.getMinutes(),
      s: input.getSeconds(),
      hasThirdTimeComponent: true,
    }
  }
  const raw = String(input).trim()
  const parts = raw.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  const hasThird = parts.length >= 3 && parts[2] !== undefined && String(parts[2]).length > 0
  const secParsed = hasThird ? Number(String(parts[2]).replace(/\D.*$/, '')) : null
  const s = hasThird && Number.isFinite(secParsed) ? secParsed : 0
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m, s, hasThirdTimeComponent: hasThird }
}

function toHms12Strings(h24, minutes, seconds) {
  const period = h24 >= 12 ? 'PM' : 'AM'
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  const pad = (n) => String(Math.trunc(n)).padStart(2, '0')
  return { h12: pad(h12), min: pad(minutes), sec: pad(seconds), period }
}

/**
 * Hora en UI con segundos siempre: `08:08:40 PM`.
 * @param {string|Date|null|undefined} input
 * @param {string} [emptyLabel='—']
 */
export function formatTimeOfDayForUi(input, emptyLabel = '—') {
  const p = parseWallClockFromInput(input)
  if (!p) return emptyLabel
  const sec = Number.isFinite(p.s) ? p.s : 0
  const { h12, min, sec: s2, period } = toHms12Strings(p.h, p.m, sec)
  return `${h12}:${min}:${s2} ${period}`
}

/**
 * Hora `HH:mm AM/PM` (y opcionalmente segundos).
 *
 * @param {'auto'|'always'|'never'} [options.seconds='auto'] — `auto`: si el string API trae `HH:mm:ss`,
 *   se muestran segundos (incl. `:00`). `never`: solo hora y minuto (listados de vehículos). `always`:
 *   siempre `:ss` (p. ej. desde `Date`).
 * @returns {string|null} `null` si no hay valor.
 */
export function formatTimeHmAmPmForUi(input, { seconds = 'auto' } = {}) {
  if (input == null || input === '') return null
  const p = parseWallClockFromInput(input)
  if (!p) return typeof input === 'string' ? input : null
  const sec = Number.isFinite(p.s) ? p.s : 0
  const { h12, min, sec: s2, period } = toHms12Strings(p.h, p.m, sec)
  const base = `${h12}:${min}`
  if (seconds === 'always' || (seconds === 'auto' && p.hasThirdTimeComponent)) {
    return `${base}:${s2} ${period}`
  }
  return `${base} ${period}`
}

/**
 * Cadena de hora para exportes (Excel): misma regla `seconds: 'auto'`, `''` si vacío.
 */
export function formatWallClockTimeForExcel(input) {
  const t = formatTimeHmAmPmForUi(input, { seconds: 'auto' })
  return t == null ? '' : t
}
