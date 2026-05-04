import { createApp } from 'vue'
import App from './App.vue'

// ── Bootstrap: register IAM interceptors on BaseApi BEFORE any store is used ──
import { BaseApi } from './shared/infrustructure/base-api.js'
import { iamRequestInterceptor, iamResponseErrorInterceptor } from './iam/infrastructure/interceptors/iam.interceptor.js'
BaseApi.configure(iamRequestInterceptor, iamResponseErrorInterceptor)

// PrimeVue Core
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

// Prime Icons
import 'primeicons/primeicons.css'

// PrimeFlex
import 'primeflex/primeflex.css'

// Estilos globales corporativos
import './assets/styles/index.css'

// PrimeVue Services
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import ToastService from 'primevue/toastservice'

// PrimeVue Directives
import Tooltip from 'primevue/tooltip'

// PrimeVue Components
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import Checkbox from 'primevue/checkbox'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import FileUpload from 'primevue/fileupload'
import FloatLabel from 'primevue/floatlabel'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Password from 'primevue/password'
import Menu from 'primevue/menu'
import Divider from 'primevue/divider'
import Rating from 'primevue/rating'
import Drawer from 'primevue/drawer'
import Tag from 'primevue/tag'
import Popover from 'primevue/popover'
import Textarea from 'primevue/textarea'
import Toolbar from 'primevue/toolbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import DataView from 'primevue/dataview'
import Toast from 'primevue/toast'
import Chip from 'primevue/chip'
import Message from 'primevue/message'
import Paginator from 'primevue/paginator'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import InputMask from 'primevue/inputmask'
import ToggleSwitch from 'primevue/toggleswitch'
import Chips from 'primevue/chips'
import InputChips from 'primevue/inputchips'
import Dropdown from 'primevue/dropdown'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SplitButton from 'primevue/splitbutton'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Badge from 'primevue/badge'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Avatar from 'primevue/avatar'

// Router
import router from './router/index.js'

// Pinia
import { createPinia } from 'pinia'
import {ColorPicker} from "primevue";

// Create app
const app = createApp(App)

// ⚠️ Suprimir warning específico SOLO en desarrollo
if (import.meta.env.DEV) {
    app.config.warnHandler = (msg, instance, trace) => {
        if (msg.includes('onMounted is called when there is no active component')) {
            return
        }
        console.warn(`[Vue warn]: ${msg}`, trace)
    }
}

// Store
const pinia = createPinia()
app.use(pinia)

// Router
app.use(router)

// PrimeVue Config
app
    .use(PrimeVue, {
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.force-dark-mode', // modo claro forzado
                cssLayer: false
            }
        },
        ripple: true
    })
    .use(ConfirmationService)
    .use(DialogService)
    .use(ToastService)

// Directives
app.directive('tooltip', Tooltip)

// Global Components (prefijo pv-)
app
    .component('pv-button', Button)
    .component('pv-card', Card)
    .component('pv-column', Column)
    .component('pv-checkbox', Checkbox)
    .component('pv-data-table', DataTable)
    .component('pv-dialog', Dialog)
    .component('pv-file-upload', FileUpload)
    .component('pv-float-label', FloatLabel)
    .component('pv-icon-field', IconField)
    .component('pv-input-icon', InputIcon)
    .component('pv-input-text', InputText)
    .component('pv-input-number', InputNumber)
    .component('pv-password', Password)
    .component('pv-menu', Menu)
    .component('pv-divider', Divider)
    .component('pv-rating', Rating)
    .component('pv-drawer', Drawer)
    .component('pv-tag', Tag)
    .component('pv-popover', Popover)
    .component('pv-textarea', Textarea)
    .component('pv-toolbar', Toolbar)
    .component('pv-toast', Toast)
    .component('pv-tabs', Tabs)
    .component('pv-tab-list', TabList)
    .component('pv-tab', Tab)
    .component('pv-tab-panel', TabPanel)
    .component('pv-tab-panels', TabPanels)
    .component('pv-data-view', DataView)
    .component('pv-accordion', Accordion)
    .component('pv-accordion-panel', AccordionPanel)
    .component('pv-accordion-header', AccordionHeader)
    .component('pv-accordion-content', AccordionContent)
    .component('pv-badge', Badge)
    .component('pv-split-button', SplitButton)
    .component('pv-auto-complete', AutoComplete)
    .component('pv-dropdown', Dropdown)
    .component('pv-multi-select', MultiSelect)
    .component('pv-select', Select)
    .component('pv-progress-bar', ProgressBar)
    .component('pv-calendar', DatePicker)
    .component('pv-input-switch', ToggleSwitch)
    .component('pv-toggle-switch', ToggleSwitch)
    .component('pv-chips', Chips)
    .component('pv-input-chips', InputChips)
    .component('pv-progress-spinner', ProgressSpinner)
    .component('pv-input-mask', InputMask)
    .component('pv-chip', Chip)
    .component('pv-message', Message)
    .component('pv-paginator', Paginator)
    .component('pv-confirm-dialog', ConfirmDialog)
    .component('pv-avatar', Avatar)
    .component('pv-color-picker', ColorPicker)

// Mount
app.mount('#app')