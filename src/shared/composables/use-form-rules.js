export function useFormRules() {
  const isBlank = value => value === null || value === undefined || String(value).trim() === ''
  const hasMaxLength = (value, max) => isBlank(value) || String(value).trim().length <= max
  const isEmail = value => isBlank(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
  const isPhone = value => isBlank(value) || /^[+]?[0-9\s\-()]{6,20}$/.test(String(value).trim())
  const isLicensePlate = value => isBlank(value) || /^[A-Z0-9-]{5,10}$/.test(String(value).trim().toUpperCase())
  const isYear = value => Number.isInteger(Number(value)) && Number(value) >= 1900 && Number(value) <= 2100

  return {
    isBlank,
    hasMaxLength,
    isEmail,
    isPhone,
    isLicensePlate,
    isYear,
  }
}
