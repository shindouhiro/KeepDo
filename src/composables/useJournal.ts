import { watch } from 'vue'
import type { JournalEntry, JournalPage, JournalSubjectType } from '../../shared/journal'
import { journalFeedQuery } from '../../shared/journal-feed'
import { api } from '../lib/api'
import { useJournalPages } from './useJournalPages'

export interface JournalDraft {
  id: string; date: string; content: string; keepImageIds: string[]
  files: File[]; version: number; operationId: string
}

export function useJournal(subjectId: () => string, subjectType: () => JournalSubjectType, isOpen: () => boolean, date: () => string) {
  const pages = useJournalPages((cursor, signal) => {
    // 在分页前限定主体和日期，避免当日记录被其他日期的历史记录挤出首屏。
    const query = journalFeedQuery({ type: subjectType(), subjectId: subjectId(), from: date(), to: date() }, cursor)
    return api<JournalPage>(`/api/journal?${query}`, { signal })
  }, '当日记录加载失败')
  async function save(draft: JournalDraft) {
    if (draft.date !== date()) throw new Error('只能保存所选日期的记录，请重新打开当天记录')
    const id = subjectId()
    const type = subjectType()
    const form = new FormData()
    form.set('entry', JSON.stringify({ date: draft.date, content: draft.content, keepImageIds: draft.keepImageIds, version: draft.version, operationId: draft.operationId }))
    for (const file of draft.files) form.append('images', file)
    const result = await api<{ entry: JournalEntry }>(`/api/${type === 'goal' ? 'goals' : 'habits'}/${encodeURIComponent(id)}/journal/${draft.id}`, { method: 'PUT', body: form, signal: AbortSignal.timeout(60_000) })
    if (subjectId() === id && subjectType() === type && date() === draft.date && isOpen()) {
      pages.entries.value = [result.entry, ...pages.entries.value.filter(entry => entry.id !== result.entry.id)]
      void pages.load()
    }
    return result.entry
  }
  watch([subjectId, subjectType, isOpen, date], ([id, , open]) => {
    pages.reset()
    if (id && open) void pages.load()
  }, { immediate: true })
  return { ...pages, save }
}
