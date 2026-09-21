import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { TrafficFinesInventoryApi } from '../infrastructure/api/traffic-fines-inventory.api.js'
import { TrafficFineInventoryAssembler } from '../infrastructure/assemblers/traffic-fine-inventory.assembler.js'

/**
 * Inventario de unidades a consultar: importación del Excel de contratos, su historial y la
 * corrección manual de una unidad. El listado vive en `useTrafficFinesStore`, junto con la deuda.
 */
export const useTrafficFinesInventoryStore = defineStore('traffic-fines-inventory', () => {
  const api = new TrafficFinesInventoryApi()

  const _imports = ref([])
  const _facets = ref({ advisors: [], commercialBrands: [] })

  const imports = computed(() => _imports.value)
  const facets = computed(() => _facets.value)

  // ── Importación ────────────────────────────────────────────────────────────

  /** Lee el archivo y lo compara con el inventario. No escribe nada. */
  async function previewImport(file) {
    const { data } = await api.previewImport(file)
    return TrafficFineInventoryAssembler.toImportResultFromResource(data)
  }

  /**
   * Aplica la importación del mismo archivo que se previsualizó. La tabla la recarga quien
   * escucha el evento `imported` del diálogo. Si el historial no se puede recargar, la
   * importación igual se aplicó: no se convierte en error.
   */
  async function applyImport(file, expectedHash) {
    const { data } = await api.applyImport(file, expectedHash)
    const result = TrafficFineInventoryAssembler.toImportResultFromResource(data)
    await fetchImports().catch(() => {})
    return result
  }

  async function fetchImports(limit = 20) {
    const { data } = await api.getImports(limit)
    _imports.value = (Array.isArray(data) ? data : [])
      .map((r) => TrafficFineInventoryAssembler.toImportFromResource(r))
    return _imports.value
  }

  /** Asesores y marcas comerciales del inventario, para los filtros exactos. */
  async function fetchFacets() {
    const { data } = await api.getFacets()
    _facets.value = {
      advisors: data?.advisors ?? [],
      commercialBrands: data?.commercial_brands ?? [],
    }
    return _facets.value
  }

  // ── Corrección manual ──────────────────────────────────────────────────────

  async function updateUnit(unitId, contract) {
    const { data } = await api.updateUnit(unitId, contract)
    return TrafficFineInventoryAssembler.toUnitFromResource(data)
  }

  return {
    imports,
    facets,
    fetchFacets,
    previewImport,
    applyImport,
    fetchImports,
    updateUnit,
  }
})
