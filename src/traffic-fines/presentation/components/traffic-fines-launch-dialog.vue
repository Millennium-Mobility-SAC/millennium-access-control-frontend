<script setup>
/**
 * Confirmación antes de lanzar la consulta.
 *
 * Existe porque la operación no es gratuita ni instantánea: cada consulta a SAT Lima gasta saldo
 * de CapSolver y el servicio procesa las placas de una en una. El usuario tiene que ver cuántas
 * unidades entran de verdad y cuántas se van a omitir **antes** de confirmar.
 */
import { computed, ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { TRAFFIC_FINE_ISSUERS } from '../../domain/format-issuer-label.js'
import { MAX_VEHICLES_PER_BATCH } from '../constants/traffic-fines-ui.constants.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Unidades seleccionadas en la tabla, tal cual. Aquí se separan las consultables. */
  selected: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirmed'])

const issuers = ref(TRAFFIC_FINE_ISSUERS.map((issuer) => issuer.value))

const consultable = computed(() => props.selected.filter((item) => item.consultable))
const notConsultable = computed(() => props.selected.filter((item) => !item.consultable))

const exceedsLimit = computed(() => consultable.value.length > MAX_VEHICLES_PER_BATCH)

const canConfirm = computed(
  () => consultable.value.length > 0 && issuers.value.length > 0 && !exceedsLimit.value,
)

/**
 * Duración aproximada del lote.
 *
 * Es una estimación deliberadamente conservadora, no una promesa: el servicio corre con un solo
 * worker y cada placa tarda decenas de segundos entre captcha y navegación. El plazo real lo
 * devuelve el backend al aceptar el lote.
 */
const estimatedMinutes = computed(() => {
  const queries = consultable.value.length * issuers.value.length
  return Math.max(1, Math.ceil((queries * 40) / 60))
})

watch(
  () => props.visible,
  (open) => {
    if (open) issuers.value = TRAFFIC_FINE_ISSUERS.map((issuer) => issuer.value)
  },
)

function confirm() {
  if (!canConfirm.value) return
  emit('confirmed', {
    vehicleIds: consultable.value.map((item) => item.vehicleId),
    issuers: [...issuers.value],
  })
}
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    entity-name="consulta"
    header-title-override="Consultar papeletas"
    custom-button-label="Consultar"
    size="standard"
    :submit-loading="loading"
    :submit-disabled="!canConfirm"
    @canceled-shared="emit('update:visible', false)"
    @saved-shared="confirm"
  >
    <template #content>
      <div class="flex flex-column gap-3">
        <div>
          <label class="block text-sm font-medium mb-2">Portales a consultar</label>
          <div class="flex flex-wrap gap-3">
            <div v-for="issuer in TRAFFIC_FINE_ISSUERS" :key="issuer.value" class="flex align-items-center gap-2">
              <pv-checkbox
                v-model="issuers"
                :input-id="`tf-issuer-${issuer.value}`"
                :value="issuer.value"
              />
              <label :for="`tf-issuer-${issuer.value}`">{{ issuer.label }}</label>
            </div>
          </div>
          <small v-if="!issuers.length" class="text-red-500">Selecciona al menos un portal.</small>
        </div>

        <pv-message severity="info" :closable="false">
          Se consultarán <strong>{{ consultable.length }}</strong>
          {{ consultable.length === 1 ? 'unidad' : 'unidades' }}
          en {{ issuers.length }} {{ issuers.length === 1 ? 'portal' : 'portales' }}.
          Duración estimada: <strong>~{{ estimatedMinutes }} min</strong>.
        </pv-message>

        <pv-message v-if="exceedsLimit" severity="error" :closable="false">
          El máximo por lote es de {{ MAX_VEHICLES_PER_BATCH }} unidades y seleccionaste
          {{ consultable.length }}. El servicio procesa las placas de una en una y un lote mayor
          tardaría horas.
        </pv-message>

        <pv-message v-if="notConsultable.length" severity="warn" :closable="false">
          {{ notConsultable.length }}
          {{ notConsultable.length === 1 ? 'unidad no se consultará' : 'unidades no se consultarán' }}
          porque no tienen una placa consultable:
          <span class="font-medium">
            {{ notConsultable.map((item) => item.licensePlate || item.vin || `#${item.vehicleId}`).join(', ') }}
          </span>
        </pv-message>

        <pv-message severity="warn" :closable="false">
          Cada consulta a SAT Lima resuelve un captcha de pago. Evita repetirla el mismo día si no
          esperas cambios.
        </pv-message>
      </div>
    </template>
  </CreateAndEdit>
</template>
