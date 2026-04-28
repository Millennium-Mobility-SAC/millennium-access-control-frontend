<div align="center">

# Millennium Access Control

### Sistema de Control de Acceso Vehicular y Peatonal

<br/>

**Plataforma empresarial para la gestión de ingresos y salidas en instalaciones corporativas**

<br/>

![Vue.js](https://img.shields.io/badge/Vue.js-3.5-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![PrimeVue](https://img.shields.io/badge/PrimeVue-4.5-0ea5e9?style=flat-square&logo=primevue&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-3.0-F7D336?style=flat-square&logo=pinia&logoColor=black)
![Axios](https://img.shields.io/badge/Axios-1.15-5A29E4?style=flat-square&logo=axios&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)

</div>

---

## 📋 Acerca del Proyecto

### 🏢 El Sistema

**Millennium Access Control** es una aplicación web empresarial diseñada para registrar, auditar y gestionar en tiempo real los ingresos y salidas de vehículos y personas en las instalaciones de una empresa.

El sistema centraliza el control de acceso bajo una única plataforma que conecta a agentes de seguridad con supervisores y administradores, proporcionando trazabilidad completa desde el momento de ingreso hasta la salida del visitante o vehículo.

### 💡 La Solución

**Millennium** resuelve la necesidad de registrar accesos de forma estructurada, con clasificación por tipo de ingreso (vehicular o peatonal), motivo, datos del visitante y seguimiento del agente que registró cada evento. Integra control de acceso basado en roles para que cada perfil de usuario solo vea y opere lo que le corresponde.

---

## 🚀 Visión general

**Millennium** es una SPA (Single Page Application) que permite al personal de seguridad y administración registrar, consultar y gestionar los ingresos y salidas de vehículos y personas en las instalaciones de una empresa.

Características principales:

- Registro de entradas y salidas de **vehículos** y **personas** con múltiples motivos de ingreso.
- **Autenticación JWT** con persistencia de sesión y protección de rutas por rol.
- **RBAC (Control de Acceso Basado en Roles)**: menú y rutas filtrados dinámicamente según el perfil del usuario autenticado.
- Gestión de **colaboradores** (personal interno) y **catálogo de vehículos** con autocompletado.
- Mock fallback configurable para desarrollo sin backend disponible.
- Diseño responsivo con sidebar colapsable y soporte para dispositivos móviles.

---

## 🛠️ Tecnologías

| Tecnología | Versión | Rol |
|---|---|---|
| [Vue 3](https://vuejs.org/) | `^3.5` | Framework UI (Composition API + `<script setup>`) |
| [Vite](https://vitejs.dev/) | `^8.0` | Bundler / servidor de desarrollo |
| [Pinia](https://pinia.vuejs.org/) | `^3.0` | State management |
| [Vue Router](https://router.vuejs.org/) | `^5.0` | Enrutamiento SPA |
| [PrimeVue](https://primevue.org/) | `^4.5` | Biblioteca de componentes UI |
| [PrimeFlex](https://primeflex.org/) | `^4.0` | Utilidades CSS (grid, flex, spacing) |
| [PrimeIcons](https://primevue.org/icons/) | `^7.0` | Iconografía |
| [@primeuix/themes](https://primevue.org/theming/) | `^2.0` | Tema visual `Aura` |
| [Axios](https://axios-http.com/) | `^1.15` | Cliente HTTP |

---

## 🏗️ Arquitectura

El proyecto implementa **Domain-Driven Design (DDD)** con arquitectura en capas. Cada módulo/bounded context está aislado bajo su propia carpeta y respeta la siguiente jerarquía de dependencias:

```
domain  ←  infrastructure  ←  application  ←  presentation
```

- **`domain/`** — Entidades y modelos de negocio puros (sin dependencias externas).
- **`infrastructure/`** — Adaptadores HTTP (`Api`), transformadores (`Assembler`), interceptores.
- **`application/`** — Stores de Pinia; orquestan casos de uso llamando a la infraestructura.
- **`presentation/`** — Vistas Vue, componentes, rutas y constantes de UI.

Un contexto `shared/` provee utilidades transversales (base HTTP, composables, componentes genéricos).

### 🔄 Flujo de datos

```
Vista  →  Store (Pinia)  →  API (Axios)  →  Backend REST
Vista  ←  Store          ←  Assembler   ←  Respuesta HTTP
```

### 🔒 Interceptores HTTP

Cada instancia de `BaseApi` registra dos interceptores de Axios:

| Interceptor | Descripción |
|---|---|
| `iamRequestInterceptor` | Inyecta `Authorization: Bearer <token>`, `X-User-Id` y `X-Role` en cada petición. |
| `iamResponseErrorInterceptor` | Detecta respuestas `401` y emite el evento global `millennium:session-expired`, desencadenando el cierre de sesión sin acoplamiento circular entre capas. |

---

## 📦 Módulos del sistema

### 🔑 IAM (Identity & Access Management)

Gestiona la identidad del usuario y el ciclo de vida de la sesión.

| Ruta | Vista | Descripción |
|---|---|---|
| `/sign-in` | `sign-in.vue` | Inicio de sesión con usuario y contraseña. |
| `/forgot-password` | `forgot-password.vue` | Solicitud de enlace de recuperación de contraseña. |

**Comportamiento del store (`iam.store.js`):**

- Persiste el token JWT y los datos de usuario en `localStorage` bajo las claves `gs_token` y `gs_user`.
- Re-hidrata la sesión automáticamente al recargar la página.
- Escucha el evento `millennium:session-expired` para limpiar el estado sin conocer el router.
- Expone `isSignedIn`, `userRole`, `currentUsername` e `isOwner` como propiedades computadas reactivas.

---

### 🛡️ Access Control

Módulo principal. Registra y consulta entradas y salidas de vehículos y personas en las instalaciones.

| Campo | Valores / Tipo | Detalle |
|---|---|---|
| Tipo de ingreso | `VEHICULO` / `PERSONA` | Determina los campos visibles en el formulario. |
| Motivo de ingreso | `MECANICA` `SINIESTRO` `MANTENIMIENTO` `CUSTODIA` `0KM` `GPS` `OTRO` | Severity visual diferenciada por tipo. |
| Tipo de documento | `DNI` `CE` `PASAPORTE` `OTROS` | Aplica a registros de tipo `PERSONA`. |
| Fecha de ingreso | `Date` | Fecha de entrada. |
| Hora de ingreso | `HH:MM:SS` | Hora de entrada. |
| Hora de salida | `HH:MM` | Hora de egreso. |
| Datos del vehículo | Placa, marca, modelo, año, km, color | Solo para tipo `VEHICULO`. |
| Datos de persona | Nombre, apellido, número de documento | Solo para tipo `PERSONA`. |
| Registrado por | `registeredByFirstName` / `registeredByLastName` | Agente de seguridad que registró la entrada. |

---

### 👥 Staff Management

Gestión de colaboradores internos de la empresa: personal, roles y perfiles. Accesible para `ROLE_ADMIN` y `ROLE_SUPPORT_ADMIN`.

---

### 🚗 Vehicle Catalog

Catálogo de vehículos registrados en la empresa. Sirve como fuente de autocompletado en el módulo de control de acceso. Accesible para `ROLE_ADMIN` y `ROLE_SUPPORT_ADMIN`.

---

## 🔐 Seguridad y roles

### 👤 Roles del sistema

| Rol | Label | Módulos accesibles |
|---|---|---|
| `ROLE_ADMIN` | Administrador | Control de Acceso · Colaboradores · Vehículos |
| `ROLE_SECURITY_GUARD` | Agente de Seguridad | Control de Acceso |
| `ROLE_SUPPORT_ADMIN` | Soporte Administrativo | Control de Acceso · Colaboradores · Vehículos |

### 🚧 Guard de navegación (`authentication.guard.js`)

Se ejecuta en cada cambio de ruta antes de la transición:

1. Usuario autenticado intentando acceder a `/sign-in` → redirige a `/access-control`.
2. Ruta protegida sin sesión activa → redirige a `/sign-in?redirect=<ruta-original>`.
3. Rol sin permiso sobre la ruta destino → redirige a `/access-control`.
4. Cualquier otro caso → permite la navegación.

El menú lateral se filtra en tiempo real según el rol activo mediante `getMenuItemsByRole()`.

---

## 📁 Estructura del proyecto

```
millennium-access-control-frontend/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js                          # Bootstrap: Vue, PrimeVue, Pinia, Router, componentes globales
    ├── App.vue                          # Root component (Toast, ConfirmDialog, RouterView)
    ├── router/
    │   └── index.js                     # Definición central de rutas + guard global
    │
    ├── iam/                             # Bounded context: Autenticación e IAM
    │   ├── application/
    │   │   └── iam.store.js             # Store: login, logout, refresh, forgotPassword
    │   ├── domain/models/
    │   │   ├── user.entity.js
    │   │   └── user-response.entity.js
    │   ├── infrastructure/
    │   │   ├── api/iam.api.js           # Endpoints: /sign-in, /logout, /register, /refresh
    │   │   ├── assemblers/user.assembler.js
    │   │   └── interceptors/iam.interceptor.js  # Token injection + 401 handler
    │   └── presentation/
    │       ├── iam.routes.js
    │       ├── guards/authentication.guard.js
    │       ├── components/iam-branding.vue
    │       └── views/ sign-in.vue · forgot-password.vue
    │
    ├── access-control/                  # Bounded context: Control de Acceso
    │   ├── application/
    │   │   └── access-control.store.js  # CRUD sobre registros de entrada
    │   ├── domain/models/
    │   │   └── access-entry.entity.js   # Entidad: entrada vehicular/peatonal
    │   ├── infrastructure/
    │   │   ├── api/access-control.api.js
    │   │   └── assemblers/access-entry.assembler.js
    │   └── presentation/
    │       ├── access-control.routes.js
    │       ├── constants/access-control-ui.constants.js  # Enums de UI (tipos, motivos, severidades)
    │       ├── components/access-create-and-edit.vue
    │       └── views/access-control-view.vue
    │
    ├── staff-management/                # Bounded context: Gestión de Personal
    │   └── (misma estructura de capas)
    │
    ├── vehicle-catalog/                 # Bounded context: Catálogo de Vehículos
    │   └── (misma estructura de capas)
    │
    ├── public/                          # Shell de la app autenticada
    │   └── presentation/
    │       ├── views/layout.vue         # Layout principal (sidebar + toolbar + router-view)
    │       ├── components/ sidebar.vue · toolbar.vue · branch-switcher.vue
    │       └── constants/layout.constants-ui.js  # Menú dinámico por rol
    │
    ├── shared/                          # Utilidades transversales
    │   ├── infrustructure/
    │   │   ├── base-api.js              # Axios factory con interceptores registrados
    │   │   ├── base-endpoint.js         # CRUD genérico: getAll, getById, create, update, delete
    │   │   └── mock-fallback.js         # withMockFallback / withMockMutation
    │   ├── composables/
    │   │   ├── use-async-action.js      # isLoading + error + run() — elimina try/catch repetitivo
    │   │   ├── use-notification.js      # Toast: showSuccess, showError, showWarning, showInfo
    │   │   ├── use-confirm-dialog.js    # ConfirmDialog como Promise (async/await)
    │   │   ├── use-date-formatter.js
    │   │   ├── use-image-viewer.js
    │   │   └── use-input-validation.js
    │   └── presentation/
    │       ├── components/
    │       │   ├── data-manager.vue     # Tabla CRUD con filtros, paginación y exportación CSV
    │       │   ├── create-and-edit.vue  # Dialog/formulario genérico reutilizable
    │       │   ├── file-uploader.vue
    │       │   ├── image-viewer-modal.vue
    │       │   └── module-state-feedback.vue
    │       └── constants/
    │           └── roles.constants.js   # ROLES, ROLE_LABELS, ROLE_ALLOWED_ROUTES, hasRouteAccess()
    │
    └── assets/
        └── styles/
            ├── variables.css            # Design tokens corporativos (colores, tipografía)
            ├── base.css
            ├── typography.css
            ├── utilities.css
            ├── primevue-overrides.css   # Sobreescrituras del tema Aura
            └── index.css               # Entry point de estilos globales
```

---

## ⚙️ Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# URL base del backend REST (sin barra al final)
VITE_PLATFORM_API_URL=http://localhost:8080/api/v1

# Endpoint oficial de estadias/accesos
VITE_STAYS_ENDPOINT=/stays

# Prefijo del endpoint de autenticación
VITE_IAM_ENDPOINT=/authentication

# Habilita el fallback a datos mock cuando el backend no está disponible
VITE_USE_MOCK=false
```

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `VITE_PLATFORM_API_URL` | `http://localhost:8080/api/v1` | URL base de la API REST del backend. |
| `VITE_STAYS_ENDPOINT` | `/stays` | Endpoint oficial para el modulo de control de acceso/estadias. |
| `VITE_IAM_ENDPOINT` | `/authentication` | Prefijo del servicio de autenticación. |
| `VITE_USE_MOCK` | `false` | Si es `true`, usa datos mock cuando la API no responde. |

---

## 📌 Requisitos previos

- **Node.js** `>= 18.x`
- **npm** `>= 9.x`

---

## ⚡ Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd millennium-access-control-frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores de tu entorno local

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173` (o el puerto que Vite asigne automáticamente).

---

## 📜 Scripts disponibles

| Script | Comando | Descripción |
|---|---|---|
| Desarrollo | `npm run dev` | Inicia el servidor de desarrollo con Hot Module Replacement (HMR). |
| Construcción | `npm run build` | Genera el bundle optimizado para producción en `/dist`. |
| Vista previa | `npm run preview` | Sirve el bundle de producción localmente para validación. |

---

## 📐 Convenciones de código

- **Composition API + `<script setup>`** en todos los componentes Vue.
- **Nombres de archivos** en `kebab-case` para vistas, componentes y stores.
- **Alias `@`** mapea a `src/` para imports absolutos (`@/shared/composables/...`).
- **Assemblers** son los únicos responsables de transformar datos API ↔ entidades de dominio; los stores no manipulan respuestas HTTP directamente.
- **Composables** (`use-*.js`) encapsulan lógica reactiva reutilizable; nunca importan stores ni componentes.
- **Design tokens** centralizados en `assets/styles/variables.css`; evitar colores o dimensiones hardcodeadas en componentes.
- Las **rutas protegidas** no contienen lógica de negocio; delegan en el guard global y en los stores de Pinia.
- El acoplamiento entre capas siempre fluye hacia adentro: `presentation → application → infrastructure → domain`.
