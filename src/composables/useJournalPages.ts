import { onScopeDispose, ref, shallowRef } from 'vue'
import type { JournalEntry, JournalPage } from '../../shared/journal.ts'
import { appendJournalEntries } from '../../shared/journal-feed.ts'

type ReadJournalPage = (cursor: string | null, signal: AbortSignal) => Promise<JournalPage>

export function useJournalPages(readPage: ReadJournalPage, failureMessage: string) {
  const entries = ref<JournalEntry[]>([])
  const cursor = shallowRef<string | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef('')
  let generation = 0
  let controller: AbortController | undefined
  let disposed = false

  function cancel() {
    // 即使底层请求未响应取消，也不能用旧结果覆盖新筛选或重新加入已删除的记录。
    generation++
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  async function load(more = false) {
    if (disposed || (more && (!cursor.value || loading.value))) return
    cancel()
    const requestGeneration = generation
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    try {
      const signal = AbortSignal.any([current.signal, AbortSignal.timeout(20_000)])
      const result = await readPage(more ? cursor.value : null, signal)
      if (requestGeneration !== generation) return
      entries.value = more ? appendJournalEntries(entries.value, result.entries) : result.entries
      cursor.value = result.nextCursor
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : failureMessage
    } finally {
      if (requestGeneration === generation) {
        controller = undefined
        loading.value = false
      }
    }
  }

  function reset() {
    cancel()
    entries.value = []
    cursor.value = null
    error.value = ''
  }

  function removeEntry(entryId: string) {
    cancel()
    error.value = ''
    entries.value = entries.value.filter(entry => entry.id !== entryId)
  }

  onScopeDispose(() => {
    disposed = true
    cancel()
  })
  return { entries, cursor, loading, error, load, reset, removeEntry }
}
