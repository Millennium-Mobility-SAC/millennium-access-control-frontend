/**
 * Convierte un error de Axios en un mensaje legible para el usuario en español.
 * Intenta obtener el detalle del backend; si no, usa el código HTTP como base.
 *
 * @param {import('axios').AxiosError|Error|any} err
 * @returns {string}
 */
export function humanizeApiError(err) {
  if (!err) return 'Error desconocido.'

  const status  = err?.response?.status
  const data    = err?.response?.data

  // 1. Intentar obtener mensaje específico del backend
  let backendMsg = null
  if (data?.message && typeof data.message === 'string') backendMsg = data.message
  else if (typeof data === 'string' && data.length < 250)  backendMsg = data
  else if (Array.isArray(data?.errors))                    backendMsg = data.errors.join('; ')

  // 2. Traducir términos técnicos comunes en el mensaje del backend
  if (backendMsg) backendMsg = _translateBackendTerms(backendMsg)

  // 3. Mensaje base por código HTTP
  const httpMsg = _statusToMessage(status)

  // Combinar: mensaje HTTP + detalle del backend (si difiere)
  if (backendMsg && httpMsg && backendMsg.toLowerCase() !== httpMsg.toLowerCase()) {
    return `${httpMsg}: ${backendMsg}`
  }
  return backendMsg || httpMsg || err?.message || 'Error desconocido.'
}

/** Mapea códigos HTTP a mensajes amigables en español. */
function _statusToMessage(status) {
  const map = {
    400: 'Los datos enviados no son válidos',
    401: 'No tiene autorización para realizar esta acción',
    403: 'No tiene permisos para realizar esta acción',
    404: 'El registro no fue encontrado',
    409: 'Ya existe un registro con esos datos (duplicado)',
    422: 'Los datos no cumplen el formato requerido',
    429: 'Demasiadas solicitudes, intente más tarde',
    500: 'Error interno del servidor',
    502: 'El servidor no está disponible',
    503: 'Servicio no disponible temporalmente',
  }
  return status ? (map[status] ?? `Error del servidor (código ${status})`) : null
}

/** Traduce frases técnicas de validación de Spring / Java al español. */
function _translateBackendTerms(msg) {
  const storagePatterns = [
    [/Failed to upload file to Google Drive.*|Google Drive credentials.*|credentials file not found.*/i,
      'No se pudo guardar el archivo. El almacenamiento no está disponible en este momento. Contacta al administrador.'],
    [/Failed to (delete|download) file from (Google Drive|storage).*/i,
      'No se pudo completar la operación con el archivo. Intenta de nuevo en unos momentos.'],
    [/File type not allowed.*/i,
      'Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP, HEIC) y PDF.'],
    [/At least one photo is required/i, 'Se requiere al menos una foto del vehículo.'],
    [/Only image files are valid as required vehicle photos/i,
      'Las fotos del vehículo deben ser imágenes (JPEG, PNG, GIF, WebP o HEIC).'],
    [/One or more uploaded file ids were not found/i,
      'No se encontraron uno o más archivos adjuntos. Vuelve a subirlos e intenta de nuevo.'],
    [/[A-Za-z]:\\[^\s]+|\/[\w./\\-]+\.(json|png|jpe?g)/i,
      'No se pudo guardar el archivo. El almacenamiento no está disponible en este momento. Contacta al administrador.'],
  ]
  for (const [pattern, replacement] of storagePatterns) {
    if (pattern.test(msg)) return replacement
  }

  const replacements = [
    [/must not be (blank|empty|null)/gi,              'el campo es obligatorio'],
    [/must be positive/gi,                            'el valor debe ser positivo'],
    [/must be greater than(?: or equal to)? (\S+)/gi, 'el valor debe ser mayor que $1'],
    [/must be less than(?: or equal to)? (\S+)/gi,    'el valor debe ser menor que $1'],
    [/size must be between \d+ and (\d+)/gi,          'el texto supera la longitud máxima permitida'],
    [/duplicate entry/gi,                             'registro duplicado'],
    [/already exists/gi,                              'ya existe un registro con esos datos'],
    [/not found/gi,                                   'no encontrado'],
    [/constraint violation/gi,                        'violación de restricción de datos'],
    [/invalid value/gi,                               'valor inválido'],
    [/cannot be null/gi,                              'el campo no puede ser nulo'],
  ]
  let result = msg
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement)
  }
  return result
}
