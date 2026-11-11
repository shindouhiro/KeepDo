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
  const image = shallowRef<{ url: string; filename: string } | null>(null)
  let controller: AbortController | undefined

  function clearImage() {
    if (image.value) URL.revokeObjectURL(image.value.url)
    image.value = null
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
      const blob = await captureRecordImage(viewport, sheet, current.signal)
      current.signal.throwIfAborted()
      image.value = { url: URL.createObjectURL(blob), filename: `KeepDo-记录-${date}.png` }
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
  return { opened, busy, progress, error, entries, image, generate, close }
}
