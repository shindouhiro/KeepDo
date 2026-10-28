import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDailyActionSummary, getGoalsForDate, getGoalDateStatus, getGoalProgressPercent, isGoalComplete } from '../shared/calendar.ts'
import type { Goal, Habit, Todo } from '../src/types/index.ts'

const date = '2026-10-27'
const todo: Todo = { id: 't1', title: '阅读', date, completed: true, priority: 'medium', createdAt: date }
const habit: Habit = { id: 'h1', title: '跑步', targetPerDay: 1, unit: '次', records: {}, color: 'indigo', createdAt: date }

test('没有行动时显示尚未安排，不能算作完成 100%', () => {
  assert.deepEqual(getDailyActionSummary([], [], date), { total: 0, completed: 0, percent: 0, state: 'empty' })
})
test('只统计所选日期的待办和打卡记录', () => {
  const summary = getDailyActionSummary([todo, { ...todo, id: 't2', date: '2026-10-28' }], [habit], date)
  assert.equal(summary.total, 2)
  assert.equal(summary.completed, 1)
  assert.equal(summary.percent, 50)
  assert.equal(summary.state, 'partial')
})
test('有行动并全部完成才显示完成状态', () => {
  assert.equal(getDailyActionSummary([todo], [{ ...habit, records: { [date]: 1 } }], date).state, 'completed')
  assert.equal(getDailyActionSummary([{ ...todo, completed: false }], [habit], date).state, 'pending')
})

const goal: Goal = {
  id: 'g1', title: '持续运动', category: '健康', type: 'days', targetValue: 100,
  currentValue: 0, unit: '天', milestones: [], color: 'indigo', createdAt: date,
}

test('无截止日的进行中目标从创建日起每天可见', () => {
  assert.equal(getGoalsForDate([goal], '2026-10-26').length, 0)
  assert.deepEqual(getGoalsForDate([goal], date), [goal])
  assert.deepEqual(getGoalsForDate([goal], '2027-01-01'), [goal])
})
test('目标在截止日可见并标记到期，逾期未完成继续显示', () => {
  const dated = { ...goal, deadline: '2026-10-28' }
  assert.equal(getGoalDateStatus(dated, date), 'active')
  assert.equal(getGoalDateStatus(dated, '2026-10-28'), 'due')
  assert.equal(getGoalDateStatus(dated, '2026-10-29'), 'overdue')
  assert.equal(getGoalsForDate([dated], '2026-10-29').length, 1)
})
test('已完成目标不再每日展示，但截止日仍可查看', () => {
  const completed = { ...goal, currentValue: 100, deadline: '2026-10-28' }
  assert.equal(getGoalsForDate([completed], date).length, 0)
  assert.equal(getGoalsForDate([completed], '2026-10-28').length, 1)
  assert.equal(getGoalDateStatus(completed, '2026-10-28'), 'completed')
})
test('里程碑需要实际全部勾选才算完成，空清单和四舍五入不能误判', () => {
  const milestone = { ...goal, type: 'milestones' as const, currentValue: 100 }
  assert.equal(isGoalComplete(milestone), false)
  assert.equal(getGoalProgressPercent(milestone), 0)
  const partial = { ...milestone, milestones: [{ id: 'm1', title: '阶段一', completed: true }, { id: 'm2', title: '阶段二', completed: false }] }
  assert.equal(getGoalProgressPercent(partial), 50)
  assert.equal(isGoalComplete(partial), false)
  assert.equal(isGoalComplete({ ...partial, milestones: partial.milestones.map(item => ({ ...item, completed: true })) }), true)
  assert.equal(getGoalProgressPercent({ ...goal, currentValue: 99.6 }), 99)
  assert.equal(isGoalComplete({ ...goal, currentValue: 99.6 }), false)
})

test('接近完成的行动不能因四舍五入显示为全部完成', () => {
  const todos = Array.from({ length: 200 }, (_, index) => ({ ...todo, id: `t-${index}`, completed: index < 199 }))
  const summary = getDailyActionSummary(todos, [], date)
  assert.equal(summary.percent, 99)
  assert.equal(summary.state, 'partial')
})

test('日期详情不包含选中日期之后新建的习惯，历史打卡仍保留', async () => {
  const { getHabitsForDate } = await import('../shared/calendar.ts')
  assert.equal(getHabitsForDate([habit], '2026-10-26').length, 0)
  assert.equal(getHabitsForDate([habit], date).length, 1)
  const recorded = { ...habit, records: { '2026-10-26': 1 } }
  assert.equal(getHabitsForDate([recorded], '2026-10-26').length, 1)
  assert.equal(getDailyActionSummary([], [habit], '2026-10-26').total, 0)
  assert.equal(getDailyActionSummary([], [recorded], '2026-10-26').state, 'completed')
})

test('周日历以周一开始，跨年仍保留完整七天', async () => {
  const { getCalendarDates } = await import('../shared/calendar.ts')
  assert.deepEqual(getCalendarDates('2027-01-01', 'week'), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ])
  assert.equal(getCalendarDates('2027-01-03', 'week')[0], '2026-12-28')
})

test('月日历覆盖闰日和首尾补齐日期，按完整周排列', async () => {
  const { getCalendarDates } = await import('../shared/calendar.ts')
  const leapMonth = getCalendarDates('2028-02-15', 'month')
  assert.equal(leapMonth.length, 35)
  assert.equal(leapMonth[0], '2028-01-31')
  assert.equal(leapMonth.at(-1), '2028-03-05')
  assert.ok(leapMonth.includes('2028-02-29'))
  const longMonth = getCalendarDates('2026-11-15', 'month')
  assert.equal(longMonth.length, 42)
  assert.equal(longMonth[0], '2026-10-26')
  assert.equal(longMonth.at(-1), '2026-12-06')
})

test('日历逐条保留全部计划、已完成项及完整标题，不限制条数', async () => {
  const { getCalendarPlans } = await import('../shared/calendar.ts')
  const todos = Array.from({ length: 20 }, (_, index) => ({ ...todo, id: `t${index}`, title: `计划 ${index}：完成完整的阅读和笔记整理工作` }))
  const entries = getCalendarPlans([goal], [habit], todos, date)
  assert.equal(entries.length, 22)
  assert.equal(entries.filter(item => item.kind === 'todo' && item.completed).length, 20)
  assert.equal(entries.at(-1)?.title, todos.at(-1)?.title)
  assert.equal(new Set(entries.map(item => item.id)).size, 22)
})

test('日历卡片准确映射历史过滤、习惯记录、目标截止状态和待办优先级', async () => {
  const { getCalendarPlans } = await import('../shared/calendar.ts')
  assert.deepEqual(getCalendarPlans([goal], [habit], [todo], '2026-10-26'), [])
  const plans = getCalendarPlans([{ ...goal, deadline: date, currentValue: 50 }], [{ ...habit, records: { [date]: 1 } }], [{ ...todo, priority: 'high' }], date)
  assert.equal(plans[0]?.attention, '今日截止')
  assert.equal(plans[0]?.percent, 50)
  assert.equal(plans[1]?.completed, true)
  assert.equal(plans[1]?.detail, '1/1 次')
  assert.equal(plans[2]?.detail, '高优先')
  assert.equal(getCalendarPlans([{ ...goal, deadline: date }], [], [], '2026-10-28')[0]?.attention, '已逾期')
})
