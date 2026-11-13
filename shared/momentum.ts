import type { Habit, Todo } from '../src/types/index.ts'
import { getDailyActionSummary, groupTodosByDate } from './calendar.ts'

export function getRecentAchievements(todos: Todo[], habits: Habit[], today: string) {
  let completedDays = 0
  const todosByDate = groupTodosByDate(todos)
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() - offset)
    const day = date.toISOString().slice(0, 10)
    if (getDailyActionSummary(todosByDate.get(day) ?? [], habits, day).state === 'completed') completedDays++
  }
  const badge = completedDays >= 7 ? '七日之星' : completedDays >= 3 ? '稳步前行' : completedDays >= 1 ? '行动启程' : null
  const next = completedDays >= 7 ? null : completedDays >= 3 ? 7 : completedDays >= 1 ? 3 : 1
  return { completedDays, badge, next }
}
