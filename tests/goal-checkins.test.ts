import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Goal, Habit } from '../src/types/index.ts'
import { getGoalCheckInUpdate, isGoalDayCounted } from '../shared/goal-checkins.ts'
import { getCalendarPlans, getGoalsForDate } from '../shared/calendar.ts'
import { appDataSchema, emptyAppData } from '../shared/schema.ts'

const today = '2026-10-28'
const yesterday = '2026-10-27'
const goal: Goal = {
  id: 'checkin-goal', title: '每日复盘', category: '成长', type: 'days',
  targetValue: 10, currentValue: 3, unit: '天', milestones: [], color: 'indigo', createdAt: '2026-10-01',
}
const habit: Habit = {
  id: 'linked-habit', title: '写复盘', goalId: goal.id, targetPerDay: 2,
  unit: '次', records: { [today]: 2 }, color: 'indigo', createdAt: goal.createdAt,
}

test('目标打卡按日期累计，撤销保留其他日期与原有进度，且不改动输入', () => {
  const first = { ...goal, ...getGoalCheckInUpdate(goal, [], today, today)! }
  assert.equal(first.currentValue, 4)
  assert.deepEqual(first.checkIns, { [today]: true })
  const second = { ...first, ...getGoalCheckInUpdate(first, [], yesterday, today)! }
  assert.equal(second.currentValue, 5)
  const undone = getGoalCheckInUpdate(second, [], today, today)!
  assert.equal(undone.currentValue, 4)
  assert.deepEqual(undone.checkIns, { [yesterday]: true })
  assert.equal(goal.checkIns, undefined)
  assert.deepEqual(first.checkIns, { [today]: true })
})

test('直接打卡与同日关联习惯不重复计天，撤销标记不会回退习惯贡献', () => {
  const update = getGoalCheckInUpdate(goal, [habit], today, today)!
  assert.equal(update.currentValue, 3)
  assert.equal(update.checkIns[today], true)
  const undone = getGoalCheckInUpdate({ ...goal, ...update }, [habit], today, today)!
  assert.equal(undone.currentValue, 3)
  assert.equal(undone.checkIns[today], undefined)
  assert.equal(isGoalDayCounted(goal, [{ ...habit, records: { [today]: 1 } }], today), false)
  assert.equal(isGoalDayCounted(goal, [{ ...habit, goalId: 'other-goal' }], today), false)
  assert.equal(isGoalDayCounted(goal, [habit], yesterday), false)
})

test('多个关联习惯与目标标记共享同一日贡献，最后一个来源撤销后才不再计天', () => {
  const checked = { ...goal, checkIns: { [today]: true } }
  const secondHabit = { ...habit, id: 'second-habit' }
  assert.equal(isGoalDayCounted(goal, [habit, secondHabit], today), true)
  assert.equal(isGoalDayCounted(goal, [secondHabit], today), true)
  assert.equal(isGoalDayCounted(checked, [], today), true)
  assert.equal(isGoalDayCounted(goal, [], today), false)
})

test('数值与里程碑型目标只保存日期标记，不自动修改累计值和阶段', () => {
  for (const type of ['number', 'milestones'] as const) {
    const item = { ...goal, type, milestones: [{ id: 'm1', title: '完成初稿', completed: false }] }
    const update = getGoalCheckInUpdate(item, [], today, today)!
    assert.equal(update.currentValue, item.currentValue)
    assert.equal(update.checkIns[today], true)
    assert.equal(item.milestones[0]!.completed, false)
    assert.deepEqual(getGoalCheckInUpdate({ ...item, ...update }, [], today, today)!.checkIns, {})
  }
})

test('未来日期、创建前日期和无效日期不能打卡', () => {
  for (const date of ['2026-10-29', '2026-09-30', '2026-02-31', '2026-13-01', 'invalid', '2026-10-28T12:00:00Z']) {
    assert.equal(getGoalCheckInUpdate(goal, [], date, today), null)
  }
})

test('达成目标后仍保留历史打卡卡片，其他日期不显示每日打卡标记', () => {
  const completed = { ...goal, currentValue: 10, checkIns: { [yesterday]: true } }
  assert.deepEqual(getGoalsForDate([completed], yesterday), [completed])
  assert.deepEqual(getGoalsForDate([completed], today), [])
  const plan = getCalendarPlans([completed], [], [], yesterday)[0]!
  assert.equal(plan.sourceId, goal.id)
  assert.equal(plan.checkedIn, true)
  assert.equal(plan.completed, true)
  assert.equal(plan.percent, 100)
  assert.equal(getCalendarPlans([{ ...completed, currentValue: 4 }], [], [], today)[0]!.checkedIn, false)
})

test('兼容无打卡记录的旧备份，记录经过保存解析和 JSON 往返后不丢失', () => {
  assert.equal(appDataSchema.parse({ ...emptyAppData(), goals: [goal] }).goals[0]!.checkIns, undefined)
  const data = { ...emptyAppData(), goals: [{ ...goal, checkIns: { [today]: true, [yesterday]: true } }] }
  assert.deepEqual(appDataSchema.parse(JSON.parse(JSON.stringify(data))), data)
  for (const checkIns of [{ 'invalid': true }, { [today]: 'yes' }, { '2026-02-31': true }]) {
    assert.equal(appDataSchema.safeParse({ ...emptyAppData(), goals: [{ ...goal, checkIns }] }).success, false)
  }
})
