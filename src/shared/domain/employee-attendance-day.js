/**
 * Fecha local del dispositivo en formato ISO (YYYY-MM-DD), alineada con el uso típico del backend (día calendario).
 */
export function todayIsoLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Convierte valores típicos de fecha del API (ISO, array Jackson, objeto) a YYYY-MM-DD.
 */
export function toIsoDateString(value) {
  if (value == null || value === '') return null
  if (Array.isArray(value) && value.length >= 3) {
    const y = value[0]
    const mo = Number(value[1])
    const da = Number(value[2])
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null
    const m = String(mo).padStart(2, '0')
    const d = String(da).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'object') {
    const y = value.year ?? value.y
    const mo = value.monthValue ?? value.month ?? value.mo
    const da = value.dayOfMonth ?? value.day ?? value.d
    if (y != null && mo != null && da != null) {
      const m = String(Number(mo)).padStart(2, '0')
      const d = String(Number(da)).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s.length >= 10 ? s.slice(0, 10) : null
}

/**
 * Qué acción de marcación corresponde para el día indicado.
 *
 * @param {string} dayIso YYYY-MM-DD
 * @param {Array<{ attendanceDate?: unknown, checkInTime?: unknown, checkOutTime?: unknown }>} rows
 * @returns {'INGRESO' | 'SALIDA' | null}
 *   - INGRESO: aún no hay registro del día
 *   - SALIDA: hay ingreso pero no salida
 *   - null: ingreso y salida ya registrados (día cerrado)
 */
/**
 * Fila de asistencia del calendario local `dayIso` únicamente.
 * No se busca en días vecinos: una jornada cerrada de ayer no debe pasar por “hoy sin marcar”.
 */
export function findTodayAttendanceRow(dayIso, rows) {
  if (!Array.isArray(rows)) return null
  return rows.find(r => toIsoDateString(r.attendanceDate) === dayIso) ?? null
}

export function pendingAttendanceAction(dayIso, rows) {
  if (!Array.isArray(rows)) return 'INGRESO'
  const row = findTodayAttendanceRow(dayIso, rows)
  if (!row) return 'INGRESO'
  const out = row.checkOutTime
  if (out != null && out !== '') return null
  const inn = row.checkInTime
  if (inn != null && inn !== '') return 'SALIDA'
  return 'INGRESO'
}
