import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JournalEntry } from '../shared/journal.ts'
import { collectJournalPages, journalFeedFilterSchema, journalFeedQuery } from '../shared/journal-feed.ts'
import { recordCaptureSize, RECORD_EXPORT_MAX_DIMENSION, RECORD_EXPORT_MAX_PIXELS, RECORD_EXPORT_WIDTH } from '../shared/record-image-export.ts'

test('记录筛选兼容默认条件，校验完整日期、主体类型与日期区间', () => {
  assert.deepEqual(journalFeedFilterSchema.parse({}), { type: 'all', subjectId: '', from: '', to: '' })
  for (const input of [{ type: 'unknown' }, { from: '2026-02-30' }, { to: 'invalid' }, { from: '2026-11-10', to: '2026-11-09' }, { subjectId: 'example' }]) {
    assert.equal(journalFeedFilterSchema.safeParse(input).success, false)
  }
  const filter = journalFeedFilterSchema.parse({ type: 'goal', subjectId: '目标 & 示例', from: '2026-11-10', to: '2026-11-10' })
  const query = new URLSearchParams(journalFeedQuery(filter, 'cursor+&='))
  assert.equal(query.get('subjectId'), '目标 & 示例')
  assert.equal(query.get('from'), query.get('to'))
  assert.equal(query.get('cursor'), 'cursor+&=')
})

const entry = (id: string): JournalEntry => ({ id, subjectType: 'goal', subjectId: 'g', date: '2026-11-10', content: id, images: [], createdAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z', version: 1 })

test('完整读取所有分页，重复记录只出现一次，保留超过首屏的记录', async () => {
  const cursors: Array<string | null> = []
  const counts: number[] = []
  const result = await collectJournalPages(async cursor => {
    cursors.push(cursor)
    return cursor ? { entries: [entry('20'), entry('21')], nextCursor: null } : { entries: Array.from({ length: 21 }, (_, i) => entry(String(i))), nextCursor: 'next' }
  }, count => counts.push(count), new AbortController().signal)
  assert.deepEqual(cursors, [null, 'next'])
  assert.equal(result.length, 22)
  assert.equal(result.at(-1)?.id, '21')
  assert.deepEqual(counts, [21, 22])
})

test('分页失败或循环时不能以不完整结果成功导出，支持取消', async () => {
  await assert.rejects(collectJournalPages(async () => { throw new Error('网络失败') }, () => {}, new AbortController().signal), /网络失败/)
  await assert.rejects(collectJournalPages(async () => ({ entries: [], nextCursor: 'same' }), () => {}, new AbortController().signal), /分页异常/)
  const controller = new AbortController()
  controller.abort()
  let requested = false
  await assert.rejects(collectJournalPages(async () => { requested = true; return { entries: [], nextCursor: null } }, () => {}, controller.signal), { name: 'AbortError' })
  assert.equal(requested, false)
})

test('普通记录生成一张高清图片，超过原分图高度也保留完整高度', () => {
  assert.deepEqual(recordCaptureSize(1000), { width: 1140, height: 1500 })
  assert.deepEqual(recordCaptureSize(8000), { width: 1140, height: 12000 })
})

test('超长记录等比缩放为一张图片，同时满足画布边长和像素限制', () => {
  for (const originalHeight of [14000, 15800, 18001, 50000, 100000, 1000000]) {
    const size = recordCaptureSize(originalHeight)
    assert.ok(size.width > 0 && size.width <= RECORD_EXPORT_MAX_DIMENSION)
    assert.ok(size.height > 0 && size.height <= RECORD_EXPORT_MAX_DIMENSION)
    assert.ok(size.width * size.height <= RECORD_EXPORT_MAX_PIXELS)
    // 取整误差小于两个像素，缩放时完整保留原长图的纵横比。
    assert.ok(Math.abs(size.width - size.height * RECORD_EXPORT_WIDTH / originalHeight) < 2)
    assert.equal(Array.isArray(size), false)
  }
})

test('拒绝无效长图尺寸，避免生成空白图片', () => {
  for (const height of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) assert.throws(() => recordCaptureSize(height))
})
