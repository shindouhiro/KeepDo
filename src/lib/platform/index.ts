import { isTauri } from '@tauri-apps/api/core'
import { z } from 'zod'
import { shallowRef } from 'vue'
import { base64ToBytes, bytesToBase64 } from '../../../shared/backup.ts'

export const isNative = isTauri()
export const platformNotice = shallowRef('')

const responseSchema = z.object({
  status: z.number().int().min(200).max(599),
  contentType: z.string(),
  body: z.string(),
})

export async function platformFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!isNative) return fetch(path, { ...options, credentials: 'same-origin' })
  if (!path.startsWith('/api/') || path.startsWith('/api/native/')) throw new Error('请求地址不正确')
  const signal = options.signal ?? AbortSignal.timeout(20_000)
  signal.throwIfAborted()
  const { invoke } = await import('@tauri-apps/api/core')
  // Request 负责生成 multipart boundary，图片、JSON 和大备份共用同一个请求通道。
  const request = new Request(`https://keepdo.invalid${path}`, options)
  const body = request.body ? bytesToBase64(new Uint8Array(await request.arrayBuffer())) : null
  signal.throwIfAborted()
  const id = crypto.randomUUID()
  const input = { id, path, method: request.method, contentType: request.headers.get('Content-Type'), body }
  let cancel = () => {}
  try {
    const pending = invoke<unknown>('api_request', { input })
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        cancel = () => {
          void invoke('cancel_request', { id }).catch(() => {})
          reject(signal.reason)
        }
        signal.addEventListener('abort', cancel, { once: true })
        if (signal.aborted) cancel()
      }),
    ])
    signal.throwIfAborted()
    const parsed = responseSchema.parse(result)
    return new Response(parsed.status === 204 || parsed.status === 205 ? null : base64ToBytes(parsed.body), {
      status: parsed.status,
      headers: { 'Content-Type': parsed.contentType },
    })
  } catch (cause) {
    if (typeof cause === 'string') throw new Error(cause)
    throw cause
  } finally { signal.removeEventListener('abort', cancel) }
}

export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  if (isNative) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs'),
    ])
    const extension = filename.split('.').pop() || ''
    const path = await save({ defaultPath: filename, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] })
    if (!path) return false
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    return true
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export async function copyImage(blob: Blob): Promise<void> {
  if (isNative) {
    const { invoke } = await import('@tauri-apps/api/core')
    const platform = await invoke<string>('native_platform')
    if (platform === 'android' || platform === 'ios') throw new Error('当前手机版暂不支持复制图片，请保存 PNG 图片后分享')
    const [{ Image }, { writeImage }] = await Promise.all([
      import('@tauri-apps/api/image'), import('@tauri-apps/plugin-clipboard-manager'),
    ])
    const image = await Image.fromBytes(await blob.arrayBuffer())
    try { await writeImage(image) }
    finally { await image.close() }
    return
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前设备不支持复制图片，请保存 PNG 图片后使用')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function initializeNativeLinks(): void {
  if (!isNative) return
  document.documentElement.dataset.platform = 'native'
  document.addEventListener('click', event => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(anchor instanceof HTMLAnchorElement)) return
    const url = new URL(anchor.href)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return
    event.preventDefault()
    if (url.protocol === 'https:') {
      void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url.href))
        .catch(() => { platformNotice.value = '未能打开系统浏览器，请稍后重试' })
    }
  })
}
