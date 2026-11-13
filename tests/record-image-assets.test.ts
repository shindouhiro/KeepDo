import { test } from 'node:test'
import assert from 'node:assert/strict'
import { waitForRecordImages } from '../src/lib/record-image-export.ts'

function sheetWith(images: Array<{ loading: string; hasAttribute: (name: string) => boolean; decode: () => Promise<void> }>) {
  return { querySelectorAll: () => images } as unknown as HTMLElement
}

test('导出屏幕外的懒加载图片前主动加载，并等待全部图片解码', async () => {
  const decoded: number[] = []
  const images = [0, 1].map(index => ({
    loading: 'lazy',
    hasAttribute: () => false,
    async decode() {
      assert.equal(this.loading, 'eager')
      decoded.push(index)
    },
  }))
  await waitForRecordImages(sheetWith(images), new AbortController().signal)
  assert.deepEqual(decoded, [0, 1])
})

test('任何图片解码失败均阻止导出不完整长图，预先取消不开始加载', async () => {
  let decodes = 0
  const image = { loading: 'lazy', hasAttribute: () => false, async decode() { decodes++; throw new Error('无效图片') } }
  await assert.rejects(waitForRecordImages(sheetWith([image]), new AbortController().signal), /部分照片未能加载/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(waitForRecordImages(sheetWith([image]), controller.signal), { name: 'AbortError' })
  assert.equal(decodes, 1)
})

test('取消原生图片等待时断开观察并移除监听器', async t => {
  let disconnected = false
  let observed = false
  class Observer {
    observe() { observed = true }
    disconnect() { disconnected = true }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver')
  Object.defineProperty(globalThis, 'MutationObserver', { value: Observer, configurable: true })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'MutationObserver', descriptor)
    else Reflect.deleteProperty(globalThis, 'MutationObserver')
  })
  const controller = new AbortController()
  const removed = t.mock.method(controller.signal, 'removeEventListener')
  const image = {
    loading: 'lazy', hasAttribute: (name: string) => name === 'data-image-loading',
    async decode() { assert.fail('取消后不应继续解码') },
  }
  const pending = waitForRecordImages(sheetWith([image]), controller.signal)
  assert.equal(observed, true)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(disconnected, true)
  assert.equal(removed.mock.calls[0]?.arguments[0], 'abort')
})
