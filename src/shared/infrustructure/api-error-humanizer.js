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
  const code = typeof data?.code === 'string' ? data.code : null
  const rawMessage = typeof data?.message === 'string' ? data.message : null
  const isFaceError = Boolean(
    code?.startsWith('FACE_')
    || rawMessage?.startsWith('FACE_')
    || (typeof data === 'string' && data.startsWith('FACE_')),
  )
  if (code?.startsWith('FACE_')) backendMsg = code
  else if (rawMessage) backendMsg = rawMessage
  else if (typeof data === 'string' && data.length < 250) backendMsg = data
  else if (Array.isArray(data?.errors)) backendMsg = data.errors.join('; ')

  // 2. Traducir términos técnicos comunes en el mensaje del backend
  if (backendMsg) backendMsg = _translateBackendTerms(backendMsg)

  // Errores faciales: mensaje de dominio solo (sin prefijo HTTP genérico)
  if (isFaceError && backendMsg) return backendMsg

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

  const facePatterns = [
    [/FACE_NOT_ENROLLED.*/i,
      'El empleado no tiene rostro registrado. Enrólalo en Gestión de empleados o usa modo Manual.'],
    [/FACE_MISMATCH.*/i,
      'El rostro no coincide. Intenta de nuevo o cambia a modo Manual.'],
    [/FACE_NO_MATCH.*/i,
      'No se reconoció a ningún empleado con rostro registrado.'],
    [/FACE_AMBIGUOUS.*/i,
      'Varios rostros coinciden de forma cercana. Pide al empleado centrarse solo frente a la cámara.'],
    [/FACE_ATTENDANCE_COMPLETE.*/i,
      'Ya tiene ingreso y salida hoy'],
    [/FACE_MULTIPLE_FACES.*/i,
      'Hay más de un rostro en cámara. Que solo una persona se acerque.'],
    [/FACE_NOT_DOMINANT.*/i,
      'Acércate más a la cámara; el sistema usa el rostro más cercano y debe destacar frente a otros.'],
    [/FACE_LOW_QUALITY.*/i,
      'La detección del rostro es débil. Mejora la luz y mira de frente a la cámara.'],
    [/FACE_TOO_FAR.*/i,
      'Acércate a la cámara: el rostro se ve demasiado lejos o pequeño.'],
    [/FACE_NOT_DETECTED.*/i,
      'No se detectó un rostro en la foto. Usa mejor iluminación y encuadre frontal.'],
    [/FACE_INVALID_IMAGE.*/i,
      'La imagen no es válida. Usa JPEG, PNG o WebP (máx. 5 MB).'],
    [/FACE_SERVICE_UNAVAILABLE.*/i,
      'El servicio de reconocimiento facial no está disponible. Usa modo Manual.'],
  ]
  for (const [pattern, replacement] of facePatterns) {
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
