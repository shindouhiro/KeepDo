import { shallowRef } from 'vue'
import type { JournalEntry } from '../../shared/journal'
import { api } from '../lib/api'
import { useJournalStore } from '../stores/journal'

export function useJournalDeletion(onDeleted: (entry: JournalEntry) => void) {
  const pending = shallowRef<JournalEntry | null>(null)
  const deleting = shallowRef(false)
  const error = shallowRef('')
  const index = useJournalStore()

  function request(entry: JournalEntry) {
    if (deleting.value) return
    pending.value = entry
    error.value = ''
  }
  function cancel() {
    if (deleting.value) return
    pending.value = null
    error.value = ''
  }
  async function confirm() {
    const entry = pending.value
    if (!entry || deleting.value) return
    deleting.value = true
    error.value = ''
    try {
      const collection = entry.subjectType === 'goal' ? 'goals' : 'habits'
      await api(`/api/${collection}/${encodeURIComponent(entry.subjectId)}/journal/${entry.id}`, {
        method: 'DELETE', body: JSON.stringify({ version: entry.version }),
      })
      // 从服务端重新计算摘要，避免删掉同日其他记录的日期标记。
      await index.refresh()
      pending.value = null
      deleting.value = false
      onDeleted(entry)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '删除失败，请重试'
    } finally { deleting.value = false }
  }
  return { pending, deleting, error, request, cancel, confirm }
}
