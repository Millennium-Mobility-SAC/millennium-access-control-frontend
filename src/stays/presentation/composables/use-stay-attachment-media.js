/**
 * URLs y utilidades para evidencias almacenadas en Google Drive.
 * En producción (Cloudflare Pages) el Referrer-Policy global puede bloquear
 * thumbnails de Drive; usar referrerpolicy="no-referrer" en cada <img>.
 */

const DRIVE_IMG_ATTRS = {
  referrerpolicy: 'no-referrer',
}

export function resolveProviderFileId(attachment) {
  return attachment?.provider_file_id ?? attachment?.providerFileId ?? null
}

export function buildDriveViewUrl(providerFileId) {
  return `https://drive.google.com/file/d/${providerFileId}/view`
}

export function buildDrivePreviewUrl(providerFileId, size = 'w1600') {
  return `https://drive.google.com/thumbnail?id=${providerFileId}&sz=${size}`
}

export function getOpenUrl(attachment) {
  const providerFileId = resolveProviderFileId(attachment)
  if (providerFileId) return buildDriveViewUrl(providerFileId)
  return attachment?.public_url ?? attachment?.publicUrl ?? '#'
}

export function getPreviewSrc(attachment, thumbnailSize = 'w1600') {
  const providerFileId = resolveProviderFileId(attachment)
  if (providerFileId) return buildDrivePreviewUrl(providerFileId, thumbnailSize)
  return attachment?.public_url ?? attachment?.publicUrl ?? ''
}

export function isImageAttachment(attachment) {
  const mimeType = attachment?.mime_type ?? attachment?.mimeType ?? ''
  if (mimeType.startsWith('image/')) return true
  const fileName = (attachment?.file_name ?? attachment?.fileName ?? '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(fileName)
}

export function onAttachmentImageError(event) {
  event.target.src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' fill='%23e5e7eb'/%3E%3Ctext x='120' y='85' text-anchor='middle' fill='%236b7280' font-size='14' font-family='Arial'%3ESin vista previa%3C/text%3E%3C/svg%3E"
}

export function useStayAttachmentMedia() {
  return {
    driveImgAttrs: DRIVE_IMG_ATTRS,
    resolveProviderFileId,
    buildDriveViewUrl,
    buildDrivePreviewUrl,
    getOpenUrl,
    getPreviewSrc,
    isImageAttachment,
    onAttachmentImageError,
  }
}
