const SecurityCheckpointView = () => import('./views/security-checkpoint-view.vue')

export const SECURITY_CHECKPOINT_ROUTES = {
  SECURITY_CHECKPOINT: '/security-checkpoint',
}

const securityCheckpointRoutes = [
  {
    path: SECURITY_CHECKPOINT_ROUTES.SECURITY_CHECKPOINT,
    name: 'security-checkpoint',
    component: SecurityCheckpointView,
    meta: {
      module: 'Marcación personal',
      description: 'Historial de marcación, filtros y registro de ingreso o salida por documento',
      showBackButton: false,
    },
  },
]

export default securityCheckpointRoutes
