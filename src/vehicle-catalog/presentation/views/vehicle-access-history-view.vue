<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute }                 from 'vue-router'
import { useVehicleCatalogStore }   from '../../application/vehicle-catalog.store.js'
import { useStaysStore }            from '@/stays/application/stays.store.js'
import { useAsyncAction }           from '@/shared/composables/use-async-action.js'
import { useNotification }          from '@/shared/composables/use-notification.js'
import { isImageAttachment }        from '@/stays/presentation/composables/use-stay-attachment-media.js'
import AttachmentCarouselDialog     from '@/shared/presentation/components/attachment-carousel-dialog.vue'
import { ACCESS_STATUS, ACCESS_STATUS_SEVERITY } from '@/shared/presentation/constants/access-status.constants.js'
import { MOTIVOS_INGRESO, MOTIVOS_SALIDA_TEMPORAL, TIPOS_DOCUMENTO } from '@/stays/presentation/constants/stays-ui.constants.js'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
  formatCalendarDateForUiNullable,
  formatTimeHmAmPmForUi,
  calendarDateToExcelLocalDate,
  formatWallClockTimeForExcel,
} from '@/shared/domain/format-datetime-ui.js'
import { todayIsoLocal } from '@/shared/domain/employee-attendance-day.js'

const route        = useRoute()
const vehicleStore = useVehicleCatalogStore()

/** Tooltip: el chip de km es odómetro al ingreso, no el motivo (0KM es motivo de ingreso en catálogo). */
const MILEAGE_INGRESO_TOOLTIP =
  'Kilometraje del odómetro declarado al registrar ese ingreso. No es el motivo de ingreso (0KM, Mecánica, etc. van arriba).'
const accessStore  = useStaysStore()
const { isLoading, error, run } = useAsyncAction()
const { showError, showInfo } = useNotification()

const photoDialogVisible = ref(false)
const photoAttachments = ref([])
const photoDialogTitle = ref('Evidencias fotográficas')
const photoLoadingKey = ref(null)
/** stayId → lista de adjuntos (evita repetir GET al abrir varias filas de la misma estadía) */
const attachmentsCache = ref(new Map())

// ── Vehicle id from route ─────────────────────────────────────────────────────
const vehicleId = Number(route.params.vehicleId)

const vehicle = computed(() =>
  vehicleStore.vehicles.find(v => v.id === vehicleId) ?? {
    licensePlate:  route.query.plate  ?? '—',
    brand:         route.query.brand  ?? '',
    model:         route.query.model  ?? '',
    currentStatus: null,
  }
)

// ── History items (sorted most-recent first) ──────────────────────────────────
const historyItems = ref([])

/** IDs de estadías con la tabla de flujo visible (por defecto solo la más reciente). */
const expandedStayIds = ref(new Set())

function isStayExpanded(entryId) {
  return expandedStayIds.value.has(entryId)
}

function toggleStayExpanded(entryId) {
  const next = new Set(expandedStayIds.value)
  if (next.has(entryId)) next.delete(entryId)
  else next.add(entryId)
  expandedStayIds.value = next
}

onMounted(async () => {
  await run(async () => {
    const items = await accessStore.fetchByVehicleId(vehicleId)
    historyItems.value = [...items].sort((a, b) => {
      const da = (a.entryDate ?? '') + (a.entryTime ?? '')
      const db = (b.entryDate ?? '') + (b.entryTime ?? '')
      return db.localeCompare(da)
    })
    const list = historyItems.value
    expandedStayIds.value = list.length ? new Set([list[0].id]) : new Set()
  })
  if (!vehicleStore.vehicles.length) {
    vehicleStore.fetchAll().catch(() => {})
  }
})

// ── Label helpers ─────────────────────────────────────────────────────────────
function getStatusLabel(v)      { return ACCESS_STATUS.find(s => s.value === v)?.label ?? v ?? '—' }
function getStatusSeverity(v)   { return ACCESS_STATUS_SEVERITY[v] ?? 'secondary' }
function getEntryReasonLabel(v) { return MOTIVOS_INGRESO.find(m => m.value === v)?.label ?? v ?? '—' }
function getExitReasonLabel(v)  { return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === v)?.label ?? v ?? '—' }

// ── Date/time (compartido: `format-datetime-ui.js`) ──────────────────────────
const fmtDate = formatCalendarDateForUiNullable
const fmtTime = (v) => formatTimeHmAmPmForUi(v, { seconds: 'never' })

// ── Timeline builder ──────────────────────────────────────────────────────────
const EVENT_ICON = {
  'ingreso':            'pi-sign-in',
  'salida-temporal':    'pi-arrow-right',
  'retorno':            'pi-arrow-left',
  'retorno-pendiente':  'pi-clock',
  'salida-permanente':  'pi-sign-out',
}

const EVENT_BG = {
  'ingreso':            '#16a34a',
  'salida-temporal':    '#d97706',
  'retorno':            '#2563eb',
  'retorno-pendiente':  '#9ca3af',
  'salida-permanente':  '#dc2626',
}

function buildTimeline(entry) {
  const events = []

  // 1. Entry
  events.push({
    type:           'ingreso',
    operationType:  'ENTRY',
    temporalExitId: null,
    date:           entry.entryDate,
    time:           entry.entryTime,
    label:          'Ingreso a planta',
    detail:         getEntryReasonLabel(entry.entryReason),
    extra:          entry.mileage != null ? entry.mileage.toLocaleString('es-PE') + ' km' : null,
  })

  // 2. Temporal exits in chronological order
  const sortedExits = [...(entry.temporalExits ?? [])].sort((a, b) =>
    ((a.exitDate ?? '') + (a.exitTime ?? '')).localeCompare((b.exitDate ?? '') + (b.exitTime ?? ''))
  )

  for (const te of sortedExits) {
    events.push({
      type:           'salida-temporal',
      operationType:  'TEMPORAL_EXIT',
      temporalExitId: te.id ?? null,
      date:           te.exitDate,
      time:           te.exitTime,
      label:          'Salida temporal',
      detail:         getExitReasonLabel(te.exitReason),
      extra:          te.replacementLicensePlate ? `Placa reemplazo: ${te.replacementLicensePlate}` : null,
    })
    if (te.returnDate) {
      events.push({
        type:           'retorno',
        operationType:  'RETURN',
        temporalExitId: te.id ?? null,
        date:           te.returnDate,
        time:           te.returnTime,
        label:          'Retorno a planta',
        detail:         null,
        extra:          null,
      })
    } else {
      events.push({
        type:           'retorno-pendiente',
        operationType:  null,
        temporalExitId: null,
        date:           null,
        time:           null,
        label:          'Retorno pendiente',
        detail:         'Vehículo aún fuera de planta',
        extra:          null,
      })
    }
  }

  // 3. Permanent exit
  if (entry.permanentExitDate) {
    const clientName = [
      entry.customerFirstName || entry.firstName,
      entry.customerLastName  || entry.lastName,
    ].filter(Boolean).join(' ') || null
    const clientDoc = entry.customerDni || entry.clientDocumentNumber || null
    events.push({
      type:           'salida-permanente',
      operationType:  'PERMANENT_EXIT',
      temporalExitId: null,
      date:           entry.permanentExitDate,
      time:           entry.permanentExitTime,
      label:          'Salida permanente',
      detail:         clientName,
      extra:          clientDoc ? `Doc: ${clientDoc}` : null,
    })
  }

  return events
}

/** Filas para tabla (mismo orden que la timeline anterior). */
function buildFlowRows(entry) {
  return buildTimeline(entry).map((ev, i) => ({ ...ev, rowIndex: i + 1 }))
}

/** Effective exit date for the range display header */
function getExitInfo(entry) {
  if (entry.permanentExitDate) {
    return { date: entry.permanentExitDate, time: entry.permanentExitTime }
  }
  const active = entry.temporalExits?.find(t => !t.returnDate)
  if (active?.exitDate) {
    return { date: active.exitDate, time: active.exitTime }
  }
  return null
}

// ── Export ───────────────────────────────────────────────────────────────────
function lbl(list, value, fallback = value ?? '—') {
  return list.find(i => i.value === value)?.label ?? fallback
}

const HISTORY_COL_WIDTHS = [6, 18, 18, 14, 12, 22, 12, 14, 16, 6, 14, 24, 22, 18, 18, 18, 18, 20, 22, 22, 20, 18, 18, 14, 12]

function applySheetStyles(ws, colWidths) {
  colWidths.forEach((wch, i) => { ws.getColumn(i + 1).width = wch })
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY'
    })
  })
}

async function handleExport() {
  const rows = []
  for (const entry of historyItems.value) {
    const base = {
      'ID':                      entry.id ?? '',
      'Estado':                  lbl(ACCESS_STATUS, entry.status),
      'Motivo Ingreso':          lbl(MOTIVOS_INGRESO, entry.entryReason),
      'Fecha Ingreso':           calendarDateToExcelLocalDate(entry.entryDate),
      'Hora Ingreso':            formatWallClockTimeForExcel(entry.entryTime),
      'Registrado por':          [entry.registeredByFirstName, entry.registeredByLastName].filter(Boolean).join(' ') || '',
      'Placa':                   entry.licensePlate ?? '',
      'Marca':                   entry.brand        ?? '',
      'Modelo':                  entry.model        ?? '',
      'Año':                     entry.year         ?? '',
      'Kilometraje':             entry.mileage      ?? '',
      'Fecha Salida Permanente': calendarDateToExcelLocalDate(entry.permanentExitDate),
      'Hora Salida Permanente':  formatWallClockTimeForExcel(entry.permanentExitTime),
      'Tipo Doc. Cliente':       entry.permanentExitDate ? lbl(TIPOS_DOCUMENTO, entry.customerDocumentType) : '',
      'Nro. Doc. Cliente':       entry.permanentExitDate ? (entry.customerDni ?? '') : '',
      'Nombre Cliente':          entry.permanentExitDate ? (entry.customerFirstName ?? '') : '',
      'Apellido Cliente':        entry.permanentExitDate ? (entry.customerLastName ?? '') : '',
    }
    if (entry.temporalExits?.length > 0) {
      entry.temporalExits.forEach((te, i) => {
        rows.push({
          ...base,
          'Nro. Salida Temporal':   i + 1,
          'Estado Salida Temporal': lbl(ACCESS_STATUS, te.status),
          'Motivo Salida Temporal': lbl(MOTIVOS_SALIDA_TEMPORAL, te.exitReason),
          'Fecha Salida Temporal':  calendarDateToExcelLocalDate(te.exitDate),
          'Hora Salida Temporal':   formatWallClockTimeForExcel(te.exitTime),
          'Placa Reemplazo':        te.replacementLicensePlate ?? '',
          'Fecha Retorno':          calendarDateToExcelLocalDate(te.returnDate),
          'Hora Retorno':           formatWallClockTimeForExcel(te.returnTime),
        })
      })
    } else {
      rows.push({
        ...base,
        'Nro. Salida Temporal':   '',
        'Estado Salida Temporal': '',
        'Motivo Salida Temporal': '',
        'Fecha Salida Temporal':  '',
        'Hora Salida Temporal':   '',
        'Placa Reemplazo':        '',
        'Fecha Retorno':          '',
        'Hora Retorno':           '',
      })
    }
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Historial')
  if (rows.length) {
    const headers = Object.keys(rows[0])
    ws.addRow(headers)
    rows.forEach(r => ws.addRow(headers.map(h => r[h])))
  }
  applySheetStyles(ws, HISTORY_COL_WIDTHS)
  const plate = vehicle.value.licensePlate?.replace(/[^A-Z0-9]/gi, '') ?? 'vehiculo'
  const date = todayIsoLocal()
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `historial-${plate}-${date}.xlsx`)
}

function rowPhotoKey(entryId, row) {
  return `${entryId}:${row.operationType}:${row.temporalExitId ?? ''}`
}

function getAttachmentOperationType(file) {
  return file?.stay_operation_type ?? file?.stayOperationType ?? null
}

function getAttachmentTemporalExitId(file) {
  const id = file?.temporal_exit_id ?? file?.temporalExitId
  return id == null ? null : Number(id)
}

function filterImagesForRow(files, row) {
  if (!row?.operationType) return []
  return files.filter((file) => {
    if (!isImageAttachment(file)) return false
    if (getAttachmentOperationType(file) !== row.operationType) return false
    if (row.operationType === 'TEMPORAL_EXIT' || row.operationType === 'RETURN') {
      return getAttachmentTemporalExitId(file) === Number(row.temporalExitId)
    }
    return true
  })
}

async function fetchStayAttachmentsCached(stayId) {
  if (attachmentsCache.value.has(stayId)) {
    return attachmentsCache.value.get(stayId)
  }
  const files = await accessStore.fetchAttachments(stayId)
  const list = Array.isArray(files) ? files : []
  attachmentsCache.value.set(stayId, list)
  return list
}

async function openRowPhotos(entry, row) {
  if (!entry?.id || !row?.operationType || photoLoadingKey.value != null) return
  const key = rowPhotoKey(entry.id, row)
  photoLoadingKey.value = key
  try {
    const files = await fetchStayAttachmentsCached(entry.id)
    const images = filterImagesForRow(files, row)
    if (!images.length) {
      showInfo('No hay fotos registradas para este paso.', 'Sin evidencias')
      return
    }
    photoAttachments.value = images
    photoDialogTitle.value = `Fotos — ${row.label}`
    photoDialogVisible.value = true
  } catch {
    showError('No se pudieron cargar las fotos de este paso.')
  } finally {
    photoLoadingKey.value = null
  }
}

function isPhotoLoading(entryId, row) {
  return photoLoadingKey.value === rowPhotoKey(entryId, row)
}

// Pre-process to avoid recomputing in template
const processedHistory = computed(() =>
  historyItems.value.map(entry => ({
    entry,
    exitInfo:  getExitInfo(entry),
    flowRows:  buildFlowRows(entry),
    registeredBy: [entry.registeredByFirstName, entry.registeredByLastName].filter(Boolean).join(' ') || '—',
  }))
)
</script>

<template>
  <div class="p-3 h-full flex flex-column gap-3 overflow-y-auto">

    <!-- ── Vehicle header ──────────────────────────────────────────────────── -->
    <div class="vh-header-card">
      <div class="detail-header-icon">
        <i class="pi pi-car" />
      </div>
      <div class="flex flex-column gap-1 flex-1">
        <span class="vh-plate">{{ vehicle.licensePlate }}</span>
        <span class="vh-sub">
          {{ [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehículo' }}
        </span>
      </div>
      <pv-tag
        v-if="vehicle.currentStatus"
        :value="getStatusLabel(vehicle.currentStatus)"
        :severity="getStatusSeverity(vehicle.currentStatus)"
      />
      <pv-button
        v-if="processedHistory.length > 0"
        icon="pi pi-download"
        label="Exportar"
        severity="secondary"
        size="small"
        outlined
        @click="handleExport"
      />
    </div>

    <!-- ── Loading ──────────────────────────────────────────────────────────── -->
    <div v-if="isLoading" class="flex justify-content-center align-items-center flex-1">
      <i class="pi pi-spinner pi-spin" style="font-size: 2rem; color: var(--color-primary)" />
    </div>

    <!-- ── Error al cargar historial ────────────────────────────────────────── -->
    <div
      v-else-if="error"
      class="flex flex-column align-items-center justify-content-center flex-1 gap-2"
    >
      <i class="pi pi-exclamation-triangle" style="font-size: 2.5rem; color: var(--red-500, #dc2626)" />
      <span style="color: var(--text-body); font-size: 0.9rem; text-align: center; max-width: 22rem">
        {{ error }}
      </span>
    </div>

    <!-- ── Empty state ──────────────────────────────────────────────────────── -->
    <div
      v-else-if="!processedHistory.length"
      class="flex flex-column align-items-center justify-content-center flex-1 gap-2"
    >
      <i class="pi pi-inbox" style="font-size: 3rem; color: var(--text-body-secondary)" />
      <span style="color: var(--text-body-secondary); font-size: 0.9rem">Sin historial de acceso</span>
    </div>

    <!-- ── History cards ────────────────────────────────────────────────────── -->
    <div v-else class="vh-list">
      <p
        v-if="processedHistory.length > 1"
        class="vh-multi-hint"
      >
        Solo la visita más reciente muestra el flujo completo. Usa la flecha al final de cada fila
        <i class="pi pi-chevron-down vh-multi-hint-ic" /> para ver u ocultar el detalle de esa estadía.
      </p>
      <div
        v-for="{ entry, exitInfo, flowRows, registeredBy } in processedHistory"
        :key="entry.id"
        class="vh-entry-card"
      >

        <!-- ── Range header: motivo ingreso + Ingreso → Salida + chips ───────── -->
        <div class="vh-range-header">
          <div class="vh-range-header-main">
            <!-- Status badge -->
            <pv-tag
              :value="getStatusLabel(entry.status)"
              :severity="getStatusSeverity(entry.status)"
              class="flex-shrink-0"
            />

            <!-- Motivo de ingreso (dato de negocio entryReason; ej. 0KM, Mecánica) -->
            <div class="vh-range-motivo">
              <span class="vh-range-motivo-k">Motivo de ingreso</span>
              <span class="vh-range-motivo-v">{{ getEntryReasonLabel(entry.entryReason) }}</span>
            </div>

            <!-- Ingreso date -->
            <div class="vh-range-date">
              <span class="vh-range-lbl">Ingreso</span>
              <span class="vh-range-val vh-range-val--entry">{{ fmtDate(entry.entryDate) ?? '—' }}</span>
              <span class="vh-range-time">{{ fmtTime(entry.entryTime) ?? '' }}</span>
            </div>

            <!-- Arrow connector -->
            <div class="vh-range-connector">
              <div class="vh-range-line" />
              <i class="pi pi-arrow-right vh-range-arrow-icon" />
            </div>

            <!-- Salida date -->
            <div class="vh-range-date">
              <span class="vh-range-lbl">Salida</span>
              <template v-if="exitInfo">
                <span class="vh-range-val vh-range-val--exit">{{ fmtDate(exitInfo.date) ?? '—' }}</span>
                <span class="vh-range-time">{{ fmtTime(exitInfo.time) ?? '' }}</span>
              </template>
              <span v-else class="vh-range-en-curso">En curso</span>
            </div>

            <!-- Chips + flecha al final de la fila -->
            <div class="vh-range-trail">
              <div class="vh-meta-chips">
                <span
                  v-if="entry.mileage != null"
                  v-tooltip.top="MILEAGE_INGRESO_TOOLTIP"
                  class="vh-chip"
                >
                  <i class="pi pi-gauge" /><span class="vh-chip-k">Km ingreso</span>{{ entry.mileage.toLocaleString('es-PE') }} km
                </span>
                <span class="vh-chip">
                  <i class="pi pi-user" /><span class="vh-chip-k">Registró</span>{{ registeredBy }}
                </span>
              </div>
              <pv-button
                v-if="processedHistory.length > 1"
                :icon="isStayExpanded(entry.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                :aria-label="isStayExpanded(entry.id) ? 'Ocultar flujo de la estadía' : 'Ver flujo de la estadía'"
                v-tooltip.top="isStayExpanded(entry.id) ? 'Ocultar tabla de pasos' : 'Ver tabla de pasos'"
                text
                rounded
                size="small"
                class="vh-expand-trail-btn flex-shrink-0"
                @click="toggleStayExpanded(entry.id)"
              />
            </div>
          </div>
        </div>

        <!-- ── Flujo ingreso → salida (tabla) ─────────────────────────────────── -->
        <div v-show="isStayExpanded(entry.id)" class="vh-flow-table-wrap">
          <pv-data-table
            :value="flowRows"
            data-key="rowIndex"
            size="small"
            striped-rows
            class="vh-flow-table"
            :pt="{ table: { class: 'vh-flow-table-inner' } }"
          >
            <pv-column
              field="rowIndex"
              header="#"
              style="width: 2.75rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            />
            <pv-column
              header="Paso"
              style="min-width: 11rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <div
                  class="vh-step-cell"
                  :class="{ 'vh-step-cell--pending': data.type === 'retorno-pendiente' }"
                >
                  <span class="vh-step-badge" :style="{ background: EVENT_BG[data.type] }">
                    <i :class="`pi ${EVENT_ICON[data.type]}`" />
                  </span>
                  <span class="vh-step-label">{{ data.label }}</span>
                </div>
              </template>
            </pv-column>
            <pv-column
              header="Fecha"
              style="min-width: 6.5rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <span class="vh-cell-muted">{{ data.date ? fmtDate(data.date) : '—' }}</span>
              </template>
            </pv-column>
            <pv-column
              header="Hora"
              style="min-width: 5.5rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <span class="vh-cell-muted">{{ data.time ? fmtTime(data.time) : '—' }}</span>
              </template>
            </pv-column>
            <pv-column
              header="Detalle"
              style="min-width: 10rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <span class="vh-cell-detail">{{ data.detail || '—' }}</span>
              </template>
            </pv-column>
            <pv-column
              header="Notas"
              style="min-width: 8rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <span class="vh-cell-notes">{{ data.extra || '—' }}</span>
              </template>
            </pv-column>
            <pv-column
              header="Fotos"
              style="width: 7.5rem"
              :header-style="{ textAlign: 'center' }"
              :body-style="{ textAlign: 'center', verticalAlign: 'middle' }"
            >
              <template #body="{ data }">
                <pv-button
                  v-if="data.operationType"
                  icon="pi pi-images"
                  label="Ver fotos"
                  severity="secondary"
                  outlined
                  size="small"
                  class="vh-photos-btn"
                  :loading="isPhotoLoading(entry.id, data)"
                  :disabled="photoLoadingKey != null && !isPhotoLoading(entry.id, data)"
                  @click="openRowPhotos(entry, data)"
                />
                <span v-else class="vh-cell-muted">—</span>
              </template>
            </pv-column>
          </pv-data-table>
        </div>

      </div>
    </div>

    <AttachmentCarouselDialog
      v-model:visible="photoDialogVisible"
      :attachments="photoAttachments"
      :title="photoDialogTitle"
    />

  </div>
</template>

<style scoped>
/* ── Vehicle header card ─────────────────────────────────────────────────── */
.vh-header-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--surface-white);
  border: 1px solid var(--border-ui);
  border-radius: 10px;
  flex-shrink: 0;
}

.vh-plate {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  color: var(--text-body);
}

.vh-sub {
  font-size: 0.8rem;
  color: var(--text-body-secondary);
}

/* ── History list ────────────────────────────────────────────────────────── */
.vh-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.vh-multi-hint {
  margin: 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text-body-secondary);
  background: var(--surface-50, #f4f4f5);
  border: 1px solid var(--border-ui);
  border-radius: 8px;
}

.vh-multi-hint-ic {
  font-size: 0.7rem;
  margin: 0 0.15rem;
  vertical-align: -0.05em;
}

/* ── Entry card ──────────────────────────────────────────────────────────── */
.vh-entry-card {
  background: var(--surface-white);
  border: 1px solid var(--border-ui);
  border-radius: 10px;
  overflow: hidden;
}

/* ── Range header ────────────────────────────────────────────────────────── */
.vh-range-header {
  padding: 0.75rem 1rem;
  background: var(--surface-0, #f8f9fa);
  border-bottom: 1px solid var(--border-ui);
}

.vh-range-header-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem 0.85rem;
  width: 100%;
}

.vh-range-motivo {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 7.5rem;
  max-width: 14rem;
}

.vh-range-motivo-k {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-body-secondary);
}

.vh-range-motivo-v {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-body);
  line-height: 1.25;
  word-break: break-word;
}

.vh-range-date {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 80px;
}

.vh-range-lbl {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-body-secondary);
}

.vh-range-val {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-body);
}

.vh-range-val--entry { color: #15803d; }
.vh-range-val--exit  { color: #b91c1c; }

.vh-range-time {
  font-size: 0.72rem;
  color: var(--text-body-secondary);
}

.vh-range-en-curso {
  font-size: 0.82rem;
  font-weight: 600;
  font-style: italic;
  color: #15803d;
  margin-top: 0.15rem;
}

/* Connector between dates */
.vh-range-connector {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 1rem; /* align with values */
  color: var(--text-body-secondary);
}

.vh-range-line {
  width: 1.5rem;
  height: 1px;
  background: var(--border-ui);
}

.vh-range-arrow-icon {
  font-size: 0.65rem;
}

/* Bloque final: chips + flecha mostrar/ocultar */
.vh-range-trail {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-left: auto;
  flex-shrink: 0;
}

.vh-expand-trail-btn {
  margin-left: 0.15rem;
}

.vh-meta-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.vh-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--text-body-secondary);
  background: var(--surface-100, #e9ecef);
  border-radius: 5px;
  padding: 0.18rem 0.45rem;
  cursor: default;
}

.vh-chip-k {
  font-weight: 700;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-body-secondary);
  margin-right: 0.15rem;
}

.vh-chip .pi {
  font-size: 0.62rem;
}

/* ── Tabla de flujo por estadía ─────────────────────────────────────────── */
.vh-flow-table-wrap {
  padding: 0.35rem 0.5rem 0.6rem;
  overflow-x: auto;
}

.vh-flow-table :deep(.p-datatable-wrapper) {
  border-radius: 0 0 8px 8px;
}

.vh-flow-table :deep(.p-datatable-thead > tr > th) {
  text-align: center;
  vertical-align: middle;
}

.vh-flow-table :deep(.p-datatable-tbody > tr > td) {
  vertical-align: middle;
}

.vh-flow-table-inner {
  font-size: 0.8rem;
}

.vh-step-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  text-align: center;
}

.vh-step-cell--pending {
  opacity: 0.72;
}

.vh-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  font-size: 0.62rem;
}

.vh-step-label {
  font-weight: 600;
  color: var(--text-body);
  line-height: 1.25;
}

.vh-cell-muted {
  display: inline-block;
  width: 100%;
  color: var(--text-body-secondary);
  font-size: 0.78rem;
  text-align: center;
}

.vh-cell-detail {
  display: inline-block;
  width: 100%;
  font-size: 0.78rem;
  color: var(--text-body);
  text-align: center;
  word-break: break-word;
}

.vh-cell-notes {
  display: inline-block;
  width: 100%;
  font-size: 0.74rem;
  color: var(--text-body-secondary);
  font-style: italic;
  text-align: center;
  word-break: break-word;
}

.vh-photos-btn {
  white-space: nowrap;
}
</style>
