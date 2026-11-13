import { onBeforeUnmount, onMounted } from 'vue'
import { isNative, platformNotice } from '../lib/platform'
import { useKeepDoStore } from '../stores/keepdo'

export function useNativeLifecycle() {
  const store = useKeepDoStore()
  let disposed = false
  let exiting = false
  const cleanup: Array<() => void> = []

  async function requestExit() {
    if (exiting) return
    const focused = document.activeElement?.closest('dialog[open]')
    const dialog = focused ?? Array.from(document.querySelectorAll('dialog[open]')).at(-1)
    if (dialog instanceof HTMLDialogElement) {
      // 按 Escape 的语义请求关闭，保留现有草稿确认和保存中保护。
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close()
      return
    }
    if (store.isRestoring) { platformNotice.value = '备份正在恢复，请完成后再退出'; return }
    exiting = true
    try {
      if (store.hasUnsavedChanges) await store.flushSync()
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('finish_exit')
    } catch (cause) {
      platformNotice.value = cause instanceof Error ? cause.message : '退出前未能保存，请重试或先导出备份'
    } finally { exiting = false }
  }

  onMounted(async () => {
    if (!isNative) return
    try {
      const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')])
      const platform = await invoke<string>('native_platform')
      const unlisten = await listen('keepdo://request-exit', () => { void requestExit() })
      cleanup.push(unlisten)
      if (platform === 'android') {
        const { onBackButtonPress } = await import('@tauri-apps/api/app')
        const listener = await onBackButtonPress(() => { void requestExit() })
        cleanup.push(() => { void listener.unregister() })
      } else if (platform !== 'ios') {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        cleanup.push(await getCurrentWindow().onCloseRequested(event => {
          event.preventDefault()
          void requestExit()
        }))
      }
      if (disposed) { cleanup.splice(0).forEach(stop => stop()); return }
      await invoke('native_exit_ready', { ready: true })
    } catch { platformNotice.value = '系统返回与退出保护未能启用，请稍后重新启动应用' }
  })

  onBeforeUnmount(() => {
    disposed = true
    cleanup.splice(0).forEach(stop => stop())
    if (isNative) void import('@tauri-apps/api/core').then(({ invoke }) => invoke('native_exit_ready', { ready: false })).catch(() => {})
  })
}
