const DEFAULT_MESSAGES_BY_TYPE = {
  validation: 'Hay errores de validacion en los datos ingresados.',
  business: 'No se pudo completar la operacion por una regla de negocio.',
  auth: 'Tu sesion no es valida o no tienes permisos para esta accion.',
  infrastructure: 'Ocurrio un error interno. Intenta nuevamente en unos segundos.',
}

function translateBusinessMessage(message) {
  if (!message) return message

  if (/Vehicle with ID \d+ already has an active stay/i.test(message)) {
    return 'Este vehiculo ya cuenta con un ingreso activo. Registra primero su salida o selecciona otro vehiculo.'
  }

  return message
}

function inferTypeFromStatus(status) {
  if (!status) return 'infrastructure'
  if (status === 401 || status === 403) return 'auth'
  if (status === 400 || status === 422) return 'validation'
  if (status === 404 || status === 409) return 'business'
  if (status >= 500) return 'infrastructure'
  return 'business'
}

export function normalizeApiError(error, fallbackMessage = 'Ha ocurrido un error') {
  const responseData = error?.response?.data ?? {}
  const status = error?.response?.status ?? responseData?.status ?? null
  const type = responseData?.type ?? inferTypeFromStatus(status)
  const message = responseData?.message
    ?? error?.message
    ?? DEFAULT_MESSAGES_BY_TYPE[type]
    ?? fallbackMessage

  return {
    type,
    status,
    code: responseData?.code ?? 'UNEXPECTED_ERROR',
    message: translateBusinessMessage(message),
    details: responseData?.details ?? {},
    requestId: responseData?.requestId ?? error?.response?.headers?.['x-request-id'] ?? null,
  }
}

export function toUserMessage(normalizedError) {
  if (!normalizedError) return 'Ha ocurrido un error'
  return normalizedError.message ?? DEFAULT_MESSAGES_BY_TYPE[normalizedError.type] ?? 'Ha ocurrido un error'
}
