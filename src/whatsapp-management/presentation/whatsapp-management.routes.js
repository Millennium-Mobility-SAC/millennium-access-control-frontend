const whatsAppManagementView = () => import('./views/whatsapp-management-view.vue')

const whatsAppManagementRoutes = [
    {
        path: '',
        name: 'whatsapp-management',
        component: whatsAppManagementView,
        meta: {
            title: 'Servicio WhatsApp',
            module: 'WhatsApp',
            description: 'Gestión del bot de notificaciones'
        }
    }
]

export default whatsAppManagementRoutes
