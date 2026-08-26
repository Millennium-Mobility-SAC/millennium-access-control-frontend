/**
 * Dispara la descarga de un Blob en el navegador.
 *
 * El backend protege sus endpoints con el JWT en cabecera, asi que un enlace
 * directo no se autentica solo: hay que pedir el archivo con axios y entregarlo
 * desde memoria. Es el mismo patron que ya usa StorageFilesApi para los adjuntos
 * de Drive, extraido aqui para no tenerlo duplicado.
 *
 * @param {Blob}   blob
 * @param {string} fileName  nombre con el que se guarda
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Extrae el nombre de archivo de una cabecera Content-Disposition.
 * Devuelve `fallback` si la cabecera no viene o no trae filename.
 *
 * @param {string|undefined|null} contentDisposition
 * @param {string} fallback
 */
export function fileNameFromContentDisposition(contentDisposition, fallback) {
  if (!contentDisposition) return fallback
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition)
  if (!match?.[1]) return fallback
  try {
    return decodeURIComponent(match[1].trim())
  } catch {
    return match[1].trim()
  }
}
