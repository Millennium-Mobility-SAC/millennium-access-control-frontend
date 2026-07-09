import { nextTick } from 'vue'
import { useNotification } from './use-notification.js'

const DEFAULT_INVALID_SELECTOR = '.p-invalid, [aria-invalid="true"], .sip__dropzone--invalid'
const FOCUSABLE_SELECTOR = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function normalizeErrors(errors) {
  if (errors && typeof errors === 'object' && 'value' in errors) {
    return errors.value
  }
  return errors
}

function normalizeContainer(containerRef) {
  if (!containerRef) return null
  if (containerRef.value != null) return containerRef.value
  return containerRef
}

/**
 * @param {Record<string, string>|import('vue').Ref<Record<string, string>>} errors
 * @param {string[]|null} [fieldOrder]
 * @returns {string[]}
 */
export function collectFormErrorMessages(errors, fieldOrder = null) {
  const source = normalizeErrors(errors)
  if (!source) return []

  const keys = Array.isArray(fieldOrder) ? fieldOrder : Object.keys(source)
  return keys
    .map(key => source[key])
    .filter(message => typeof message === 'string' && message.trim().length > 0)
}

/**
 * @param {string[]} messages
 * @returns {string}
 */
export function buildFormValidationDetail(messages) {
  if (!messages.length) return ''
  if (messages.length === 1) return messages[0]

  const extra = messages.length - 1
  return `${messages[0]} (y ${extra} campo${extra > 1 ? 's' : ''} más)`
}

function focusElement(el) {
  if (!el) return false

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const focusable = el.matches(FOCUSABLE_SELECTOR)
    ? el
    : el.querySelector(FOCUSABLE_SELECTOR)

  if (!focusable) return false

  try {
    focusable.focus({ preventScroll: true })
  } catch {
    focusable.focus()
  }

  return true
}

/**
 * Enfoca el primer campo inválido dentro de un contenedor de formulario.
 *
 * @param {HTMLElement|null|import('vue').Ref<HTMLElement|null>} containerRef
 * @param {Object} [options]
 * @param {Record<string, string>|import('vue').Ref<Record<string, string>>} [options.errors]
 * @param {string[]} [options.fieldOrder]
 * @param {Record<string, string>} [options.fieldSelectors]
 * @param {string} [options.invalidSelector]
 * @returns {boolean}
 */
export function focusFirstInvalidField(containerRef, options = {}) {
  const container = normalizeContainer(containerRef)
  if (!container) return false

  const errors = normalizeErrors(options.errors)
  const fieldOrder = options.fieldOrder
  const fieldSelectors = options.fieldSelectors ?? {}
  const invalidSelector = options.invalidSelector ?? DEFAULT_INVALID_SELECTOR

  if (errors && Array.isArray(fieldOrder)) {
    for (const field of fieldOrder) {
      const message = errors[field]
      if (typeof message !== 'string' || !message.trim()) continue

      const customSelector = fieldSelectors[field]
      if (customSelector) {
        const customEl = container.querySelector(customSelector)
        if (focusElement(customEl)) return true
      }

      const fieldEl = container.querySelector(`[data-field="${field}"]`)
      if (focusElement(fieldEl)) return true
    }
  }

  return focusElement(container.querySelector(invalidSelector))
}

/**
 * Composable para reportar errores de validación de formularios:
 * toast con mensaje adecuado + autofocus en el primer campo inválido.
 */
export function useFormValidation() {
  const { showError } = useNotification()

  /**
   * @param {Record<string, string>|import('vue').Ref<Record<string, string>>} errors
   * @param {Object} [options]
   * @returns {Promise<boolean>} false cuando hay errores reportados
   */
  async function reportValidationErrors(errors, options = {}) {
    const messages = collectFormErrorMessages(errors, options.fieldOrder)
    if (!messages.length) return false

    if (options.showNotification !== false) {
      const title = options.title ?? 'Error de validación'
      const detail = options.detail ?? buildFormValidationDetail(messages)
      showError(detail, title)
    }

    await nextTick()
    focusFirstInvalidField(options.containerRef, options)
    return false
  }

  /**
   * @param {boolean} isValid
   * @param {Record<string, string>|import('vue').Ref<Record<string, string>>} errors
   * @param {Object} [options]
   * @returns {Promise<boolean>}
   */
  async function guardValidated(isValid, errors, options = {}) {
    if (isValid) return true
    await reportValidationErrors(errors, options)
    return false
  }

  return {
    reportValidationErrors,
    guardValidated,
    focusFirstInvalidField,
    collectFormErrorMessages,
    buildFormValidationDetail,
  }
}
