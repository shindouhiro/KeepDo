const appUrl = new URL(chrome.runtime.getManifest().homepage_url)
const content = document.getElementById('extension-content')
const connection = document.getElementById('extension-connection')
const loading = document.getElementById('extension-loading')
const error = document.getElementById('extension-error')
const errorMessage = document.getElementById('extension-error-message')
const reload = document.getElementById('extension-reload')
const retry = document.getElementById('extension-retry')
const openWeb = document.getElementById('extension-open-web')
openWeb.href = appUrl.href

let currentController
let currentTimeout
let attempt = 0

async function connect() {
  const currentAttempt = ++attempt
  currentController?.abort()
  clearTimeout(currentTimeout)
  const controller = new AbortController()
  currentController = controller
  content.replaceChildren()
  content.hidden = true
  connection.hidden = false
  loading.hidden = false
  error.hidden = true
  reload.disabled = true

  function showError(message) {
    if (currentAttempt !== attempt) return
    clearTimeout(currentTimeout)
    controller.abort()
    content.replaceChildren()
    content.hidden = true
    connection.hidden = false
    loading.hidden = true
    error.hidden = false
    errorMessage.textContent = message
    reload.disabled = false
  }

  currentTimeout = setTimeout(() => {
    showError('连接超时，请检查网络后重试。也可以点击右上角「在网页中打开」。')
  }, 20_000)

  try {
    // 仅检查公开健康接口；登录和业务请求始终由线上页面同源处理。
    const response = await fetch(new URL('/api/health', appUrl), {
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    })
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error('服务不可用')
    if (currentAttempt !== attempt || controller.signal.aborted) return

    const frame = document.createElement('iframe')
    frame.id = 'extension-app'
    frame.title = 'KeepDo 个人管理工作区'
    frame.className = 'h-full w-full border-0'
    frame.allow = 'clipboard-write'
    frame.addEventListener('load', () => {
      if (currentAttempt !== attempt || controller.signal.aborted) return
      clearTimeout(currentTimeout)
      connection.hidden = true
      content.hidden = false
      reload.disabled = false
    }, { once: true })
    frame.addEventListener('error', () => {
      showError('页面未能加载，请重新连接，或点击右上角「在网页中打开」。')
    }, { once: true })
    frame.src = appUrl.href
    content.replaceChildren(frame)
  } catch {
    if (controller.signal.aborted) return
    showError('账号服务暂时无法访问，请检查网络后重试，或点击右上角「在网页中打开」。')
  }
}

// 使用浏览器完整刷新，让内嵌页面的未保存草稿保护有机会拦截关闭。
reload.addEventListener('click', () => { window.location.reload() })
retry.addEventListener('click', () => { void connect() })
void connect()
