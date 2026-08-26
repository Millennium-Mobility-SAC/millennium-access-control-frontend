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
    if (naming?.vin) formData.append('vin', naming.vin)
    if (naming?.accessType) formData.append('accessType', naming.accessType)
    if (naming?.stayType) formData.append('stayType', naming.stayType)
    if (naming?.operationDate) formData.append('operationDate', naming.operationDate)
    if (naming?.operationTime) formData.append('operationTime', naming.operationTime)
    // Do not set Content-Type manually — browser/Axios must add the multipart boundary.
    return this.http.post(this.#endpoint, formData)
  }

  getFileContent(fileId) {
    return this.http.get(`${this.#endpoint}/${fileId}/content`, { responseType: 'blob' })
  }

  downloadFile(attachment) {
    return this.getFileContent(attachment.id).then(res => {
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = attachment.file_name ?? attachment.fileName ?? 'archivo'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }
}
