const EmployeeManagementView = () => import('./views/employee-management-view.vue')
const EmployeeDetailView = () => import('./views/employee-detail-view.vue')

export const EMPLOYEE_MANAGEMENT_ROUTES = {
  EMPLOYEE_MANAGEMENT: '/employee-management',
  EMPLOYEE_DETAIL: '/employee-management/:id',
}

export const EMPLOYEE_ROUTE_NAMES = {
  LIST: 'employee-management',
  DETAIL: 'employee-detail',
}

const employeeManagementRoutes = [
  {
    path: EMPLOYEE_MANAGEMENT_ROUTES.EMPLOYEE_MANAGEMENT,
    name: EMPLOYEE_ROUTE_NAMES.LIST,
    component: EmployeeManagementView,
    meta: {
      title: 'Empleados',
      module: 'Empleados',
      description: 'Gestión de empleados internos y asistencia',
      showBackButton: false,
    },
  },
  {
    path: EMPLOYEE_MANAGEMENT_ROUTES.EMPLOYEE_DETAIL,
    name: EMPLOYEE_ROUTE_NAMES.DETAIL,
    component: EmployeeDetailView,
    meta: {
      title: 'Detalle de empleado',
      module: 'Empleados',
      description: 'Datos del empleado e historial de asistencia',
      showBackButton: true,
    },
  },
]

export default employeeManagementRoutes

