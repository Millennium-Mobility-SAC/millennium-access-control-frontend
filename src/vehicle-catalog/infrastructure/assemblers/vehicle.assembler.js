import { Vehicle } from '../../domain/models/vehicle.entity.js'

/** Fecha de importación: serial Excel, ISO, o DD/MM/AAAA → YYYY-MM-DD. */
function coerceImportDateToIso(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epochMs = (val - 25569) * 86400 * 1000
    const d = new Date(epochMs)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, d, mo, y] = slash
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

/** Hora de importación: fracción Excel del día, o HH:mm / HH:mm:ss. */
function coerceImportTimeToIso(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val < 1) {
    const totalSec = Math.round(val * 86400)
    const h = Math.floor(totalSec / 3600) % 24
    const m = Math.floor((totalSec % 3600) / 60)
    const sec = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  const s = String(val).trim()
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s
  return s.length > 0 ? s : null
}

function blankToNull(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  return s.length ? s : null
}

function hasImportSnapshotFields(form) {
  const keys = [
    'operationalStatus', 'entryDate', 'entryTime', 'entryReason',
    'permanentExitDate', 'permanentExitTime',
    'customerDocumentType', 'customerDocumentNumber', 'customerFirstName', 'customerLastName',
  ]
  return keys.some((k) => form[k] != null && String(form[k]).trim() !== '')
}

function buildImportSnapshotPayload(form) {
  if (!hasImportSnapshotFields(form)) return null
  const operational = blankToNull(form.operationalStatus)?.toUpperCase() ?? null
  return {
    operational_status: operational,
    entry_date:         coerceImportDateToIso(form.entryDate),
    entry_time:         coerceImportTimeToIso(form.entryTime),
    entry_reason:       blankToNull(form.entryReason),
    permanent_exit_date: coerceImportDateToIso(form.permanentExitDate),
    permanent_exit_time: coerceImportTimeToIso(form.permanentExitTime),
    customer_document_type:   blankToNull(form.customerDocumentType),
    customer_document_number: blankToNull(form.customerDocumentNumber),
    customer_first_name:      blankToNull(form.customerFirstName),
    customer_last_name:       blankToNull(form.customerLastName),
  }
}

export class VehicleAssembler {
  static toEntityFromResource(resource) {
    return new Vehicle({
      id:            resource.id                                           ?? null,
      licensePlate:  resource.license_plate ?? resource.licensePlate      ?? '',
      brand:         resource.brand                                       ?? '',
      model:         resource.model                                       ?? '',
      year:          resource.year                                        ?? null,
      color:         resource.color                                       ?? '',
      currentStatus: resource.current_status ?? resource.currentStatus   ?? null,
      lastEntryDate: resource.last_entry_date ?? resource.lastEntryDate   ?? null,
      lastEntryTime: resource.last_entry_time ?? resource.lastEntryTime   ?? null,
      catalogFlowEntryReason: resource.catalog_flow_entry_reason ?? resource.catalogFlowEntryReason ?? null,
      catalogActiveTemporalExitReason:
        resource.catalog_active_temporal_exit_reason ?? resource.catalogActiveTemporalExitReason ?? null,
      external:      resource.external ?? false,
    })
  }

  static toEntitiesFromResponse(response) {
    if (response.status !== 200) return []
    if (!Array.isArray(response.data)) return []
    return response.data.map(r => VehicleAssembler.toEntityFromResource(r))
  }

  static toEntityFromResponse(response) {
    if (response.status !== 200) return null
    if (!response.data) return null
    return VehicleAssembler.toEntityFromResource(response.data)
  }

  static toResource(form) {
    const year =
      form.year != null && form.year !== ''
        ? Number(form.year)
        : new Date().getFullYear()
    const payload = {
      license_plate: form.licensePlate || null,
      brand:         form.brand        || null,
      model:         form.model        || null,
      year:          Number.isFinite(year) ? year : new Date().getFullYear(),
      color:         form.color        || null,
    }
    const snap = buildImportSnapshotPayload(form)
    if (snap) payload.import_snapshot = snap
    return payload
  }
}
