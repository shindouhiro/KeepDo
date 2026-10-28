import { onBeforeUnmount, ref, watch } from 'vue'
import type { JournalEntry, JournalFilter, JournalPage } from '../../shared/journal'
import { api } from '../lib/api'

export function useJournalFeed(filter: () => JournalFilter) {
  const entries = ref<JournalEntry[]>([])
  const cursor = ref<string | null>(null)
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined

  async function load(more = false) {
    if (more && (!cursor.value || loading.value)) return
    const requestGeneration = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const query = new URLSearchParams({ type: filter() })
      if (more) query.set('cursor', cursor.value!)
      const result = await api<JournalPage>(`/api/journal?${query}`, { signal: controller.signal })
      if (requestGeneration !== generation) return
      entries.value = more ? [...entries.value, ...result.entries.filter(entry => !entries.value.some(old => old.id === entry.id))] : result.entries
      cursor.value = result.nextCursor
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : '记录加载失败，请稍后重试'
    } finally { if (requestGeneration === generation) loading.value = false }
  }

  watch(filter, () => {
    entries.value = []
    cursor.value = null
    void load()
  }, { immediate: true })
  onBeforeUnmount(() => { generation++; controller?.abort() })
  return { entries, cursor, loading, error, load }
}
