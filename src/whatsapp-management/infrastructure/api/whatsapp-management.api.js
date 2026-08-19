import { BaseApi } from '@/shared/infrustructure/base-api.js'

/**
 * Cliente para la gestión del bot de WhatsApp.
 *
 * Apunta siempre al backend Spring, que es la única fuente de verdad de la
 * configuración (groupId, apiKey, enabled) y quien habla con el microservicio
 * Node. El frontend nunca contacta al bot directamente.
 */
export class WhatsAppManagementApi extends BaseApi {

    /** GET → { enabled, groupId, hasApiKey, maskedApiKey, apiKeyRotatedAt } */
    getConfiguration() {
        return this.http.get('/integrations/whatsapp/configuration')
    }

    /** GET → estado de la sesión y datos de la cuenta vinculada */
    getStatus() {
        return this.http.get('/integrations/whatsapp/status')
    }

    /** GET → { qr, generated_at, expires_in_seconds } */
    getQr() {
        return this.http.get('/integrations/whatsapp/qr')
    }

    /** GET → [{ id, subject, participants, is_announce, can_send }] */
    listGroups() {
        return this.http.get('/integrations/whatsapp/groups')
    }

    /**
     * POST → { key }. Solo propone una clave nueva: no la guarda ni la envía al
     * microservicio. Aplicarla es configuración del despliegue en ambos lados.
     */
    generateApiKey() {
        return this.http.post('/integrations/whatsapp/api-key/generate')
    }

    /** PATCH → configuración actualizada */
    updateGroupId(groupId) {
        return this.http.patch('/integrations/whatsapp/group-id', { groupId })
    }

    /** PATCH → configuración actualizada */
    setEnabled(enabled) {
        return this.http.patch('/integrations/whatsapp/enabled', { enabled })
    }

    /**
     * POST → 202. Reconecta conservando la vinculación: es lo que hace falta
     * ante una caída. No pide QR.
     */
    reconnect() {
        return this.http.post('/integrations/whatsapp/reconnect')
    }

    /** POST → 204. Desvincula la cuenta; obligará a escanear un QR nuevo. */
    resetSession() {
        return this.http.post('/integrations/whatsapp/reset-session')
    }
}
