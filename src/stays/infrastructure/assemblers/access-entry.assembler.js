import { AccessEntry }   from '../../domain/models/access-entry.entity.js'
import { TemporalExit }  from '../../domain/models/temporal-exit.entity.js'

const ENTRY_REASON_CANONICAL_VALUES = new Set([
  'MECANICA',
  'SINIESTRO',
  'MANTENIMIENTO',
  'CUSTODIA',
  '0KM',
  'GPS',
  'AREA_VENTAS',
  'OTRO',
])

const ENTRY_REASON_ALIASES = {
  '0_KM': '0KM',
  'KM_0': '0KM',
  'KM0': '0KM',
  'AREA_DE_VENTAS': 'AREA_VENTAS',
}

function normalizeToken(value) {
  if (value == null) return null
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || null
}

function resolveCanonicalValue(value, aliases, canonicalValues) {
  const normalized = normalizeToken(value)
  if (!normalized) return null
  const canonical = aliases[normalized] ?? normalized
  return canonicalValues.has(canonical) ? canonical : normalized
}

function normalizeEntryReason(value) {
  return resolveCanonicalValue(value, ENTRY_REASON_ALIASES, ENTRY_REASON_CANONICAL_VALUES)
}

function exitTimeTo24h(value) {
  if (!value) return null
  // HH:MM:SS AM/PM (with seconds)
  const mSec = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i)
  if (mSec) {
    let h = parseInt(mSec[1])
    const min = mSec[2], sec = mSec[3]
    const period = mSec[4].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    else if (period === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${min}:${sec}`
  }
  // HH:MM AM/PM (no seconds fallback)
  const m = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (m) {
    let h = parseInt(m[1])
    const min = m[2]
    const period = m[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    else if (period === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${min}:00`
  }
  if (value.length === 5) return value + ':00'
  return value || null
}

function entryTimeTo24h(value) {
  if (!value) return null
  const m = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i)
  if (m) {
    let h = parseInt(m[1])
    const min = m[2], sec = m[3]
    const period = m[4].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    else if (period === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${min}:${sec}`
  }
  return value || null
}

function toISODate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

export class AccessEntryAssembler {
  /**
   * @param {Object} resource - Raw resource object from API (camelCase or snake_case)
   * @returns {AccessEntry}
   */
  static toEntityFromResource(resource) {
    const temporalExits = Array.isArray(resource.temporal_exits)
      ? resource.temporal_exits.map(t => new TemporalExit({
          id:                     t.id                        ?? null,
          status:                 t.status                    ?? null,
          exitDate:               t.exit_date                 ?? t.exitDate                ?? null,
          exitTime:               t.exit_time                 ?? t.exitTime                ?? '',
          exitReason:             t.exit_reason               ?? t.exitReason              ?? null,
          replacementLicensePlate: t.replacement_license_plate ?? t.replacementLicensePlate ?? null,
          returnDate:             t.return_date               ?? t.returnDate              ?? null,
          returnTime:             t.return_time               ?? t.returnTime              ?? '',
          registeredByUserId:     t.registered_by_user_id     ?? t.registeredByUserId       ?? null,
        }))
      : []

    return new AccessEntry({
      id:                    resource.id                                                           ?? null,
      type:                  resource.type                                                         ?? 'VEHICULO',
      status:                resource.status                                                       ?? null,
      entryDate:             resource.entry_date             ?? resource.entryDate              ?? null,
      entryTime:             resource.entry_time             ?? resource.entryTime              ?? '',
      entryReason:           normalizeEntryReason(resource.entry_reason ?? resource.entryReason ?? null),
      licensePlate:          resource.license_plate          ?? resource.licensePlate           ?? null,
      brand:                 resource.brand                                                    ?? null,
      model:                 resource.model                                                    ?? null,
      year:                  resource.year                                                     ?? null,
      mileage:               resource.mileage                                                  ?? null,
      color:                 resource.color                                                    ?? null,
      documentType:          resource.document_type          ?? resource.documentType           ?? 'DNI',
      clientDocumentNumber:  resource.client_document_number ?? resource.clientDocumentNumber  ?? '',
      firstName:             resource.first_name             ?? resource.firstName             ?? null,
      lastName:              resource.last_name              ?? resource.lastName              ?? null,
      vehicleId:             resource.vehicle_id             ?? resource.vehicleId             ?? null,
      registeredByUserId:    resource.registered_by_user_id    ?? resource.registeredByUserId    ?? null,
      registeredByProfileId: resource.registered_by_profile_id ?? resource.registeredByProfileId ?? null,
      registeredByFirstName: resource.registered_by_first_name ?? resource.registeredByFirstName ?? null,
      registeredByLastName:  resource.registered_by_last_name  ?? resource.registeredByLastName  ?? null,
      permanentExitDate:     resource.permanent_exit_date       ?? resource.permanentExitDate      ?? null,
      permanentExitTime:     resource.permanent_exit_time       ?? resource.permanentExitTime      ?? '',
      customerDocumentType:  resource.customer_document_type    ?? resource.customerDocumentType   ?? 'DNI',
      customerDni:           resource.customer_document_number  ?? resource.customerDni            ?? null,
      customerFirstName:     resource.customer_first_name       ?? resource.customerFirstName      ?? null,
      customerLastName:      resource.customer_last_name        ?? resource.customerLastName       ?? null,
      temporalExits,
    })
  }

  /**
   * Serializes the form (camelCase) into the snake_case body expected by the API
   * for both create (POST) and full update (PUT).
   * Exit registration is handled separately via toExitResource().
   * @param {Object} form
   * @returns {Object}
   */
  static toResource(form) {
    const entryDate = (() => {
      if (!form.entryDate) return null
      const d = form.entryDate instanceof Date ? form.entryDate : new Date(form.entryDate)
      return isNaN(d) ? null : d.toISOString().slice(0, 10)
    })()

    return {
      type:                   form.type                 ?? 'VEHICULO',
      entry_date:             entryDate,
      entry_time:             entryTimeTo24h(form.entryTime) ?? null,
      entry_reason:           normalizeEntryReason(form.entryReason) ?? null,
      document_type:          form.documentType         ?? null,
      client_document_number: form.clientDocumentNumber || null,
      license_plate:          form.licensePlate         || null,
      brand:                  form.brand                || null,
      model:                  form.model                || null,
      year:                   form.year                 ?? null,
      mileage:                form.mileage              ?? null,
      color:                  form.color                || null,
      first_name:             form.firstName            || null,
      last_name:              form.lastName             || null,
      vehicle_id:             form.vehicleId            ?? null,
      attachment_ids:         Array.isArray(form.attachmentIds) ? form.attachmentIds : [],
    }
  }

  /**
   * Serializes an exit form into the snake_case body expected by the API.
   * Used exclusively for the permanent exit operation (PATCH /{id}/salida).
   * @param {Object} form
   * @returns {Object}
   */
  static toExitResource(form) {
    return {
      exit_date:                toISODate(form.exitDate),
      exit_time:                exitTimeTo24h(form.exitTime),
      customer_document_type:   form.customerDocumentType ?? null,
      customer_document_number: form.customerDni          ?? null,
      customer_first_name:      form.customerFirstName    ?? null,
      customer_last_name:       form.customerLastName     ?? null,
      attachment_ids:           Array.isArray(form.attachmentIds) ? form.attachmentIds : [],
    }
  }

  /**
   * Serializes a temporal exit form into the snake_case body expected by the API.
   * Used exclusively for the temporal exit operation (PATCH /{id}/salida-temporal).
   * @param {Object} form
   * @returns {Object}
   */
  static toTemporalExitResource(form) {
    const resource = {
      exit_date:   toISODate(form.exitDate),
      exit_time:   exitTimeTo24h(form.exitTime),
      exit_reason: form.temporaryExitReason ?? null,
      attachment_ids: Array.isArray(form.attachmentIds) ? form.attachmentIds : [],
    }

    if (form.temporaryExitReason === 'PRESTAMO') {
      resource.replacement_license_plate = form.replacementLicensePlate ?? null
    }

    return resource
  }

  /**
   * Serializes a return form into the snake_case body expected by the API.
   * Used exclusively for the return operation (PATCH /{id}/retorno).
   * @param {Object} form
   * @returns {Object}
   */
  static toReturnResource(form) {
    return {
      return_date: toISODate(form.returnDate),
      return_time: exitTimeTo24h(form.returnTime),
      attachment_ids: Array.isArray(form.attachmentIds) ? form.attachmentIds : [],
    }
  }

  /**
   * @param {Object} response - Full HTTP response (e.g. Axios)
   * @returns {AccessEntry|null}
   */
  static toEntityFromResponse(response) {
    if (!response?.data) return null
    return AccessEntryAssembler.toEntityFromResource(response.data)
  }

  /**
   * @param {Object} response - Full HTTP response (e.g. Axios)
   * @returns {AccessEntry[]}
   */
  static toEntitiesFromResponse(response) {
    if (!Array.isArray(response?.data)) return []
    return response.data.map(r => AccessEntryAssembler.toEntityFromResource(r))
  }
}
