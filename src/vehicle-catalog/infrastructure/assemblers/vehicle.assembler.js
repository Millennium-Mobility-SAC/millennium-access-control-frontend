import { Vehicle } from '../../domain/models/vehicle.entity.js'

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
    return {
      license_plate: form.licensePlate || null,
      brand:         form.brand        || null,
      model:         form.model        || null,
      year:          form.year         ?? null,
      color:         form.color        || null,
    }
  }
}
