import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { emptyAppData } from '../shared/schema.ts'
import { NOTE_SUBJECT_ID } from '../shared/journal.ts'
import type { JournalEntry, JournalPage } from '../shared/journal.ts'
import { bytesToBase64, completeBackupSchema } from '../shared/backup.ts'
import type { BackupManifest } from '../shared/backup.ts'

const origin = process.env.KEEPDO_TEST_ORIGIN || 'http://localhost:8787'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('随记集成测试仅允许本地 Worker')
const accounts: Array<{ id: string; username: string }> = []
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')

function request(path: string, method = 'GET', body?: unknown, cookie = '', extra: Record<string, string> = {}) {
  return fetch(`${origin}${path}`, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  })
}
function saveNote(id: string, cookie: string, changes: Record<string, unknown> = {}, includeImage = false, nativeToken = '') {
  const form = new FormData()
  form.set('entry', JSON.stringify({ date: '2000-01-01', content: '无须每天重复的随记', keepImageIds: [], version: 0, operationId: crypto.randomUUID(), ...changes }))
  if (includeImage) form.append('images', new Blob([png], { type: 'image/png' }), 'note.png')
  const headers = nativeToken ? { 'X-KeepDo-Client': 'native-v1', Authorization: `Bearer ${nativeToken}` } : { Origin: origin, Cookie: cookie }
  return fetch(`${origin}/api/${nativeToken ? 'native/' : ''}notes/${id}`, { method: 'PUT', headers, body: form, signal: AbortSignal.timeout(30_000) })
}
async function readJson<T>(path: string, cookie: string): Promise<T> {
  const response = await request(path, 'GET', undefined, cookie)
  assert.equal(response.status, 200, await response.clone().text())
  return await response.json() as T
}
async function savedEntry(response: Response, status: number): Promise<JournalEntry> {
  assert.equal(response.status, status, await response.clone().text())
  return (await response.json() as { entry: JournalEntry }).entry
}

test('独立随记复用记录与备份能力，同时与习惯、目标和其他账号隔离', async t => {
  const username = `notes_${randomBytes(6).toString('hex')}`
  const password = randomBytes(24).toString('base64url')
  const cookies: string[] = []
  for (const name of [username, `${username}_b`]) {
    const response = await request('/api/auth/register', 'POST', { username: name, password })
    assert.equal(response.status, 201, await response.clone().text())
    accounts.push((await response.json() as { user: { id: string; username: string } }).user)
    cookies.push(response.headers.get('set-cookie')!.split(';')[0]!)
  }
  const [cookieA, cookieB] = cookies as [string, string]
  t.after(async () => {
    await Promise.all(cookies.map(cookie => request('/api/auth/logout', 'POST', {}, cookie)))
    mkdirSync('.wrangler', { recursive: true })
    writeFileSync('.wrangler/notes-test-users.json', JSON.stringify(accounts))
  })
  const initial = await readJson<{ data: ReturnType<typeof emptyAppData>; version: number }>('/api/data', cookieA)
  assert.deepEqual(initial.data, emptyAppData())
  const id = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  let note: JournalEntry

  await t.test('空账号可直接建立历史日期图文随记，重复提交幂等且不改变基础数据', async () => {
    note = await savedEntry(await saveNote(id, cookieA, { operationId }, true), 201)
    assert.equal(note.subjectType, 'note')
    assert.equal(note.subjectId, NOTE_SUBJECT_ID)
    assert.equal(note.date, '2000-01-01')
    assert.equal(note.goalId, undefined)
    assert.equal(note.habitId, undefined)
    assert.equal(note.images.length, 1)
    const retry = await savedEntry(await saveNote(id, cookieA, { operationId }, true), 200)
    assert.deepEqual(retry, note)
    assert.deepEqual(await readJson('/api/data', cookieA), initial)
    assert.deepEqual(await readJson('/api/journal/summary', cookieA), { dates: {}, habitDates: {} })
  })
  await t.test('全部记录和随记日期筛选可见，目标与习惯分类和伪主体筛选隔离', async () => {
    for (const path of ['/api/journal', '/api/journal?type=note', '/api/journal?type=note&from=2000-01-01&to=2000-01-01']) {
      const page = await readJson<JournalPage>(path, cookieA)
      assert.deepEqual(page.entries.map(entry => entry.id), [id])
    }
    for (const path of ['/api/journal?type=goal', '/api/journal?type=habit', '/api/journal?type=note&from=2000-01-02']) {
      assert.deepEqual((await readJson<JournalPage>(path, cookieA)).entries, [])
    }
    for (const subjectId of [NOTE_SUBJECT_ID, 'forged-subject']) {
      assert.equal((await request(`/api/journal?type=note&subjectId=${subjectId}`, 'GET', undefined, cookieA)).status, 400)
    }
    assert.equal((await request('/api/journal?type=note&from=2000-02-30', 'GET', undefined, cookieA)).status, 400)
  })
  await t.test('读写要求认证、同源与合法表单，跨账号记录和图片不能访问', async () => {
    assert.equal((await saveNote(crypto.randomUUID(), '')).status, 401)
    assert.equal((await request(`/api/notes/${id}`, 'PUT', {}, cookieA, { Origin: 'https://evil.example' })).status, 403)
    assert.equal((await request(`/api/notes/${id}`, 'PUT', {}, cookieA)).status, 415)
    assert.equal((await saveNote('invalid', cookieA)).status, 400)
    assert.equal((await saveNote(crypto.randomUUID(), cookieA, { content: ' ' })).status, 400)
    assert.equal((await saveNote(crypto.randomUUID(), cookieA, { date: '2000-02-30' })).status, 400)
    assert.equal((await saveNote(crypto.randomUUID(), cookieA, { keepImageIds: [note.images[0]!.id] })).status, 400)
    assert.equal((await request(`/api/notes/${id}`, 'DELETE', { version: note.version }, cookieB)).status, 404)
    assert.equal((await saveNote(id, cookieB)).status, 409)
    assert.equal((await request(note.images[0]!.url, 'GET', undefined, cookieB)).status, 404)
    assert.equal((await request(note.images[0]!.url)).status, 401)
    assert.deepEqual((await readJson<JournalPage>('/api/journal?type=note', cookieB)).entries, [])
    const image = await request(note.images[0]!.url, 'GET', undefined, cookieA)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
  })
  await t.test('并发编辑只有一个成功，过期删除不能清理最新图片', async () => {
    const version = note.version
    const results = await Promise.all(['编辑 A', '编辑 B'].map(content => saveNote(id, cookieA, { content, version, keepImageIds: note.images.map(image => image.id) })))
    assert.deepEqual(results.map(response => response.status).sort(), [200, 409])
    note = await savedEntry(results.find(response => response.status === 200)!, 200)
    assert.equal(note.version, version + 1)
    assert.equal((await request(`/api/notes/${id}`, 'DELETE', { version }, cookieA)).status, 409)
    assert.equal((await request(note.images[0]!.url, 'GET', undefined, cookieA)).status, 200)
    assert.deepEqual(await readJson('/api/data', cookieA), initial)
  })
  await t.test('完整备份 v2 保留随记与图片，跨账号恢复重新分配标识并拒绝伪主体', async () => {
    const manifest = await readJson<BackupManifest>('/api/backup', cookieA)
    assert.equal(manifest.entries.length, 1)
    const journal = await Promise.all(manifest.entries.map(async entry => ({
      ...entry, images: await Promise.all(entry.images.map(async image => ({
        id: image.id, mimeType: image.mimeType,
        data: bytesToBase64(new Uint8Array(await (await request(image.url, 'GET', undefined, cookieA)).arrayBuffer())),
      }))),
    })))
    const backup = completeBackupSchema.parse({ ...initial.data, format: 'keepdo-backup', backupVersion: 2, exportedAt: new Date().toISOString(), journal })
    const point = await readJson<BackupManifest>('/api/backup', cookieB)
    const input = { backup, version: point.version, journalRevision: point.journalRevision }
    const invalid = structuredClone(input)
    invalid.backup.journal[0]!.subjectId = 'forged-habit'
    assert.equal((await request('/api/backup', 'PUT', invalid, cookieB)).status, 400)
    assert.deepEqual(await readJson('/api/backup', cookieB), point)
    const restored = await request('/api/backup', 'PUT', input, cookieB)
    assert.equal(restored.status, 200, await restored.clone().text())
    const entry = (await readJson<JournalPage>('/api/journal?type=note', cookieB)).entries[0]!
    assert.notEqual(entry.id, id)
    assert.equal(entry.subjectType, 'note')
    assert.equal(entry.subjectId, NOTE_SUBJECT_ID)
    assert.equal(entry.content, note.content)
    assert.equal(entry.date, note.date)
    assert.notEqual(entry.images[0]!.id, note.images[0]!.id)
    assert.deepEqual(Buffer.from(await (await request(entry.images[0]!.url, 'GET', undefined, cookieB)).arrayBuffer()), png)
    assert.equal((await request(entry.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
    assert.deepEqual(await readJson('/api/journal/summary', cookieB), { dates: {}, habitDates: {} })
    assert.equal((await request('/api/backup', 'PUT', input, cookieB)).status, 409)
  })
  await t.test('原生通道可写随记、读筛选和图片，保持浏览器来源隔离', async () => {
    const nativeHeaders = { 'X-KeepDo-Client': 'native-v1', 'Content-Type': 'application/json' }
    const login = await fetch(`${origin}/api/native/auth/login`, { method: 'POST', headers: nativeHeaders, body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(30_000) })
    assert.equal(login.status, 200, await login.clone().text())
    const { token } = await login.json() as { token: string }
    const headers = { ...nativeHeaders, Authorization: `Bearer ${token}` }
    try {
      const nativeNote = await savedEntry(await saveNote(crypto.randomUUID(), '', { date: '2001-01-01', content: '原生随记' }, true, token), 201)
      const feed = await fetch(`${origin}/api/native/journal?type=note`, { headers })
      assert.equal(feed.status, 200)
      assert.ok((await feed.json() as JournalPage).entries.some(entry => entry.id === nativeNote.id))
      const image = await fetch(`${origin}${nativeNote.images[0]!.url.replace('/api/', '/api/native/')}`, { headers })
      assert.equal(image.status, 200)
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
      assert.equal((await fetch(`${origin}/api/native/notes/${nativeNote.id}`, { method: 'DELETE', headers: { ...headers, Origin: origin }, body: JSON.stringify({ version: nativeNote.version }) })).status, 403)
      assert.equal((await fetch(`${origin}/api/native/notes/${nativeNote.id}`, { method: 'DELETE', headers, body: JSON.stringify({ version: nativeNote.version }) })).status, 200)
      assert.deepEqual(await readJson('/api/data', cookieA), initial)
    } finally {
      await fetch(`${origin}/api/native/auth/logout`, { method: 'POST', headers, body: '{}' })
    }
  })
  await t.test('删除随记级联清理图片，不改变习惯打卡和基础版本', async () => {
    assert.equal((await request(`/api/notes/${id}`, 'DELETE', { version: note.version }, cookieA)).status, 200)
    assert.equal((await request(note.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
    assert.equal((await request(`/api/notes/${id}`, 'DELETE', { version: note.version }, cookieA)).status, 404)
    assert.deepEqual((await readJson<JournalPage>('/api/journal?type=note', cookieA)).entries, [])
    assert.deepEqual(await readJson('/api/journal/summary', cookieA), { dates: {}, habitDates: {} })
    assert.deepEqual(await readJson('/api/data', cookieA), initial)
  })
})
