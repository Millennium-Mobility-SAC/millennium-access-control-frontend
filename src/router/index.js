import {createRouter, createWebHistory} from "vue-router";
import iamRoutes             from "../iam/presentation/iam.routes.js";
import staysRoutes           from "../stays/presentation/stays.routes.js";
import staffManagementRoutes from "../staff-management/presentation/staff-management.routes.js";
import vehicleCatalogRoutes  from "../vehicle-catalog/presentation/vehicle-catalog.routes.js";
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