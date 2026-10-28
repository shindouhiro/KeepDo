import { onBeforeUnmount, ref, watch } from 'vue'
import type { GoalJournalEntry, JournalPage } from '../../shared/journal'
import { api } from '../lib/api'

export interface JournalDraft {
  id: string; date: string; content: string; keepImageIds: string[]
  files: File[]; version: number; operationId: string
}

export function useGoalJournal(goalId: () => string, isOpen: () => boolean) {
  const entries = ref<GoalJournalEntry[]>([])
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
    const id = goalId()
    loading.value = true
    error.value = ''
    try {
      const suffix = more ? `?cursor=${encodeURIComponent(cursor.value!)}` : ''
      const result = await api<JournalPage>(`/api/goals/${encodeURIComponent(id)}/journal${suffix}`, { signal: controller.signal })
      if (requestGeneration !== generation) return
      entries.value = more ? [...entries.value, ...result.entries.filter(entry => !entries.value.some(old => old.id === entry.id))] : result.entries
      cursor.value = result.nextCursor
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : '时间线加载失败'
    } finally { if (requestGeneration === generation) loading.value = false }
  }
  async function save(draft: JournalDraft) {
    const id = goalId()
    const form = new FormData()
    form.set('entry', JSON.stringify({ date: draft.date, content: draft.content, keepImageIds: draft.keepImageIds, version: draft.version, operationId: draft.operationId }))
    for (const file of draft.files) form.append('images', file)
    const result = await api<{ entry: GoalJournalEntry }>(`/api/goals/${encodeURIComponent(id)}/journal/${draft.id}`, { method: 'PUT', body: form, signal: AbortSignal.timeout(60_000) })
    if (goalId() === id && isOpen()) {
      entries.value = [result.entry, ...entries.value.filter(entry => entry.id !== result.entry.id)]
      void load()
    }
    return result.entry
  }
  watch([goalId, isOpen], ([id, open]) => {
    generation++
    controller?.abort()
    entries.value = []
    cursor.value = null
    error.value = ''
    loading.value = false
    if (id && open) void load()
  }, { immediate: true })
  onBeforeUnmount(() => { generation++; controller?.abort() })
  return { entries, cursor, loading, error, load, save }
}
