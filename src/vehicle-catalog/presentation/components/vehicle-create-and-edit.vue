<script setup>
import { reactive, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  edit:    { type: Boolean, default: false },
  entity:  { type: Object,  default: null  },
})

const emit = defineEmits(['canceled-shared', 'saved-shared'])

const form = reactive({
  id:           null,
  licensePlate: '',
  brand:        '',
  model:        '',
  year:         null,
  color:        '',
})

watch(() => props.visible, (val) => {
  if (!val) return
  const src = props.entity ?? {}
  Object.assign(form, {
    id:           src.id           ?? null,
    licensePlate: src.licensePlate ?? '',
    brand:        src.brand        ?? '',
    model:        src.model        ?? '',
    year:         src.year         ?? null,
    color:        src.color        ?? '',
  })
})
</script>

<template>
  <CreateAndEdit
    :entity="form"
    :visible="visible"
    entity-name="Vehículo"
    :edit="edit"
    size="standard"
    @canceled-shared="emit('canceled-shared')"
    @saved-shared="emit('saved-shared', $event)"
  >
    <template #content>
      <div class="vce-form">

        <!-- Identificación -->
        <div class="vce-section">
          <div class="vce-section-header">
            <i class="pi pi-car vce-section-icon" />
            <span>Identificación</span>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex vce-field--highlight">
              <label class="vce-label">Placa</label>
              <pv-input-text
                v-model="form.licensePlate"
                placeholder="Ej. ABC-123"
                class="w-full vce-input-plate"
              />
            </div>
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Color</label>
              <pv-input-text v-model="form.color" placeholder="Ej. Blanco" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Datos del vehículo -->
        <div class="vce-section">
          <div class="vce-section-header">
            <i class="pi pi-info-circle vce-section-icon" />
            <span>Datos del vehículo</span>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Marca</label>
              <pv-input-text v-model="form.brand" placeholder="Ej. Toyota" class="w-full" />
            </div>
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Modelo</label>
              <pv-input-text v-model="form.model" placeholder="Ej. Corolla" class="w-full" />
            </div>
          </div>
          <div class="vce-row">
            <div class="vce-field vce-field--flex">
              <label class="vce-label">Año</label>
              <pv-input-number
                v-model="form.year"
                :use-grouping="false"
                :min="1900"
                :max="2100"
                placeholder="2022"
                class="w-full"
              />
            </div>
          </div>
        </div>

      </div>
    </template>
  </CreateAndEdit>
</template>

<style>
.vce-form { display: flex; flex-direction: column; }

.vce-section {
  padding: 0.75rem 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.vce-section:last-child { border-bottom: none; padding-bottom: 0.25rem; }

.vce-section-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.875rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7280;
}
.vce-section-icon { font-size: 0.75rem; color: #1A6BC2; }

.vce-row {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.vce-row:last-child { margin-bottom: 0; }

.vce-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.vce-field--flex { flex: 1; }

.vce-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
.vce-label-opt { font-weight: 400; color: #9ca3af; font-size: 0.75rem; margin-left: 0.25rem; }

.vce-input-plate { font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
</style>
