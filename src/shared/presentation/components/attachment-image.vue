<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { StorageFilesApi } from '@/stays/infrastructure/api/storage-files.api.js'

const api = new StorageFilesApi()

const props = defineProps({
  attachment: { type: Object, required: true },
  alt:        { type: String, default: '' },
  imgClass:   { type: String, default: '' },
})

const emit = defineEmits(['error'])

const src      = ref('')
const loading  = ref(false)
let objectUrl  = null

async function load(attachment) {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
  src.value = ''
  const fileId = attachment?.id
  if (!fileId) return
  loading.value = true
  try {
    const res = await api.getFileContent(fileId)
    objectUrl = URL.createObjectURL(res.data)
    src.value = objectUrl
  } catch {
    emit('error')
  } finally {
    loading.value = false
  }
}

watch(() => props.attachment?.id, () => load(props.attachment), { immediate: true })

onUnmounted(() => {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
})
</script>

<template>
  <div class="attachment-image-wrapper" :class="imgClass">
    <img
      v-if="src"
      :src="src"
      :alt="alt"
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
.attachment-image-wrapper__placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  background: #e5e7eb;
  border-radius: 4px;
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
