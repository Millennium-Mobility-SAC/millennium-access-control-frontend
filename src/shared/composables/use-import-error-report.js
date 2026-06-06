import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// ── Colors ─────────────────────────────────────────────────────────────────
const COLOR_HEADER_BG   = 'FF2D3748' // dark gray-blue  → header row background
const COLOR_HEADER_TEXT = 'FFFFFFFF' // white           → header row text
const COLOR_ERROR_BG    = 'FFC53030' // dark red        → "Motivo del error" header
const COLOR_ERROR_TEXT  = 'FFFFFFFF' // white           → "Motivo del error" header text
const COLOR_CELL_BG     = 'FFFFF5F5' // very light pink → error cell background
const COLOR_CELL_TEXT   = 'FF9B2335' // dark red        → error cell text

/**
 * Descarga automáticamente un archivo Excel con las filas que fallaron
 * durante una importación masiva, incluyendo una columna "Motivo del error"
 * resaltada y mensajes en lenguaje amigable para el usuario.
 *
 * @param {Array<{row: Object, reason: string}>} failedRows  - Filas fallidas con su razón de fallo
 * @param {Array<{key: string, header: string}>} importColumns - Definición de columnas usadas en la importación
 * @param {string} [baseFilename='errores-importacion']       - Nombre base del archivo (sin extensión)
 */
export async function downloadImportErrorReport(failedRows, importColumns, baseFilename = 'errores-importacion') {
  if (!failedRows?.length || !importColumns?.length) return

  const today = new Date()
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Errores de importación')

  const dataHeaders = importColumns.map(c => c.header)
  const errorHeader = 'Motivo del error'
  const headers     = [...dataHeaders, errorHeader]
  const errorColIdx = headers.length // 1-based

  // ── Column widths ─────────────────────────────────────────────────────────
  ws.columns = headers.map((h, i) => ({
    width: i === headers.length - 1 ? 55 : Math.max(h.length + 6, 20),
  }))

  // ── Header row ────────────────────────────────────────────────────────────
  const headerRow = ws.addRow(headers)
  headerRow.height = 24

  headerRow.eachCell((cell, colNumber) => {
    const isErrorCol = colNumber === errorColIdx
    cell.font = {
      bold:  true,
      color: { argb: isErrorCol ? COLOR_ERROR_TEXT : COLOR_HEADER_TEXT },
      size:  11,
    }
    cell.fill = {
      type:    'pattern',
      pattern: 'solid',
      fgColor: { argb: isErrorCol ? COLOR_ERROR_BG : COLOR_HEADER_BG },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFCCCCCC' } },
    }
  })

  // ── Data rows ─────────────────────────────────────────────────────────────
  for (const { row, reason } of failedRows) {
    const values = importColumns.map(col => {
      const v = row[col.key]
      return v !== null && v !== undefined ? v : ''
    })
    values.push(reason || 'Error desconocido.')

    const dataRow = ws.addRow(values)
    dataRow.height = 20

    // Style only the error cell
    const errorCell = dataRow.getCell(errorColIdx)
    errorCell.fill = {
      type:    'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_CELL_BG },
    }
    errorCell.font      = { color: { argb: COLOR_CELL_TEXT }, italic: true, size: 10 }
    errorCell.alignment = { vertical: 'middle', wrapText: true }
    errorCell.border    = {
      left: { style: 'thin', color: { argb: 'FFFFCCCC' } },
    }
  }

  // ── Freeze the header row ─────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Auto-filter on header row ─────────────────────────────────────────────
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: headers.length },
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const outName = `${baseFilename.trim().replace(/\.xlsx$/i, '')}-${dateStr}.xlsx`
  const buffer  = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), outName)
}

