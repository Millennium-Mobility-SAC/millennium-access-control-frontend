<script setup>
defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  imageName: {
    type: String,
    default: 'Imagen'
  },
  imageAlt: {
    type: String,
    default: ''
  },
  zoom: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['update:visible', 'zoom-in', 'zoom-out', 'reset-zoom', 'download', 'error']);

const handleClose = () => {
  emit('update:visible', false);
};

const handleZoomIn = () => {
  emit('zoom-in');
};

const handleZoomOut = () => {
  emit('zoom-out');
};

const handleResetZoom = () => {
  emit('reset-zoom');
};

const handleDownload = () => {
  emit('download');
};

const handleImageError = (event) => {
  emit('error', event);
};

const getFileIcon = (url) => {
  if (!url) return 'pi-file';
  
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.pdf')) return 'pi-file-pdf';
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
      urlLower.includes('.png') || urlLower.includes('.gif') || 
      urlLower.includes('.webp')) return 'pi-image';
  
  return 'pi-file';
};

const getFileColor = (url) => {
  if (!url) return 'text-gray-600';
  
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.pdf')) return 'text-red-500';
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
      urlLower.includes('.png') || urlLower.includes('.gif') || 
      urlLower.includes('.webp')) return 'text-blue-500';
  
  return 'text-gray-600';
};
</script>

<template>
  <pv-dialog
    :visible="visible"
    :modal="true"
    :closable="true"
    :draggable="false"
    :resizable="false"
    class="image-viewer-modal"
    :style="{ width: '90vw', maxWidth: '800px' }"
    @update:visible="handleClose"
  >
    <template #header>
      <div class="flex align-items-center gap-2">
        <i :class="`pi ${getFileIcon(imageUrl)} ${getFileColor(imageUrl)}`"></i>
        <span class="font-semibold">{{ imageName }}</span>
      </div>
    </template>

    <div class="document-viewer-content">
      <div class="image-viewer">
        <div class="image-controls mb-3 flex justify-content-between align-items-center">
          <div class="flex gap-2">
            <pv-button
              icon="pi pi-minus"
              class="p-button-sm p-button-outlined"
              @click="handleZoomOut"
              :disabled="zoom <= 0.5"
              title="Alejar"
            />
            <pv-button
              icon="pi pi-refresh"
              class="p-button-sm p-button-outlined"
              @click="handleResetZoom"
              title="Tamaño original"
            />
            <pv-button
              icon="pi pi-plus"
              class="p-button-sm p-button-outlined"
              @click="handleZoomIn"
              :disabled="zoom >= 3"
              title="Acercar"
            />
          </div>
          <span class="text-sm text-600">{{ Math.round(zoom * 100) }}%</span>
        </div>
        <div class="image-container-modal">
          <img
            :src="imageUrl"
            :alt="imageAlt || imageName"
            :style="{ transform: `scale(${zoom})`, transformOrigin: 'center', display: 'block', margin: '0 auto' }"
            class="w-full h-auto"
            @error="handleImageError"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-container">
        <div class="footer-actions-left">
          <pv-button
            icon="pi pi-download"
            label="Descargar"
            class="p-button-outlined"
            @click="handleDownload"
            :disabled="!imageUrl"
          />
        </div>
        <div class="footer-actions-right">
          <pv-button
            icon="pi pi-times"
            label="Cerrar"
            class="p-button-text"
            @click="handleClose"
          />
        </div>
      </div>
    </template>
  </pv-dialog>
</template>

<style scoped>
/* Estilos para el modal de imágenes */
:deep(.image-viewer-modal .p-dialog-header) {
  background-color: #4A60D0;
  color: white;
}

:deep(.image-viewer-modal .p-dialog-content) {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: calc(90vh - 250px);
}

:deep(.image-viewer-modal .p-dialog-footer) {
  padding: 1rem 1.5rem;
}

.image-container-modal {
  background-color: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.image-controls {
  background-color: #f8f9fa;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.modal-footer-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 1rem;
}

.footer-actions-left {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.footer-actions-right {
  display: flex;
  gap: 0.5rem;
}

:deep(.image-viewer-modal) {
  max-height: 90vh;
}

@media (max-width: 768px) {
  .modal-footer-container {
    flex-direction: column;
    gap: 0.75rem;
  }

  .footer-actions-left,
  .footer-actions-right {
    width: 100%;
    justify-content: center;
  }
}
</style>
