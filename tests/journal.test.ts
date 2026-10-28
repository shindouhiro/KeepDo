import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getJournalImageType, journalInputSchema, groupJournalEntries } from '../shared/journal.ts'
import type { GoalJournalEntry } from '../shared/journal.ts'
import { getCalendarPlans, getGoalsForDate } from '../shared/calendar.ts'
import type { Goal } from '../src/types/index.ts'
import { readLimitedBytes, HttpError } from '../server/http.ts'

const input = { date: '2026-10-28', content: ' 今天完成了初稿 ', keepImageIds: [], version: 0, operationId: crypto.randomUUID() }
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
  const base: GoalJournalEntry = { id: 'b', goalId: 'goal', date: '2026-10-27', content: '', images: [], createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-10-28T08:00:00.000Z', version: 1 }
  const entries = [base, { ...base, id: 'c', createdAt: '2026-10-28T09:00:00.000Z' }, { ...base, id: 'a', date: '2026-10-28', createdAt: '2026-10-28T07:00:00.000Z' }]
  const groups = groupJournalEntries(entries)
  assert.deepEqual(groups.map(group => group.date), ['2026-10-28', '2026-10-27'])
  assert.deepEqual(groups[1]!.records.map(record => record.id), ['c', 'b'])
  assert.equal(entries[0]!.id, 'b')
})
test('已达成目标的日记日期仍在日历保留，未记录日期不额外展示', () => {
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
