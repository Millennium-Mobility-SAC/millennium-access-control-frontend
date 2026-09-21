import { TrafficFineUnit } from '../../domain/models/traffic-fine-unit.entity.js'

function toRowIssue(resource) {
  return {
    rowNumber: resource.row_number ?? null,
    plate: resource.plate ?? '',
    messages: resource.messages ?? [],
  }
}

export class TrafficFineInventoryAssembler {
  static toUnitFromResource(resource) {
    return new TrafficFineUnit({
      id: resource.id ?? null,
      rowNumber: resource.row_number ?? null,
      licensePlate: resource.license_plate ?? null,
      licensePlateRaw: resource.license_plate_raw ?? null,
      commercialBrand: resource.commercial_brand ?? null,
      advisor: resource.advisor ?? null,
      contractStart: resource.contract_start ?? null,
      contractEnd: resource.contract_end ?? null,
      resolutionDate: resource.resolution_date ?? null,
      contractStatus: resource.contract_status ?? null,
      importId: resource.import_id ?? null,
      createdAt: resource.created_at ?? null,
    })
  }

  /**
   * Vista previa o resultado de una importación.
   *
   * Las listas llegan recortadas y los contadores son los reales: quien las muestre tiene que decir
   * cuántas faltan en vez de dar a entender que son todas.
   */
  static toImportResultFromResource(resource) {
    return {
      importId: resource.import_id ?? null,
      fileName: resource.file_name ?? '',
      fileHash: resource.file_hash ?? null,
      sheetName: resource.sheet_name ?? null,
      totalRows: resource.total_rows ?? 0,
      newCount: resource.new_count ?? 0,
      unchangedCount: resource.unchanged_count ?? 0,
      differingCount: resource.differing_count ?? 0,
      rejectedCount: resource.rejected_count ?? 0,
      missingColumns: resource.missing_columns ?? [],
      rejectedRows: (resource.rejected_rows ?? []).map(toRowIssue),
      differingRows: (resource.differing_rows ?? []).map(toRowIssue),
      newUnits: (resource.new_units ?? []).map((unit) => TrafficFineInventoryAssembler.toUnitFromResource(unit)),
    }
  }

  static toImportFromResource(resource) {
    return {
      id: resource.id ?? null,
      fileName: resource.file_name ?? '',
      fileHash: resource.file_hash ?? null,
      sheetName: resource.sheet_name ?? null,
      importedAt: resource.imported_at ?? null,
      importedBy: resource.imported_by ?? null,
      totalRows: resource.total_rows ?? 0,
      createdCount: resource.created_count ?? 0,
      unchangedCount: resource.unchanged_count ?? 0,
      differingCount: resource.differing_count ?? 0,
      rejectedCount: resource.rejected_count ?? 0,
    }
  }
}
