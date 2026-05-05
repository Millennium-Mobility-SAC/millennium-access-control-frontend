/**
 * IAM Presentation - UI Constants
 * 
 * Constantes relacionadas con la presentación del módulo IAM.
 * NO contienen lógica de negocio.
 * 
 * Ejemplos:
 * - Labels de formularios
 * - Mensajes de UI
 * - Rutas de navegación
 * - Configuración de componentes
 */

export const IAM_LABELS = {
  LOGIN_TITLE: 'Iniciar Sesión',
  REGISTER_TITLE: 'Registrarse',
  EMAIL_LABEL: 'Correo Electrónico',
  PASSWORD_LABEL: 'Contraseña',
};


export const IAM_MESSAGES = {
  LOGIN_SUCCESS: 'Sesión iniciada correctamente',
  LOGIN_ERROR: 'Credenciales incorrectas',
  REGISTER_SUCCESS: 'Usuario registrado correctamente',
  REGISTER_ERROR: 'Error al registrar el usuario',
  FORGOT_PASSWORD_SUCCESS: 'Correo de recuperación enviado',
  FORGOT_PASSWORD_ERROR: 'Error al enviar el correo de recuperación',
  RESET_PASSWORD_SUCCESS: 'Contraseña restablecida correctamente',
  RESET_PASSWORD_ERROR: 'Error al restablecer la contraseña'
};

// ── Profile creation constants ─────────────────────────────────────────────

export const PROFILE_DOCUMENT_TYPES = [
  { label: 'DNI',       value: 'DNI'       },
  { label: 'C.E.',      value: 'CE'        },
  { label: 'Pasaporte', value: 'PASAPORTE' },
  { label: 'PTP',       value: 'PTP'       },
  { label: 'Otro',      value: 'OTRO'      },
];

export const PROFILE_DEPARTMENTS = [
  { label: 'Administración',      value: 'ADMINISTRACION'   },
  { label: 'Mecánica',            value: 'MECANICA'         },
  { label: 'Carrocería',          value: 'CARROCERIA'       },
  { label: 'Ventas',              value: 'VENTAS'           },
  { label: 'Atención al cliente', value: 'ATENCION_CLIENTE' },
  { label: 'Logística',           value: 'LOGISTICA'        },
  { label: 'Seguridad',           value: 'SEGURIDAD'        },
  { label: 'Sistemas',            value: 'SISTEMAS'         },
  { label: 'Otro',                value: 'OTRO'             },
];

export const PROFILE_ROLES_OPTIONS = [
  { label: 'Administrador',            value: 'ROLE_ADMIN'          },
  { label: 'Administrador de Soporte', value: 'ROLE_SUPPORT_ADMIN'  },
  { label: 'Guardia de Seguridad',     value: 'ROLE_SECURITY_GUARD' },
];
