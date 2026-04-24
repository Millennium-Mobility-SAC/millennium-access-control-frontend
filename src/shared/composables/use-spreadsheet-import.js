import { ref } from 'vue'
import * as XLSX from 'xlsx'

/**
 * Composable para parsear archivos Excel (.xlsx/.xls) y CSV,
 * mapeando las filas a objetos usando una configuración de columnas.
 *
 * @example
 * const { parsedRows, parseErrors, isLoading, fileName, parseFile, reset } = useSpreadsheetImport()
 *
 * await parseFile(file, [
 *   { key: 'licensePlate', header: 'Placa',  required: true  },
 *   { key: 'brand',        header: 'Marca',  required: false },
 *   { key: 'year',         header: 'Año',    required: false, default: null },
 * ])
 *
 * @typedef  {Object}  ImportColumn
 * @property {string}  key       - Clave camelCase del objeto de salida
 * @property {string}  header    - Nombre exacto de la columna en el archivo
 * @property {boolean} [required=true]  - Si la columna es obligatoria
 * @property {*}       [default=null]   - Valor por defecto cuando la celda está vacía
 */
export function useSpreadsheetImport() {
  // ===========================
  // STATE
  // ===========================
  /** @type {import('vue').Ref<Object[]>} Filas mapeadas listas para usar */
  const parsedRows  = ref([])
  /** @type {import('vue').Ref<string[]>} Mensajes de error de parseo */
  const parseErrors = ref([])
  /** @type {import('vue').Ref<boolean>} Indica si hay parseo en curso */
  const isLoading   = ref(false)
  /** @type {import('vue').Ref<string>} Nombre del archivo cargado */
  const fileName    = ref('')

  // ===========================
  // METHODS
  // ===========================
  /**
   * Parsea un objeto File (Excel o CSV) y mapea sus filas según importColumns.
   * Rellena parsedRows en éxito o parseErrors en fallo.
   *
   * @param {File}           file          - Archivo seleccionado por el usuario
   * @param {ImportColumn[]} importColumns - Definición de columnas esperadas
   */
  async function parseFile(file, importColumns) {
    isLoading.value  = true
    parseErrors.value = []
    parsedRows.value  = []
    fileName.value    = file.name

    try {
      const buffer   = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet    = workbook.Sheets[workbook.SheetNames[0]]
      const raw      = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (raw.length === 0) {
        parseErrors.value = ['El archivo está vacío o no contiene datos en la primera hoja.']
        return
      }

      const fileHeaders = Object.keys(raw[0])

      // Validar columnas requeridas
      const missingRequired = importColumns
        .filter(col => col.required !== false)
        .filter(col => !fileHeaders.includes(col.header))
        .map(col => col.header)

      if (missingRequired.length > 0) {
        parseErrors.value = [
          `Columnas requeridas no encontradas: ${missingRequired.join(', ')}.`,
          `Columnas detectadas en el archivo: ${fileHeaders.join(', ')}.`,
        ]
        return
      }

      // Mapear filas a objetos usando las keys configuradas
      parsedRows.value = raw.map(row => {
        const obj = {}
        for (const col of importColumns) {
          const rawVal = row[col.header]
          obj[col.key] = (rawVal !== undefined && rawVal !== '') ? rawVal : (col.default ?? null)
        }
        return obj
      })
    } catch {
      parseErrors.value = [
        'No se pudo procesar el archivo. Asegúrate de que sea un Excel (.xlsx/.xls) o CSV válido.',
      ]
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Restablece el estado del composable a su valor inicial.
   */
  function reset() {
    parsedRows.value  = []
    parseErrors.value = []
    isLoading.value   = false
    fileName.value    = ''
  }

  return { parsedRows, parseErrors, isLoading, fileName, parseFile, reset }
}
