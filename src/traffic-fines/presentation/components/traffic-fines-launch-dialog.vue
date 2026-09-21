<script setup>
/**
 * Confirmación antes de consultar Callao y ATU.
 *
 * Existe porque la operación no es gratuita ni instantánea: cada consulta resuelve un captcha de
 * pago y el servicio procesa las placas de una en una. El usuario tiene que ver qué se va a
 * consultar **antes** de confirmar.
 *
 * Dos modos: las unidades seleccionadas en la tabla, o «todas», en cuyo caso el backend elige las
 * activas y las de periodo recién terminado, empezando por las que llevan más tiempo sin
 * consultarse, hasta el tope por lote.
 */
import { computed, ref, watch } from 'vue'
import CreateAndEdit from '@/shared/presentation/components/create-and-edit.vue'
import { PER_PLATE_ISSUERS } from '../../domain/format-issuer-label.js'
import {
  ESTIMATED_SECONDS_PER_QUERY,
  MAX_UNITS_PER_BATCH,
  RECENTLY_ENDED_DAYS,
} from '../constants/traffic-fines-ui.constants.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** `selected`: las unidades elegidas en la tabla. `all`: las que elija el backend. */
  mode: { type: String, default: 'selected', validator: (value) => ['selected', 'all'].includes(value) },
  /** Unidades seleccionadas en la tabla (solo en modo `selected`). */
  selected: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirmed'])

const issuers = ref(PER_PLATE_ISSUERS.map((issuer) => issuer.value))

const isAll = computed(() => props.mode === 'all')
const onlyAtu = computed(() => issuers.value.length === 1 && issuers.value[0] === 'ATU')

/** Las motos solo se consultan en Callao: con solo ATU marcado, se omiten. */
const motos = computed(() => props.selected.filter((item) => item.isMoto))
const skippedMotos = computed(() => (onlyAtu.value ? motos.value : []))
const consultable = computed(() => props.selected.filter((item) => !skippedMotos.value.includes(item)))

const exceedsLimit = computed(() => !isAll.value && props.selected.length > MAX_UNITS_PER_BATCH)

const canConfirm = computed(() => {
  if (!issuers.value.length) return false
  if (isAll.value) return true
  return consultable.value.length > 0 && !exceedsLimit.value
})

/**
 * Duración aproximada. Es una estimación conservadora, no una promesa: el plazo real lo devuelve
 * el backend al aceptar el lote.
 */
const estimate = computed(() => {
  if (isAll.value) return null
  const queries = consultable.value.reduce(
    (total, item) => total + (item.isMoto ? issuers.value.filter((issuer) => issuer === 'CALLAO').length : issuers.value.length),
    0,
  )
  const minutes = Math.max(1, Math.ceil((queries * ESTIMATED_SECONDS_PER_QUERY) / 60))
  return minutes < 90 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`
})

watch(
  () => props.visible,
  (open) => {
    if (open) issuers.value = PER_PLATE_ISSUERS.map((issuer) => issuer.value)
  },
)

function confirm() {
  if (!canConfirm.value) return
  emit('confirmed', {
    unitIds: isAll.value ? [] : consultable.value.map((item) => item.unitId),
    all: isAll.value,
    issuers: [...issuers.value],
  })
}
</script>

<template>
  <CreateAndEdit
    :visible="visible"
    entity-name="consulta"
    :header-title-override="isAll ? 'Consultar todas las unidades' : 'Consultar papeletas'"
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
            <div v-for="issuer in PER_PLATE_ISSUERS" :key="issuer.value" class="flex align-items-center gap-2">
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

        <pv-message v-if="isAll" severity="info" :closable="false">
          Se consultarán hasta <strong>{{ MAX_UNITS_PER_BATCH }}</strong> unidades: las de contrato
          activo y las que terminaron su periodo en los últimos {{ RECENTLY_ENDED_DAYS }} días,
          empezando por las que llevan más tiempo sin consultarse. Si hay más, el resto entra la
          próxima vez que pulses «Consultar todas».
        </pv-message>
        <pv-message v-else severity="info" :closable="false">
          Se consultarán <strong>{{ consultable.length }}</strong>
          {{ consultable.length === 1 ? 'unidad' : 'unidades' }}.
          Duración estimada: <strong>{{ estimate }}</strong>.
        </pv-message>

        <pv-message v-if="exceedsLimit" severity="error" :closable="false">
          El máximo por lote es de {{ MAX_UNITS_PER_BATCH }} unidades y seleccionaste
          {{ selected.length }}. Usa «Consultar todas» para recorrer el inventario por turnos.
        </pv-message>

        <pv-message v-if="skippedMotos.length" severity="warn" :closable="false">
          {{ skippedMotos.length }}
          {{ skippedMotos.length === 1 ? 'moto no se consultará' : 'motos no se consultarán' }}:
          las motos solo tienen papeletas de Callao.
        </pv-message>
        <pv-message v-else-if="motos.length" severity="secondary" :closable="false">
          {{ motos.length }} {{ motos.length === 1 ? 'moto se consultará' : 'motos se consultarán' }}
          solo en Callao.
        </pv-message>

        <pv-message severity="secondary" :closable="false">
          SAT Lima no se consulta aquí: se actualiza para toda la flota por el RUC de la empresa con
          «Actualizar SAT».
        </pv-message>
      </div>
    </template>
  </CreateAndEdit>
</template>
