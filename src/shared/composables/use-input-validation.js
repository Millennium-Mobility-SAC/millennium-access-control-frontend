/**
 * Composable para validaciones de entrada en formularios.
 * Proporciona funciones para validar y filtrar entradas de texto y números.
 */
export function useInputValidation() {
  
  /**
   * Valida que solo se ingresen letras, espacios y caracteres con tilde.
   * Previene la entrada de números y caracteres especiales.
   * @param {KeyboardEvent} event - El evento de teclado
   */
  const validateTextOnly = (event) => {
    const key = event.key
    
    // Permitir teclas de control
    if (
      key === 'Backspace' || 
      key === 'Delete' || 
      key === 'Tab' || 
      key === 'Escape' || 
      key === 'Enter' ||
      key === 'ArrowLeft' || 
      key === 'ArrowRight' || 
      key === 'ArrowUp' || 
      key === 'ArrowDown' ||
      key === 'Home' || 
      key === 'End' ||
      (event.ctrlKey || event.metaKey)
    ) {
      return
    }
    
    // Solo permitir letras, espacios y caracteres con tilde
    const regex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]$/
    if (!regex.test(key)) {
      event.preventDefault()
    }
  }

  /**
   * Valida que solo se ingresen números.
   * Previene la entrada de letras y caracteres especiales.
   * @param {KeyboardEvent} event - El evento de teclado
   */
  const validateNumbersOnly = (event) => {
    const key = event.key
    
    // Permitir teclas de control
    if (
      key === 'Backspace' || 
      key === 'Delete' || 
      key === 'Tab' || 
      key === 'Escape' || 
      key === 'Enter' ||
      key === 'ArrowLeft' || 
      key === 'ArrowRight' || 
      key === 'ArrowUp' || 
      key === 'ArrowDown' ||
      key === 'Home' || 
      key === 'End' ||
      (event.ctrlKey || event.metaKey)
    ) {
      return
    }
    
    // Solo permitir números
    const regex = /^[0-9]$/
    if (!regex.test(key)) {
      event.preventDefault()
    }
  }

  /**
   * Valida que solo se ingresen caracteres alfanuméricos.
   * Útil para campos como códigos o identificadores.
   * @param {KeyboardEvent} event - El evento de teclado
   */
  const validateAlphanumericOnly = (event) => {
    const key = event.key
    
    // Permitir teclas de control
    if (
      key === 'Backspace' || 
      key === 'Delete' || 
      key === 'Tab' || 
      key === 'Escape' || 
      key === 'Enter' ||
      key === 'ArrowLeft' || 
      key === 'ArrowRight' || 
      key === 'ArrowUp' || 
      key === 'ArrowDown' ||
      key === 'Home' || 
      key === 'End' ||
      (event.ctrlKey || event.metaKey)
    ) {
      return
    }
    
    // Solo permitir letras y números
    const regex = /^[a-zA-Z0-9]$/
    if (!regex.test(key)) {
      event.preventDefault()
    }
  }

  /**
   * Filtra un string para que solo contenga letras, espacios y caracteres con tilde.
   * Útil para limpiar texto pegado desde el portapapeles.
   * @param {string} value - El valor a filtrar
   * @returns {string} El valor filtrado
   */
  const filterTextOnly = (value) => {
    if (!value) return ''
    return value.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ\s]/g, '')
  }

  /**
   * Filtra un string para que solo contenga números.
   * Útil para limpiar números pegados desde el portapapeles.
   * @param {string} value - El valor a filtrar
   * @param {number} maxLength - Longitud máxima opcional
   * @returns {string} El valor filtrado
   */
  const filterNumbersOnly = (value, maxLength = null) => {
    if (!value) return ''
    const filtered = value.replace(/[^0-9]/g, '')
    return maxLength ? filtered.slice(0, maxLength) : filtered
  }

  /**
   * Filtra un string para que solo contenga caracteres alfanuméricos.
   * @param {string} value - El valor a filtrar
   * @returns {string} El valor filtrado
   */
  const filterAlphanumericOnly = (value) => {
    if (!value) return ''
    return value.replace(/[^a-zA-Z0-9]/g, '')
  }

  // ===========================
  // VALIDADORES DE CAMPO
  // ===========================

  /**
   * Valida que un email tenga formato válido.
   * @param {string} email - El email a validar
   * @returns {boolean} True si el email es válido
   */
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Valida un campo de nombre (solo letras y espacios).
   * @param {string} value - El valor a validar
   * @returns {string} Mensaje de error o string vacío si es válido
   */
  const validateName = (value) => {
    if (!value.trim()) return 'Este campo es requerido'
    const nameRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]+$/
    if (!nameRegex.test(value)) {
      return 'Solo se permiten letras y espacios'
    }
    return ''
  }

  /**
   * Valida un campo de teléfono (9 dígitos numéricos).
   * @param {string} value - El valor a validar
   * @returns {string} Mensaje de error o string vacío si es válido
   */
  const validatePhone = (value) => {
    if (!value.trim()) return 'Este campo es requerido'
    const phoneRegex = /^\d+$/
    if (!phoneRegex.test(value)) {
      return 'Solo se permiten números'
    }
    if (value.length !== 9) {
      return 'Debe contener exactamente 9 dígitos'
    }
    return ''
  }

  /**
   * Valida un campo de email.
   * @param {string} value - El valor a validar
   * @returns {string} Mensaje de error o string vacío si es válido
   */
  const validateEmailField = (value) => {
    if (!value.trim()) return 'Este campo es requerido'
    if (!isValidEmail(value)) {
      return 'Ingrese un correo electrónico válido'
    }
    return ''
  }

  /**
   * Valida un campo de RUC (11 dígitos numéricos).
   * @param {string} value - El valor a validar
   * @returns {string} Mensaje de error o string vacío si es válido
   */
  const validateRUC = (value) => {
    if (!value.trim()) return 'Este campo es requerido'
    const rucRegex = /^\d+$/
    if (!rucRegex.test(value)) {
      return 'Solo se permiten números'
    }
    if (value.length !== 11) {
      return 'El RUC debe contener exactamente 11 dígitos'
    }
    return ''
  }

  /**
   * Valida que un campo requerido no esté vacío.
   * @param {string} value - El valor a validar
   * @param {string} fieldName - Nombre del campo para el mensaje de error
   * @returns {string} Mensaje de error o string vacío si es válido
   */
  const validateRequired = (value, fieldName = 'Este campo') => {
    if (!value || !value.toString().trim()) {
      return `${fieldName} es requerido`
    }
    return ''
  }

  return {
    // Validaciones en keydown
    validateTextOnly,
    validateNumbersOnly,
    validateAlphanumericOnly,
    
    // Filtros para copiar/pegar
    filterTextOnly,
    filterNumbersOnly,
    filterAlphanumericOnly,

    // Validadores de campo
    isValidEmail,
    validateName,
    validatePhone,
    validateEmailField,
    validateRUC,
    validateRequired
  }
}
