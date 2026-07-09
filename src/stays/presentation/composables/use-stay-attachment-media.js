/**
 * Utilidades para evidencias almacenadas en el backend (proxy autenticado).
 * Las imágenes se sirven a través de GET /integrations/storage/files/{id}/content
 * con el token JWT en el header, por lo que los archivos en Drive son privados.
 *
 * Para mostrar imágenes en UI, usar el componente `AttachmentImage`.
 */

export function isImageAttachment(attachment) {
  const mimeType = attachment?.mime_type ?? attachment?.mimeType ?? ''
  if (mimeType.startsWith('image/')) return true
  const fileName = (attachment?.file_name ?? attachment?.fileName ?? '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(fileName)
}

const PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' fill='%23e5e7eb'/%3E%3Ctext x='120' y='85' text-anchor='middle' fill='%236b7280' font-size='14' font-family='Arial'%3ESin vista previa%3C/text%3E%3C/svg%3E"

export function onAttachmentImageError(event) {
  if (!event?.target) return
  event.target.src = PLACEHOLDER_SRC
}

export function useStayAttachmentMedia() {
  return {
    isImageAttachment,
    onAttachmentImageError,
  }
}
