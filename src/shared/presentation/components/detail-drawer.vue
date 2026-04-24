<script setup>
// ===========================
// PROPS & EMITS
// ===========================
const props = defineProps({
  visible: { type: Boolean, required: true },
  width:   { type: String,  default: '360px' },
})

const emit = defineEmits(['update:visible'])

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <pv-drawer
    :visible="visible"
    position="right"
    :style="{ width: props.width, maxWidth: 'calc(100vw - 1rem)' }"
    :pt="{
      header:  { style: 'background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 1rem 1.25rem;' },
      content: { style: 'background: #f9fafb; padding: 0;' },
    }"
    @update:visible="close"
  >
    <!-- Header: icono + título + tags -->
    <template #header>
      <slot name="header" />
    </template>

    <!-- Botón de cierre propio, visible sobre fondo blanco -->
    <template #closebutton>
      <button class="dd-close-btn" aria-label="Cerrar" type="button" @click="close">
        <i class="pi pi-times" />
      </button>
    </template>

    <!-- Cuerpo: secciones detail-section -->
    <slot name="content"></slot>


  </pv-drawer>
</template>

<style scoped>
.dd-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-body-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.dd-close-btn:hover {
  background: var(--surface-lighter);
  color: var(--text-body);
}

.dd-close-btn .pi {
  font-size: 0.875rem;
}
</style>
