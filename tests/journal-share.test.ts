import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { shareRequestSchema, shareSelectionSchema, shareSnapshotSchema } from '../shared/journal-share.ts'

test('分享范围严格区分单条、片段与整天，拒绝额外主体和无效日期', () => {
  const id = crypto.randomUUID()
  assert.deepEqual(shareSelectionSchema.parse({ scope: 'entry', entryId: id, excerpt: '  连续的一段  ' }), { scope: 'entry', entryId: id, excerpt: '连续的一段' })
  assert.ok(shareSelectionSchema.safeParse({ scope: 'day', date: '2026-11-16' }).success)
  for (const input of [
    { scope: 'entry', entryId: id, excerpt: ' ' }, { scope: 'entry', entryId: 'invalid' },
    { scope: 'day', date: '2026-02-30' }, { scope: 'day', date: '2026-11-16', entryId: id },
    { scope: 'entry', entryId: id, userId: 'other' }, { scope: 'entry', entryId: id, excerpt: '字'.repeat(5001) },
  ]) assert.equal(shareSelectionSchema.safeParse(input).success, false)
  assert.equal(shareRequestSchema.safeParse({ selection: { scope: 'entry', entryId: id }, revision: '伪造版本' }).success, false)
})

test('快照与原记录独立，撤销分享或删除账号会级联清理分享图片', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('PRAGMA foreign_keys = ON')
    for (const file of readdirSync(new URL('../server/migrations/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      db.exec(readFileSync(new URL(`../server/migrations/${file}`, import.meta.url), 'utf8'))
    }
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('owner', 'owner', 'test-only', 1)
    db.prepare(`INSERT INTO goal_journal_entries (id, user_id, goal_id, date, content, created_at, updated_at, mutation_id) VALUES ('source', 'owner', 'goal', '2026-11-16', '原文', 'now', 'now', 'mutation')`).run()
    for (const token of ['first', 'second']) {
      db.prepare('INSERT INTO journal_shares (token, user_id, title, snapshot, created_at) VALUES (?, ?, ?, ?, ?)').run(token, 'owner', '快照', '{}', 'now')
      db.prepare('INSERT INTO journal_share_images VALUES (?, ?, ?, ?)').run(token, 'image', 'image/png', new Uint8Array([1, 2, 3]))
    }
    db.prepare('DELETE FROM goal_journal_entries WHERE id = ?').run('source')
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM journal_share_images').get()!.count, 2)
    db.prepare('DELETE FROM journal_shares WHERE token = ?').run('first')
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM journal_share_images').get()!.count, 1)
    db.prepare('DELETE FROM users WHERE id = ?').run('owner')
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM journal_shares').get()!.count, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM journal_share_images').get()!.count, 0)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
  } finally { db.close() }
})

test('快照按 UTF-8 字节限制正文大小，避免大量中文记录超过数据库单行上限', () => {
  const record = { title: '随记', subjectType: 'note', date: '2026-11-16', content: '文'.repeat(5000), images: [] }
  const snapshot = { title: '一天的记录', scope: 'day', excerpt: false, records: Array.from({ length: 200 }, () => record) }
  assert.equal(shareSnapshotSchema.safeParse(snapshot).success, false)
  assert.equal(shareSnapshotSchema.safeParse({ ...snapshot, records: [record] }).success, true)
})
