import { TrafficFine } from '../../domain/models/traffic-fine.entity.js'
import { TrafficFineBatch } from '../../domain/models/traffic-fine-batch.entity.js'
import { TrafficFineSummary } from '../../domain/models/traffic-fine-summary.entity.js'
import { TrafficFineInventoryAssembler } from './traffic-fine-inventory.assembler.js'

/** Los importes llegan como número JSON; se normalizan a `Number` para poder mostrarlos y ordenarlos. */
function toNumber(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Igual que `toNumber`, pero conserva la ausencia: un descuento no informado no es un cero. */
function toNullableNumber(value) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function toChange(resource) {
  return {
    changeType: resource.change_type ?? null,
    changedAt: resource.changed_at ?? null,
    previousAmountDue: toNullableNumber(resource.previous_amount_due),
    newAmountDue: toNullableNumber(resource.new_amount_due),
    previousIssuerStatus: resource.previous_issuer_status ?? null,
    newIssuerStatus: resource.new_issuer_status ?? null,
    previousStage: resource.previous_stage ?? null,
    newStage: resource.new_stage ?? null,
  }
}

export class TrafficFineAssembler {
  static toSummaryFromResource(resource) {
    return new TrafficFineSummary({
      unitId: resource.unit_id ?? null,
      licensePlate: resource.license_plate ?? null,
      licensePlateRaw: resource.license_plate_raw ?? null,
      commercialBrand: resource.commercial_brand ?? null,
      advisor: resource.advisor ?? null,
      contractStatus: resource.contract_status ?? null,
      contractStart: resource.contract_start ?? null,
      contractEnd: resource.contract_end ?? null,
      resolutionDate: resource.resolution_date ?? null,
      periodEnd: resource.period_end ?? null,
      fineCount: toNumber(resource.fine_count),
      totalAmountDue: toNumber(resource.total_amount_due),
      oldestInfractionDate: resource.oldest_infraction_date ?? null,
      worstStage: resource.worst_stage ?? null,
      issuerTotals: (resource.issuer_totals ?? []).map((totals) => ({
        issuer: totals.issuer,
        fineCount: toNumber(totals.fine_count),
        amountDue: toNumber(totals.amount_due),
      })),
      checks: (resource.checks ?? []).map(toCheck),
      lastCheckedAt: resource.last_checked_at ?? null,
      hasCheckErrors: resource.has_check_errors ?? false,
      undeliveredCount: toNumber(resource.undelivered_count),
    })
  }

  static toFineFromResource(resource) {
    return new TrafficFine({
      id: resource.id ?? null,
      issuer: resource.issuer ?? null,
      ticketNumber: resource.ticket_number ?? null,
      offenderType: resource.offender_type ?? null,
      infractionCode: resource.infraction_code ?? null,
      infractionDate: resource.infraction_date ?? null,
      infractionDateRaw: resource.infraction_date_raw ?? null,
      discountAmount: toNullableNumber(resource.discount_amount),
      amountDue: toNumber(resource.amount_due),
      issuerStatus: resource.issuer_status ?? null,
      collectionStage: resource.collection_stage ?? null,
      status: resource.status ?? null,
      inPeriod: resource.in_period ?? true,
      firstSeenAt: resource.first_seen_at ?? null,
      resolvedAt: resource.resolved_at ?? null,
      reopenedAt: resource.reopened_at ?? null,
      updatedAt: resource.updated_at ?? null,
      changes: (resource.changes ?? []).map(toChange),
    })
  }

  /**
   * Detalle de una unidad. Las papeletas de fuera del periodo del contrato llegan aparte: no
   * suman, pero se muestran para poder discutirlas si alguien las reclama.
   */
  static toDetailFromResource(resource) {
    return {
      unit: TrafficFineInventoryAssembler.toUnitFromResource(resource.unit ?? {}),
      periodEnd: resource.period_end ?? null,
      hasCompleteContractDates: resource.has_complete_contract_dates ?? false,
      pendingCount: toNumber(resource.pending_count),
      totalAmountDue: toNumber(resource.total_amount_due),
      worstStage: resource.worst_stage ?? null,
      checks: (resource.checks ?? []).map(toCheck),
      fines: (resource.fines ?? []).map((fine) => TrafficFineAssembler.toFineFromResource(fine)),
      finesOutOfPeriod: (resource.fines_out_of_period ?? [])
        .map((fine) => TrafficFineAssembler.toFineFromResource(fine)),
    }
  }

  static toBatchFromResource(resource) {
    return new TrafficFineBatch({
      batchId: resource.batch_id ?? null,
      kind: resource.kind ?? null,
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
        unitId: item.unit_id ?? null,
        licensePlate: item.license_plate ?? null,
        issuer: item.issuer ?? null,
        status: item.status ?? null,
        completedAt: item.completed_at ?? null,
        errorMessage: item.error_message ?? null,
      })),
    })
  }

  static toPendingDeliveriesFromResource(resource) {
    return {
      newCount: toNumber(resource.new_count),
      changedCount: toNumber(resource.changed_count),
      reappearedCount: toNumber(resource.reappeared_count),
      total: toNumber(resource.total),
    }
  }

  static toDeliveryFromResource(resource) {
    if (!resource) return null
    return {
      id: resource.id ?? null,
      number: resource.number ?? '',
      kind: resource.kind ?? null,
      deliveredAt: resource.delivered_at ?? null,
      deliveredBy: resource.delivered_by ?? null,
      itemCount: toNumber(resource.item_count),
      newCount: toNumber(resource.new_count),
      changedCount: toNumber(resource.changed_count),
      reappearedCount: toNumber(resource.reappeared_count),
      totalAmountDue: toNumber(resource.total_amount_due),
      filterSummary: resource.filter_summary ?? null,
      fileName: resource.file_name ?? null,
    }
  }

  /**
   * Resultado de pedir una descarga. Sin nada que entregar no hay descarga, pero sí la última de
   * «nuevas»: es lo que permite decir quién se llevó lo que había y cuándo.
   */
  static toDeliveryResultFromResource(resource) {
    return {
      created: resource?.created ?? false,
      delivery: TrafficFineAssembler.toDeliveryFromResource(resource?.delivery),
      lastDelivery: TrafficFineAssembler.toDeliveryFromResource(resource?.last_delivery),
    }
  }

  /**
   * Acuse del lanzamiento.
   *
   * El acuse no trae `settled`: el lote recién lanzado nunca está cerrado, y `pending_items`
   * viene exacto del backend para que la tira no lo pinte como terminado hasta el primer sondeo.
   * `skipped` se conserva entero: es la única forma de que el usuario se entere de qué unidades
   * no se van a consultar y por qué.
   */
  static toLaunchResultFromResource(resource) {
    return {
      batch: new TrafficFineBatch({
        batchId: resource.batch_id ?? null,
        kind: resource.kind ?? null,
        providerJobId: resource.provider_job_id ?? null,
        status: resource.status ?? null,
        settled: false,
        issuers: resource.issuers ?? [],
        requestedAt: resource.requested_at ?? null,
        deadlineAt: resource.deadline_at ?? null,
        totalItems: resource.total_items ?? 0,
        pendingItems: resource.pending_items ?? 0,
        failedItems: Math.max(0, (resource.total_items ?? 0) - (resource.pending_items ?? 0)),
      }),
      requestedUnits: resource.requested_units ?? 0,
      skipped: (resource.skipped ?? []).map((item) => ({
        unitId: item.unit_id ?? null,
        licensePlate: item.license_plate ?? null,
        reason: item.reason ?? '',
      })),
    }
  }
}
