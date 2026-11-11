import { onBeforeUnmount, ref, watch } from 'vue'
import type { JournalEntry, JournalPage, JournalSubjectType } from '../../shared/journal'
import { journalFeedQuery } from '../../shared/journal-feed'
import { api } from '../lib/api'

export interface JournalDraft {
  id: string; date: string; content: string; keepImageIds: string[]
  files: File[]; version: number; operationId: string
}

export function useJournal(subjectId: () => string, subjectType: () => JournalSubjectType, isOpen: () => boolean, date: () => string) {
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
    const id = subjectId()
    const type = subjectType()
    loading.value = true
    error.value = ''
    try {
      // 在分页前限定主体和日期，避免当日记录被其他日期的历史记录挤出首屏。
      const query = journalFeedQuery({ type, subjectId: id, from: date(), to: date() }, more ? cursor.value : null)
      const result = await api<JournalPage>(`/api/journal?${query}`, { signal: controller.signal })
      if (requestGeneration !== generation) return
      entries.value = more ? [...entries.value, ...result.entries.filter(entry => !entries.value.some(old => old.id === entry.id))] : result.entries
      cursor.value = result.nextCursor
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : '当日记录加载失败'
    } finally { if (requestGeneration === generation) loading.value = false }
  }
  async function save(draft: JournalDraft) {
    if (draft.date !== date()) throw new Error('只能保存所选日期的记录，请重新打开当天记录')
    const id = subjectId()
    const type = subjectType()
    const form = new FormData()
    form.set('entry', JSON.stringify({ date: draft.date, content: draft.content, keepImageIds: draft.keepImageIds, version: draft.version, operationId: draft.operationId }))
    for (const file of draft.files) form.append('images', file)
    const result = await api<{ entry: JournalEntry }>(`/api/${type === 'goal' ? 'goals' : 'habits'}/${encodeURIComponent(id)}/journal/${draft.id}`, { method: 'PUT', body: form, signal: AbortSignal.timeout(60_000) })
    if (subjectId() === id && subjectType() === type && date() === draft.date && isOpen()) {
      entries.value = [result.entry, ...entries.value.filter(entry => entry.id !== result.entry.id)]
      void load()
    }
    return result.entry
  }
  function removeEntry(entryId: string) {
    generation++
    controller?.abort()
    loading.value = false
    error.value = ''
    entries.value = entries.value.filter(entry => entry.id !== entryId)
  }
  watch([subjectId, subjectType, isOpen, date], ([id, , open]) => {
    generation++
    controller?.abort()
    entries.value = []
    cursor.value = null
    error.value = ''
    loading.value = false
    if (id && open) void load()
  }, { immediate: true })
  onBeforeUnmount(() => { generation++; controller?.abort() })
  return { entries, cursor, loading, error, load, save, removeEntry }
}
