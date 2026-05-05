import { BaseApi } from '../../../shared/infrustructure/base-api.js'

export class StorageFilesApi extends BaseApi {
  #endpoint

  constructor() {
    super()
    this.#endpoint = import.meta.env.VITE_STORAGE_FILES_ENDPOINT ?? '/integrations/storage/files'
  }

  upload(files = [], naming = {}) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    if (naming?.plate) formData.append('plate', naming.plate)
    if (naming?.accessType) formData.append('accessType', naming.accessType)
    if (naming?.stayType) formData.append('stayType', naming.stayType)
    if (naming?.operationDate) formData.append('operationDate', naming.operationDate)
    if (naming?.operationTime) formData.append('operationTime', naming.operationTime)
    return this.http.post(this.#endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
}
