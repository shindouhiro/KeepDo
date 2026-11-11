import { nextTick, onBeforeUnmount, shallowRef } from 'vue'
import type { JournalEntry, JournalPage } from '../../shared/journal'
import type { JournalFeedFilter } from '../../shared/journal-feed'
import { collectJournalPages, journalFeedFilterSchema, journalFeedQuery } from '../../shared/journal-feed'
import { api } from '../lib/api'

export function useRecordsImageExport(getViewport: () => HTMLElement | null, getSheet: () => HTMLElement | null) {
  const opened = shallowRef(false)
  const busy = shallowRef(false)
  const progress = shallowRef('')
  const error = shallowRef('')
  const entries = shallowRef<JournalEntry[]>([])
  const image = shallowRef<{ url: string; svgUrl: string; filename: string; svgFilename: string; png: Blob; width: number; height: number } | null>(null)
  const copying = shallowRef(false)
  const copyMessage = shallowRef('')
  const copyFailed = shallowRef(false)
  let controller: AbortController | undefined

  function clearImage() {
    if (image.value) {
      URL.revokeObjectURL(image.value.url)
      URL.revokeObjectURL(image.value.svgUrl)
    }
    image.value = null
    copying.value = false
    copyMessage.value = ''
    copyFailed.value = false
  }

  async function copyImage() {
    const current = image.value
    if (!current || copying.value) return
    copying.value = true
    copyMessage.value = ''
    copyFailed.value = false
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持复制图片，请下载 PNG 图片后使用')
      // 直接使用已生成的 PNG，在点击事件中发起写入，保留浏览器所需的用户操作授权。
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': current.png })])
      if (image.value === current) copyMessage.value = '图片已复制，可直接粘贴到聊天或文档中'
    } catch (cause) {
      if (image.value === current) {
        copyFailed.value = true
        copyMessage.value = cause instanceof Error && cause.name !== 'NotAllowedError'
          ? cause.message : '未能复制图片，请允许剪贴板访问后重试，或下载 PNG 图片'
      }
    } finally { if (image.value === current) copying.value = false }
  }

  function close() {
    controller?.abort()
    controller = undefined
    opened.value = false
    busy.value = false
    entries.value = []
    clearImage()
  }

  async function generate(filter: JournalFeedFilter) {
    if (busy.value) return
    clearImage()
    const current = new AbortController()
    controller = current
    opened.value = true
    busy.value = true
    error.value = ''
    progress.value = '正在读取全部筛选记录…'
    try {
      const snapshot = journalFeedFilterSchema.parse(filter)
      const all = await collectJournalPages(
        cursor => api<JournalPage>(`/api/journal?${journalFeedQuery(snapshot, cursor)}`, { signal: current.signal }),
        count => { progress.value = `已读取 ${count} 条记录，正在整理完整内容…` },
        current.signal,
      )
      if (!all.length) throw new Error('当前筛选没有记录，请调整条件后再保存图片')
      entries.value = all
      await nextTick()
      const viewport = getViewport()
      const sheet = getSheet()
      if (!viewport || !sheet) throw new Error('图片排版尚未就绪，请重试')
      progress.value = `正在生成 ${all.length} 条记录的完整图片…`
      const { captureRecordImage } = await import('../lib/record-image-export')
      current.signal.throwIfAborted()
      const date = new Intl.DateTimeFormat('sv-SE').format(new Date())
      const result = await captureRecordImage(viewport, sheet, current.signal)
      current.signal.throwIfAborted()
      image.value = {
        url: URL.createObjectURL(result.png), svgUrl: URL.createObjectURL(result.svg),
        filename: `KeepDo-记录-${date}.png`, svgFilename: `KeepDo-记录-${date}.svg`,
        png: result.png, width: result.width, height: result.height,
      }
      progress.value = `共 ${all.length} 条记录，已完整合并为一张长图`
    } catch (cause) {
      if (!current.signal.aborted) {
        clearImage()
        error.value = cause instanceof Error ? cause.message : '图片生成失败，请稍后重试'
      }
    } finally {
      if (controller === current) {
        busy.value = false
        entries.value = []
      }
    }
  }

  onBeforeUnmount(close)
  return { opened, busy, progress, error, entries, image, copying, copyMessage, copyFailed, generate, copyImage, close }
}
