import type { Goal, Habit, Todo } from '../src/types/index.ts'
import type { JournalDates } from './journal.ts'
import { getJournalDates } from './journal.ts'

export type CalendarView = 'week' | 'month'
export interface CalendarPlan {
  id: string
  sourceId: string
  kind: 'goal' | 'habit' | 'todo'
  title: string
  completed: boolean
  detail: string
  attention?: string
  percent?: number
  checkedIn?: boolean
  hasJournal?: boolean
}

export function getCalendarDates(date: string, view: CalendarView): string[] {
  const start = new Date(`${date}T12:00:00Z`)
  let count = 7
  if (view === 'month') {
    start.setUTCDate(1)
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1, 0)
    count = Math.ceil(((start.getUTCDay() + 6) % 7 + end.getUTCDate()) / 7) * 7
  }
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export function getCalendarPlans(goals: Goal[], habits: Habit[], todos: Todo[], date: string, journalDates: JournalDates = {}, habitJournalDates: JournalDates = {}): CalendarPlan[] {
  const goalPlans: CalendarPlan[] = getGoalsForDate(goals, date, journalDates).map(goal => {
    const status = getGoalDateStatus(goal, date)
    return {
      id: `goal-${goal.id}`, sourceId: goal.id, kind: 'goal', title: goal.title, completed: isGoalComplete(goal),
      checkedIn: goal.checkIns?.[date] === true,
      hasJournal: getJournalDates(journalDates, goal.id).includes(date),
      detail: `累计 ${getGoalProgressPercent(goal)}%`, percent: getGoalProgressPercent(goal),
      attention: status === 'due' ? '今日截止' : status === 'overdue' ? '已逾期' : undefined,
    }
  })
  const habitPlans: CalendarPlan[] = getHabitsForDate(habits, date).map(habit => ({
    id: `habit-${habit.id}`, sourceId: habit.id, kind: 'habit', title: habit.title,
    completed: (habit.records[date] || 0) >= habit.targetPerDay,
    detail: `${habit.records[date] || 0}/${habit.targetPerDay} ${habit.unit}`,
    hasJournal: getJournalDates(habitJournalDates, habit.id).includes(date),
  }))
  const priorities = { high: '高优先', medium: '中优先', low: '低优先' }
  const todoPlans: CalendarPlan[] = todos.filter(todo => todo.date === date).map(todo => ({
    id: `todo-${todo.id}`, sourceId: todo.id, kind: 'todo', title: todo.title, completed: todo.completed,
    detail: priorities[todo.priority],
  }))
  return [...goalPlans, ...habitPlans, ...todoPlans]
}

export function getHabitsForDate(habits: Habit[], date: string): Habit[] {
  return habits.filter(habit => habit.createdAt <= date || Object.hasOwn(habit.records, date))
}

export function getDailyActionSummary(todos: Todo[], habits: Habit[], date: string) {
  const dayTodos = todos.filter(todo => todo.date === date)
  const dayHabits = getHabitsForDate(habits, date)
  const total = dayTodos.length + dayHabits.length
  const completed = dayTodos.filter(todo => todo.completed).length
    + dayHabits.filter(habit => (habit.records[date] || 0) >= habit.targetPerDay).length
  const state: 'empty' | 'pending' | 'partial' | 'completed' = total === 0
    ? 'empty'
    : completed === total ? 'completed' : completed > 0 ? 'partial' : 'pending'
  const percent = total === 0 ? 0 : completed === total ? 100 : Math.min(99, Math.round(completed / total * 100))
  return { total, completed, percent, state }
}

export function isGoalComplete(goal: Goal): boolean {
  if (goal.type === 'milestones') return goal.milestones.length > 0 && goal.milestones.every(item => item.completed)
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue
}

export function getGoalProgressPercent(goal: Goal): number {
  if (isGoalComplete(goal)) return 100
  const total = goal.type === 'milestones' ? goal.milestones.length : goal.targetValue
  const done = goal.type === 'milestones' ? goal.milestones.filter(item => item.completed).length : goal.currentValue
  return total > 0 ? Math.max(0, Math.min(99, Math.round(done / total * 100))) : 0
}

export function getGoalsForDate(goals: Goal[], date: string, journalDates: JournalDates = {}) {
  // 达成后仍保留打卡日期与截止日；未完成目标从创建日起持续显示。
  return goals.filter(goal => goal.checkIns?.[date] === true || getJournalDates(journalDates, goal.id).includes(date) || goal.deadline === date || (goal.createdAt <= date && !isGoalComplete(goal)))
}

export function getGoalDateStatus(goal: Goal, date: string): 'completed' | 'due' | 'overdue' | 'active' {
  if (isGoalComplete(goal)) return 'completed'
  if (goal.deadline === date) return 'due'
  if (goal.deadline && goal.deadline < date) return 'overdue'
  return 'active'
}
