import { watch } from 'vue'
import type { JournalPage } from '../../shared/journal'
import type { JournalFeedFilter } from '../../shared/journal-feed'
import { journalFeedFilterSchema, journalFeedQuery } from '../../shared/journal-feed'
import { api } from '../lib/api'
import { useJournalPages } from './useJournalPages'

export function useJournalFeed(filter: () => JournalFeedFilter) {
  const pages = useJournalPages(async (cursor, signal) => {
    const parsed = journalFeedFilterSchema.safeParse(filter())
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? '请检查记录筛选条件')
    const query = journalFeedQuery(parsed.data, cursor)
    return api<JournalPage>(`/api/journal?${query}`, { signal })
  }, '记录加载失败，请稍后重试')

  watch(() => journalFeedQuery(filter()), () => {
    pages.reset()
    void pages.load()
  }, { immediate: true })
  return pages
}
