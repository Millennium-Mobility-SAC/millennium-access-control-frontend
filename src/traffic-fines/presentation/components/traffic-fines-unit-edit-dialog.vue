<script setup>
/**
 * Corrección manual del contrato de una unidad.
 *
 * Volver a subir el Excel solo agrega placas nuevas, así que el estado y las fechas de una unidad
 * que ya está en el inventario se corrigen aquí. Al guardar, el backend reclasifica sus papeletas
 * dentro o fuera del periodo en el acto.
 */
import { computed, ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { useTrafficFinesInventoryStore } from '../../application/traffic-fines-inventory.store.js'
import { CONTRACT_STATUSES } from '../../domain/format-contract-status.js'
import { toIsoDateString } from '@/shared/domain/employee-attendance-day.js'
import { formatCalendarDateForUi } from '@/shared/domain/format-datetime-ui.js'
import { humanizeApiError } from '@/shared/infrustructure/api-error-humanizer.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Fila del resumen (`TrafficFineSummary`) o unidad del detalle (`TrafficFineUnit`). */
  unit: { type: Object, default: null },
})

const emit = defineEmits(['update:visible', 'saved'])

const store = useTrafficFinesInventoryStore()

const contractStatus = ref(null)
const contractStart = ref(null)
const contractEnd = ref(null)
const resolutionDate = ref(null)
const saving = ref(false)
const errorMessage = ref(null)

/**
 * `YYYY-MM-DD` a `Date` local a medianoche. `new Date('YYYY-MM-DD')` lo interpretaría en UTC y en
 * Lima el calendario mostraría el día anterior.
 */
function toLocalDate(value) {
  const iso = toIsoDateString(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    contractStatus.value = props.unit?.contractStatus ?? null
    contractStart.value = toLocalDate(props.unit?.contractStart)
    contractEnd.value = toLocalDate(props.unit?.contractEnd)
    resolutionDate.value = toLocalDate(props.unit?.resolutionDate)
    errorMessage.value = null
  },
)

const endBeforeStart = computed(
  () => !!contractStart.value && !!contractEnd.value && contractEnd.value < contractStart.value,
)
const resolutionBeforeStart = computed(
  () => !!contractStart.value && !!resolutionDate.value && resolutionDate.value < contractStart.value,
)

const canSave = computed(
  () => !!contractStatus.value && !endBeforeStart.value && !resolutionBeforeStart.value && !saving.value,
)

/** El periodo que va a quedar, en palabras: es lo que decide qué papeletas suman. */
const periodPreview = computed(() => {
  const start = contractStart.value ? formatCalendarDateForUi(toIsoDateString(contractStart.value)) : 'sin inicio'
  const endDate = resolutionDate.value ?? contractEnd.value
  const end = endDate ? formatCalendarDateForUi(toIsoDateString(endDate)) : 'sin fin'
  const byResolution = resolutionDate.value ? ' (termina en la resolución)' : ''
  return `${start} → ${end}${byResolution}`
})

async function save() {
  if (!canSave.value || !props.unit) return
  saving.value = true
  errorMessage.value = null
  try {
    const updated = await store.updateUnit(props.unit.unitId ?? props.unit.id, {
      contractStatus: contractStatus.value,
      contractStart: toIsoDateString(contractStart.value),
      contractEnd: toIsoDateString(contractEnd.value),
      resolutionDate: toIsoDateString(resolutionDate.value),
    })
    emit('saved', updated)
    emit('update:visible', false)
  } catch (error) {
    const message = error?.response?.data?.message
    errorMessage.value = typeof message === 'string' && message.trim() ? message : humanizeApiError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    entity-name="contrato"
    :header-title-override="unit ? `Contrato de ${unit.licensePlate}` : 'Contrato'"
    custom-button-label="Guardar"
    size="standard"
    :submit-loading="saving"
    :submit-disabled="!canSave"
    @canceled-shared="emit('update:visible', false)"
    @saved-shared="save"
  >
    <template #content>
      <div class="tfu-form">
        <div class="tfu-field tfu-field--wide">
          <label for="tfu-status" class="tfu-label">Estado del contrato</label>
          <pv-select
            v-model="contractStatus"
            input-id="tfu-status"
            :options="CONTRACT_STATUSES"
            option-label="label"
            option-value="value"
            placeholder="Selecciona"
            class="w-full"
          />
        </div>

        <div class="tfu-field">
          <label for="tfu-start" class="tfu-label">Inicio de contrato</label>
          <pv-calendar
            v-model="contractStart"
            input-id="tfu-start"
            date-format="dd/mm/yy"
            show-icon
            icon-display="input"
            show-button-bar
            class="w-full"
          />
        </div>

        <div class="tfu-field">
          <label for="tfu-end" class="tfu-label">Fin de contrato</label>
          <pv-calendar
            v-model="contractEnd"
            input-id="tfu-end"
            date-format="dd/mm/yy"
            show-icon
            icon-display="input"
            show-button-bar
            class="w-full"
            :invalid="endBeforeStart"
          />
          <small v-if="endBeforeStart" class="text-red-500">Es anterior al inicio.</small>
        </div>

        <div class="tfu-field">
          <label for="tfu-resolution" class="tfu-label">Fecha de resolución</label>
          <pv-calendar
            v-model="resolutionDate"
            input-id="tfu-resolution"
            date-format="dd/mm/yy"
            show-icon
            icon-display="input"
            show-button-bar
            class="w-full"
            :invalid="resolutionBeforeStart"
          />
          <small v-if="resolutionBeforeStart" class="text-red-500">Es anterior al inicio.</small>
        </div>

        <pv-message severity="info" :closable="false" class="tfu-field--wide">
          Periodo del contrato: <strong>{{ periodPreview }}</strong>. Solo suman las papeletas con
          fecha dentro de este periodo; si hay resolución, el periodo termina en ella.
        </pv-message>

        <pv-message v-if="errorMessage" severity="error" :closable="false" class="tfu-field--wide">
          {{ errorMessage }}
        </pv-message>
      </div>
    </template>
  </CreateAndEdit>
</template>

<style scoped>
.tfu-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem 1rem;
}

.tfu-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.tfu-field--wide {
  grid-column: 1 / -1;
}

.tfu-label {
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
