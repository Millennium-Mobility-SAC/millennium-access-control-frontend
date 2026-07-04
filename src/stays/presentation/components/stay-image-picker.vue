<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: 'Imágenes' },
  hint: { type: String, default: 'Puedes subir múltiples imágenes o tomar fotos al momento.' },
  capture: { type: String, default: 'environment' },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const galleryInput = ref(null)
const cameraInput = ref(null)
const previewUrls = ref([])

const files = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])

function rebuildPreviewUrls() {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
  previewUrls.value = files.value.map(file => URL.createObjectURL(file))
}

function openGalleryPicker() {
  galleryInput.value?.click()
}

function openCameraPicker() {
  cameraInput.value?.click()
}

/** Clave estable para deduplicar archivos ya seleccionados en cargas sucesivas. */
function fileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified ?? 0}`
}

function onFileChange(event) {
  const incoming = Array.from(event?.target?.files ?? [])
  if (incoming.length === 0) {
    if (event?.target) event.target.value = ''
    return
  }
  // Acumular con los archivos ya seleccionados, evitando duplicados.
  const existingKeys = new Set(files.value.map(fileKey))
  const merged = [...files.value]
  for (const file of incoming) {
    const key = fileKey(file)
    if (!existingKeys.has(key)) {
      existingKeys.add(key)
      merged.push(file)
    }
  }
  emit('update:modelValue', merged)
  // Reset del input para permitir re-seleccionar el mismo archivo si se eliminó.
  if (event?.target) event.target.value = ''
}

function removeAt(index) {
  emit('update:modelValue', files.value.filter((_, current) => current !== index))
}

watch(files, rebuildPreviewUrls, { deep: true, immediate: true })

onBeforeUnmount(() => {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="sip">
    <div class="sip__dropzone" :class="{ 'sip__dropzone--invalid': !!error }" role="button" tabindex="0" @click="openGalleryPicker" @keydown.enter.prevent="openGalleryPicker" @keydown.space.prevent="openGalleryPicker">
      <div class="sip__icon-wrap">
        <i class="pi pi-camera sip__icon" />
      </div>
      <div class="sip__content">
        <div class="sip__title">
          {{ label }}
          <span v-if="required" class="sip__required">*</span>
        </div>
        <div class="sip__subtitle">{{ hint }}</div>
        <div class="sip__actions">
          <button type="button" class="sip__action sip__action--primary" @click.stop="openCameraPicker">
            <i class="pi pi-camera" />
            <span>Tomar foto</span>
          </button>
          <button type="button" class="sip__action" @click.stop="openGalleryPicker">
            <i class="pi pi-images" />
            <span>Elegir de galería</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Galería: SIN atributo capture, así el sistema operativo ofrece el selector de archivos/galería. -->
    <input
      ref="galleryInput"
      type="file"
      accept="image/*"
      multiple
      class="sip__input"
      @change="onFileChange"
    >

    <!-- Cámara: con atributo capture para forzar la cámara en dispositivos móviles. -->
    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      :capture="capture"
      class="sip__input"
      @change="onFileChange"
    >

    <div v-if="files.length" class="sip__summary">
      <span>{{ files.length }} archivo(s) seleccionado(s)</span>
      <button type="button" class="sip__clear" @click="emit('update:modelValue', [])">Limpiar</button>
    </div>

    <small v-if="error" class="sip__error">{{ error }}</small>

    <div v-if="files.length" class="sip__grid">
      <article v-for="(file, index) in files" :key="`${file.name}-${index}`" class="sip__card">
        <img :src="previewUrls[index]" :alt="file.name" class="sip__image">
        <div class="sip__meta">
          <div class="sip__name">{{ file.name }}</div>
          <div class="sip__size">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</div>
        </div>
        <button type="button" class="sip__remove" @click="removeAt(index)">
          <i class="pi pi-trash" />
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.sip {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sip__dropzone {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 1rem;
  border: 1px dashed #93c5fd;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.sip__dropzone:hover,
.sip__dropzone:focus-visible {
  border-color: #2563eb;
  background: linear-gradient(180deg, #f3f8ff 0%, #e8f1ff 100%);
  transform: translateY(-1px);
  outline: none;
}

.sip__dropzone--invalid {
  border-color: #dc2626;
  background: linear-gradient(180deg, #fff7f7 0%, #fee2e2 100%);
}

.sip__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  flex-shrink: 0;
}

.sip__icon {
  font-size: 1.2rem;
}

.sip__content {
  min-width: 0;
}

.sip__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1f2937;
}

.sip__required {
  color: #dc2626;
}

.sip__subtitle {
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.sip__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
}

.sip__action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #dbeafe;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1d4ed8;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}

.sip__action:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

.sip__action:active {
  transform: translateY(1px);
}

.sip__action--primary {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #1d4ed8;
}

.sip__action--primary:hover {
  background: #1e40af;
  border-color: #1e40af;
}

.sip__input {
  display: none;
}

.sip__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.78rem;
  color: #4b5563;
}

.sip__clear {
  border: none;
  background: transparent;
  color: #dc2626;
  font-weight: 600;
  cursor: pointer;
}

.sip__error {
  color: #dc2626;
  font-size: 0.75rem;
}

.sip__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.sip__card {
  position: relative;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.sip__image {
  display: block;
  width: 100%;
  height: 100px;
  object-fit: cover;
  background: #f3f4f6;
}

.sip__meta {
  padding: 0.55rem 0.65rem 0.7rem;
}

.sip__name {
  font-size: 0.74rem;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sip__size {
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: #6b7280;
}

.sip__remove {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border: none;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.7);
  color: #fff;
  cursor: pointer;
}

@media (max-width: 560px) {
  .sip__dropzone {
    align-items: flex-start;
  }
}
</style>
