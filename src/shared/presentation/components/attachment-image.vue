<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { StorageFilesApi } from '@/stays/infrastructure/api/storage-files.api.js'

const PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' fill='%23e5e7eb'/%3E%3Ctext x='120' y='85' text-anchor='middle' fill='%236b7280' font-size='14' font-family='Arial'%3ESin vista previa%3C/text%3E%3C/svg%3E"

const api = new StorageFilesApi()

const props = defineProps({
  attachment: { type: Object, required: true },
  alt:        { type: String, default: '' },
  imgClass:   { type: String, default: '' },
})

const emit = defineEmits(['error'])

const src      = ref('')
const loading  = ref(false)
const failed   = ref(false)
let objectUrl  = null

function revokeObjectUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

async function load(attachment) {
  revokeObjectUrl()
  src.value = ''
  failed.value = false

  const fileId = attachment?.id
  if (!fileId) {
    failed.value = true
    return
  }

  loading.value = true
  try {
    const res = await api.getFileContent(fileId)
    if (!res?.data || res.data.size === 0) {
      throw new Error('Empty file content')
    }
    objectUrl = URL.createObjectURL(res.data)
    src.value = objectUrl
  } catch (err) {
    failed.value = true
    emit('error', err)
  } finally {
    loading.value = false
  }
}

function onImgError(event) {
  failed.value = true
  if (event?.target) {
    event.target.src = PLACEHOLDER_SRC
  }
  emit('error', event)
}

watch(() => props.attachment?.id, () => load(props.attachment), { immediate: true })

onUnmounted(() => {
  revokeObjectUrl()
})
</script>

<template>
  <div class="attachment-image-wrapper" :class="imgClass">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      v-bind="$attrs"
      @error="onImgError"
    />
    <img
      v-else-if="failed"
      :src="PLACEHOLDER_SRC"
      :alt="alt"
      class="attachment-image-wrapper__fallback"
      v-bind="$attrs"
    />
    <div v-else-if="loading" class="attachment-image-wrapper__placeholder attachment-image-wrapper__placeholder--loading" />
    <div v-else class="attachment-image-wrapper__placeholder" />
  </div>
</template>

<style scoped>
.attachment-image-wrapper {
  display: contents;
}
.attachment-image-wrapper__placeholder,
.attachment-image-wrapper__fallback {
  width: 100%;
  aspect-ratio: 4/3;
  background: #e5e7eb;
  border-radius: 4px;
  object-fit: contain;
}
.attachment-image-wrapper__placeholder--loading {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
