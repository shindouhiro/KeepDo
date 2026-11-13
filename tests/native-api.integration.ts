import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { emptyAppData } from '../shared/schema.ts'
import type { JournalEntry } from '../shared/journal.ts'

const origin = process.env.KEEPDO_TEST_ORIGIN || 'http://localhost:8787'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname) && process.env.KEEPDO_ALLOW_REMOTE_TESTS !== '1') throw new Error('远程测试需显式授权')
const accounts: Array<{ id: string; username: string }> = []
const headers = { 'X-KeepDo-Client': 'native-v1', 'Content-Type': 'application/json' }
function request(path: string, method = 'GET', body?: unknown, token = '', extra: Record<string, string> = {}) {
  return fetch(`${origin}/api/native${path}`, {
    method, headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  })
}

test('原生会话与 Web 隔离并完整复用数据、图文、备份接口', async t => {
  const username = `native_${randomBytes(5).toString('hex')}`
  const password = randomBytes(24).toString('base64url')
  let token = ''
  let cookie = ''
  let imageUrl = ''
  await t.test('注册只返回原生令牌，不设置 Cookie', async () => {
    const response = await request('/auth/register', 'POST', { username, password })
    assert.equal(response.status, 201, await response.clone().text())
    assert.equal(response.headers.get('set-cookie'), null)
    const result = await response.json() as { token: string; user: { id: string; username: string } }
    assert.match(result.token, /^[a-zA-Z0-9_-]{43}$/)
    token = result.token
    accounts.push(result.user)
    const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie')!.split(';')[0]!
    assert.equal((await login.json() as { token?: string }).token, undefined)
  })
  await t.test('禁止 Cookie 替代、Web 令牌互用、浏览器原生请求和无同源写入', async () => {
    assert.equal((await request('/data')).status, 401)
    assert.equal((await request('/data', 'GET', undefined, '', { Cookie: cookie })).status, 401)
    const webToken = cookie.split('=')[1]!
    assert.equal((await request('/data', 'GET', undefined, webToken)).status, 401)
    assert.equal((await fetch(`${origin}/api/data`, { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    assert.equal((await request('/data', 'GET', undefined, token, { Origin: origin })).status, 403)
    assert.equal((await request('/data', 'GET', undefined, token, { 'Sec-Fetch-Site': 'same-origin' })).status, 403)
    assert.equal((await fetch(`${origin}/api/native/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })).status, 403)
    assert.equal((await fetch(`${origin}/api/data`, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403)
  })
  await t.test('原生保存后 Web 可见，仍然执行版本校验', async () => {
    const data = { ...emptyAppData(), goals: [{ id: 'native-goal', title: '跨平台验证', category: '成长', type: 'days', targetValue: 10, currentValue: 0, unit: '天', milestones: [], color: 'indigo', createdAt: '2026-11-13' }] }
    const saved = await request('/data', 'PUT', { data, version: 0 }, token)
    assert.equal(saved.status, 200, await saved.clone().text())
    const web = await fetch(`${origin}/api/data`, { headers: { Cookie: cookie } })
    assert.deepEqual((await web.json() as { data: unknown }).data, data)
    assert.equal((await request('/data', 'PUT', { data, version: 0 }, token)).status, 409)
  })
  await t.test('multipart 图片可上传、鉴权读取、从原生时间线与备份找到', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64')
    const form = new FormData()
    form.set('entry', JSON.stringify({ date: '2026-11-13', content: '原生图文记录', keepImageIds: [], version: 0, operationId: crypto.randomUUID() }))
    form.append('images', new Blob([png], { type: 'image/png' }), 'native.png')
    const response = await fetch(`${origin}/api/native/goals/native-goal/journal/${crypto.randomUUID()}`, { method: 'PUT', headers: { 'X-KeepDo-Client': 'native-v1', Authorization: `Bearer ${token}` }, body: form })
    assert.equal(response.status, 201, await response.clone().text())
    imageUrl = (await response.json() as { entry: JournalEntry }).entry.images[0]!.url
    const image = await request(imageUrl.replace('/api', ''), 'GET', undefined, token)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    const feed = await request('/journal', 'GET', undefined, token)
    assert.equal((await feed.json() as { entries: unknown[] }).entries.length, 1)
    const backup = await request('/backup', 'GET', undefined, token)
    assert.equal((await backup.json() as { entries: unknown[] }).entries.length, 1)
    assert.equal((await request('/github-backup', 'GET', undefined, token)).status, 200)
  })
  await t.test('退出撤销原生会话和图片访问，但保留 Web 会话', async () => {
    assert.equal((await request('/auth/logout', 'POST', {}, token)).status, 200)
    assert.equal((await request('/data', 'GET', undefined, token)).status, 401)
    assert.equal((await request(imageUrl.replace('/api', ''), 'GET', undefined, token)).status, 401)
    assert.equal((await fetch(`${origin}/api/data`, { headers: { Cookie: cookie } })).status, 200)
    assert.equal((await request('/auth/session', 'GET', undefined, token)).status, 200)
    assert.deepEqual(await (await request('/auth/session', 'GET', undefined, token)).json(), { user: null })
    await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } })
  })
})
process.on('exit', () => {
  mkdirSync('.wrangler', { recursive: true })
  writeFileSync('.wrangler/native-test-users.json', JSON.stringify(accounts))
})
