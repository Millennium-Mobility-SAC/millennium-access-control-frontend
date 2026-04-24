<script setup>
import DetailDrawer from '@/shared/presentation/components/detail-drawer.vue'

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
</script>

<template>
  <DetailDrawer :visible="visible" width="320px" @update:visible="close">
    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="detail-header-icon">
          <i class="pi pi-car" />
        </div>
        <span class="font-bold text-sm" style="color: #111827; letter-spacing: 0.06em;">
          {{ item?.licensePlate || 'Vehículo' }}
        </span>
      </div>
    </template>

    <!-- ── Contenido ──────────────────────────────────────────────── -->
    <template #content>
      <template v-if="item">

        <div class="detail-section">
          <p class="detail-section-title">Identificación</p>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Placa</span>
              <span class="detail-value font-bold" style="letter-spacing: 0.08em;">{{ item.licensePlate || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Color</span>
              <span class="detail-value">{{ item.color || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-section-title">Datos</p>
          <div class="detail-grid">
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
