import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JournalEntry } from '../shared/journal.ts'
import type { ShareLink, SharePreview, ShareSelection } from '../shared/journal-share.ts'
import { publicShareSchema } from '../shared/journal-share.ts'

const origin = process.env.KEEPDO_TEST_ORIGIN || 'http://localhost:8787'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('分享集成测试仅允许本地运行')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
async function request(path: string, method = 'GET', body?: unknown, cookie = '', requestOrigin = origin) {
  return fetch(`${origin}${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
}
async function account() {
  const result = await request('/api/auth/register', 'POST', { username: `share_${crypto.randomUUID().slice(0, 8)}`, password: crypto.randomUUID() })
  assert.equal(result.status, 201, await result.clone().text())
  return result.headers.get('set-cookie')!.split(';')[0]!
}
async function note(cookie: string, content: string, date = '2026-11-16', image = false, existing?: JournalEntry) {
  const form = new FormData()
  form.set('entry', JSON.stringify({ date, content, version: existing?.version ?? 0, keepImageIds: [], operationId: crypto.randomUUID() }))
  if (image) form.append('images', new Blob([png], { type: 'image/png' }), 'share.png')
  const result = await fetch(`${origin}/api/notes/${existing?.id ?? crypto.randomUUID()}`, { method: 'PUT', headers: { Origin: origin, Cookie: cookie }, body: form })
  assert.ok(result.ok, await result.clone().text())
  return (await result.json() as { entry: JournalEntry }).entry
}
async function preview(cookie: string, selection: ShareSelection) {
  const response = await request('/api/journal-shares/preview', 'POST', { selection }, cookie)
  assert.equal(response.status, 200, await response.clone().text())
  return await response.json() as SharePreview
}
async function create(cookie: string, selection: ShareSelection) {
  const prepared = await preview(cookie, selection)
  const response = await request('/api/journal-shares', 'POST', { selection, revision: prepared.revision }, cookie)
  assert.equal(response.status, 201, await response.clone().text())
  return await response.json() as ShareLink
}

test('真实 Workers/D1 分享范围、快照、匿名访问与撤销', async t => {
  const cookieA = await account()
  const cookieB = await account()
  let entry = await note(cookieA, '# 公开的标题\n\n只分享这一段\n\n这段保持私密', '2026-11-16', true)
  const foreign = await note(cookieB, '另一账号的私密内容')
  const selection: ShareSelection = { scope: 'entry', entryId: entry.id }
  let full: ShareLink
  let excerpt: ShareLink
  let sharedImage = ''
  await t.test('创建和管理需要登录，不能分享或读取其他账号的私密原记录', async () => {
    assert.equal((await request('/api/journal-shares')).status, 401)
    assert.equal((await request('/api/journal-shares/preview', 'POST', { selection })).status, 401)
    assert.equal((await request('/api/journal-shares/preview', 'POST', { selection }, cookieB)).status, 404)
    assert.equal((await request('/api/journal-shares/preview', 'POST', { selection }, cookieA, 'https://evil.example')).status, 403)
    assert.equal((await request('/api/journal-shares', 'POST', { selection }, cookieA)).status, 409)
    assert.equal((await request('/api/journal-shares/preview', 'POST', { selection: { scope: 'entry', entryId: foreign.id } }, cookieA)).status, 404)
  })
  await t.test('完整图文使用独立公开图片，公开载荷不含账号、主体 ID 或原文版本', async () => {
    full = await create(cookieA, selection)
    const response = await request(`/api/public/journal-shares/${full.token}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.match(response.headers.get('x-robots-tag')!, /noindex/)
    const raw = await response.json()
    const data = publicShareSchema.parse(raw)
    assert.equal(data.snapshot.records[0]!.content, entry.content)
    assert.equal(data.snapshot.records[0]!.images.length, 1)
    for (const key of ['userId', 'username', 'subjectId', 'entryId', 'version']) assert.ok(!JSON.stringify(raw).includes(`"${key}"`))
    sharedImage = data.snapshot.records[0]!.images[0]!.url
    const image = await request(sharedImage)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    assert.equal((await request(entry.images[0]!.url)).status, 401)
    assert.equal((await request(`/api/public/journal-shares/${'0'.repeat(64)}`)).status, 404)
    assert.equal((await request(sharedImage.replace(full.token, '0'.repeat(64)))).status, 404)
    const page = await fetch(full.url)
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
    assert.match(await page.text(), /id="app"/)
  })
  await t.test('片段只公开选中的连续文字且不复制图片', async () => {
    excerpt = await create(cookieA, { ...selection, excerpt: '只分享这一段' })
    const data = publicShareSchema.parse(await (await request(`/api/public/journal-shares/${excerpt.token}`)).json())
    assert.equal(data.snapshot.records[0]!.content, '只分享这一段')
    assert.deepEqual(data.snapshot.records[0]!.images, [])
    assert.equal((await request(sharedImage.replace(full.token, excerpt.token))).status, 404)
    assert.equal((await request('/api/journal-shares/preview', 'POST', { selection: { ...selection, excerpt: '篡改后的片段' } }, cookieA)).status, 409)
  })
  await t.test('预览后源记录变更会阻止发布；已生成的图文快照不受编辑或删除影响', async () => {
    const before = await preview(cookieA, selection)
    entry = await note(cookieA, '后来添加的私密内容', '2026-11-16', false, entry)
    assert.equal((await request('/api/journal-shares', 'POST', { selection, revision: before.revision }, cookieA)).status, 409)
    assert.equal((await request(`/api/notes/${entry.id}`, 'DELETE', { version: entry.version }, cookieA)).status, 200)
    const data = publicShareSchema.parse(await (await request(`/api/public/journal-shares/${full.token}`)).json())
    assert.ok(data.snapshot.records[0]!.content.includes('只分享这一段'))
    assert.ok(!JSON.stringify(data).includes('后来添加的私密内容'))
    assert.equal((await request(sharedImage)).status, 200)
  })
  await t.test('整天分享包含超过一页的记录，不包含相邻日期或其他账号', async () => {
    const state = await (await request('/api/data', 'GET', undefined, cookieA)).json() as { version: number }
    const base = { id: 'share-subject', title: '分享测试主体', createdAt: '2026-11-01', color: 'indigo' }
    const saved = await request('/api/data', 'PUT', { version: state.version, data: {
      goals: [{ ...base, category: '学习', type: 'days', targetValue: 30, currentValue: 0, unit: '天', milestones: [] }],
      habits: [{ ...base, targetPerDay: 1, unit: '次', records: {} }], todos: [], categories: ['学习'],
    } }, cookieA)
    assert.equal(saved.status, 200, await saved.clone().text())
    for (const collection of ['goals', 'habits']) {
      const form = new FormData()
      form.set('entry', JSON.stringify({ date: '2026-11-16', content: `${collection} 的图文日记`, version: 0, keepImageIds: [], operationId: crypto.randomUUID() }))
      const response = await fetch(`${origin}/api/${collection}/share-subject/journal/${crypto.randomUUID()}`, { method: 'PUT', headers: { Origin: origin, Cookie: cookieA }, body: form })
      assert.equal(response.status, 201, await response.clone().text())
    }
    for (let index = 0; index < 23; index++) await note(cookieA, `当天第 ${index + 1} 条`)
    await note(cookieA, '前一天不分享', '2026-11-15')
    await note(cookieA, '后一天不分享', '2026-11-17')
    const day: ShareSelection = { scope: 'day', date: '2026-11-16' }
    const before = await preview(cookieA, day)
    assert.equal(before.snapshot.records.length, 25)
    assert.deepEqual(new Set(before.snapshot.records.map(record => record.subjectType)), new Set(['goal', 'habit', 'note']))
    await note(cookieA, '刚增加的一条')
    assert.equal((await request('/api/journal-shares', 'POST', { selection: day, revision: before.revision }, cookieA)).status, 409)
    const shared = await create(cookieA, day)
    const data = publicShareSchema.parse(await (await request(`/api/public/journal-shares/${shared.token}`)).json())
    assert.equal(data.snapshot.records.length, 26)
    assert.ok(data.snapshot.records.every(record => record.date === day.date))
    assert.ok(!JSON.stringify(data).includes('另一账号'))
    assert.equal((await request(`/api/journal-shares/${shared.token}`, 'DELETE', undefined, cookieA)).status, 200)
  })
  await t.test('仅所有者能管理及撤销，撤销同步阻断匿名图片访问', async () => {
    const owned = await (await request('/api/journal-shares', 'GET', undefined, cookieA)).json() as { shares: ShareLink[] }
    assert.equal(owned.shares.length, 2)
    assert.deepEqual(await (await request('/api/journal-shares', 'GET', undefined, cookieB)).json(), { shares: [] })
    assert.equal((await request(`/api/journal-shares/${full.token}`, 'DELETE', undefined, cookieB)).status, 404)
    assert.equal((await request(`/api/journal-shares/${full.token}`, 'DELETE')).status, 401)
    assert.equal((await request(`/api/journal-shares/${full.token}`, 'DELETE', undefined, cookieA)).status, 200)
    assert.equal((await request(`/api/public/journal-shares/${full.token}`)).status, 404)
    assert.equal((await request(sharedImage)).status, 404)
    assert.equal((await request(`/api/public/journal-shares/${excerpt.token}`)).status, 200)
    assert.equal((await request(`/api/journal-shares/${excerpt.token}`, 'DELETE', undefined, cookieA)).status, 200)
  })
})
