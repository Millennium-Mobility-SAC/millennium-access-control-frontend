const VehicleCatalogView       = () => import('./views/vehicle-catalog-view.vue')
const VehicleAccessHistoryView = () => import('./views/vehicle-access-history-view.vue')

export const VEHICLE_CATALOG_ROUTES = {
  VEHICLE_CATALOG: '/vehicle-catalog',
  VEHICLE_HISTORY: '/vehicle-catalog/:vehicleId/history',
}

/** Nombres de ruta para `router.push` (mismo patrón que `EMPLOYEE_ROUTE_NAMES`). */
export const VEHICLE_ROUTE_NAMES = {
  CATALOG: 'vehicle-catalog',
  ACCESS_HISTORY: 'vehicle-access-history',
}

const vehicleCatalogRoutes = [
  {
    path: VEHICLE_CATALOG_ROUTES.VEHICLE_CATALOG,
    name: 'vehicle-catalog',
    component: VehicleCatalogView,
    meta: {
      title: 'Catálogo de Vehículos',
      module: 'Catálogo de Vehículos',
      description: 'Registro de vehículos para autocompletado en accesos',
      showBackButton: false,
    },
  },
  {
    path: VEHICLE_CATALOG_ROUTES.VEHICLE_HISTORY,
    name: 'vehicle-access-history',
    component: VehicleAccessHistoryView,
    meta: {
      title: 'Detalle del Vehículo',
      module: 'Detalle del Vehículo',
      description: 'Historial de ingresos y movimientos en planta',
      showBackButton: true,
    },
  },
]

export default vehicleCatalogRoutes
