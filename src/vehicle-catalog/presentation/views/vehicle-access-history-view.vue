<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute }                 from 'vue-router'
import { useVehicleCatalogStore }   from '../../application/vehicle-catalog.store.js'
import { useStaysStore }            from '@/stays/application/stays.store.js'
import { useAsyncAction }           from '@/shared/composables/use-async-action.js'
import { ACCESS_STATUS, ACCESS_STATUS_SEVERITY } from '@/shared/presentation/constants/access-status.constants.js'
import { MOTIVOS_INGRESO, MOTIVOS_SALIDA_TEMPORAL, TIPOS_DOCUMENTO } from '@/stays/presentation/constants/stays-ui.constants.js'
import * as XLSX from 'xlsx'

const route        = useRoute()
const vehicleStore = useVehicleCatalogStore()
const accessStore  = useStaysStore()
const { isLoading, run } = useAsyncAction()

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

onMounted(async () => {
  await run(async () => {
    const items = await accessStore.fetchByVehicleId(vehicleId)
    historyItems.value = [...items].sort((a, b) => {
      const da = (a.entryDate ?? '') + (a.entryTime ?? '')
      const db = (b.entryDate ?? '') + (b.entryTime ?? '')
      return db.localeCompare(da)
    })
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

// ── Date/time formatters ──────────────────────────────────────────────────────
function fmtDate(value) {
  if (!value) return null
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function fmtTime(value) {
  if (!value) return null
  const [hStr, mStr] = value.split(':')
  const h = Number(hStr), min = Number(mStr)
  if (isNaN(h) || isNaN(min)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`
}

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
    type:   'ingreso',
    date:   entry.entryDate,
    time:   entry.entryTime,
    label:  'Ingreso a planta',
    detail: getEntryReasonLabel(entry.entryReason),
    extra:  entry.mileage != null ? entry.mileage.toLocaleString('es-PE') + ' km' : null,
  })

  // 2. Temporal exits in chronological order
  const sortedExits = [...(entry.temporalExits ?? [])].sort((a, b) =>
    ((a.exitDate ?? '') + (a.exitTime ?? '')).localeCompare((b.exitDate ?? '') + (b.exitTime ?? ''))
  )

  for (const te of sortedExits) {
    events.push({
      type:   'salida-temporal',
      date:   te.exitDate,
      time:   te.exitTime,
      label:  'Salida temporal',
      detail: getExitReasonLabel(te.exitReason),
      extra:  te.replacementLicensePlate ? `Placa reemplazo: ${te.replacementLicensePlate}` : null,
    })
    if (te.returnDate) {
      events.push({
        type:   'retorno',
        date:   te.returnDate,
        time:   te.returnTime,
        label:  'Retorno a planta',
        detail: null,
        extra:  null,
      })
    } else {
      events.push({
        type:   'retorno-pendiente',
        date:   null,
        time:   null,
        label:  'Retorno pendiente',
        detail: 'Vehículo aún fuera de planta',
        extra:  null,
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
      type:   'salida-permanente',
      date:   entry.permanentExitDate,
      time:   entry.permanentExitTime,
      label:  'Salida permanente',
      detail: clientName,
      extra:  clientDoc ? `Doc: ${clientDoc}` : null,
    })
  }

  return events
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

function fmtDateExport(value) {
  if (!value) return ''
  const str = String(value)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : new Date(str)
  return isNaN(d) ? str : d
}

const HISTORY_COL_WIDTHS = [6, 18, 18, 14, 12, 22, 12, 14, 16, 6, 14, 12, 24, 22, 18, 18, 18, 18, 20, 22, 22, 20, 18, 18, 14, 12]

function applySheetStyles(ws, colWidths) {
  ws['!cols'] = colWidths.map(wch => ({ wch }))
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && cell.t === 'd') cell.z = 'DD/MM/YYYY'
    }
  }
}

function fmtTimeExport(value) {
  if (!value) return ''
  const parts = value.split(':')
  const h = Number(parts[0])
  const min = Number(parts[1])
  const sec = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(min)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const base = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  return sec !== null && !isNaN(sec)
    ? `${base}:${String(sec).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

function handleExport() {
  const rows = []
  for (const entry of historyItems.value) {
    const base = {
      'ID':                      entry.id ?? '',
      'Estado':                  lbl(ACCESS_STATUS, entry.status),
      'Motivo Ingreso':          lbl(MOTIVOS_INGRESO, entry.entryReason),
      'Fecha Ingreso':           fmtDateExport(entry.entryDate),
      'Hora Ingreso':            fmtTimeExport(entry.entryTime),
      'Registrado por':          [entry.registeredByFirstName, entry.registeredByLastName].filter(Boolean).join(' ') || '',
      'Placa':                   entry.licensePlate ?? '',
      'Marca':                   entry.brand        ?? '',
      'Modelo':                  entry.model        ?? '',
      'Año':                     entry.year         ?? '',
      'Kilometraje':             entry.mileage      ?? '',
      'Color':                   entry.color        ?? '',
      'Fecha Salida Permanente': fmtDateExport(entry.permanentExitDate),
      'Hora Salida Permanente':  fmtTimeExport(entry.permanentExitTime),
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
          'Fecha Salida Temporal':  fmtDateExport(te.exitDate),
          'Hora Salida Temporal':   fmtTimeExport(te.exitTime),
          'Placa Reemplazo':        te.replacementLicensePlate ?? '',
          'Fecha Retorno':          fmtDateExport(te.returnDate),
          'Hora Retorno':           fmtTimeExport(te.returnTime),
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

  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true })
  applySheetStyles(ws, HISTORY_COL_WIDTHS)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historial')
  const plate = vehicle.value.licensePlate?.replace(/[^A-Z0-9]/gi, '') ?? 'vehiculo'
  const date  = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `historial-${plate}-${date}.xlsx`)
}

// Pre-process to avoid recomputing in template
const processedHistory = computed(() =>
  historyItems.value.map(entry => ({
    entry,
    exitInfo:  getExitInfo(entry),
    timeline:  buildTimeline(entry),
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
      <div
        v-for="{ entry, exitInfo, timeline, registeredBy } in processedHistory"
        :key="entry.id"
        class="vh-entry-card"
      >

        <!-- ── Range header: Ingreso → Salida ──────────────────────────────── -->
        <div class="vh-range-header">
          <!-- Status badge -->
          <pv-tag
            :value="getStatusLabel(entry.status)"
            :severity="getStatusSeverity(entry.status)"
            class="flex-shrink-0"
          />

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

          <!-- Meta chips -->
          <div class="vh-meta-chips">
            <span class="vh-chip">
              <i class="pi pi-wrench" />{{ getEntryReasonLabel(entry.entryReason) }}
            </span>
            <span v-if="entry.mileage != null" class="vh-chip">
              <i class="pi pi-gauge" />{{ entry.mileage.toLocaleString('es-PE') }} km
            </span>
            <span class="vh-chip">
              <i class="pi pi-user" />{{ registeredBy }}
            </span>
          </div>
        </div>

        <!-- ── Timeline of movements ─────────────────────────────────────────── -->
        <div class="vh-timeline">
          <div
            v-for="(ev, idx) in timeline"
            :key="idx"
            class="vh-tl-row"
          >
            <!-- Track: dot + connecting line -->
            <div class="vh-tl-track">
              <div class="vh-tl-dot" :style="{ background: EVENT_BG[ev.type] }">
                <i :class="`pi ${EVENT_ICON[ev.type]}`" />
              </div>
              <div v-if="idx < timeline.length - 1" class="vh-tl-line" />
            </div>

            <!-- Content -->
            <div class="vh-tl-content" :class="{ 'vh-tl-content--pending': ev.type === 'retorno-pendiente' }">
              <div class="vh-tl-top">
                <span class="vh-tl-label">{{ ev.label }}</span>
                <span v-if="ev.date" class="vh-tl-datetime">
                  {{ fmtDate(ev.date) }}
                  <span class="vh-tl-time">{{ fmtTime(ev.time) }}</span>
                </span>
              </div>
              <div v-if="ev.detail || ev.extra" class="vh-tl-sub">
                <span v-if="ev.detail" class="vh-tl-detail">{{ ev.detail }}</span>
                <span v-if="ev.extra" class="vh-tl-extra">· {{ ev.extra }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

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

/* ── Entry card ──────────────────────────────────────────────────────────── */
.vh-entry-card {
  background: var(--surface-white);
  border: 1px solid var(--border-ui);
  border-radius: 10px;
  overflow: hidden;
}

/* ── Range header ────────────────────────────────────────────────────────── */
.vh-range-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface-0, #f8f9fa);
  border-bottom: 1px solid var(--border-ui);
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

/* Meta chips pushed to the right */
.vh-meta-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-left: auto;
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
}

.vh-chip .pi {
  font-size: 0.62rem;
}

/* ── Timeline ────────────────────────────────────────────────────────────── */
.vh-timeline {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 1rem 0.4rem;
}

.vh-tl-row {
  display: flex;
  gap: 0.75rem;
}

/* Track column */
.vh-tl-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 26px;
}

.vh-tl-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 0.6rem;
}

.vh-tl-line {
  width: 2px;
  flex: 1;
  min-height: 10px;
  background: var(--border-ui);
  margin: 3px 0;
}

/* Content column */
.vh-tl-content {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.2rem 0 0.6rem;
  flex: 1;
}

.vh-tl-content--pending {
  opacity: 0.6;
}

.vh-tl-top {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.vh-tl-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-body);
}

.vh-tl-datetime {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-body);
}

.vh-tl-time {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-body-secondary);
  margin-left: 0.1rem;
}

.vh-tl-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.vh-tl-detail {
  font-size: 0.74rem;
  color: var(--text-body-secondary);
}

.vh-tl-extra {
  font-size: 0.72rem;
  color: var(--text-body-secondary);
  font-style: italic;
}
</style>
