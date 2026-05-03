import {createRouter, createWebHistory} from "vue-router";
import iamRoutes             from "../iam/presentation/iam.routes.js";
import staysRoutes           from "../stays/presentation/stays.routes.js";
import staffManagementRoutes from "../staff-management/presentation/staff-management.routes.js";
import vehicleCatalogRoutes  from "../vehicle-catalog/presentation/vehicle-catalog.routes.js";
import employeeManagementRoutes from "../employee-management/presentation/employee-management.routes.js";
import securityCheckpointRoutes from "../security-checkpoint/presentation/security-checkpoint.routes.js";
import whatsAppManagementRoutes from "../whatsapp-management/presentation/whatsapp-management.routes.js";
import { authenticationGuard } from "../iam/presentation/guards/authentication.guard.js";

import layout from '../public/presentation/views/layout.vue';

const routes = [

    {
        path: '/',
        redirect: '/sign-in'
    },

    // IAM Routes (public – no layout wrapper)
    ...iamRoutes,

    {
        path: '/stays',
        component: layout,
        children: staysRoutes,
        meta: { title: 'Control de Acceso' },
    },
    {
        path: '/staff-management',
        component: layout,
        children: staffManagementRoutes,
        meta: { title: 'Colaboradores' },
    },
    {
        path: '/vehicle-catalog',
        component: layout,
        children: vehicleCatalogRoutes,
        meta: { title: 'Catálogo de Vehículos' },
    },
    {
        path: '/employee-management',
        component: layout,
        children: employeeManagementRoutes,
        meta: { title: 'Empleados' },
    },
    {
        path: '/security-checkpoint',
        component: layout,
        children: securityCheckpointRoutes,
        meta: { title: 'Marcación personal' },
    },
    {
        path: '/whatsapp-management',
        component: layout,
        children: whatsAppManagementRoutes,
        meta: { title: 'Servicio WhatsApp' },
    },

];

const router = createRouter({
    history: createWebHistory (),
    routes: routes
});


router.beforeEach((to, from) => {
    let baseTitle = 'Millennium';
    document.title = to.meta.title ? `${baseTitle} | ${to.meta.title}` : baseTitle;
    return authenticationGuard(to, from);
});

export default router;