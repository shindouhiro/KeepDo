import type { Goal, Habit } from '../src/types/index.ts'

export function isGoalDayCounted(goal: Goal, habits: Habit[], date: string): boolean {
  return goal.checkIns?.[date] === true || habits.some(habit =>
    habit.goalId === goal.id && (habit.records[date] || 0) >= habit.targetPerDay,
  )
}

export function getGoalCheckInUpdate(goal: Goal, habits: Habit[], date: string, today: string) {
  const parsedDate = new Date(`${date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date || date > today || date < goal.createdAt) return null

  const checkIns = { ...goal.checkIns }
  if (checkIns[date]) delete checkIns[date]
  else checkIns[date] = true

  const delta = Number(isGoalDayCounted({ ...goal, checkIns }, habits, date))
    - Number(isGoalDayCounted(goal, habits, date))
  return {
    checkIns,
    currentValue: goal.type === 'days' ? Math.max(0, goal.currentValue + delta) : goal.currentValue,
  }
}
