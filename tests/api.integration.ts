import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { emptyAppData } from '../shared/schema.ts'
import type { JournalEntry, JournalPage } from '../shared/journal.ts'
import { bytesToBase64, completeBackupSchema } from '../shared/backup.ts'
import type { BackupManifest } from '../shared/backup.ts'

const origin = process.env.KEEPDO_TEST_ORIGIN || 'http://localhost:8787'
const local = ['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
if (!local && process.env.KEEPDO_ALLOW_REMOTE_TESTS !== '1') throw new Error('远程测试需显式设置 KEEPDO_ALLOW_REMOTE_TESTS=1')

async function request(path: string, method = 'GET', body?: unknown, cookie = '', customOrigin = origin) {
  return fetch(`${origin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: customOrigin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
}
const accounts: Array<{ id: string; username: string }> = []
test('真实 Workers/D1 的账号与持久化流程', async t => {
  const suffix = randomBytes(6).toString('hex')
  const username = `test_${suffix}`
  const password = randomBytes(24).toString('base64url')
  let cookieA = ''
  let cookieB = ''
  let secondSession = ''
  await t.test('未登录无法读取数据', async () => {
    assert.equal((await request('/api/data')).status, 401)
  })
  await t.test('注册返回安全会话，用户名忽略大小写', async () => {
    const response = await request('/api/auth/register', 'POST', { username, password })
    assert.equal(response.status, 201, await response.clone().text())
    const cookie = response.headers.get('set-cookie') || ''
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    if (!local) assert.match(cookie, /Secure/)
    cookieA = cookie.split(';')[0]!
    const payload = await response.json() as { user: { id: string; username: string } }
    accounts.push(payload.user)
    assert.equal((await request('/api/auth/register', 'POST', { username: username.toUpperCase(), password })).status, 409)
    const session = await request('/api/auth/session', 'GET', undefined, cookieA)
    assert.equal((await session.json() as { user: { username: string } }).user.username, username)
  })
  await t.test('错误密码失败，正确密码可在新设备登录', async () => {
    assert.equal((await request('/api/auth/login', 'POST', { username, password: `${password}wrong` })).status, 401)
    const response = await request('/api/auth/login', 'POST', { username: username.toUpperCase(), password })
    assert.equal(response.status, 200, await response.clone().text())
    assert.ok(response.headers.get('set-cookie'))
    secondSession = response.headers.get('set-cookie')!.split(';')[0]!
  })
  await t.test('写入后重新读取保持一致，过期版本不能覆盖', async () => {
    const initial = await (await request('/api/data', 'GET', undefined, cookieA)).json() as { version: number }
    const data = {
      ...emptyAppData(),
      goals: [{ id: 'goal-checkin-test', title: '目标打卡持久化验证', category: '成长', type: 'days', targetValue: 10, currentValue: 1, unit: '天', milestones: [], color: 'indigo', createdAt: '2026-10-27', checkIns: { '2026-10-27': true } }],
      habits: [{ id: 'goal-checkin-test', title: '习惯图文记录验证', description: '每天记录一次阅读收获，保持自己的节奏。', goalId: 'goal-checkin-test', targetPerDay: 1, unit: '次', records: {}, color: 'amber', createdAt: '2026-10-27' }],
      todos: [{ id: 'todo-test', title: '持久化验证', date: '2026-10-27', completed: true, priority: 'high', createdAt: '2026-10-27' }],
    }
    const saved = await request('/api/data', 'PUT', { data, version: initial.version }, cookieA)
    assert.equal(saved.status, 200, await saved.clone().text())
    const read = await (await request('/api/data', 'GET', undefined, secondSession)).json() as { version: number; data: unknown }
    assert.deepEqual(read.data, data)
    assert.equal(read.version, initial.version + 1)
    assert.equal((await request('/api/data', 'PUT', { data: emptyAppData(), version: initial.version }, cookieA)).status, 409)
    assert.equal((await request('/api/data', 'PUT', { data: { todos: 'invalid' }, version: read.version }, cookieA)).status, 400)
    assert.equal((await request('/api/data', 'PUT', { data, version: read.version }, cookieA, 'https://evil.example')).status, 403)
    assert.equal((await request('/api/data', 'PUT', { data, version: read.version }, cookieA, '')).status, 403)
  })
  await t.test('第二个账号与第一个账号的数据隔离', async () => {
    const response = await request('/api/auth/register', 'POST', { username: `${username}_b`, password })
    assert.equal(response.status, 201, await response.clone().text())
    cookieB = response.headers.get('set-cookie')!.split(';')[0]!
    accounts.push((await response.json() as { user: { id: string; username: string } }).user)
    const second = await (await request('/api/data', 'GET', undefined, cookieB)).json() as { data: unknown }
    assert.deepEqual(second.data, emptyAppData())
    assert.equal((await request(`/api/data?user_id=${accounts[0]!.id}`, 'GET', undefined, cookieB)).status, 200)
    const forged = await (await request(`/api/data?user_id=${accounts[0]!.id}`, 'GET', undefined, cookieB)).json() as { data: unknown }
    assert.deepEqual(forged.data, emptyAppData())
  })
  await t.test('目标图文日记持久化、编辑、分页与图片权限隔离', async () => {
    const goalPath = '/api/goals/goal-checkin-test/journal'
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
    const entryId = crypto.randomUUID()
    const initialInput = { date: '2026-10-27', content: '完成了今天的阅读，保存一张进展照片。', keepImageIds: [] as string[], version: 0, operationId: crypto.randomUUID() }
    async function saveJournal(id: string, input: typeof initialInput, images: Blob[] = [], cookie = cookieA, customOrigin = origin) {
      const form = new FormData()
      form.set('entry', JSON.stringify(input))
      images.forEach(file => form.append('images', file, 'progress.png'))
      return fetch(`${origin}${goalPath}/${id}`, { method: 'PUT', headers: { Origin: customOrigin, Cookie: cookie }, body: form })
    }
    const saved = await saveJournal(entryId, initialInput, [new Blob([png], { type: 'image/png' })])
    assert.equal(saved.status, 201, await saved.clone().text())
    const first = (await saved.json() as { entry: JournalEntry }).entry
    assert.equal(first.date, initialInput.date)
    assert.equal(first.images.length, 1)
    const image = await request(first.images[0]!.url, 'GET', undefined, secondSession)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieB)).status, 404)
    assert.equal((await request(first.images[0]!.url)).status, 401)
    assert.equal((await request(goalPath, 'GET', undefined, cookieB)).status, 404)
    assert.equal((await saveJournal(crypto.randomUUID(), initialInput, [], cookieA, 'https://evil.example')).status, 403)
    assert.equal((await saveJournal(crypto.randomUUID(), { ...initialInput, keepImageIds: [first.images[0]!.id] })).status, 400)
    assert.equal((await saveJournal(crypto.randomUUID(), initialInput, [new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' })])).status, 415)
    assert.equal((await saveJournal(crypto.randomUUID(), initialInput, [new Blob([new Uint8Array(400_001)], { type: 'image/png' })])).status, 413)
    assert.equal((await saveJournal(crypto.randomUUID(), { ...initialInput, content: '' })).status, 400)
    assert.equal((await saveJournal(crypto.randomUUID(), initialInput, Array(7).fill(new Blob([png], { type: 'image/png' })))).status, 400)
    const changed = { ...initialInput, content: '补充今天的收获与思考。', keepImageIds: first.images.map(item => item.id), version: 1, operationId: crypto.randomUUID() }
    const edit = await saveJournal(entryId, changed)
    assert.equal(edit.status, 200, await edit.clone().text())
    const edited = (await edit.json() as { entry: JournalEntry }).entry
    assert.equal(edited.version, 2)
    assert.deepEqual(edited.images, first.images)
    const retry = await saveJournal(entryId, changed)
    assert.equal(retry.status, 200)
    assert.equal((await retry.json() as { entry: JournalEntry }).entry.version, 2)
    assert.equal((await saveJournal(entryId, { ...changed, operationId: crypto.randomUUID() })).status, 409)
    const removed = await saveJournal(entryId, { ...changed, version: 2, keepImageIds: [], operationId: crypto.randomUUID() })
    assert.equal(removed.status, 200, await removed.clone().text())
    assert.equal((await removed.json() as { entry: JournalEntry }).entry.images.length, 0)
    assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
    const concurrentId = crypto.randomUUID()
    const concurrentInput = { ...initialInput, operationId: crypto.randomUUID() }
    const concurrent = await Promise.all([saveJournal(concurrentId, concurrentInput, [new Blob([png], { type: 'image/png' })]), saveJournal(concurrentId, concurrentInput, [new Blob([png], { type: 'image/png' })])])
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 201])
    for (const response of concurrent) assert.equal((await response.json() as { entry: JournalEntry }).entry.images.length, 1)
    for (let index = 0; index < 21; index++) {
      const response = await saveJournal(crypto.randomUUID(), { ...initialInput, content: `时间线记录 ${index}`, operationId: crypto.randomUUID() })
      assert.equal(response.status, 201, await response.clone().text())
    }
    const page = await (await request(goalPath, 'GET', undefined, secondSession)).json() as JournalPage
    assert.equal(page.entries.length, 20)
    assert.ok(page.nextCursor)
    const next = await (await request(`${goalPath}?cursor=${encodeURIComponent(page.nextCursor!)}`, 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal(next.entries.length, 3)
    assert.equal(new Set([...page.entries, ...next.entries].map(item => item.id)).size, 23)
    assert.equal(next.nextCursor, null)
    assert.equal((await request(`${goalPath}?cursor=invalid`, 'GET', undefined, cookieA)).status, 400)
    const summary = await (await request('/api/journal/summary', 'GET', undefined, cookieA)).json() as { dates: Record<string, string[]> }
    assert.deepEqual(summary.dates['goal-checkin-test'], ['2026-10-27'])
    const otherSummary = await (await request('/api/journal/summary', 'GET', undefined, cookieB)).json() as { dates: Record<string, string[]> }
    assert.deepEqual(otherSummary.dates, {})
  })
  await t.test('习惯图文日记按主体和账号隔离，图片可编辑且记录不改变打卡', async () => {
    const path = '/api/habits/goal-checkin-test/journal'
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
    const input = { date: '2026-10-28', content: '阅读半小时，记录今天的收获。', keepImageIds: [] as string[], version: 0, operationId: crypto.randomUUID() }
    async function saveHabit(id: string, changes: Partial<typeof input> = {}, files: Blob[] = [], cookie = cookieA) {
      const form = new FormData()
      form.set('entry', JSON.stringify({ ...input, ...changes }))
      files.forEach(file => form.append('images', file, 'habit.png'))
      return fetch(`${origin}${path}/${id}`, { method: 'PUT', headers: { Origin: origin, Cookie: cookie }, body: form })
    }
    const before = await (await request('/api/data', 'GET', undefined, cookieA)).json() as { data: { habits: unknown[]; goals: unknown[] } }
    const goalPage = await (await request('/api/goals/goal-checkin-test/journal', 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal((await request(path, 'GET', undefined, cookieA)).status, 200)
    assert.deepEqual((await (await request(path, 'GET', undefined, cookieA)).json() as JournalPage).entries, [])
    assert.equal((await request(path, 'GET', undefined, cookieB)).status, 404)
    assert.equal((await request(path)).status, 401)
    assert.equal((await request('/api/habits/missing/journal', 'GET', undefined, cookieA)).status, 404)
    assert.equal((await saveHabit(crypto.randomUUID(), {}, [], cookieB)).status, 404)
    assert.equal((await saveHabit(crypto.randomUUID(), { date: '2026-10-26' })).status, 400)
    assert.equal((await saveHabit(crypto.randomUUID(), {}, [new Blob(['<svg/>'], { type: 'image/png' })])).status, 415)
    assert.equal((await saveHabit(crypto.randomUUID(), {}, Array(7).fill(new Blob([png], { type: 'image/png' })))).status, 400)
    const saved = await saveHabit(crypto.randomUUID(), {}, [new Blob([png], { type: 'image/png' })])
    assert.equal(saved.status, 201, await saved.clone().text())
    const first = (await saved.json() as { entry: JournalEntry }).entry
    assert.equal(first.subjectType, 'habit')
    assert.equal(first.subjectId, 'goal-checkin-test')
    assert.equal(first.habitId, 'goal-checkin-test')
    assert.equal(first.goalId, undefined)
    assert.equal(first.images.length, 1)
    const image = await request(first.images[0]!.url, 'GET', undefined, secondSession)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieB)).status, 404)
    // 相同主体 ID 不共享记录；已有目标记录 ID 也不能通过习惯接口覆盖或回读。
    assert.equal((await saveHabit(goalPage.entries[0]!.id)).status, 409)
    const goalAfter = await (await request('/api/goals/goal-checkin-test/journal', 'GET', undefined, cookieA)).json() as JournalPage
    assert.deepEqual(goalAfter, goalPage)
    const changes = { content: '补充实践心得。', keepImageIds: [first.images[0]!.id], version: 1, operationId: crypto.randomUUID() }
    const edited = await saveHabit(first.id, changes)
    assert.equal(edited.status, 200, await edited.clone().text())
    assert.equal((await edited.json() as { entry: JournalEntry }).entry.version, 2)
    const retry = await saveHabit(first.id, changes)
    assert.equal(retry.status, 200)
    assert.equal((await retry.json() as { entry: JournalEntry }).entry.version, 2)
    assert.equal((await saveHabit(first.id, { ...changes, operationId: crypto.randomUUID() })).status, 409)
    const removed = await saveHabit(first.id, { ...changes, version: 2, keepImageIds: [], operationId: crypto.randomUUID() })
    assert.equal(removed.status, 200, await removed.clone().text())
    assert.equal((await removed.json() as { entry: JournalEntry }).entry.images.length, 0)
    assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
    const read = await (await request(path, 'GET', undefined, secondSession)).json() as JournalPage
    assert.equal(read.entries.length, 1)
    assert.equal(read.entries[0]!.content, changes.content)
    const summary = await (await request('/api/journal/summary', 'GET', undefined, cookieA)).json() as { dates: Record<string, string[]>; habitDates: Record<string, string[]> }
    assert.deepEqual(summary.dates['goal-checkin-test'], ['2026-10-27'])
    assert.deepEqual(summary.habitDates['goal-checkin-test'], ['2026-10-28'])
    const after = await (await request('/api/data', 'GET', undefined, secondSession)).json() as { data: { habits: unknown[]; goals: unknown[] } }
    assert.deepEqual(after.data.habits, before.data.habits)
    assert.deepEqual(after.data.goals, before.data.goals)
  })
  await t.test('记录总时间线支持跨主体排序、筛选和分页，且始终按账号隔离', async () => {
    assert.equal((await request('/api/journal')).status, 401)
    assert.equal((await request('/api/journal', 'POST', {}, cookieA)).status, 405)
    assert.equal((await request('/api/journal?type=unknown', 'GET', undefined, cookieA)).status, 400)
    assert.equal((await request('/api/journal?cursor=invalid', 'GET', undefined, cookieA)).status, 400)
    const page = await (await request('/api/journal', 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal(page.entries.length, 20)
    assert.equal(page.entries[0]!.subjectType, 'habit')
    assert.equal(page.entries[0]!.date, '2026-10-28')
    assert.ok(page.nextCursor)
    const next = await (await request(`/api/journal?cursor=${encodeURIComponent(page.nextCursor!)}`, 'GET', undefined, secondSession)).json() as JournalPage
    assert.equal(next.entries.length, 4)
    assert.equal(next.nextCursor, null)
    const combined = [...page.entries, ...next.entries]
    assert.equal(new Set(combined.map(entry => entry.id)).size, 24)
    const sorted = [...combined].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    assert.deepEqual(combined, sorted)
    assert.ok(combined.some(entry => entry.images.length > 0))
    const habits = await (await request('/api/journal?type=habit', 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal(habits.entries.length, 1)
    assert.equal(habits.entries[0]!.subjectType, 'habit')
    assert.equal(habits.nextCursor, null)
    const goals = await (await request('/api/journal?type=goal', 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal(goals.entries.length, 20)
    assert.ok(goals.entries.every(entry => entry.subjectType === 'goal'))
    const moreGoals = await (await request(`/api/journal?type=goal&cursor=${encodeURIComponent(goals.nextCursor!)}`, 'GET', undefined, cookieA)).json() as JournalPage
    assert.equal(moreGoals.entries.length, 3)
    const other = await (await request(`/api/journal?user_id=${accounts[0]!.id}`, 'GET', undefined, cookieB)).json() as JournalPage
    assert.deepEqual(other, { entries: [], nextCursor: null })
    const otherFiltered = await (await request('/api/journal?type=habit', 'GET', undefined, cookieB)).json() as JournalPage
    assert.deepEqual(otherFiltered.entries, [])
  })
  await t.test('删除图文记录校验账号与版本、清理图片并准确更新日期标记', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
    const before = await (await request('/api/data', 'GET', undefined, cookieA)).json()
    for (const collection of ['goals', 'habits']) {
      const path = `/api/${collection}/goal-checkin-test/journal`
      const id = crypto.randomUUID()
      const input = { date: '2026-10-29', content: '这是一条需要删除的错误记录', keepImageIds: [] as string[], version: 0, operationId: crypto.randomUUID() }
      async function save(id: string, changes = {}) {
        const form = new FormData()
        form.set('entry', JSON.stringify({ ...input, ...changes }))
        if (!Object.keys(changes).length) form.append('images', new Blob([png], { type: 'image/png' }), 'delete-test.png')
        const response = await fetch(`${origin}${path}/${id}`, { method: 'PUT', headers: { Origin: origin, Cookie: cookieA }, body: form })
        assert.ok(response.ok, await response.clone().text())
        return (await response.json() as { entry: JournalEntry }).entry
      }
      const first = await save(id)
      const second = await save(crypto.randomUUID())
      const body = { version: first.version }
      assert.equal((await request(`${path}/${id}`, 'DELETE', body)).status, 401)
      assert.equal((await request(`${path}/${id}`, 'DELETE', body, cookieB)).status, 404)
      assert.equal((await request(`${path}/${id}`, 'DELETE', body, cookieA, 'https://evil.example')).status, 403)
      assert.equal((await request(`${path}/invalid`, 'DELETE', body, cookieA)).status, 400)
      assert.equal((await request(`${path}/${id}`, 'DELETE', { version: 0 }, cookieA)).status, 400)
      assert.equal((await request(`${path}/${id}`, 'DELETE', {}, cookieA)).status, 400)
      const wrongCollection = collection === 'goals' ? 'habits' : 'goals'
      assert.equal((await request(`/api/${wrongCollection}/goal-checkin-test/journal/${id}`, 'DELETE', body, cookieA)).status, 404)
      assert.equal((await request(`/api/${collection}/wrong-subject/journal/${id}`, 'DELETE', body, cookieA)).status, 404)
      const edited = await save(id, { version: first.version, keepImageIds: first.images.map(image => image.id), operationId: crypto.randomUUID(), content: '另一台设备已经编辑' })
      assert.equal((await request(`${path}/${id}`, 'DELETE', body, cookieA)).status, 409)
      assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieA)).status, 200)
      const removed = await request(`${path}/${id}`, 'DELETE', { version: edited.version }, secondSession)
      assert.equal(removed.status, 200, await removed.clone().text())
      assert.deepEqual(await removed.json(), { success: true })
      assert.equal((await request(first.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
      const summaryKey = collection === 'goals' ? 'dates' : 'habitDates'
      const summary = await (await request('/api/journal/summary', 'GET', undefined, cookieA)).json() as Record<string, Record<string, string[]>>
      assert.ok(summary[summaryKey]!['goal-checkin-test']!.includes(input.date))
      const feed = await (await request('/api/journal', 'GET', undefined, cookieA)).json() as JournalPage
      assert.ok(!feed.entries.some(entry => entry.id === id))
      assert.ok(feed.entries.some(entry => entry.id === second.id))
      assert.equal((await request(`${path}/${second.id}`, 'DELETE', { version: second.version }, cookieA)).status, 200)
      assert.equal((await request(second.images[0]!.url, 'GET', undefined, cookieA)).status, 404)
      const after = await (await request('/api/journal/summary', 'GET', undefined, cookieA)).json() as Record<string, Record<string, string[]>>
      assert.ok(!after[summaryKey]!['goal-checkin-test']?.includes(input.date))
      assert.equal((await request(`${path}/${id}`, 'DELETE', { version: edited.version }, cookieA)).status, 404)
    }
    assert.deepEqual(await (await request('/api/data', 'GET', undefined, cookieA)).json(), before)
  })
  await t.test('完整备份覆盖全部历史日记及图片，跨账号原子恢复并拒绝损坏和过期请求', async () => {
    assert.equal((await request('/api/backup')).status, 401)
    assert.equal((await request('/api/backup', 'PUT', {})).status, 401)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
    for (const collection of ['goals', 'habits']) {
      const form = new FormData()
      form.set('entry', JSON.stringify({ date: '2026-10-29', content: `完整备份验证 ${collection}`, keepImageIds: [], version: 0, operationId: crypto.randomUUID() }))
      form.append('images', new Blob([png], { type: 'image/png' }), 'backup.png')
      form.append('images', new Blob([png], { type: 'image/png' }), 'backup-second.png')
      const saved = await fetch(`${origin}/api/${collection}/goal-checkin-test/journal/${crypto.randomUUID()}`, { method: 'PUT', headers: { Origin: origin, Cookie: cookieA }, body: form })
      assert.equal(saved.status, 201, await saved.clone().text())
    }
    const accountA = await (await request('/api/data', 'GET', undefined, cookieA)).json() as { data: ReturnType<typeof emptyAppData>; version: number }
    // 主体移除后仍应备份其历史记录。
    const withoutSubjects = { ...emptyAppData(), todos: accountA.data.todos }
    const removed = await request('/api/data', 'PUT', { data: withoutSubjects, version: accountA.version }, cookieA)
    assert.equal(removed.status, 200, await removed.clone().text())
    const manifest = await (await request('/api/backup', 'GET', undefined, cookieA)).json() as BackupManifest
    assert.equal(manifest.entries.length, 26)
    assert.ok(manifest.entries.some(entry => entry.subjectType === 'goal'))
    assert.ok(manifest.entries.some(entry => entry.subjectType === 'habit'))
    assert.equal(manifest.entries.filter(entry => entry.images.length === 2).length, 2)
    const journal = []
    for (const entry of manifest.entries) {
      const images = []
      for (const image of entry.images) {
        const response = await request(image.url, 'GET', undefined, cookieA)
        assert.equal(response.status, 200)
        const bytes = new Uint8Array(await response.arrayBuffer())
        assert.equal(bytes.byteLength, image.byteSize)
        images.push({ id: image.id, mimeType: image.mimeType, data: bytesToBase64(bytes) })
      }
      journal.push({ ...entry, images })
    }
    const backup = completeBackupSchema.parse({ ...withoutSubjects, format: 'keepdo-backup', backupVersion: 2, exportedAt: new Date().toISOString(), journal })
    const point = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    assert.deepEqual(point.entries, [])
    const input = { backup, version: point.version, journalRevision: point.journalRevision }
    assert.equal((await request('/api/backup', 'PUT', input, cookieB, 'https://evil.example')).status, 403)
    const corrupt = structuredClone(input)
    corrupt.backup.journal.find(entry => entry.images.length)!.images[0]!.data = '%%%%'
    assert.equal((await request('/api/backup', 'PUT', corrupt, cookieB)).status, 400)
    assert.deepEqual(await (await request('/api/backup', 'GET', undefined, cookieB)).json(), point)
    const restored = await request('/api/backup', 'PUT', input, cookieB)
    assert.equal(restored.status, 200, await restored.clone().text())
    assert.deepEqual(await restored.json(), { version: point.version + 1 })
    const after = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    assert.equal(after.entries.length, backup.journal.length)
    const originalIds = new Set(backup.journal.map(entry => entry.id))
    assert.ok(after.entries.every(entry => !originalIds.has(entry.id)))
    function contents(entries: Array<{ subjectType: string; subjectId: string; content: string; date: string; createdAt: string; updatedAt: string; version: number; images: unknown[] }>) {
      return entries.map(entry => ({ subjectType: entry.subjectType, subjectId: entry.subjectId, content: entry.content, date: entry.date, createdAt: entry.createdAt, updatedAt: entry.updatedAt, version: entry.version, imageCount: entry.images.length }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
    assert.deepEqual(contents(after.entries), contents(backup.journal))
    for (const entry of after.entries) {
      for (const image of entry.images) {
        const response = await request(image.url, 'GET', undefined, cookieB)
        assert.equal(response.status, 200)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
        assert.equal((await request(image.url, 'GET', undefined, cookieA)).status, 404)
      }
    }
    assert.deepEqual((await (await request('/api/data', 'GET', undefined, cookieB)).json() as { data: unknown }).data, withoutSubjects)
    // 即使被其他写入推进到 version + 1，过期恢复也不能越过写入令牌清理日记。
    assert.equal((await request('/api/backup', 'PUT', input, cookieB)).status, 409)
    assert.deepEqual(await (await request('/api/backup', 'GET', undefined, cookieB)).json(), after)
    // 基础版本仍相同，但另一设备删除了日记，同样应阻止覆盖。
    const toDelete = after.entries[0]!
    const path = `/api/${toDelete.subjectType === 'goal' ? 'goals' : 'habits'}/${encodeURIComponent(toDelete.subjectId)}/journal/${toDelete.id}`
    assert.equal((await request(path, 'DELETE', { version: toDelete.version }, cookieB)).status, 200)
    const changed = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    assert.equal((await request('/api/backup', 'PUT', { backup, version: after.version, journalRevision: after.journalRevision }, cookieB)).status, 409)
    assert.deepEqual(await (await request('/api/backup', 'GET', undefined, cookieB)).json(), changed)
    // 使用当前快照再次恢复，应完整替换，不能追加重复记录。
    const retry = await request('/api/backup', 'PUT', { backup, version: changed.version, journalRevision: changed.journalRevision }, cookieB)
    assert.equal(retry.status, 200, await retry.clone().text())
    const repeated = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    assert.equal(repeated.entries.length, backup.journal.length)
    // 恢复无日记的完整备份要清空对应图片，但不影响来源账号。
    const cleared = await request('/api/backup', 'PUT', { backup: { ...backup, journal: [] }, version: repeated.version, journalRevision: repeated.journalRevision }, cookieB)
    assert.equal(cleared.status, 200, await cleared.clone().text())
    const image = repeated.entries.find(entry => entry.images.length)!.images[0]!
    assert.equal((await request(image.url, 'GET', undefined, cookieB)).status, 404)
    assert.deepEqual((await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest).entries, [])
    assert.deepEqual(await (await request('/api/backup', 'GET', undefined, cookieA)).json(), manifest)
  })
  await t.test('完整恢复支持超过基础接口 1 MB 限制的真实图片正文', async () => {
    const bytes = new Uint8Array(400_000)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    const point = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    const now = new Date().toISOString()
    const backup = { ...emptyAppData(), format: 'keepdo-backup', backupVersion: 2, exportedAt: now, journal: [{
      id: crypto.randomUUID(), subjectType: 'habit', subjectId: '历史习惯', date: '2026-10-29', content: '恢复较大的图文备份', createdAt: now, updatedAt: now, version: 1,
      images: Array.from({ length: 3 }, () => ({ id: crypto.randomUUID(), mimeType: 'image/png', data: bytesToBase64(bytes) })),
    }] }
    const input = { backup, version: point.version, journalRevision: point.journalRevision }
    assert.ok(JSON.stringify(input).length > 1_000_000)
    const restored = await request('/api/backup', 'PUT', input, cookieB)
    assert.equal(restored.status, 200, await restored.clone().text())
    const after = await (await request('/api/backup', 'GET', undefined, cookieB)).json() as BackupManifest
    assert.equal(after.entries.length, 1)
    assert.equal(after.entries[0]!.images.length, 3)
    for (const image of after.entries[0]!.images) {
      const response = await request(image.url, 'GET', undefined, cookieB)
      assert.equal(response.status, 200)
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
    }
  })
  await t.test('退出使原会话失效', async () => {
    assert.equal((await request('/api/auth/logout', 'POST', {}, cookieA)).status, 200)
    assert.equal((await request('/api/data', 'GET', undefined, cookieA)).status, 401)
    assert.equal((await request('/api/auth/logout', 'POST', {}, cookieB)).status, 200)
  })
  await t.test('连续登录尝试会被限流', async () => {
    for (let attempt = 0; attempt < 15; attempt++) {
      assert.equal((await request('/api/auth/login', 'POST', { username: `rate_${suffix}`, password })).status, 401)
    }
    assert.equal((await request('/api/auth/login', 'POST', { username: `rate_${suffix}`, password })).status, 429)
  })
})
process.on('exit', () => {
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync(`.wrangler/${local ? 'local' : 'remote'}-test-users.json`, JSON.stringify(accounts))
})
