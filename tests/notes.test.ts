import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NOTE_SUBJECT_ID, convertHabitToNotesPath, journalEntryPath, journalSubjectLabel } from '../shared/journal.ts'
import { journalFeedFilterSchema, journalFeedQuery } from '../shared/journal-feed.ts'
import { completeBackupSchema, parseBackup } from '../shared/backup.ts'
import { emptyAppData } from '../shared/schema.ts'

function noteBackup() {
  const now = '2026-11-16T00:00:00.000Z'
  return {
    ...emptyAppData(), format: 'keepdo-backup', backupVersion: 2, exportedAt: now,
    journal: [{ id: crypto.randomUUID(), subjectType: 'note', subjectId: NOTE_SUBJECT_ID, date: '2000-01-01', content: '当天随手记录', createdAt: now, updatedAt: now, version: 1, images: [] }],
  }
}

test('随记使用独立接口与名称，现有目标和习惯路径保持编码规则', () => {
  assert.equal(journalSubjectLabel('note'), '随记')
  assert.equal(journalSubjectLabel('goal'), '目标')
  assert.equal(journalSubjectLabel('habit'), '习惯')
  assert.equal(journalEntryPath('note', NOTE_SUBJECT_ID, 'entry'), '/api/notes/entry')
  assert.equal(journalEntryPath('goal', '阅读/计划', 'entry'), '/api/goals/%E9%98%85%E8%AF%BB%2F%E8%AE%A1%E5%88%92/journal/entry')
  assert.equal(journalEntryPath('habit', 'reading', 'entry'), '/api/habits/reading/journal/entry')
  assert.equal(convertHabitToNotesPath('habit-123'), '/api/habits/habit-123/convert-to-notes')
  assert.equal(convertHabitToNotesPath('习惯/特例'), '/api/habits/%E4%B9%A0%E6%83%AF%2F%E7%89%B9%E4%BE%8B/convert-to-notes')
})

test('随记可按日期筛选，但不能伪装目标或习惯主体', () => {
  const filter = journalFeedFilterSchema.parse({ type: 'note', from: '2000-01-01', to: '2000-01-02' })
  assert.equal(journalFeedQuery(filter), 'type=note&from=2000-01-01&to=2000-01-02')
  for (const subjectId of [NOTE_SUBJECT_ID, '伪造主体']) {
    assert.equal(journalFeedFilterSchema.safeParse({ type: 'note', subjectId }).success, false)
  }
  assert.equal(journalFeedFilterSchema.safeParse({ type: 'note', from: '2026-02-30' }).success, false)
  assert.equal(journalFeedFilterSchema.safeParse({ type: 'note', from: '2026-02-10', to: '2026-02-01' }).success, false)
})

test('完整备份 v2 支持无目标和习惯的随记，拒绝非固定主体标识', () => {
  const source = noteBackup()
  assert.deepEqual(parseBackup(source), { kind: 'complete', data: source })
  assert.deepEqual(parseBackup(emptyAppData()), { kind: 'legacy', data: emptyAppData() })
  for (const subjectId of ['', 'habit-id', '__proto__']) {
    const invalid = structuredClone(source)
    invalid.journal[0]!.subjectId = subjectId
    assert.equal(completeBackupSchema.safeParse(invalid).success, false)
  }
})

test('随记数据库迁移完整保留历史记录、图片字节和索引，并保持级联清理', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('PRAGMA foreign_keys = ON')
    const migrations = readdirSync(new URL('../server/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()
    for (const name of migrations.filter(name => name < '0009_standalone_notes.sql')) {
      db.exec(readFileSync(new URL(`../server/migrations/${name}`, import.meta.url), 'utf8'))
    }
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run('owner', 'owner', 'test-only', 1)
    for (const type of ['goal', 'habit']) {
      db.prepare(`INSERT INTO goal_journal_entries
        (id, user_id, goal_id, date, content, created_at, updated_at, version, mutation_id, write_token, subject_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(`${type}-entry`, 'owner', `${type}-subject`, '2026-11-16', `历史${type}`, 'created', 'updated', 3, `${type}-mutation`, `${type}-write`, type)
      db.prepare('INSERT INTO goal_journal_images (id, user_id, entry_id, mime_type, byte_size, position, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(`${type}-image`, 'owner', `${type}-entry`, 'image/png', 4, 2, new Uint8Array([0, 1, 128, 255]))
    }
    const entries = db.prepare('SELECT * FROM goal_journal_entries ORDER BY id').all()
    const images = db.prepare('SELECT * FROM goal_journal_images ORDER BY id').all()
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    db.exec(readFileSync(new URL('../server/migrations/0009_standalone_notes.sql', import.meta.url), 'utf8'))
    assert.deepEqual(db.prepare('SELECT * FROM goal_journal_entries ORDER BY id').all(), entries)
    assert.deepEqual(db.prepare('SELECT * FROM goal_journal_images ORDER BY id').all(), images)
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all(), indexes)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
    const insert = db.prepare(`INSERT INTO goal_journal_entries
      (id, user_id, goal_id, subject_type, date, content, created_at, updated_at, mutation_id)
      VALUES (?, 'owner', ?, 'note', '2000-01-01', '随记', 'created', 'updated', 'note-mutation')`)
    insert.run('note-entry', NOTE_SUBJECT_ID)
    assert.throws(() => insert.run('forged-note', 'habit-subject'), /CHECK constraint failed/)
    db.prepare('DELETE FROM goal_journal_entries WHERE id = ?').run('goal-entry')
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM goal_journal_images').get()!.count, 1)
    db.prepare('DELETE FROM users WHERE id = ?').run('owner')
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM goal_journal_entries').get()!.count, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM goal_journal_images').get()!.count, 0)
  } finally { db.close() }
})

test('习惯修改为随记：历史图文记录完整转为随记保留图片，无记录习惯自动生成随记', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('PRAGMA foreign_keys = ON')
    const migrations = readdirSync(new URL('../server/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()
    for (const name of migrations) {
      db.exec(readFileSync(new URL(`../server/migrations/${name}`, import.meta.url), 'utf8'))
    }
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run('user1', 'user1', 'test-only', 1)

    // Case 1: 习惯有日记记录及图片
    db.prepare(`INSERT INTO goal_journal_entries
      (id, user_id, goal_id, subject_type, date, content, created_at, updated_at, version, mutation_id, write_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('entry-1', 'user1', 'habit-adblock', 'habit', '2026-11-09', 'hello world', '2026-11-09T10:00:00Z', '2026-11-09T10:00:00Z', 1, 'mut-1', 'tok-1')
    db.prepare(`INSERT INTO goal_journal_images (id, user_id, entry_id, mime_type, byte_size, position, data) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('img-1', 'user1', 'entry-1', 'image/png', 4, 0, new Uint8Array([1, 2, 3, 4]))

    const title = '去除家庭网络广告'
    const rows = db.prepare('SELECT * FROM goal_journal_entries WHERE user_id = ? AND subject_type = ? AND goal_id = ?').all('user1', 'habit', 'habit-adblock') as Array<{ id: string; content: string; version: number }>
    assert.equal(rows.length, 1)
    const content = rows[0]!.content.includes(title) ? rows[0]!.content : `### ${title}\n\n${rows[0]!.content}`
    db.prepare("UPDATE goal_journal_entries SET subject_type = 'note', goal_id = ?, content = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(NOTE_SUBJECT_ID, content, '2026-11-16T12:00:00Z', rows[0]!.id, 'user1')

    const updated = db.prepare('SELECT * FROM goal_journal_entries WHERE id = ?').get('entry-1') as { subject_type: string; goal_id: string; content: string; version: number }
    assert.equal(updated.subject_type, 'note')
    assert.equal(updated.goal_id, NOTE_SUBJECT_ID)
    assert.equal(updated.content, '### 去除家庭网络广告\n\nhello world')
    assert.equal(updated.version, 2)
    // 验证图片依然完整保留并关联
    const images = db.prepare('SELECT * FROM goal_journal_images WHERE entry_id = ?').all('entry-1') as Array<{ id: string }>
    assert.equal(images.length, 1)
    assert.equal(images[0]!.id, 'img-1')
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])

    // Case 2: 无记录的习惯转换为随记生成一条记录
    const noteId = 'new-note-1'
    db.prepare("INSERT INTO goal_journal_entries (id, user_id, goal_id, subject_type, date, content, created_at, updated_at, version, mutation_id, write_token) VALUES (?, ?, ?, 'note', ?, ?, ?, ?, 1, ?, ?)")
      .run(noteId, 'user1', NOTE_SUBJECT_ID, '2026-11-16', '### 跑步习惯\n\n每天跑 5 公里', '2026-11-16T12:00:00Z', '2026-11-16T12:00:00Z', 'mut-2', 'tok-2')
    const createdNote = db.prepare('SELECT * FROM goal_journal_entries WHERE id = ?').get(noteId) as { subject_type: string; goal_id: string; content: string }
    assert.equal(createdNote.subject_type, 'note')
    assert.equal(createdNote.goal_id, NOTE_SUBJECT_ID)
    assert.equal(createdNote.content, '### 跑步习惯\n\n每天跑 5 公里')
  } finally { db.close() }
})
