import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, createToken, hashToken } from '../server/password.ts'
import { appDataSchema, credentialsSchema, emptyAppData } from '../shared/schema.ts'
import { assertSameOrigin } from '../server/http.ts'

test('密码使用独立盐，正确密码可验证，错误密码被拒绝', async () => {
  const password = '仅用于自动化测试的长密码'
  const first = await hashPassword(password)
  const second = await hashPassword(password)
  assert.notEqual(first, second)
  assert.ok(!first.includes(password))
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword('错误的长密码', first), false)
  assert.equal(await verifyPassword(password, 'invalid'), false)
})
test('会话令牌随机且数据库只使用摘要', () => {
  const token = createToken()
  assert.match(token, /^[a-zA-Z0-9_-]{43}$/)
  assert.notEqual(token, createToken())
  assert.equal(hashToken(token).length, 64)
  assert.notEqual(hashToken(token), token)
})
test('拒绝短密码、无效用户名、无效记录日期和重复实体', () => {
  assert.equal(credentialsSchema.safeParse({ username: 'test', password: 'short' }).success, false)
  assert.equal(credentialsSchema.safeParse({ username: "test' OR 1=1", password: 'long-test-password' }).success, false)
  assert.equal(credentialsSchema.parse({ username: 'TEST', password: 'long-test-password' }).username, 'test')
  assert.equal(appDataSchema.safeParse(emptyAppData()).success, true)
  const todo = { id: 't1', title: '测试', date: '2026-10-27', completed: false, priority: 'medium', createdAt: '2026-10-27' }
  assert.equal(appDataSchema.safeParse({ ...emptyAppData(), todos: [todo, todo] }).success, false)
  assert.equal(appDataSchema.safeParse({ ...emptyAppData(), todos: [{ ...todo, date: '2026-99-01' }] }).success, false)
  assert.equal(appDataSchema.safeParse({ ...emptyAppData(), todos: [{ ...todo, goalId: 'missing' }] }).success, false)
})
test('修改请求必须来自同源，伪造 Origin 或缺少 Origin 时拒绝', () => {
  const url = 'https://example.com/api/data'
  assert.doesNotThrow(() => assertSameOrigin(new Request(url, { headers: { Origin: 'https://example.com' } })))
  assert.throws(() => assertSameOrigin(new Request(url, { headers: { Origin: 'https://evil.example' } })))
  assert.throws(() => assertSameOrigin(new Request(url)))
})
