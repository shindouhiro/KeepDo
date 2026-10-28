import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { JournalDates } from '../../shared/journal'
import { getGoalJournalDates } from '../../shared/journal'
import { api } from '../lib/api'

export const useJournalStore = defineStore('journal', () => {
  const dates = ref<JournalDates>({})
  const error = ref('')
  let generation = 0
  async function refresh() {
    const requestGeneration = ++generation
    try {
      const result = await api<{ dates: JournalDates }>('/api/journal/summary')
      if (requestGeneration !== generation) return
      dates.value = result.dates
      error.value = ''
    } catch (cause) {
      if (requestGeneration === generation) error.value = cause instanceof Error ? cause.message : '日记索引加载失败'
    }
  }
  function markDate(goalId: string, date: string) {
    dates.value = { ...dates.value, [goalId]: [...new Set([...getGoalJournalDates(dates.value, goalId), date])] }
  }
  function clear() { generation++; dates.value = {}; error.value = '' }
  return { dates, error, refresh, markDate, clear }
})
