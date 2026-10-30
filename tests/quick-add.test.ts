import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isQuickAddShortcut } from '../shared/quick-add.ts'

const key = { key: 'k', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false }
test('支持 macOS 和 Windows 快捷键，只接受明确的单次组合键', () => {
  assert.equal(isQuickAddShortcut(key), true)
  assert.equal(isQuickAddShortcut({ ...key, ctrlKey: false, metaKey: true, key: 'K' }), true)
  for (const change of [{ ctrlKey: false }, { altKey: true }, { shiftKey: true }, { repeat: true }, { isComposing: true }, { defaultPrevented: true }, { key: 'a' }]) {
    assert.equal(isQuickAddShortcut({ ...key, ...change }), false)
  }
})
