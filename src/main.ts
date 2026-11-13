import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { initializeNativeLinks } from './lib/platform'

initializeNativeLinks()
const app = createApp(App)
app.use(createPinia())
app.mount('#app')
