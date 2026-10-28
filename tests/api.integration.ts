import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { emptyAppData } from '../shared/schema.ts'

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
