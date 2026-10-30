import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getJournalImageType, journalInputSchema, journalDeleteSchema, groupJournalEntries, getJournalDates } from '../shared/journal.ts'
import type { JournalEntry } from '../shared/journal.ts'
import { getCalendarPlans, getGoalsForDate } from '../shared/calendar.ts'
import type { Goal, Habit } from '../src/types/index.ts'
import { appDataSchema, emptyAppData } from '../shared/schema.ts'
import { readLimitedBytes, HttpError } from '../server/http.ts'

const input = { date: '2026-10-28', content: ' 今天完成了初稿 ', keepImageIds: [], version: 0, operationId: crypto.randomUUID() }
test('删除记录必须提供已保存记录的正整数版本', () => {
  assert.deepEqual(journalDeleteSchema.parse({ version: 2 }), { version: 2 })
  for (const version of [undefined, null, 0, -1, 1.5, '1']) {
    assert.equal(journalDeleteSchema.safeParse({ version }).success, false)
  }
})
test('日记输入校验日期、文字长度、版本号和图片引用', () => {
  assert.equal(journalInputSchema.parse(input).content, '今天完成了初稿')
  for (const changes of [{ date: '2026-02-31' }, { content: '字'.repeat(5001) }, { version: -1 }, { keepImageIds: ['not-an-id'] }, { keepImageIds: Array(2).fill(input.operationId) }, { operationId: 'invalid' }]) {
    assert.equal(journalInputSchema.safeParse({ ...input, ...changes }).success, false)
  }
})
test('通过真实图片签名识别类型，拒绝 SVG 和任意文本', () => {
  assert.equal(getJournalImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png')
  assert.equal(getJournalImageType(new Uint8Array([255, 216, 255, 224])), 'image/jpeg')
  assert.equal(getJournalImageType(new TextEncoder().encode('RIFF1234WEBP')), 'image/webp')
  assert.equal(getJournalImageType(new TextEncoder().encode('<svg onload="alert(1)">')), null)
  assert.equal(getJournalImageType(new Uint8Array()), null)
})
test('时间线以业务日期为主，同日按实际创建时间和 ID 排序', () => {
  const base: JournalEntry = { id: 'b', subjectType: 'goal', subjectId: 'goal', goalId: 'goal', date: '2026-10-27', content: '', images: [], createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-10-28T08:00:00.000Z', version: 1 }
  const entries = [base, { ...base, id: 'c', createdAt: '2026-10-28T09:00:00.000Z' }, { ...base, id: 'a', date: '2026-10-28', createdAt: '2026-10-28T07:00:00.000Z' }]
  const groups = groupJournalEntries(entries)
  assert.deepEqual(groups.map(group => group.date), ['2026-10-28', '2026-10-27'])
  assert.deepEqual(groups[1]!.records.map(record => record.id), ['c', 'b'])
  assert.equal(entries[0]!.id, 'b')
})
test('已达成目标的日记日期仍在日历保留，未记录日期不额外展示', () => {
  assert.deepEqual(getJournalDates({}, '__proto__'), [])
  assert.deepEqual(getJournalDates(JSON.parse('{"__proto__":["2026-10-27"]}'), '__proto__'), ['2026-10-27'])
  const goal: Goal = { id: 'g', title: '写作', category: '成长', type: 'days', targetValue: 1, currentValue: 1, unit: '天', milestones: [], color: 'indigo', createdAt: '2026-10-01' }
  const dates = { g: ['2026-10-27'] }
  assert.deepEqual(getGoalsForDate([goal], '2026-10-27', dates), [goal])
  assert.deepEqual(getGoalsForDate([goal], '2026-10-28', dates), [])
  assert.equal(getCalendarPlans([goal], [], [], '2026-10-27', dates)[0]!.hasJournal, true)
})
test('按流限制上传正文大小，超限时拒绝并停止读取', async () => {
  const request = new Request('https://example.com', { method: 'POST', body: '123456' })
  await assert.rejects(readLimitedBytes(request, 5), error => error instanceof HttpError && error.status === 413)
  assert.equal(new TextDecoder().decode(await readLimitedBytes(new Request('https://example.com', { method: 'POST', body: '1234' }), 5)), '1234')
})

test('习惯描述兼容旧数据，导入导出保留文字并限制长度', () => {
  const habit: Habit = { id: 'h', title: '阅读', targetPerDay: 1, unit: '次', records: {}, color: 'amber', createdAt: '2026-10-01' }
  const data = { ...emptyAppData(), habits: [habit] }
  assert.deepEqual(appDataSchema.parse(data).habits[0], habit)
  const described = { ...data, habits: [{ ...habit, description: '每天阅读半小时，记下三个收获。' }] }
  assert.deepEqual(appDataSchema.parse(JSON.parse(JSON.stringify(described))), described)
  assert.equal(appDataSchema.safeParse({ ...data, habits: [{ ...habit, description: '字'.repeat(5001) }] }).success, false)
})

test('相同 ID 的目标与习惯日记标记分别展示，日记不影响打卡状态', () => {
  const goal: Goal = { id: 'same', title: '读书目标', category: '学习', type: 'days', targetValue: 100, currentValue: 0, unit: '天', milestones: [], color: 'indigo', createdAt: '2026-10-01' }
  const habit: Habit = { id: 'same', title: '每天阅读', goalId: 'same', targetPerDay: 1, unit: '次', records: {}, color: 'amber', createdAt: '2026-10-01' }
  const plans = getCalendarPlans([goal], [habit], [], '2026-10-28', { same: ['2026-10-27'] }, { same: ['2026-10-28'] })
  assert.equal(plans.find(plan => plan.kind === 'goal')!.hasJournal, false)
  assert.equal(plans.find(plan => plan.kind === 'habit')!.hasJournal, true)
  assert.equal(plans.find(plan => plan.kind === 'habit')!.completed, false)
  assert.equal(goal.currentValue, 0)
  assert.deepEqual(habit.records, {})
})
