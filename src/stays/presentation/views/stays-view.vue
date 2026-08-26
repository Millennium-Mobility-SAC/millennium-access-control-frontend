<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed, defineAsyncComponent } from 'vue'
import { useStaysStore }                        from '../../application/stays.store.js'
import { useIamStore }                          from '@/iam/application/iam.store.js'
import { useAsyncAction }                       from '@/shared/composables/use-async-action.js'
import { useNotification }                      from '@/shared/composables/use-notification.js'
import { usePermissions }                       from '@/shared/composables/use-permissions.js'
import { normalizeApiError }                    from '@/shared/infrustructure/error-normalizer.js'
import { StorageFilesApi }                      from '../../infrastructure/api/storage-files.api.js'
import DataManager                              from '@/shared/presentation/components/data-manager.vue'
import AccessCreateAndEdit                      from '../components/access-create-and-edit.vue'
import AccessRegisterExit                       from '../components/access-register-exit.vue'
import AccessRegisterReturn                     from '../components/access-register-return.vue'
import AccessDetailDrawer                        from '../components/access-detail-drawer.vue'
import { MOTIVOS_INGRESO, MOTIVO_SEVERITY, TIPOS_INGRESO, TIPOS_DOCUMENTO, ACCESS_STATUS, ACCESS_STATUS_SEVERITY, MOTIVOS_SALIDA_TEMPORAL, VEHICLE_ORIGIN_FILTER } from '../constants/stays-ui.constants.js'
import { getAccessStatusFilterOptions } from '@/shared/presentation/constants/access-status.constants.js'
import { todayIsoLocal, toIsoDateString } from '@/shared/domain/employee-attendance-day.js'
import {
  formatCalendarDateForUi,
  formatTimeHmAmPmForUi,
  calendarDateToExcelLocalDate,
  formatWallClockTimeForExcel,
} from '@/shared/domain/format-datetime-ui.js'

const AccessImportDialog = defineAsyncComponent(() =>
  import('../components/access-import-dialog.vue')
)

const store              = useStaysStore()
const iamStore           = useIamStore()
const permissions        = usePermissions()
const { isLoading, error, run } = useAsyncAction()
const { showSuccess, showError } = useNotification()
const storageFilesApi = new StorageFilesApi()

const dialogVisible = ref(false)
const isEditing     = ref(false)
const editEntity    = ref(null)
const editAttachments = ref([])
const editDeletingAttachmentId = ref(null)

const drawerVisible = ref(false)
const drawerItem    = ref(null)
const drawerAttachments = ref([])
const deletingAttachmentId = ref(null)
const drawerWhatsappAttempts = ref([])
const drawerWhatsappLoading = ref(false)
const drawerWhatsappResending = ref(false)
let whatsappPollTimer = null
let whatsappPollDeadline = 0
const WHATSAPP_POLL_INTERVAL_MS = 4000
const WHATSAPP_POLL_WINDOW_MS = 60_000

function stopWhatsappPolling() {
  if (whatsappPollTimer) {
    clearTimeout(whatsappPollTimer)
    whatsappPollTimer = null
  }
  whatsappPollDeadline = 0
}

async function refreshWhatsappStatus(stayId, { silent = false } = {}) {
  if (stayId == null) return
  if (!silent) drawerWhatsappLoading.value = true
  try {
    drawerWhatsappAttempts.value = await store.fetchNotificationStatus(stayId)
  } catch (_e) {
    if (!silent) drawerWhatsappAttempts.value = []
  } finally {
    if (!silent) drawerWhatsappLoading.value = false
  }
}

function isWhatsappFinalState(attempt) {
  return attempt && (attempt.status === 'SENT' || attempt.status === 'SKIPPED')
}

function scheduleWhatsappPoll(stayId) {
  stopWhatsappPolling()
  whatsappPollDeadline = Date.now() + WHATSAPP_POLL_WINDOW_MS
  const tick = async () => {
    if (!drawerVisible.value || drawerItem.value?.id !== stayId) {
      stopWhatsappPolling()
      return
    }
    await refreshWhatsappStatus(stayId, { silent: true })
    const latest = drawerWhatsappAttempts.value?.[0] ?? null
    if (isWhatsappFinalState(latest) || Date.now() >= whatsappPollDeadline) {
      stopWhatsappPolling()
      return
    }
    whatsappPollTimer = setTimeout(tick, WHATSAPP_POLL_INTERVAL_MS)
  }
  whatsappPollTimer = setTimeout(tick, WHATSAPP_POLL_INTERVAL_MS)
}

const exitDialogVisible   = ref(false)
const exitEntity          = ref(null)

const returnDialogVisible = ref(false)
const returnEntity        = ref(null)

// Filtros (multi-selección — arrays vacíos = sin filtro)
const filterStatus = ref([])
const filterType   = ref([])
const filterMotivo = ref([])
const filterOrigin = ref([])
const searchText   = ref('')

const statusFilterOptions = computed(() =>
  getAccessStatusFilterOptions(iamStore.currentUserRoles),
)

// ── Server-side filtering ──────────────────────────────────────────
let _searchDebounceTimer = null

function applyAllFilters() {
  store.applyFilters({
    statuses:     filterStatus.value,
    types:        filterType.value,
    entryReasons: filterMotivo.value,
    search:       searchText.value,
    external:     filterOrigin.value,
  })
}

watch(searchText, () => {
  clearTimeout(_searchDebounceTimer)
  _searchDebounceTimer = setTimeout(applyAllFilters, 400)
})

watch([filterStatus, filterType, filterMotivo, filterOrigin], applyAllFilters, { deep: true })

watch(statusFilterOptions, (options) => {
  const allowed = new Set(options.map(option => option.value))
  filterStatus.value = filterStatus.value.filter(status => allowed.has(status))
}, { immediate: true })

function clearAllFilters() {
  filterStatus.value = []
  filterType.value   = []
  filterMotivo.value = []
  filterOrigin.value = []
  searchText.value   = ''
  store.applyFilters({ statuses: [], types: [], entryReasons: [], search: '', external: [] })
}

async function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
  drawerWhatsappAttempts.value = []
  drawerWhatsappLoading.value = true
  stopWhatsappPolling()
  try {
    await store.fetchById(item.id)
    drawerAttachments.value = await store.fetchAttachments(item.id)
  } catch (e) {
    drawerAttachments.value = []
    if (drawerVisible.value) {
      showError(normalizeApiError(e, 'No se pudieron cargar las evidencias del registro.'))
    }
  }
  if (store.selected) drawerItem.value = store.selected
  await refreshWhatsappStatus(item.id)
  const latest = drawerWhatsappAttempts.value?.[0] ?? null
  if (latest && !isWhatsappFinalState(latest)) {
    scheduleWhatsappPoll(item.id)
  }
}

async function handleRefreshWhatsapp(stayId) {
  stopWhatsappPolling()
  await refreshWhatsappStatus(stayId)
  const latest = drawerWhatsappAttempts.value?.[0] ?? null
  if (latest && !isWhatsappFinalState(latest)) {
    scheduleWhatsappPoll(stayId)
  }
}

async function handleResendWhatsapp({ stayId, operationType, temporalExitId } = {}) {
  if (drawerWhatsappResending.value) return
  drawerWhatsappResending.value = true
  try {
    await store.resendWhatsApp(stayId, operationType ?? null, temporalExitId ?? null)
    await refreshWhatsappStatus(stayId, { silent: true })
    showSuccess('WhatsApp', 'Reenvío programado.')
    scheduleWhatsappPoll(stayId)
  } catch (e) {
    showError('WhatsApp', e?.response?.data?.message ?? 'No se pudo programar el reenvío.')
  } finally {
    drawerWhatsappResending.value = false
  }
}

watch(drawerVisible, (visible) => {
  if (!visible) stopWhatsappPolling()
})

onBeforeUnmount(() => {
  stopWhatsappPolling()
})

const columns = [
  {
    field: 'status',
    header: 'Estado',
    sortable: true,
    style: 'width: 8rem; min-width: 8rem; max-width: 8rem',
    headerStyle: 'text-align: center',
    bodyStyle: 'text-align: center',
    template: 'status-template',
  },
  {
    field: 'type',
    header: 'Tipo',
    sortable: true,
    style: 'width: 8.5rem; min-width: 8.5rem; max-width: 8.5rem',
    headerStyle: 'text-align: center',
    bodyStyle: 'text-align: center',
    template: 'tipo-template',
  },
  {
    field: 'licensePlate',
    header: 'Placa / Nombre',
    sortable: true,
    style: 'width: 9.5rem; min-width: 9.5rem; max-width: 10.5rem',
    headerStyle: 'text-align: left',
    bodyStyle: 'text-align: left',
    template: 'identidad-template',
  },
  {
    field: 'entryReason',
    header: 'Motivo',
    sortable: true,
    style: 'width: 6.5rem; min-width: 6.5rem; max-width: 6.5rem',
    headerStyle: 'text-align: left',
    bodyStyle: 'text-align: left',
    headerClass: 'stays-col-motivo',
    bodyClass: 'stays-col-motivo',
    template: 'motivo-template',
  },
  {
    field: 'entryDate',
    header: 'Ingreso',
    sortable: true,
    style: 'width: 6.25rem; min-width: 6.25rem; max-width: 6.25rem',
    headerStyle: 'text-align: center',
    bodyStyle: 'text-align: center',
    headerClass: 'stays-col-ingreso',
    bodyClass: 'stays-col-ingreso',
    template: 'ingreso-template',
  },
  {
    field: 'exitDate',
    header: 'Salida',
    sortable: true,
    style: 'width: 8.25rem; min-width: 8.25rem; max-width: 8.25rem',
    headerStyle: 'text-align: center',
    bodyStyle: 'text-align: center',
    template: 'salida-template',
  },
]

const formatDate = (value) => formatCalendarDateForUi(value, '-')
const formatTime = (value) => formatTimeHmAmPmForUi(value, { seconds: 'never' })

function getEntryReasonLabel(value) {
  return MOTIVOS_INGRESO.find(m => m.value === value)?.label ?? value ?? '-'
}

function getEntryReasonSeverity(value) {
  return MOTIVO_SEVERITY[value] ?? 'secondary'
}

function getExitReasonLabel(value) {
  return MOTIVOS_SALIDA_TEMPORAL.find(m => m.value === value)?.label ?? value ?? '—'
}

function getStatusLabel(value) {
  return ACCESS_STATUS.find(s => s.value === value)?.label ?? value ?? '-'
}

function getStatusSeverity(value) {
  return ACCESS_STATUS_SEVERITY[value] ?? 'secondary'
}

function getDocumentTypeLabel(value) {
  return TIPOS_DOCUMENTO.find(t => t.value === value)?.label ?? value ?? 'DNI'
}

function getTypeLabel(data) {
  if (data.type === 'PERSONA') return 'Persona'
  if (data.external) return 'Vehículo Exte.'
  return 'Vehículo'
}

function getTypeSeverity(data) {
  if (data.type === 'PERSONA') return 'info'
  if (data.external) return 'danger'
  return 'secondary'
}

function getTypeIcon(data) {
  return data.type === 'PERSONA' ? 'pi pi-user' : 'pi pi-car'
}

function openNewDialog() {
  isEditing.value  = false
  editEntity.value = null
  editAttachments.value = []
  dialogVisible.value = true
}

async function openEditDialog(item) {
  isEditing.value = true
  await run(async () => {
    await store.fetchById(item.id)
    editAttachments.value = await store.fetchAttachments(item.id)
  })
  editEntity.value    = store.selected ?? item
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
  editAttachments.value = []
  editDeletingAttachmentId.value = null
}

async function handleSave(entity) {
  if (isLoading.value) return
  await run(async () => {
    const subjectIdentifier = entity.licensePlate || entity.vin || entity.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(entity.attachments, {
      plate: subjectIdentifier,
      vin: entity.vin ?? null,
      accessType: entity.type,
      stayType: 'INGRESO',
      operationDate: toIsoDateString(entity.entryDate),
      operationTime: entity.entryTime ?? null,
    })
    const payload = { ...entity, attachmentIds }
    if (isEditing.value) {
      await store.update(entity.id, payload)
      await store.fetchById(entity.id)
      if (drawerVisible.value && drawerItem.value?.id === entity.id) {
        drawerItem.value = store.selected ?? drawerItem.value
        drawerAttachments.value = await store.fetchAttachments(entity.id)
      }
      showSuccess('Registro actualizado correctamente.')
    } else {
      await store.create(payload)
      showSuccess('Registro creado correctamente.')
    }
    dialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

const canManageAttachments = permissions.canUploadAttachments

async function handleRemoveAttachment(attachment) {
  if (!drawerItem.value?.id || !attachment?.id) return
  deletingAttachmentId.value = attachment.id
  await run(async () => {
    await store.deleteAttachment(drawerItem.value.id, attachment.id)
    drawerAttachments.value = drawerAttachments.value.filter(file => file.id !== attachment.id)
    showSuccess('Evidencia eliminada correctamente.')
  }, { rethrow: false })
  deletingAttachmentId.value = null
  if (error.value) showError(error.value)
}

async function handleRemoveEditAttachment(attachment) {
  if (!editEntity.value?.id || !attachment?.id) return
  editDeletingAttachmentId.value = attachment.id
  await run(async () => {
    await store.deleteAttachment(editEntity.value.id, attachment.id)
    editAttachments.value = editAttachments.value.filter(file => file.id !== attachment.id)
    showSuccess('Evidencia eliminada correctamente.')
  }, { rethrow: false })
  editDeletingAttachmentId.value = null
  if (error.value) showError(error.value)
}

function handleDelete(item) {
  run(async () => {
    await store.remove(item.id)
    showSuccess('Registro eliminado correctamente.')
  }).then(() => { if (error.value) showError(error.value) })
}

function openExitDialog(item) {
  exitEntity.value        = item
  exitDialogVisible.value = true
}

function openReturnDialog(item) {
  returnEntity.value        = item
  returnDialogVisible.value = true
}

async function handleExit(exitData) {
  if (isLoading.value) return
  await run(async () => {
    const subjectIdentifier = exitData.licensePlate || exitData.vin || exitData.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(exitData.attachments, {
      plate: subjectIdentifier,
      vin: exitData.vin ?? null,
      accessType: exitData.type,
      stayType: exitData.exitType === 'TEMPORAL' ? 'SALIDA_TEMPORAL' : 'SALIDA_PERMANENTE',
      operationDate: toIsoDateString(exitData.exitDate),
      operationTime: exitData.exitTime ?? null,
    })
    await store.registerExit(exitData.id, { ...exitData, attachmentIds })
    showSuccess('Salida registrada correctamente.')
    exitDialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

async function handleReturn(returnData) {
  if (isLoading.value) return
  await run(async () => {
    const subjectIdentifier = returnData.licensePlate || returnData.vin || returnData.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(returnData.attachments, {
      plate: subjectIdentifier,
      vin: returnData.vin ?? null,
      accessType: returnData.type,
      stayType: 'RETORNO',
      operationDate: toIsoDateString(returnData.returnDate),
      operationTime: returnData.returnTime ?? null,
    })
    await store.registerReturn(returnData.id, { ...returnData, attachmentIds })
    showSuccess('Retorno registrado correctamente.')
    returnDialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

async function handleDeleteSelected(items) {
  await run(async () => {
    const result = await store.bulkRemove(items)
    if (result.failed === 0) {
      showSuccess(`${result.success} registro(s) eliminado(s) correctamente.`)
    } else {
      const msg = result.success > 0
        ? `${result.success} eliminado(s), ${result.failed} no se pudo(ieron) eliminar.`
        : `No se pudo eliminar ningún registro (${result.failed} error(es)).`
      showError(msg)
    }
  })
  if (error.value) showError(error.value)
}

async function handleDeleteAll() {
  await run(async () => {
    const count = await store.deleteAll()
    showSuccess(`${count} registro(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

// Importación
const importDialogVisible = ref(false)

async function handleImport(rows, importColumns) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} ingreso(s) importado(s) correctamente.`)
    } else {
      const msg = result.success > 0
        ? `${result.success} importado(s), ${result.failed} no se procesó(aron).`
        : `No se pudo importar ningún registro (${result.failed} error(es)).`
      showError(`${msg} Descargando reporte de errores...`)
      if (importColumns?.length) {
        const { downloadImportErrorReport } = await import('@/shared/composables/use-import-error-report.js')
        await downloadImportErrorReport(result.failedRows, importColumns, 'errores-importacion-acceso')
      }
    }
  } else if (error.value) {
    showError(error.value)
  }
}

onMounted(async () => {
  await run(() => store.fetchAll())
})

async function uploadAttachments(files, naming = {}) {
  if (!Array.isArray(files) || files.length === 0) return []
  const response = await storageFilesApi.upload(files, naming)
  if (!Array.isArray(response?.data)) {
    throw new Error('No se pudieron registrar las evidencias. Inténtalo nuevamente.')
  }
  const ids = response.data.map(file => file.id).filter(Boolean)
  if (ids.length === 0) {
    throw new Error('No se pudieron registrar las evidencias. Inténtalo nuevamente.')
  }
  return ids
}

// Exportación a Excel
function label(list, value, fallback = value ?? '—') {
  return list.find(i => i.value === value)?.label ?? fallback
}

function applySheetStyles(ws, colWidths) {
  colWidths.forEach((wch, i) => { ws.getColumn(i + 1).width = wch })
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value instanceof Date) cell.numFmt = 'DD/MM/YYYY'
    })
  })
}

// Columnas compartidas (ingreso, registrado por, salida permanente, salida temporal)
function sharedExitCols(exit, exitIndex) {
  return {
    'Nro. Salida Temporal':   exitIndex !== null ? exitIndex + 1 : '',
    'Estado Salida Temporal': exit ? label(ACCESS_STATUS, exit.status) : '',
    'Motivo Salida Temporal': exit ? label(MOTIVOS_SALIDA_TEMPORAL, exit.exitReason) : '',
    'Fecha Salida Temporal':  exit ? calendarDateToExcelLocalDate(exit.exitDate) : '',
    'Hora Salida Temporal':   exit ? formatWallClockTimeForExcel(exit.exitTime) : '',
    'Placa Reemplazo':        exit ? (exit.replacementLicensePlate ?? '') : '',
    'Fecha Retorno':          exit ? calendarDateToExcelLocalDate(exit.returnDate) : '',
    'Hora Retorno':           exit ? formatWallClockTimeForExcel(exit.returnTime) : '',
  }
}

function sharedEntryCols(entry) {
  return {
    'ID':                      entry.id ?? '',
    'Estado':                  label(ACCESS_STATUS, entry.status),
    'Motivo Ingreso':          label(MOTIVOS_INGRESO, entry.entryReason),
    'Fecha Ingreso':           calendarDateToExcelLocalDate(entry.entryDate),
    'Hora Ingreso':            formatWallClockTimeForExcel(entry.entryTime),
    'Registrado por':          [entry.registeredByFirstName, entry.registeredByLastName].filter(Boolean).join(' ') || '',
    'Fecha Salida Permanente': calendarDateToExcelLocalDate(entry.permanentExitDate),
    'Hora Salida Permanente':  formatWallClockTimeForExcel(entry.permanentExitTime),
    'Tipo Doc. Cliente':       entry.permanentExitDate ? label(TIPOS_DOCUMENTO, entry.customerDocumentType) : '',
    'Nro. Doc. Cliente':       entry.permanentExitDate ? (entry.customerDni ?? '') : '',
    'Nombre Cliente':          entry.permanentExitDate ? (entry.customerFirstName ?? '') : '',
    'Apellido Cliente':        entry.permanentExitDate ? (entry.customerLastName ?? '') : '',
  }
}

function buildVehicleRow(entry, exit = null, exitIndex = null) {
  return {
    ...sharedEntryCols(entry),
    'VIN':         entry.vin          ?? '',
    'Placa':       entry.licensePlate ?? '',
    'Marca':       entry.brand        ?? '',
    'Modelo':      entry.model        ?? '',
    'Año':         entry.year         ?? '',
    'Kilometraje': entry.mileage      ?? '',
    'Color':       entry.color        ?? '',
    ...sharedExitCols(exit, exitIndex),
  }
}

function buildPersonRow(entry, exit = null, exitIndex = null) {
  return {
    ...sharedEntryCols(entry),
    'Tipo Documento': label(TIPOS_DOCUMENTO, entry.documentType),
    'Nro. Documento': entry.clientDocumentNumber ?? '',
    'Nombre':         entry.firstName            ?? '',
    'Apellido':       entry.lastName             ?? '',
    ...sharedExitCols(exit, exitIndex),
  }
}

function flattenRows(entries, buildRow) {
  const rows = []
  for (const entry of entries) {
    if (entry.temporalExits?.length > 0) {
      entry.temporalExits.forEach((exit, i) => rows.push(buildRow(entry, exit, i)))
    } else {
      rows.push(buildRow(entry))
    }
  }
  return rows
}

// Anchos de columna (en caracteres) por hoja
const VEHICLE_COL_WIDTHS = [6, 18, 18, 14, 12, 22, 24, 22, 18, 18, 18, 18, 12, 14, 16, 6, 14, 12, 20, 22, 22, 20, 18, 18, 14, 12]
const PERSON_COL_WIDTHS  = [6, 18, 18, 14, 12, 22, 24, 22, 18, 18, 18, 18, 18, 18, 16, 16, 20, 22, 22, 20, 18, 18, 14, 12]

async function handleExport() {
  await run(async () => {
    const entries = await store.exportAll()
    if (!entries.length) {
      showError('No hay datos para exportar con los filtros actuales.')
      return
    }
    const vehicles = entries.filter(e => e.type === 'VEHICULO')
    const persons  = entries.filter(e => e.type === 'PERSONA')

    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import('exceljs'),
      import('file-saver'),
    ])
    const wb = new ExcelJS.Workbook()

    if (vehicles.length > 0) {
      const ws = wb.addWorksheet('Vehículos')
      const vRows = flattenRows(vehicles, buildVehicleRow)
      if (vRows.length) {
        const headers = Object.keys(vRows[0])
        ws.addRow(headers)
        vRows.forEach(r => ws.addRow(headers.map(h => r[h])))
      }
      applySheetStyles(ws, VEHICLE_COL_WIDTHS)
    }
    if (persons.length > 0) {
      const ws = wb.addWorksheet('Personas')
      const pRows = flattenRows(persons, buildPersonRow)
      if (pRows.length) {
        const headers = Object.keys(pRows[0])
        ws.addRow(headers)
        pRows.forEach(r => ws.addRow(headers.map(h => r[h])))
      }
      applySheetStyles(ws, PERSON_COL_WIDTHS)
    }

    const date = todayIsoLocal()
    const buffer = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `control-acceso-${date}.xlsx`)
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

function handlePageChange({ page }) {
  store.goToPage(page)
}
</script>

<template>
  <div class="stays-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.items"
      :filtered-items="null"
      :global-filter-value="searchText"
      :lazy="true"
      :total-records="store.pagination.totalElements"
      :rows="20"
      :title="{ singular: 'registro', plural: 'registros' }"
      :columns="columns"
      :dynamic="true"
      :loading="isLoading"
      search-placeholder="Busca por placa, nombre, marca..."
      new-button-label="Registrar Ingreso"
      :show-view-action="true"
      :view-action-icon-only="true"
      view-button-label="Ver detalle"
      :show-edit-action="false"
      :show-delete-action="permissions.canDeleteStays.value"
      :show-delete="permissions.canDeleteStays.value"
      :show-selection="permissions.canDeleteStays.value"
      :show-exit-action="true"
      exit-button-label="Registrar salida"
      :exit-action-condition="(item) => item.status === 'EN_PLANTA' || item.status === 'EN_PLANTA_CUSTODIA'"
      :show-return-action="true"
      return-button-label="Registrar retorno"
      :return-action-condition="(item) => item.status === 'SALIDA_TEMPORAL'"
      :show-import="false"
      :show-export="false"
      @new-item-requested-manager="openNewDialog"
      @view-item-requested-manager="openDrawer"
      @edit-item-requested-manager="openEditDialog"
      @delete-item-requested-manager="handleDelete"
      @delete-selected-items-requested-manager="handleDeleteSelected"
      @delete-all-requested-manager="handleDeleteAll"
      @import-data-requested-manager="handleImport"
      @exit-item-requested-manager="openExitDialog"
      @return-item-requested-manager="openReturnDialog"
      @page-changed="handlePageChange"
      @global-filter-change="(v) => { searchText = v }"
      @clear-filters="clearAllFilters"
    >
      <template #extra-actions>
        <pv-button
          icon="pi pi-upload"
          label="Importar"
          severity="info"
          size="small"
          outlined
          @click="importDialogVisible = true"
        />
        <pv-button
          icon="pi pi-download"
          label="Exportar"
          severity="secondary"
          size="small"
          outlined
          @click="handleExport"
        />
      </template>

      <template #filters="{ clearFilters }">
        <div class="ac-filters">
          <div class="ac-filters__fields">
            <pv-multi-select
              v-model="filterStatus"
              :options="statusFilterOptions"
              option-label="label"
              option-value="value"
              placeholder="Estado"
              :max-selected-labels="1"
              selected-items-label="{0} estados"
            />
            <pv-multi-select
              v-model="filterType"
              :options="TIPOS_INGRESO"
              option-label="label"
              option-value="value"
              placeholder="Tipo"
              :max-selected-labels="1"
              selected-items-label="{0} tipos"
            />
            <pv-multi-select
              v-model="filterMotivo"
              :options="MOTIVOS_INGRESO"
              option-label="label"
              option-value="value"
              placeholder="Motivo"
              :max-selected-labels="1"
              selected-items-label="{0} motivos"
            />
            <pv-multi-select
              v-model="filterOrigin"
              :options="VEHICLE_ORIGIN_FILTER"
              option-label="label"
              option-value="value"
              placeholder="Origen"
              :max-selected-labels="1"
              selected-items-label="{0} orígenes"
            />
          </div>
          <pv-button
            type="button"
            label="Limpiar"
            icon="pi pi-filter-slash"
            text
            size="small"
            class="ac-filters__clear"
            @click="clearFilters"
          />
        </div>
      </template>

      <template #status-template="{ data }">
        <pv-tag
          :value="getStatusLabel(data.status)"
          :severity="getStatusSeverity(data.status)"
          class="stays-status-tag"
        />
      </template>

      <template #tipo-template="{ data }">
        <pv-tag
          :value="getTypeLabel(data)"
          :severity="getTypeSeverity(data)"
          :icon="getTypeIcon(data)"
          class="stays-type-tag"
        />
      </template>

      <template #identidad-template="{ data }">
        <span
          v-if="data.type === 'PERSONA'"
          class="stays-person-name"
          :title="data.fullName || data.clientDocumentNumber || ''"
        >
          {{ data.fullName || data.clientDocumentNumber || '—' }}
        </span>
        <span
          v-else
          class="stays-plate"
          :title="data.licensePlate || data.vin || data.clientDocumentNumber || ''"
        >
          {{ data.licensePlate || (data.vin ? 'VIN ' + data.vin : '') || data.clientDocumentNumber || '—' }}
        </span>
      </template>

      <template #motivo-template="{ data, value }">
        <span
          v-if="data.external && data.externalDescription"
          class="stays-ext-desc"
          :title="data.externalDescription"
        >
          {{ data.externalDescription }}
        </span>
        <pv-tag
          v-else-if="data.external"
          value="Externo"
          severity="danger"
          class="stays-motivo-tag"
        />
        <pv-tag
          v-else
          :value="getEntryReasonLabel(value)"
          :severity="getEntryReasonSeverity(value)"
          class="stays-motivo-tag"
        />
      </template>

      <template #ingreso-template="{ data }">
        <div class="stays-datetime">
          <span class="stays-datetime__date">{{ formatDate(data.entryDate) }}</span>
          <span class="stays-datetime__time">{{ formatTime(data.entryTime) || '—' }}</span>
        </div>
      </template>

      <template #salida-template="{ data }">
        <div v-if="data.exitDate || data.exitTime" class="stays-datetime stays-datetime--exit">
          <span class="stays-datetime__date">{{ formatDate(data.exitDate) }}</span>
          <span class="stays-datetime__time">{{ formatTime(data.exitTime) || '—' }}</span>
        </div>
        <span v-else class="exit-badge-active">Pendiente</span>
      </template>
    </DataManager>

    <!-- Detail Drawer -->
    <AccessDetailDrawer
      v-model:visible="drawerVisible"
      :item="drawerItem"
      :attachments="drawerAttachments"
      :can-manage-attachments="canManageAttachments"
      :can-edit="permissions.canEditStays.value"
      :deleting-attachment-id="deletingAttachmentId"
      :whatsapp-attempts="drawerWhatsappAttempts"
      :whatsapp-loading="drawerWhatsappLoading"
      :whatsapp-resending="drawerWhatsappResending"
      @edit-requested="openEditDialog"
      @remove-attachment-requested="handleRemoveAttachment"
      @resend-whatsapp-requested="handleResendWhatsapp"
      @refresh-whatsapp-requested="handleRefreshWhatsapp"
    />

    <!-- Create / Edit dialog -->
    <AccessCreateAndEdit
      :entity="editEntity"
      :existing-attachments="editAttachments"
      :visible="dialogVisible"
      :edit="isEditing"
      :can-manage-attachments="canManageAttachments"
      :deleting-attachment-id="editDeletingAttachmentId"
      :submit-loading="isLoading"
      @canceled-shared="closeDialog"
      @remove-existing-attachment-requested="handleRemoveEditAttachment"
      @saved-shared="handleSave"
    />

    <!-- Register Exit dialog -->
    <AccessRegisterExit
      :entity="exitEntity"
      :visible="exitDialogVisible"
      :submit-loading="isLoading"
      @canceled="exitDialogVisible = false"
      @saved="handleExit"
    />

    <!-- Register Return dialog -->
    <AccessRegisterReturn
      :entity="returnEntity"
      :visible="returnDialogVisible"
      :submit-loading="isLoading"
      @canceled="returnDialogVisible = false"
      @saved="handleReturn"
    />

    <!-- Diálogo de importación con selector de tipo -->
    <AccessImportDialog
      v-if="importDialogVisible"
      v-model:visible="importDialogVisible"
      @import-confirmed="handleImport"
    />

  </div>
</template>

<style scoped>
.stays-page :deep(.p-datatable .p-datatable-table) {
  table-layout: fixed;
  width: max-content;
  min-width: 100%;
}

.stays-page :deep(.stays-col-motivo) {
  width: 6.5rem !important;
  min-width: 6.5rem !important;
  max-width: 6.5rem !important;
  padding-inline: 0.4rem !important;
  overflow: hidden;
}

.stays-page :deep(.stays-col-ingreso) {
  width: 6.25rem !important;
  min-width: 6.25rem !important;
  max-width: 6.25rem !important;
  padding-inline: 0.35rem !important;
  overflow: hidden;
}

.stays-page :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.65rem !important;
  vertical-align: middle;
}

.stays-page :deep(.p-datatable .p-datatable-thead > tr > th) {
  padding: 0.55rem 0.65rem !important;
  white-space: nowrap;
}

.stays-page :deep(.p-datatable .p-datatable-thead > tr > th:last-child),
.stays-page :deep(.p-datatable .p-datatable-tbody > tr > td:last-child) {
  width: 7.5rem;
  min-width: 7.5rem;
  max-width: 7.5rem;
  padding-inline: 0.35rem !important;
}

.stays-page :deep(.p-datatable .p-datatable-tbody > tr > td:last-child .p-button) {
  width: 1.85rem;
  height: 1.85rem;
}

.stays-status-tag,
.stays-type-tag,
.stays-motivo-tag {
  font-size: 0.72rem;
  padding: 0.15rem 0.45rem;
  white-space: nowrap;
}

.stays-plate {
  display: block;
  font-weight: 700;
  font-size: 0.84rem;
  letter-spacing: 0.06em;
  color: var(--color-gray-900, #111827);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stays-person-name {
  display: block;
  font-weight: 500;
  font-size: 0.84rem;
  color: var(--color-gray-900, #111827);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stays-ext-desc {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  line-height: 1.2;
  color: var(--text-body, #374151);
}

.stays-motivo-tag {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.stays-page :deep(.stays-col-motivo .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 5.5rem;
}

.stays-datetime {
  display: inline-flex;
  flex-direction: column;
  gap: 0.05rem;
  line-height: 1.2;
  font-size: 0.78rem;
}

.stays-datetime__date {
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.stays-datetime__time {
  color: #6b7280;
  white-space: nowrap;
}

.stays-datetime--exit .stays-datetime__date {
  color: var(--color-success, #16a34a);
}

.exit-badge-active {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background-color: #dbeafe;
  color: #1d4ed8;
  white-space: nowrap;
}

.stays-page :deep(.app-filters-row.dm-filters-row:has(> .dm-global-search)) {
  grid-template-columns: minmax(12rem, 1.1fr) minmax(0, 2.4fr);
  gap: 0.625rem;
  align-items: center;
}

.stays-page :deep(.dm-filters-slot) {
  flex-wrap: nowrap;
  gap: 0;
}

.stays-page {
  flex: 1 1 auto;
}

.ac-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.ac-filters__fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.ac-filters__clear {
  flex-shrink: 0;
  align-self: center;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .ac-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .ac-filters__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ac-filters__clear {
    align-self: flex-end;
  }
}

@media (max-width: 767px) {
  .ac-filters__fields {
    grid-template-columns: 1fr;
  }
}

.ac-filters :deep(.p-select),
.ac-filters :deep(.p-multiselect) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 2.5rem;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.ac-filters :deep(.p-multiselect-label) {
  padding: 0 0.625rem;
  font-size: 0.875rem;
  line-height: 1;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 0;
  min-width: 0;
}

/* Checkboxes del MultiSelect: usar color primario del tema */
.ac-filters :deep(.p-multiselect-option .p-checkbox .p-checkbox-box) {
  border-color: var(--p-primary-color, #1a6bc2);
  background: #fff;
}

.ac-filters :deep(.p-multiselect-option.p-multiselect-option-selected .p-checkbox .p-checkbox-box) {
  background: var(--p-primary-color, #1a6bc2);
  border-color: var(--p-primary-color, #1a6bc2);
  color: #fff;
}

.ac-filters :deep(.p-checkbox-icon) {
  color: #fff;
}

/* ── Drawer detail panel ─────────────────────────────────── */
/* styles are global — see utilities.css */
</style>
