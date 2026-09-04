const TrafficFinesView = () => import('./views/traffic-fines-view.vue')
const TrafficFineDetailView = () => import('./views/traffic-fine-detail-view.vue')

export const TRAFFIC_FINES_ROUTES = {
  TRAFFIC_FINES: '/traffic-fines',
  TRAFFIC_FINE_DETAIL: '/traffic-fines/:vehicleId',
}

/** Nombres de ruta para `router.push` (mismo patrón que `VEHICLE_ROUTE_NAMES`). */
export const TRAFFIC_FINE_ROUTE_NAMES = {
  SUMMARY: 'traffic-fines',
  DETAIL: 'traffic-fine-detail',
}

const trafficFinesRoutes = [
  {
    path: TRAFFIC_FINES_ROUTES.TRAFFIC_FINES,
    name: TRAFFIC_FINE_ROUTE_NAMES.SUMMARY,
    component: TrafficFinesView,
    meta: {
      title: 'Papeletas',
      module: 'Papeletas',
      description: 'Deuda de papeletas de tránsito por unidad',
      showBackButton: false,
    },
  },
  {
    path: TRAFFIC_FINES_ROUTES.TRAFFIC_FINE_DETAIL,
    name: TRAFFIC_FINE_ROUTE_NAMES.DETAIL,
    component: TrafficFineDetailView,
    meta: {
      title: 'Papeletas de la unidad',
      module: 'Papeletas de la unidad',
      description: 'Papeletas registradas y última consulta por portal',
      showBackButton: true,
    },
  },
]

export default trafficFinesRoutes
