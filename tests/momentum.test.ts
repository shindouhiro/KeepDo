import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRecentAchievements } from '../shared/momentum.ts'
import type { Habit, Todo } from '../src/types/index.ts'

const today = '2026-10-30'
const habit: Habit = { id: 'h1', title: '阅读', createdAt: '2026-10-01', targetPerDay: 2, unit: '页', color: 'indigo', records: {} }
const todo: Todo = { id: 't1', title: '笔记', createdAt: today, date: today, completed: true, priority: 'medium' }

test('空计划不授予徽章，未达成的习惯与部分完成的待办不算达成日', () => {
  assert.deepEqual(getRecentAchievements([], [], today), { completedDays: 0, badge: null, next: 1 })
  assert.equal(getRecentAchievements([todo], [habit], today).completedDays, 0)
  assert.equal(getRecentAchievements([], [{ ...habit, records: { [today]: 1 } }], today).completedDays, 0)
})

test('近七天跨月跨年，只计入截至今天的完整达成日期', () => {
  const dates = ['2026-12-25', '2026-12-26', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']
  const todos = dates.map(date => ({ ...todo, id: date, date }))
  assert.deepEqual(getRecentAchievements(todos, [], '2027-01-01'), { completedDays: 4, badge: '稳步前行', next: 7 })
})

test('徽章从记录派生，重复计算不累加，撤销完成后立即回退', () => {
  assert.deepEqual(getRecentAchievements([todo], [], today), { completedDays: 1, badge: '行动启程', next: 3 })
  assert.deepEqual(getRecentAchievements([todo], [], today), getRecentAchievements([todo], [], today))
  assert.equal(getRecentAchievements([{ ...todo, completed: false }], [], today).badge, null)
  const records = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-10-${24 + i}`, 2]))
  assert.deepEqual(getRecentAchievements([], [{ ...habit, records }], today), { completedDays: 7, badge: '七日之星', next: null })
})
