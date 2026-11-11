import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPastedJournalImages } from '../src/lib/journal-clipboard.ts'

const png = new File(['png'], '截图.png', { type: 'image/png' })
const jpeg = new File(['jpeg'], '照片.jpg', { type: 'image/jpeg' })
const text = new File(['text'], '笔记.txt', { type: 'text/plain' })
const fileItem = (file: File | null) => ({ kind: 'file', getAsFile: () => file })

test('从剪贴板读取多张图片，不重复添加同时出现在 items 与 files 中的图片', () => {
  assert.deepEqual(getPastedJournalImages({ items: [fileItem(png), fileItem(jpeg)], files: [png, jpeg] }), [png, jpeg])
})

test('空剪贴板、普通文字和其他文件不触发图片粘贴', () => {
  assert.deepEqual(getPastedJournalImages(null), [])
  assert.deepEqual(getPastedJournalImages({}), [])
  assert.deepEqual(getPastedJournalImages({ items: [{ kind: 'string', getAsFile: () => { throw new Error('不应读取文本项') } }, fileItem(null), fileItem(text)] }), [])
  assert.deepEqual(getPastedJournalImages({ files: [text] }), [])
})

test('浏览器没有可用图片 items 时从 files 读取，混合内容只提取图片', () => {
  assert.deepEqual(getPastedJournalImages({ files: [text, png, jpeg] }), [png, jpeg])
  assert.deepEqual(getPastedJournalImages({ items: [fileItem(null)], files: [png] }), [png])
})

test('不支持的图片格式交由现有图片处理流程提示错误，不当作普通文字粘贴', () => {
  const gif = new File(['gif'], '动画.gif', { type: 'image/gif' })
  assert.deepEqual(getPastedJournalImages({ items: [fileItem(gif)] }), [gif])
})
