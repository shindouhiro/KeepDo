import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isJournalPreviewShortcut } from '../src/lib/journal-shortcuts.ts'

test('Markdown 预览使用单次 Ctrl + E，忽略输入法、组合修饰和长按', () => {
  const event = { key: 'e', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false }
  assert.equal(isJournalPreviewShortcut(event), true)
  assert.equal(isJournalPreviewShortcut({ ...event, key: 'E' }), true)
  for (const patch of [{ key: 'k' }, { ctrlKey: false }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }, { isComposing: true }, { defaultPrevented: true }]) {
    assert.equal(isJournalPreviewShortcut({ ...event, ...patch }), false)
  }
})
