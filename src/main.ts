import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import { initializeNativeLinks } from './lib/platform'

initializeNativeLinks()
async function mountApp() {
  // 公开分享独立启动，不加载账号状态或触发登录检查。
  const component = location.pathname.startsWith('/share/')
    ? (await import('./components/sharing/PublicShareView.vue')).default
    : (await import('./App.vue')).default
  const app = createApp(component)
  app.use(createPinia())
  app.mount('#app')
}
void mountApp()
