import { ref } from 'vue'
import ExcelJS from 'exceljs'

/**
 * Composable para parsear archivos Excel (.xlsx) y CSV,
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
  // PRIVATE HELPERS
  // ===========================

  /**
   * Parsea texto CSV (RFC 4180 básico) a un array de objetos con los encabezados de la primera fila.
   * @param {ArrayBuffer} buffer
   * @returns {Object[]}
   */
  function _parseCsvBuffer(buffer) {
    const text = new TextDecoder('utf-8').decode(buffer)
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length < 1) return []

    const parseRow = (line) => {
      const result = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseRow(lines[0])
    return lines.slice(1).map(line => {
      const vals = parseRow(line)
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    })
  }

  /**
   * Parsea un buffer xlsx con ExcelJS y devuelve las filas como objetos
   * con los encabezados de la primera fila como claves.
   * @param {ArrayBuffer} buffer
   * @returns {Promise<Object[]>}
   */
  async function _parseXlsxBuffer(buffer) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]
    if (!ws) return []

    // Extraer encabezados de la primera fila
    const headers = []
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim()
    })

    const raw = []
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return
      const obj = {}
      headers.forEach((header, i) => {
        if (!header) return
        let val = row.getCell(i + 1).value
        if (val === null || val === undefined) {
          val = ''
        } else if (val instanceof Date) {
          // Mantener como Date para que el código consumidor lo trate igual que antes
          val = val
        } else if (typeof val === 'object') {
          if (val.text !== undefined) val = val.text          // hipervínculo
          else if (val.richText) val = val.richText.map(r => r.text).join('')
          else if (val.result !== undefined) val = val.result // fórmula
          else val = String(val)
        }
        obj[header] = val !== null && val !== undefined ? val : ''
      })
      raw.push(obj)
    })

    return raw
  }

  // ===========================
  // METHODS
  // ===========================
  /**
   * Parsea un objeto File (Excel .xlsx o CSV) y mapea sus filas según importColumns.
   * Rellena parsedRows en éxito o parseErrors en fallo.
   *
   * @param {File}           file          - Archivo seleccionado por el usuario
   * @param {ImportColumn[]} importColumns - Definición de columnas esperadas
   */
  async function parseFile(file, importColumns) {
    isLoading.value   = true
    parseErrors.value = []
    parsedRows.value  = []
    fileName.value    = file.name

    try {
      const ext = file.name.toLowerCase().split('.').pop()

      if (ext === 'xls') {
        parseErrors.value = [
          'El formato .xls (Excel 97-2003) no está soportado. Por favor guarda el archivo como .xlsx o .csv e intenta de nuevo.',
        ]
        return
      }

      const buffer = await file.arrayBuffer()
      const raw = ext === 'csv' ? _parseCsvBuffer(buffer) : await _parseXlsxBuffer(buffer)

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
        'No se pudo procesar el archivo. Asegúrate de que sea un Excel (.xlsx) o CSV válido.',
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
