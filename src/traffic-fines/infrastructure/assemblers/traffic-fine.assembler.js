import { TrafficFine } from '../../domain/models/traffic-fine.entity.js'
import { TrafficFineBatch } from '../../domain/models/traffic-fine-batch.entity.js'
import { TrafficFineSummary } from '../../domain/models/traffic-fine-summary.entity.js'

/** Los importes llegan como número JSON; se normalizan a `Number` para poder sumarlos y ordenarlos. */
function toNumber(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toCheck(resource) {
  return {
    issuer: resource.issuer ?? null,
    status: resource.status ?? null,
    succeeded: resource.succeeded ?? false,
    completedAt: resource.completed_at ?? null,
    errorMessage: resource.error_message ?? null,
    finesReported: resource.fines_reported ?? null,
  }
}

export class TrafficFineAssembler {
  static toSummaryFromResource(resource) {
    return new TrafficFineSummary({
      vehicleId: resource.vehicle_id ?? null,
      vin: resource.vin ?? null,
      licensePlate: resource.license_plate ?? null,
      brand: resource.brand ?? '',
      model: resource.model ?? '',
      year: resource.year ?? null,
      external: resource.external ?? false,
      consultable: resource.consultable ?? false,
      fineCount: toNumber(resource.fine_count),
      totalAmountDue: toNumber(resource.total_amount_due),
      totalDiscount: toNumber(resource.total_discount),
      oldestInfractionDate: resource.oldest_infraction_date ?? null,
      issuerTotals: (resource.issuer_totals ?? []).map((totals) => ({
        issuer: totals.issuer,
        fineCount: toNumber(totals.fine_count),
        amountDue: toNumber(totals.amount_due),
      })),
      checks: (resource.checks ?? []).map(toCheck),
      lastCheckedAt: resource.last_checked_at ?? null,
      hasCheckErrors: resource.has_check_errors ?? false,
    })
  }

  static toFineFromResource(resource) {
    return new TrafficFine({
      id: resource.id ?? null,
      issuer: resource.issuer ?? null,
      ticketNumber: resource.ticket_number ?? null,
      infractionDate: resource.infraction_date ?? null,
      infractionDateRaw: resource.infraction_date_raw ?? null,
      totalAmount: toNumber(resource.total_amount),
      discountAmount: toNumber(resource.discount_amount),
      amountDue: toNumber(resource.amount_due),
      issuerStatus: resource.issuer_status ?? null,
      status: resource.status ?? null,
      firstSeenAt: resource.first_seen_at ?? null,
      resolvedAt: resource.resolved_at ?? null,
      updatedAt: resource.updated_at ?? null,
    })
  }

  static toDetailFromResource(resource) {
    return {
      vehicleId: resource.vehicle_id ?? null,
      vin: resource.vin ?? null,
      licensePlate: resource.license_plate ?? null,
      brand: resource.brand ?? '',
      model: resource.model ?? '',
      year: resource.year ?? null,
      external: resource.external ?? false,
      consultable: resource.consultable ?? false,
      pendingCount: toNumber(resource.pending_count),
      totalAmountDue: toNumber(resource.total_amount_due),
      checks: (resource.checks ?? []).map(toCheck),
      fines: (resource.fines ?? []).map((fine) => TrafficFineAssembler.toFineFromResource(fine)),
    }
  }

  static toBatchFromResource(resource) {
    return new TrafficFineBatch({
      batchId: resource.batch_id ?? null,
      providerJobId: resource.provider_job_id ?? null,
      status: resource.status ?? null,
      settled: resource.settled ?? false,
      issuers: resource.issuers ?? [],
      requestedAt: resource.requested_at ?? null,
      deadlineAt: resource.deadline_at ?? null,
      completedAt: resource.completed_at ?? null,
      totalItems: resource.total_items ?? 0,
      completedItems: resource.completed_items ?? 0,
      failedItems: resource.failed_items ?? 0,
      pendingItems: resource.pending_items ?? 0,
      finesCreated: resource.fines_created ?? 0,
      finesUpdated: resource.fines_updated ?? 0,
      finesResolved: resource.fines_resolved ?? 0,
      errorMessage: resource.error_message ?? null,
      items: (resource.items ?? []).map((item) => ({
        vehicleId: item.vehicle_id ?? null,
        licensePlate: item.license_plate ?? null,
        issuer: item.issuer ?? null,
        status: item.status ?? null,
        completedAt: item.completed_at ?? null,
        errorMessage: item.error_message ?? null,
        finesReported: item.fines_reported ?? null,
        finesCreated: item.fines_created ?? null,
      })),
    })
  }

  /**
   * Acuse del lanzamiento.
   *
   * `skipped` se conserva entero: es la única forma de que el usuario se entere de que algunas
   * de las unidades que seleccionó no se van a consultar y por qué.
   */
  static toLaunchResultFromResource(resource) {
    return {
      batch: TrafficFineAssembler.toBatchFromResource(resource),
      requestedPlates: resource.requested_plates ?? [],
      skipped: (resource.skipped ?? []).map((item) => ({
        vehicleId: item.vehicle_id ?? null,
        licensePlate: item.license_plate ?? null,
        reason: item.reason ?? '',
      })),
    }
  }
}
