/** Horas en segundos para desempate mismo día (HH:mm o HH:mm:ss). */
function checkInTimeToSeconds(t) {
  if (t == null || t === '') return 0
  const p = String(t).split(':').map((x) => Number(x) || 0)
  return p[0] * 3600 + p[1] * 60 + (p[2] || 0)
}

/**
 * Historial de marcación: del más reciente al más antiguo
 * (fecha descendente, luego hora de ingreso descendente).
 *
 * @param {Array<{ attendanceDate?: unknown, checkInTime?: unknown, id?: unknown }>} list
 */
export function sortAttendanceRecordsByRecencyDesc(list) {
  if (!Array.isArray(list) || list.length < 2) return list ? [...list] : []
  return [...list].sort((a, b) => {
    const dA = String(a.attendanceDate ?? '').slice(0, 10)
    const dB = String(b.attendanceDate ?? '').slice(0, 10)
    if (dA !== dB) return dB.localeCompare(dA)
    const tDiff = checkInTimeToSeconds(b.checkInTime) - checkInTimeToSeconds(a.checkInTime)
    if (tDiff !== 0) return tDiff
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
}
