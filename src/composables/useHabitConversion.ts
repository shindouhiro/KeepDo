import { ref } from 'vue'
import { api } from '../lib/api'
import { convertHabitToNotesPath } from '../../shared/journal'
import { useKeepDoStore } from '../stores/keepdo'
import { useJournalStore } from '../stores/journal'
import { useConfirmDrawer } from './useConfirmDrawer'
import type { Habit } from '../types'

export function useHabitConversion(onSuccess?: () => void) {
  const store = useKeepDoStore()
  const journalIndex = useJournalStore()
  const confirm = useConfirmDrawer()
  const converting = ref(false)
  const convertError = ref('')

  async function convertToNote(habit: Habit, override?: { title?: string; description?: string }) {
    if (converting.value) return false
    const title = (override?.title?.trim() || habit.title).trim()
    const description = (override?.description !== undefined ? override.description : (habit.description || '')).trim()
    const confirmed = await confirm({
      title: '将习惯修改为随记',
      message: `确定要将习惯「${title}」修改为随记吗？\n\n• 该习惯将从每日打卡和日常习惯中移除，不再出现在计划日历中；\n• 其所有历史图文记录将完整转换为独立随记保留在时间线中；\n• 若未写过日记，将以习惯名称与描述自动生成一条随记。`,
      confirmLabel: '修改为随记',
      danger: false,
    })
    if (!confirmed) return false

    converting.value = true
    convertError.value = ''
    try {
      await api(convertHabitToNotesPath(habit.id), {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          date: store.selectedDate,
        }),
      })
      store.deleteHabit(habit.id)
      await store.flushSync()
      await journalIndex.refresh()
      onSuccess?.()
      return true
    } catch (cause) {
      convertError.value = cause instanceof Error ? cause.message : '转换失败，请重试'
      return false
    } finally {
      converting.value = false
    }
  }

  return {
    converting,
    convertError,
    convertToNote,
  }
}

