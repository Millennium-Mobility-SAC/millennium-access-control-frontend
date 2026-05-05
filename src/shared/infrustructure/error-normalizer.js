const DEFAULT_MESSAGES_BY_TYPE = {
  validation: 'Hay errores de validación en los datos ingresados.',
  business: 'No se pudo completar la operación por una regla de negocio.',
  auth: 'Tu sesión no es válida o no tienes permisos para esta acción.',
  infrastructure: 'Ocurrió un error interno. Intenta nuevamente en unos segundos.',
}

function translateBusinessMessage(message) {
  if (!message) return message

  if (/Invalid username or password/i.test(message)) {
    return 'Usuario o contraseña incorrectos. Verifica tus credenciales e intenta de nuevo.'
  }

  if (/User with username .+ not found/i.test(message)) {
    return 'El usuario ingresado no existe. Verifica el nombre de usuario.'
  }

  if (/Bad credentials/i.test(message)) {
    return 'Contraseña incorrecta. Verifica tus credenciales e intenta de nuevo.'
  }

  if (/User is disabled/i.test(message)) {
    return 'Esta cuenta está desactivada. Contacta al administrador.'
  }

  if (/User account is locked/i.test(message)) {
    return 'La cuenta está bloqueada. Contacta al administrador.'
  }

  if (/Vehicle with ID \d+ already has an active stay/i.test(message)) {
    return 'Este vehículo ya cuenta con un ingreso activo. Registra primero su salida o selecciona otro vehículo.'
  }

  if (/Cannot register attendance for an inactive employee/i.test(message)) {
    return 'No se puede registrar asistencia para un empleado inactivo.'
  }

  if (/Check-in is already registered for this employee on/i.test(message)) {
    return 'El ingreso de este empleado ya fue registrado hoy.'
  }

  if (/Cannot register check-out without a prior check-in/i.test(message)) {
    return 'No se puede registrar salida sin un ingreso previo el mismo día.'
  }

  if (/Check-out is already registered for this employee on/i.test(message)) {
    return 'La salida de este empleado ya fue registrada hoy.'
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

export function normalizeApiError(error, fallbackMessage = 'No se pudo completar la solicitud. Intenta de nuevo.') {
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
  if (!normalizedError) return 'No se pudo completar la solicitud.'
  return normalizedError.message ?? DEFAULT_MESSAGES_BY_TYPE[normalizedError.type] ?? 'No se pudo completar la solicitud.'
}
