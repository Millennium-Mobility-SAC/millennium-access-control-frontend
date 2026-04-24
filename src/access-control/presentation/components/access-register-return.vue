<script setup>
import { reactive, watch, onUnmounted } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
})

const emit = defineEmits(['canceled', 'saved'])

// ── Helpers ────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }

function nowTimeString() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function to12h(value) {
  if (!value) return ''
  const parts = value.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  const s = parts[2] !== undefined ? Number(parts[2]) : null
  if (isNaN(h) || isNaN(m)) return ''
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h % 12 === 0 ? 12 : h % 12
  const base   = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return s !== null && !isNaN(s)
    ? `${base}:${String(s).padStart(2, '0')} ${period}`
    : `${base} ${period}`
}

// ── Live clock ─────────────────────────────────────────────
let clockInterval = null

function startClock() {
  clearInterval(clockInterval)
  clockInterval = setInterval(() => { form.returnTime = to12h(nowTimeString()) }, 1000)
}

function stopClock() {
  clearInterval(clockInterval)
  clockInterval = null
}

onUnmounted(() => stopClock())

// ── Form state ─────────────────────────────────────────────
const form = reactive({
  id:           null,
  licensePlate: null,
  brand:        null,
  model:        null,
  year:         null,
  color:        null,
  returnDate:   null,
  returnTime:   '',
})

watch(() => props.visible, (val) => {
  if (!val) { stopClock(); return }

  const src = props.entity ?? {}

  Object.assign(form, {
    id:           src.id           ?? null,
    licensePlate: src.licensePlate ?? null,
    brand:        src.brand        ?? null,
    model:        src.model        ?? null,
    year:         src.year         ?? null,
    color:        src.color        ?? null,
    returnDate:   new Date(),
    returnTime:   to12h(nowTimeString()),
  })

  startClock()
})

function onCanceled() {
  stopClock()
  emit('canceled')
}

function onSaved(formData) {
  stopClock()
  emit('saved', { ...formData })
}
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Registro de Retorno"
    :edit="false"
    size="standard"
    custom-button-label="Registrar retorno"
    @canceled-shared="onCanceled"
    @saved-shared="onSaved($event)"
  >
    <template #content>
      <div class="ace-form">

        <!-- ── 1. Vehículo (informativo, read-only) ── -->
        <div class="ace-section">
          <div class="ace-section-header">
            <i class="pi pi-car ace-section-icon" />
            <span>Vehículo</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Placa</label>
              <pv-input-text :model-value="form.licensePlate || '—'" class="w-full" :disabled="true" />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Color</label>
              <pv-input-text :model-value="form.color || '—'" class="w-full" :disabled="true" />
            </div>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Marca</label>
              <pv-input-text :model-value="form.brand || '—'" class="w-full" :disabled="true" />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Modelo</label>
              <pv-input-text :model-value="form.model || '—'" class="w-full" :disabled="true" />
            </div>
          </div>
        </div>

        <!-- ── 2. Fecha y hora de retorno ── -->
        <div class="ace-section" style="border-bottom: none;">
          <div class="ace-section-header">
            <i class="pi pi-calendar ace-section-icon" />
            <span>Fecha y hora de retorno</span>
          </div>
          <div class="ace-row">
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Fecha</label>
              <pv-calendar
                v-model="form.returnDate"
                date-format="dd/mm/yy"
                show-icon
                icon-display="input"
                placeholder="dd/mm/aaaa"
                class="w-full"
                :disabled="true"
              />
            </div>
            <div class="ace-field ace-field--flex">
              <label class="ace-label">Hora</label>
              <pv-input-text
                :model-value="form.returnTime"
                class="w-full"
                :disabled="true"
              />
            </div>
          </div>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>
