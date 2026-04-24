<script setup>
import DetailDrawer from '@/shared/presentation/components/detail-drawer.vue'
import {
  MOTIVOS_INGRESO,
  MOTIVO_SEVERITY,
  TIPOS_DOCUMENTO,
  ACCESS_STATUS,
  ACCESS_STATUS_SEVERITY,
  MOTIVOS_SALIDA_TEMPORAL,
} from '../constants/access-control-ui.constants.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  item:    { type: Object,  default: null  },
})

const emit = defineEmits(['update:visible', 'edit-requested'])

function close() {
  emit('update:visible', false)
}

function requestEdit() {
  emit('update:visible', false)
  emit('edit-requested', props.item)
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d) ? '-' : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(value) {
  if (!value) return null
  const parts = value.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  const s = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(m)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h % 12 === 0 ? 12 : h % 12
  const base   = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return s !== null && !isNaN(s)
    ? `${base}:${String(s).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

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
</script>

<template>
  <DetailDrawer :visible="visible" @update:visible="close">
    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="detail-header-icon">
          <i :class="item?.type === 'PERSONA' ? 'pi pi-user' : 'pi pi-car'" />
        </div>
        <div class="flex flex-column gap-1">
          <span class="font-bold text-sm" style="color: #111827">
            {{ item?.type === 'PERSONA' ? (item?.fullName ?? 'Persona') : (item?.licensePlate ?? 'Vehículo') }}
          </span>
          <div class="flex gap-2 flex-wrap">
            <pv-tag
              v-if="item?.status"
              :value="getStatusLabel(item.status)"
              :severity="getStatusSeverity(item.status)"
            />
            <pv-tag
              v-if="item?.entryReason"
              :value="getEntryReasonLabel(item.entryReason)"
              :severity="getEntryReasonSeverity(item.entryReason)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ── Contenido ──────────────────────────────────────────────── -->
    <template #content>
      <template v-if="item">

        <!-- Registrado por -->
        <div class="detail-section">
          <p class="detail-section-title">Registrado por</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Nombre</span>
              <span class="detail-value">
                {{ [item.registeredByFirstName, item.registeredByLastName].filter(Boolean).join(' ') || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Vehículo -->
        <template v-if="item.type !== 'PERSONA'">
          <div class="detail-section">
            <p class="detail-section-title">Vehículo</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Placa</span>
                <span class="detail-value font-bold">{{ item.licensePlate || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Marca</span>
                <span class="detail-value">{{ item.brand || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Modelo</span>
                <span class="detail-value">{{ item.model || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Año</span>
                <span class="detail-value">{{ item.year || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Kilometraje</span>
                <span class="detail-value">{{ item.mileage != null ? item.mileage + ' km' : '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Color</span>
                <span class="detail-value">{{ item.color || '—' }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Persona -->
        <template v-else>
          <div class="detail-section">
            <p class="detail-section-title">Persona</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Nombre</span>
                <span class="detail-value font-bold">{{ item.firstName || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Apellido</span>
                <span class="detail-value font-bold">{{ item.lastName || '—' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tipo doc.</span>
                <span class="detail-value">{{ getDocumentTypeLabel(item.documentType) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Número</span>
                <span class="detail-value">{{ item.clientDocumentNumber || '—' }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Ingreso -->
        <div class="detail-section">
          <p class="detail-section-title">Ingreso</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Fecha</span>
              <span class="detail-value">{{ formatDate(item.entryDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Hora</span>
              <span class="detail-value">{{ formatTime(item.entryTime) || '—' }}</span>
            </div>
            <div v-if="item.entryReason" class="detail-row">
              <span class="detail-label">Motivo</span>
              <span class="detail-value">{{ getEntryReasonLabel(item.entryReason) }}</span>
            </div>
          </div>
        </div>

        <!-- Salidas temporales -->
        <template v-if="item.temporalExits?.length">
          <div
            v-for="(te, idx) in item.temporalExits"
            :key="te.id ?? idx"
            class="detail-section"
          >
            <p class="detail-section-title">
              Salida temporal {{ item.temporalExits.length > 1 ? `#${idx + 1}` : '' }}
              <pv-tag
                :value="te.status === 'EN_SALIDA' ? 'En salida' : 'Retornado'"
                :severity="te.status === 'EN_SALIDA' ? 'warn' : 'info'"
                style="margin-left: 0.4rem; font-size: 0.7rem;"
              />
            </p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Motivo</span>
                <span class="detail-value">{{ getExitReasonLabel(te.exitReason) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha salida</span>
                <span class="detail-value" style="color: var(--color-success)">{{ formatDate(te.exitDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora salida</span>
                <span class="detail-value" style="color: var(--color-success)">{{ formatTime(te.exitTime) || '—' }}</span>
              </div>
              <template v-if="te.replacementLicensePlate">
                <div class="detail-row">
                  <span class="detail-label">Placa reemplazo</span>
                  <span class="detail-value font-bold">{{ te.replacementLicensePlate }}</span>
                </div>
              </template>
              <template v-if="te.returnDate">
                <div class="detail-row">
                  <span class="detail-label">Fecha retorno</span>
                  <span class="detail-value" style="color: var(--color-info)">{{ formatDate(te.returnDate) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Hora retorno</span>
                  <span class="detail-value" style="color: var(--color-info)">{{ formatTime(te.returnTime) || '—' }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Salida permanente -->
        <template v-if="item.permanentExitDate">
          <div class="detail-section">
            <p class="detail-section-title">Salida permanente</p>
            <div class="detail-grid">
              <div class="detail-row">
                <span class="detail-label">Fecha</span>
                <span class="detail-value font-semibold" style="color: var(--color-success)">{{ formatDate(item.permanentExitDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora</span>
                <span class="detail-value font-semibold" style="color: var(--color-success)">{{ formatTime(item.permanentExitTime) || '—' }}</span>
              </div>
            </div>
          </div>
          <template v-if="item.clientDocumentNumber || item.firstName || item.lastName || item.customerDni || item.customerFirstName || item.customerLastName">
            <div class="detail-section">
              <p class="detail-section-title">Cliente</p>
              <div class="detail-grid">
                <div class="detail-row">
                  <span class="detail-label">Tipo doc.</span>
                  <span class="detail-value">{{ getDocumentTypeLabel(item.documentType || item.customerDocumentType) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Número</span>
                  <span class="detail-value font-bold">{{ item.clientDocumentNumber || item.customerDni || '—' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Nombre</span>
                  <span class="detail-value">{{ item.firstName || item.customerFirstName || '—' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Apellido</span>
                  <span class="detail-value">{{ item.lastName || item.customerLastName || '—' }}</span>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- Acciones -->
        <div class="detail-section" style="border-bottom: none; background: #f9fafb;">
          <div class="flex gap-2">
            <pv-button
              icon="pi pi-pencil"
              label="Editar"
              size="small"
              class="flex-1"
              @click="requestEdit"
            />
          </div>
        </div>

      </template>
    </template>
  </DetailDrawer>
</template>
