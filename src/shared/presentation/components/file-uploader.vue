<script setup>
// ===========================
// IMPORTS
// ===========================
import { ref, computed, watch, onBeforeUnmount } from 'vue'

// ===========================
// CONSTANTS
// ===========================
const FILE_FORMATS = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}
FILE_FORMATS.any = [...FILE_FORMATS.image, ...FILE_FORMATS.document]

const EXTENSION_MAP = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
}

const PLACEHOLDERS = {
  image: 'Haz clic para subir imagen',
  document: 'Haz clic para subir documento',
  any: 'Haz clic para subir archivo'
}

const ICONS = {
  image: 'pi pi-image',
  document: 'pi pi-file',
  any: 'pi pi-upload'
}

const FILE_TYPE_ICONS = {
  pdf: 'pi pi-file-pdf',
  doc: 'pi pi-file-word',
  docx: 'pi pi-file-word'
}

// ===========================
// PROPS
// ===========================
const props = defineProps({
  modelValue: { type: File, default: null },
  fileType: { type: String, default: 'image', validator: (v) => ['image', 'document', 'any'].includes(v) },
  maxFileSize: { type: Number, default: 10 * 1024 * 1024 },
  acceptedFormats: { type: Array, default: null },
  label: String,
  placeholder: String,
  hint: String,
  dragText: { type: String, default: ' o arrastra aquí' },
  changeText: { type: String, default: 'Cambiar' },
  removeText: { type: String, default: 'Eliminar' },
  errorMessages: {
    type: Object,
    default: () => ({
      fileTooBig: 'El archivo es muy grande. Máximo {maxSize}',
      invalidFormat: 'Formato no válido. Formatos permitidos: {formats}'
    })
  },
  required: Boolean,
  disabled: Boolean,
  inputId: { type: String, default: () => `file-uploader-${Math.random().toString(36).substr(2, 9)}` }
})

// ===========================
// EMITS
// ===========================
const emit = defineEmits(['update:modelValue', 'file-selected', 'file-removed', 'validation-error'])

// ===========================
// STATE
// ===========================
const isDragOver = ref(false)
const fileUrl = ref(null)
const fileInput = ref(null)

// ===========================
// COMPUTED PROPERTIES
// ===========================
const hasFile = computed(() => !!props.modelValue)
const isImage = computed(() => props.modelValue?.type.startsWith('image/'))

const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const fileInfo = computed(() => {
  if (!props.modelValue) return null
  return {
    name: props.modelValue.name,
    size: formatFileSize(props.modelValue.size),
    type: props.modelValue.type,
    url: isImage.value ? fileUrl.value : null,
    extension: props.modelValue.name.slice((props.modelValue.name.lastIndexOf(".") - 1 >>> 0) + 2)
  }
})

const computedAcceptedFormats = computed(() => 
  props.acceptedFormats || FILE_FORMATS[props.fileType] || FILE_FORMATS.any
)

const acceptAttribute = computed(() => computedAcceptedFormats.value.join(','))

const allowedExtensions = computed(() => 
  computedAcceptedFormats.value
    .map(format => EXTENSION_MAP[format] || `.${format.split('/')[1]}`)
    .join(', ')
)

const placeholderText = computed(() => props.placeholder || PLACEHOLDERS[props.fileType] || PLACEHOLDERS.any)

const iconClass = computed(() => 
  hasFile.value && isImage.value ? 'pi pi-image' : (ICONS[props.fileType] || ICONS.any)
)

const fileTypeIcon = computed(() => {
  if (!hasFile.value) return null
  if (isImage.value) return 'pi pi-image'
  return FILE_TYPE_ICONS[fileInfo.value.extension.toLowerCase()] || 'pi pi-file'
})

// ===========================
// METHODS
// ===========================
const validateFile = (file) => {
  const errors = []
  
  if (file.size > props.maxFileSize) {
    errors.push({
      type: 'size',
      message: props.errorMessages.fileTooBig.replace('{maxSize}', formatFileSize(props.maxFileSize))
    })
  }
  
  if (!computedAcceptedFormats.value.includes(file.type)) {
    errors.push({
      type: 'format',
      message: props.errorMessages.invalidFormat.replace('{formats}', allowedExtensions.value)
    })
  }
  
  return errors
}

const handleFileSelect = (file) => {
  if (!file || props.disabled) return
  
  const validationErrors = validateFile(file)
  if (validationErrors.length) {
    emit('validation-error', validationErrors)
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  
  emit('update:modelValue', file)
  emit('file-selected', file)
}

const openFileDialog = () => !props.disabled && fileInput.value?.click()

const onInputChange = (event) => handleFileSelect(event.target.files?.[0])

const onDragOver = (event) => {
  event.preventDefault()
  if (!props.disabled) isDragOver.value = true
}

const onDragLeave = (event) => {
  event.preventDefault()
  isDragOver.value = false
}

const onDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  if (!props.disabled) handleFileSelect(event.dataTransfer?.files?.[0])
}

const removeFile = () => {
  if (props.disabled) return
  
  if (fileUrl.value) {
    URL.revokeObjectURL(fileUrl.value)
    fileUrl.value = null
  }
  
  if (fileInput.value) fileInput.value.value = ''
  
  emit('update:modelValue', null)
  emit('file-removed')
}

const onKeyDown = (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && !hasFile.value) {
    event.preventDefault()
    openFileDialog()
  }
}

// ===========================
// WATCHERS
// ===========================
watch(() => props.modelValue, (newFile) => {
  if (fileUrl.value) {
    URL.revokeObjectURL(fileUrl.value)
    fileUrl.value = null
  }
  
  if (newFile?.type.startsWith('image/')) {
    fileUrl.value = URL.createObjectURL(newFile)
  }
})

// ===========================
// LIFECYCLE HOOKS
// ===========================
onBeforeUnmount(() => {
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value)
})
</script>

<template>
  <div class="w-full">
    <!-- Label -->
    <label 
      v-if="label" 
      :for="inputId" 
      class="block mb-2 font-medium text-color"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>

    <!-- Dropzone -->
    <div
      class="file-uploader__dropzone flex align-items-center gap-3 w-full cursor-pointer"
      :class="{
        'file-uploader__dropzone--filled': hasFile,
        'file-uploader__dropzone--drag-over': isDragOver,
        'file-uploader__dropzone--disabled': disabled
      }"
      :tabindex="disabled ? -1 : 0"
      role="button"
      :aria-label="hasFile ? `Archivo seleccionado: ${fileInfo?.name}` : placeholderText"
      :aria-describedby="`${inputId}-hint`"
      @click="openFileDialog"
      @keydown="onKeyDown"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Estado vacío -->
      <div v-if="!hasFile" class="text-center w-full">
        <i 
          :class="iconClass" 
          class="file-uploader__icon block mb-2"
          aria-hidden="true"
        ></i>
        <div class="file-uploader__cta">
          <span class="file-uploader__link font-semibold">{{ placeholderText }}</span>
          <span v-if="dragText" class="file-uploader__muted"> {{ dragText }}</span>
        </div>
        <div 
          v-if="hint"
          :id="`${inputId}-hint`" 
          class="mt-1 text-sm file-uploader__hint"
        >
          {{ hint }}
        </div>
      </div>

      <!-- Estado con archivo -->
      <div v-else class="flex flex-column sm:flex-row align-items-start sm:align-items-center gap-3 w-full">
        <!-- Preview para imágenes -->
        <div v-if="isImage" class="file-uploader__preview flex-shrink-0 overflow-hidden border-round-lg border-1 border-300">
          <img 
            :src="fileInfo.url" 
            :alt="fileInfo.name"
            class="w-full h-full"
          />
        </div>
        <!-- Icono para documentos -->
        <div v-else class="file-uploader__file-icon flex-shrink-0 flex align-items-center justify-content-center border-round-lg border-1 border-300">
          <i :class="fileTypeIcon" class="file-uploader__type-icon"></i>
        </div>
        
        <div class="flex flex-column flex-1 min-w-0">
          <div class="font-semibold text-color file-uploader__filename">{{ fileInfo.name }}</div>
          <div class="text-color-secondary text-sm">{{ fileInfo.size }}</div>
        </div>
        <div class="flex align-items-center gap-2 sm:ml-auto" v-if="!disabled">
          <button 
            type="button" 
            class="file-uploader__action-link"
            @click.stop="openFileDialog"
            :aria-label="`${changeText} archivo ${fileInfo.name}`"
          >
            {{ changeText }}
          </button>
          <span class="file-uploader__separator">·</span>
          <button 
            type="button" 
            class="file-uploader__action-link file-uploader__action-link--danger"
            @click.stop="removeFile"
            :aria-label="`${removeText} archivo ${fileInfo.name}`"
          >
            {{ removeText }}
          </button>
        </div>
      </div>

      <!-- Input nativo oculto -->
      <input
        ref="fileInput"
        :id="inputId"
        type="file"
        class="file-uploader__input"
        :accept="acceptAttribute"
        :disabled="disabled"
        @change="onInputChange"
      />
    </div>
  </div>
</template>

<style scoped>
/* ── Input nativo oculto ──────────────────────────────────── */
.file-uploader__input {
    display: none;
}

/* ── Dropzone base ────────────────────────────────────────── */
.file-uploader__dropzone {
    border: 2px dashed #d1d5db;
    border-radius: 10px;
    padding: 1.5rem 1.25rem;
    background-color: #f9fafb;
    transition: border-color 0.2s, background-color 0.2s;
    outline: none;
    min-height: 110px;
}

.file-uploader__dropzone:focus-visible {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* Hover (solo cuando no está lleno ni deshabilitado) */
.file-uploader__dropzone:not(.file-uploader__dropzone--filled):not(.file-uploader__dropzone--disabled):hover {
    border-color: #3b82f6;
    background-color: #eff6ff;
}

/* Arrastrando encima */
.file-uploader__dropzone--drag-over {
    border-color: #3b82f6 !important;
    background-color: #dbeafe !important;
}

/* Con archivo seleccionado */
.file-uploader__dropzone--filled {
    border-style: solid;
    border-color: #d1d5db;
    background-color: #ffffff;
    cursor: default;
}

/* Deshabilitado */
.file-uploader__dropzone--disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* ── Estado vacío ─────────────────────────────────────────── */
.file-uploader__icon {
    font-size: 2rem;
    color: #9ca3af;
}

.file-uploader__cta {
    font-size: 0.875rem;
}

.file-uploader__link {
    color: #3b82f6;
    text-decoration: underline;
    text-underline-offset: 2px;
}

.file-uploader__muted {
    color: #6b7280;
}

.file-uploader__hint {
    color: #9ca3af;
}

/* ── Estado con archivo ───────────────────────────────────── */
.file-uploader__preview {
    width: 64px;
    height: 64px;
    background-color: #f3f4f6;
}

.file-uploader__file-icon {
    width: 48px;
    height: 48px;
    background-color: #f3f4f6;
}

.file-uploader__type-icon {
    font-size: 1.5rem;
    color: #6b7280;
}

.file-uploader__filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

/* ── Links de acción (Cambiar / Eliminar) ─────────────────── */
.file-uploader__action-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    color: #3b82f6;
    transition: color 0.15s;
}

.file-uploader__action-link:hover {
    color: #1d4ed8;
}

.file-uploader__action-link--danger {
    color: #ef4444;
}

.file-uploader__action-link--danger:hover {
    color: #b91c1c;
}

.file-uploader__separator {
    color: #d1d5db;
    font-size: 0.8rem;
}
</style>
