import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConfirmationQueue } from '../src/lib/confirmation-queue.ts'
import type { ConfirmationOptions } from '../src/lib/confirmation-queue.ts'

test('确认抽屉按顺序处理请求，取消和确认分别返回对应结果', async () => {
  const states: Array<string | null> = []
  const queue = createConfirmationQueue(options => states.push(options?.title ?? null))
  const first = queue.ask(Symbol(), { title: '恢复备份', message: '覆盖当前数据' })
  const second = queue.ask(Symbol(), { title: '断开连接', message: '移除授权' })
  queue.settle(false)
  assert.equal(await first, false)
  queue.settle(true)
  assert.equal(await second, true)
  assert.deepEqual(states, ['恢复备份', '恢复备份', '断开连接', null])
})

test('请求方卸载时取消其当前及排队确认，保留其他请求且不执行危险操作', async () => {
  let current: ConfirmationOptions | null = null
  const queue = createConfirmationQueue(options => { current = options })
  const owner = Symbol()
  const first = queue.ask(owner, { title: '恢复', message: '覆盖数据' })
  const other = queue.ask(Symbol(), { title: '其他请求', message: '保留' })
  const last = queue.ask(owner, { title: '退出', message: '关闭账号' })
  queue.cancelOwner(owner)
  assert.deepEqual(await Promise.all([first, last]), [false, false])
  assert.deepEqual(current, { title: '其他请求', message: '保留' })
  queue.settle(true)
  assert.equal(await other, true)
})

test('应用销毁时所有确认均取消，空队列的重复关闭安全', async () => {
  const queue = createConfirmationQueue(() => {})
  const first = queue.ask(Symbol(), { title: '恢复', message: '覆盖数据' })
  const second = queue.ask(Symbol(), { title: '导入', message: '覆盖数据' })
  queue.dispose()
  assert.deepEqual(await Promise.all([first, second]), [false, false])
  assert.doesNotThrow(() => queue.settle(true))
})
