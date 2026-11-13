import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import type { JournalEntry, JournalPage } from '../shared/journal.ts'
import { useJournalPages } from '../src/composables/useJournalPages.ts'

function entry(id: string): JournalEntry {
  return { id, subjectType: 'goal', subjectId: 'goal', date: '2026-11-13', content: id, images: [], createdAt: '2026-11-13T00:00:00Z', updatedAt: '2026-11-13T00:00:00Z', version: 1 }
}

function setup() {
  const scope = effectScope()
  const requests: Array<{
    cursor: string | null
    signal: AbortSignal
    resolve: (page: JournalPage) => void
    reject: (cause: unknown) => void
  }> = []
  const pages = scope.run(() => useJournalPages((cursor, signal) => new Promise<JournalPage>((resolve, reject) => {
    requests.push({ cursor, signal, resolve, reject })
  }), '加载失败'))!
  return { scope, pages, requests }
}

test('分页传递游标、合并去重，重复点击加载更多不会重复请求', async t => {
  const { scope, pages, requests } = setup()
  t.after(() => scope.stop())
  await pages.load(true)
  assert.equal(requests.length, 0)
  const first = pages.load()
  assert.equal(requests[0]!.cursor, null)
  requests[0]!.resolve({ entries: [entry('a')], nextCursor: 'next' })
  await first
  const more = pages.load(true)
  await pages.load(true)
  assert.equal(requests.length, 2)
  assert.equal(requests[1]!.cursor, 'next')
  requests[1]!.resolve({ entries: [entry('a'), entry('b'), entry('b')], nextCursor: null })
  await more
  assert.deepEqual(pages.entries.value.map(item => item.id), ['a', 'b'])
  assert.equal(pages.loading.value, false)
  await pages.load(true)
  assert.equal(requests.length, 2)
})

test('刷新替换进行中的分页，过期响应不能覆盖新记录和游标', async t => {
  const { scope, pages, requests } = setup()
  t.after(() => scope.stop())
  pages.entries.value = [entry('old')]
  pages.cursor.value = 'old-cursor'
  const more = pages.load(true)
  const refresh = pages.load()
  assert.equal(requests[0]!.signal.aborted, true)
  requests[0]!.resolve({ entries: [entry('stale')], nextCursor: 'stale-cursor' })
  await more
  assert.equal(pages.loading.value, true)
  assert.deepEqual(pages.entries.value.map(item => item.id), ['old'])
  requests[1]!.resolve({ entries: [entry('fresh')], nextCursor: 'fresh-cursor' })
  await refresh
  assert.deepEqual(pages.entries.value.map(item => item.id), ['fresh'])
  assert.equal(pages.cursor.value, 'fresh-cursor')
})

test('筛选重置清空状态，旧请求的错误不能污染新筛选', async t => {
  const { scope, pages, requests } = setup()
  t.after(() => scope.stop())
  pages.entries.value = [entry('old')]
  pages.cursor.value = 'next'
  const pending = pages.load(true)
  pages.reset()
  assert.equal(requests[0]!.signal.aborted, true)
  requests[0]!.reject(new Error('旧请求错误'))
  await pending
  assert.deepEqual(pages.entries.value, [])
  assert.equal(pages.cursor.value, null)
  assert.equal(pages.error.value, '')
  assert.equal(pages.loading.value, false)
})

test('删除记录时取消进行中的请求，迟到结果不能恢复已删除记录', async t => {
  const { scope, pages, requests } = setup()
  t.after(() => scope.stop())
  pages.entries.value = [entry('a'), entry('b')]
  pages.cursor.value = 'next'
  const pending = pages.load()
  pages.removeEntry('a')
  assert.equal(requests[0]!.signal.aborted, true)
  requests[0]!.resolve({ entries: [entry('a'), entry('b')], nextCursor: null })
  await pending
  assert.deepEqual(pages.entries.value.map(item => item.id), ['b'])
  assert.equal(pages.cursor.value, 'next')
})

test('分页失败保留已加载记录和游标，重试成功后清除错误', async t => {
  const { scope, pages, requests } = setup()
  t.after(() => scope.stop())
  pages.entries.value = [entry('a')]
  pages.cursor.value = 'next'
  const failed = pages.load(true)
  requests[0]!.reject(new Error('网络失败'))
  await failed
  assert.equal(pages.error.value, '网络失败')
  assert.equal(pages.loading.value, false)
  assert.equal(pages.cursor.value, 'next')
  assert.deepEqual(pages.entries.value.map(item => item.id), ['a'])
  const retry = pages.load(true)
  assert.equal(pages.error.value, '')
  requests[1]!.resolve({ entries: [entry('b')], nextCursor: null })
  await retry
  assert.deepEqual(pages.entries.value.map(item => item.id), ['a', 'b'])
})

test('作用域销毁会取消请求，迟到响应和后续加载不再改变列表', async () => {
  const { scope, pages, requests } = setup()
  const pending = pages.load()
  scope.stop()
  assert.equal(requests[0]!.signal.aborted, true)
  requests[0]!.resolve({ entries: [entry('stale')], nextCursor: 'stale' })
  await pending
  await pages.load()
  assert.equal(requests.length, 1)
  assert.deepEqual(pages.entries.value, [])
  assert.equal(pages.loading.value, false)
})

test('分页取消信号同时保留超时能力，超时后退出加载状态并允许重试', async t => {
  const timeout = new AbortController()
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 20_000)
    return timeout.signal
  })
  const scope = effectScope()
  t.after(() => scope.stop())
  const pages = scope.run(() => useJournalPages((_, signal) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }), '加载失败'))!
  const pending = pages.load()
  timeout.abort(new DOMException('请求超时', 'TimeoutError'))
  await pending
  assert.equal(pages.loading.value, false)
  assert.equal(pages.error.value, '请求超时')
})
