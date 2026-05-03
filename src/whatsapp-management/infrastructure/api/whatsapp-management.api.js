import { BaseApi } from '@/shared/infrustructure/base-api.js'

/**
 * Cliente para la gestión del bot de WhatsApp.
 * Apunta al backend Spring Boot — Spring es la única fuente de verdad
 * para la configuración (groupId, apiKey, enabled). Spring se comunica
 * internamente con el microservicio Node.js.
 */
export class WhatsAppManagementApi extends BaseApi {

    /** GET /integrations/whatsapp/configuration → { enabled, groupId, hasApiKey, maskedApiKey, apiKeyRotatedAt } */
    getConfiguration() {
        return this.http.get('/integrations/whatsapp/configuration')
    }

    /** GET /integrations/whatsapp/status → { connected } */
    getStatus() {
        return this.http.get('/integrations/whatsapp/status')
    }

    /** GET /integrations/whatsapp/qr → { qr } */
    getQr() {
        return this.http.get('/integrations/whatsapp/qr')
    }

    /** GET /integrations/whatsapp/groups → [{ id, name, participants }] */
    listGroups() {
        return this.http.get('/integrations/whatsapp/groups')
    }

    /** POST /integrations/whatsapp/api-key/rotate → { key } (solo ADMIN) */
    rotateApiKey() {
        return this.http.post('/integrations/whatsapp/api-key/rotate')
    }

    /** PATCH /integrations/whatsapp/group-id → resource */
    updateGroupId(groupId) {
        return this.http.patch('/integrations/whatsapp/group-id', { groupId })
    }

    /** PATCH /integrations/whatsapp/enabled → resource */
    setEnabled(enabled) {
        return this.http.patch('/integrations/whatsapp/enabled', { enabled })
    }

    /** POST /integrations/whatsapp/reset-session → 204 */
    resetSession() {
        return this.http.post('/integrations/whatsapp/reset-session')
    }
}
