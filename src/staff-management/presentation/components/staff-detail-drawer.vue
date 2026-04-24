<script setup>
import DetailDrawer from '@/shared/presentation/components/detail-drawer.vue'
import { TIPOS_DOCUMENTO, DEPARTAMENTOS } from '../constants/staff-management-ui.constants.js'

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

function getDocumentTypeLabel(value) {
  return TIPOS_DOCUMENTO.find(t => t.value === value)?.label ?? value ?? 'DNI'
}

function getDepartmentLabel(value) {
  return DEPARTAMENTOS.find(d => d.value === value)?.label ?? value ?? '—'
}
</script>

<template>
  <DetailDrawer :visible="visible" @update:visible="close">
    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex align-items-center gap-3">
        <span class="collab-avatar collab-avatar--lg">
          {{ item?.firstName?.[0] ?? '?' }}{{ item?.lastName?.[0] ?? '' }}
        </span>
        <div>
          <div class="font-bold text-sm" style="color: #111827">
            {{ item?.fullName || 'Colaborador' }}
          </div>
          <div style="font-size: 0.75rem; color: #6b7280">
            {{ item?.position || '' }}
          </div>
        </div>
      </div>
    </template>

    <!-- ── Contenido ──────────────────────────────────────────────── -->
    <template #content>
      <template v-if="item">

        <div class="detail-section">
          <p class="detail-section-title">Identidad</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Tipo doc.</span>
              <span class="detail-value">{{ getDocumentTypeLabel(item.documentType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Documento</span>
              <span class="detail-value font-bold">{{ item.documentNumber || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nombres</span>
              <span class="detail-value">{{ item.firstName || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Apellidos</span>
              <span class="detail-value">{{ item.lastName || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-section-title">Contacto</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Correo</span>
              <span class="detail-value">{{ item.email || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-section-title">Cargo</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Puesto</span>
              <span class="detail-value">{{ item.position || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Área</span>
              <span class="detail-value">{{ getDepartmentLabel(item.department) || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-section-title">Acceso al sistema</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Estado</span>
              <pv-tag
                :value="item.active ? 'Activo' : 'Inactivo'"
                :severity="item.active ? 'success' : 'secondary'"
              />
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="flex gap-2" style="padding: 0.75rem 1rem;">
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
