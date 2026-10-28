import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { JournalDates, JournalSubjectType } from '../../shared/journal'
import { getJournalDates } from '../../shared/journal'
import { api } from '../lib/api'

export const useJournalStore = defineStore('journal', () => {
  const dates = ref<JournalDates>({})
  const habitDates = ref<JournalDates>({})
  const error = ref('')
  let generation = 0
  async function refresh() {
    const requestGeneration = ++generation
    try {
      const result = await api<{ dates: JournalDates; habitDates?: JournalDates }>('/api/journal/summary')
      if (requestGeneration !== generation) return
      dates.value = result.dates
      habitDates.value = result.habitDates || {}
      error.value = ''
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : '日记索引加载失败'
    }
  }
  function markDate(subjectId: string, date: string, type: JournalSubjectType) {
    // 让保存前发出的摘要请求失效，防止旧响应覆盖刚保存的日期标记。
    generation++
    const target = type === 'goal' ? dates : habitDates
    target.value = { ...target.value, [subjectId]: [...new Set([...getJournalDates(target.value, subjectId), date])] }
  }
  function clear() { generation++; dates.value = {}; habitDates.value = {}; error.value = '' }
  return { dates, habitDates, error, refresh, markDate, clear }
})
