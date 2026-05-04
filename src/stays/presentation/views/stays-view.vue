<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useStaysStore }                        from '../../application/stays.store.js'
import { useIamStore }                          from '@/iam/application/iam.store.js'
import { useAsyncAction }                       from '@/shared/composables/use-async-action.js'
import { useNotification }                      from '@/shared/composables/use-notification.js'
import { StorageFilesApi }                      from '../../infrastructure/api/storage-files.api.js'
import DataManager                              from '@/shared/presentation/components/data-manager.vue'
import AccessCreateAndEdit                      from '../components/access-create-and-edit.vue'
import AccessRegisterExit                       from '../components/access-register-exit.vue'
import AccessRegisterReturn                     from '../components/access-register-return.vue'
import AccessImportDialog                        from '../components/access-import-dialog.vue'
import AccessDetailDrawer                        from '../components/access-detail-drawer.vue'
import { MOTIVOS_INGRESO, MOTIVO_SEVERITY, TIPOS_INGRESO, TIPOS_DOCUMENTO, ACCESS_STATUS, ACCESS_STATUS_SEVERITY, MOTIVOS_SALIDA_TEMPORAL } from '../constants/stays-ui.constants.js'
import * as XLSX from 'xlsx'
import { todayIsoLocal, toIsoDateString } from '@/shared/domain/employee-attendance-day.js'
import {
  formatCalendarDateForUi,
  formatTimeHmAmPmForUi,
  calendarDateToExcelLocalDate,
  formatWallClockTimeForExcel,
} from '@/shared/domain/format-datetime-ui.js'

const store              = useStaysStore()
const iamStore           = useIamStore()
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
const searchText   = ref('')

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  return store.items.filter(item => {
    if (filterStatus.value.length && !filterStatus.value.includes(item.status))      return false
    if (filterType.value.length   && !filterType.value.includes(item.type))          return false
    if (filterMotivo.value.length && !filterMotivo.value.includes(item.entryReason)) return false
    if (q) {
      const searchable = [
        item.licensePlate,
        item.fullName,
        item.firstName,
        item.lastName,
        item.brand,
        item.model,
        item.clientDocumentNumber,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })
})

function clearAllFilters() {
  filterStatus.value = []
  filterType.value   = []
  filterMotivo.value = []
  searchText.value   = ''
}

async function openDrawer(item) {
  drawerItem.value    = item
  drawerVisible.value = true
  drawerWhatsappAttempts.value = []
  drawerWhatsappLoading.value = true
  stopWhatsappPolling()
  await run(async () => {
    await store.fetchById(item.id)
    drawerAttachments.value = await store.fetchAttachments(item.id)
  })
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

async function handleResendWhatsapp(stayId) {
  if (drawerWhatsappResending.value) return
  drawerWhatsappResending.value = true
  try {
    await store.resendWhatsApp(stayId)
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
  { field: 'status',      header: 'Estado',        sortable: true, style: 'min-width: 100px', template: 'status-template'   },
  { field: 'type',        header: 'Tipo',           sortable: true, style: 'min-width: 100px', template: 'tipo-template'     },
  { field: 'licensePlate', header: 'Placa / Nombre', sortable: true, style: 'min-width: 150px', template: 'identidad-template' },
  { field: 'entryReason', header: 'Motivo',          sortable: true, style: 'min-width: 140px', template: 'motivo-template'   },
  { field: 'entryDate',   header: 'Ingreso',         sortable: true, style: 'min-width: 160px', template: 'ingreso-template'  },
  { field: 'exitDate',    header: 'Salida',          sortable: true, style: 'min-width: 160px', template: 'salida-template'   },
]

const formatDate = (value) => formatCalendarDateForUi(value, '-')
const formatTime = (value) => formatTimeHmAmPmForUi(value, { seconds: 'auto' })

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
    const subjectIdentifier = entity.licensePlate || entity.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(entity.attachments, {
      plate: subjectIdentifier,
      accessType: entity.type,
      stayType: 'INGRESO',
      operationDate: toIsoDateString(entity.entryDate),
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

const canManageAttachments = computed(() => {
  const roles = iamStore.currentUserRoles ?? []
  return roles.includes('ROLE_ADMIN') || roles.includes('ROLE_SECURITY_GUARD') || roles.includes('ROLE_SUPPORT_ADMIN')
})

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
    const subjectIdentifier = exitData.licensePlate || exitData.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(exitData.attachments, {
      plate: subjectIdentifier,
      accessType: exitData.type,
      stayType: exitData.exitType === 'TEMPORAL' ? 'SALIDA_TEMPORAL' : 'SALIDA_PERMANENTE',
      operationDate: toIsoDateString(exitData.exitDate),
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
    const subjectIdentifier = returnData.licensePlate || returnData.clientDocumentNumber || 'SIN_IDENTIFICADOR'
    const attachmentIds = await uploadAttachments(returnData.attachments, {
      plate: subjectIdentifier,
      accessType: returnData.type,
      stayType: 'RETORNO',
      operationDate: toIsoDateString(returnData.returnDate),
    })
    await store.registerReturn(returnData.id, { ...returnData, attachmentIds })
    showSuccess('Retorno registrado correctamente.')
    returnDialogVisible.value = false
  }, { rethrow: false })
  if (error.value) showError(error.value)
}

async function handleDeleteSelected(items) {
  await run(async () => {
    await Promise.all(items.map(item => store.remove(item.id)))
    showSuccess(`${items.length} registro(s) eliminado(s) correctamente.`)
  })
  if (error.value) showError(error.value)
}

// Importación
const importDialogVisible = ref(false)

async function handleImport(rows) {
  let result = null
  await run(
    async () => { result = await store.bulkCreate(rows) },
    { errorMessage: 'No se pudo completar la importación. Verifica el archivo e inténtalo de nuevo.' }
  )
  if (result) {
    if (result.failed === 0) {
      showSuccess(`${result.success} ingreso(s) importado(s) correctamente.`)
    } else {
      showError(`${result.success} importado(s), ${result.failed} no se procesó(aron) — verifica los datos.`)
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
  if (!Array.isArray(response?.data)) return []
  return response.data.map(file => file.id).filter(Boolean)
}

// Exportación a Excel
function label(list, value, fallback = value ?? '—') {
  return list.find(i => i.value === value)?.label ?? fallback
}

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

function handleExport() {
  const vehicles = store.items.filter(e => e.type === 'VEHICULO')
  const persons  = store.items.filter(e => e.type === 'PERSONA')

  const wb = XLSX.utils.book_new()

  if (vehicles.length > 0) {
    const ws = XLSX.utils.json_to_sheet(flattenRows(vehicles, buildVehicleRow), { cellDates: true })
    applySheetStyles(ws, VEHICLE_COL_WIDTHS)
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos')
  }
  if (persons.length > 0) {
    const ws = XLSX.utils.json_to_sheet(flattenRows(persons, buildPersonRow), { cellDates: true })
    applySheetStyles(ws, PERSON_COL_WIDTHS)
    XLSX.utils.book_append_sheet(wb, ws, 'Personas')
  }

  const date = todayIsoLocal()
  XLSX.writeFile(wb, `control-acceso-${date}.xlsx`)
}
</script>

<template>
  <div class="stays-page app-page-view flex flex-column flex-1 min-h-0 min-w-0">
    <DataManager
      :items="store.items"
      :filtered-items="filteredItems"
      :global-filter-value="searchText"
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
      :show-delete-action="iamStore.hasFullActionAccess"
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
      @import-data-requested-manager="handleImport"
      @exit-item-requested-manager="openExitDialog"
      @return-item-requested-manager="openReturnDialog"
      @global-filter-change="(v) => searchText = v"
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
          <pv-multi-select
            v-model="filterStatus"
            :options="ACCESS_STATUS"
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
          <pv-button
            type="button"
            label="Limpiar filtros"
            text
            size="small"
            class="flex-shrink-0"
            @click="clearFilters"
          />
        </div>
      </template>

      <template #status-template="{ data }">
        <pv-tag
          :value="getStatusLabel(data.status)"
          :severity="getStatusSeverity(data.status)"
        />
      </template>

      <template #tipo-template="{ data }">
        <pv-tag
          :value="data.type === 'PERSONA' ? 'Persona' : 'Vehículo'"
          :severity="data.type === 'PERSONA' ? 'info' : 'secondary'"
          :icon="data.type === 'PERSONA' ? 'pi pi-user' : 'pi pi-car'"
        />
      </template>

      <template #identidad-template="{ data }">
        <span v-if="data.type === 'PERSONA'" style="color: var(--color-gray-900); font-weight: 500">
          {{ data.fullName || data.clientDocumentNumber || '—' }}
        </span>
        <span v-else class="font-bold" style="letter-spacing: 0.04em">
          {{ data.licensePlate || data.clientDocumentNumber || '—' }}
        </span>
      </template>

      <template #motivo-template="{ value }">
        <pv-tag
          :value="getEntryReasonLabel(value)"
          :severity="getEntryReasonSeverity(value)"
        />
      </template>

      <template #ingreso-template="{ data }">
        <div class="flex flex-column" style="line-height: 1.4">
          <span style="font-weight: 600">{{ formatDate(data.entryDate) }}</span>
          <span style="font-size: 0.8rem; color: #6b7280">{{ formatTime(data.entryTime) || '—' }}</span>
        </div>
      </template>

      <template #salida-template="{ data }">
        <div v-if="data.exitDate || data.exitTime" class="flex flex-column" style="line-height: 1.4">
          <span style="font-weight: 600; color: var(--color-success)">{{ formatDate(data.exitDate) }}</span>
          <span style="font-size: 0.8rem; color: #6b7280">{{ formatTime(data.exitTime) || '—' }}</span>
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
      v-model:visible="importDialogVisible"
      @import-confirmed="handleImport"
    />

  </div>
</template>

<style scoped>
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

/* ── Filtros Control de acceso: ocupan todo el ancho junto a la búsqueda global ── */
.stays-page {
  flex: 1 1 auto;
}

.ac-filters {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 767px) {
  .ac-filters {
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
