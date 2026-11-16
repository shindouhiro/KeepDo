import assert from 'node:assert/strict'
import { test } from 'node:test'
import { journalShareBlocks } from '../src/lib/journal-share-blocks.ts'

test('按章节分享，代码中的标题不会产生额外区块', () => {
  const source = '# Loon\n\n安装说明\n\n```text\n# 配置注释\n```\n\n# Shadowrocket\n\n其他配置'
  const blocks = journalShareBlocks(source)
  assert.deepEqual(blocks.map(block => block.title), ['Loon', 'Shadowrocket'])
  assert.ok(blocks[0]!.content.includes('# 配置注释'))
  assert.ok(!blocks[0]!.content.includes('Shadowrocket'))
  for (const block of blocks) assert.ok(source.includes(block.content))
})

test('无标题正文保留完整列表、代码块和段落', () => {
  const blocks = journalShareBlocks('第一段\n\n- 一\n- 二\n\n```js\nconst a = 1\n```\n\n最后一段')
  assert.equal(blocks.length, 4)
  assert.equal(blocks[1]!.content, '- 一\n- 二')
  assert.equal(blocks[2]!.content, '```js\nconst a = 1\n```')
})

test('父章节包含子章节，同时允许单独选子章节，保留 CRLF 原文', () => {
  const source = '引言\r\n\r\n# 主章\r\n正文\r\n## 子章\r\n详情\r\n# 结束\r\n结束正文'
  const blocks = journalShareBlocks(source)
  assert.deepEqual(blocks.map(block => block.title), ['引言', '主章', '子章', '结束'])
  assert.ok(blocks[1]!.content.includes('## 子章'))
  assert.equal(blocks[2]!.content, '## 子章\r\n详情')
  for (const block of blocks) assert.ok(source.includes(block.content))
  assert.deepEqual(journalShareBlocks(' \n\n'), [])
})

test('引用中的标题作为整个引用分享，支持下划线标题', () => {
  const blocks = journalShareBlocks('> # 引用标题\n> 内容\n\n章节\n====\n正文')
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0]!.content, '> # 引用标题\n> 内容')
  assert.equal(blocks[1]!.title, '章节')
})
