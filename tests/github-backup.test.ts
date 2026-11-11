import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Env } from '../server/types.ts'
import { emptyAppData } from '../shared/schema.ts'
import { GITHUB_BACKUP_LIMIT, githubConnectionInputSchema } from '../shared/github-backup.ts'
import { decryptGitHubToken, encryptGitHubToken } from '../server/github-secrets.ts'
import { handleGitHubBackup } from '../server/github-backup.ts'
import { listGitHubBackups, readGitHubBackup, uploadGitHubBackup, verifyGitHubRepository } from '../server/github-client.ts'

const secret = '仅用于本地单元测试的随机密钥'.repeat(4)
const token = 'github_pat_abcdefghijklmnopqrstuvwxyz'
const access = { owner: 'keepdo-test', repo: 'private-backups', branch: 'main', token }
const sha = 'a'.repeat(40)
const source = () => JSON.stringify({ ...emptyAppData(), format: 'keepdo-backup', backupVersion: 2, exportedAt: '2026-11-03T02:00:00.000Z', journal: [] })
const repository = (changes = {}) => ({ private: true, archived: false, name: access.repo, owner: { login: access.owner }, default_branch: 'main', permissions: { push: true }, ...changes })

test('GitHub 输入拒绝 URL、路径穿越、非法令牌与不合法仓库名', () => {
  assert.equal(githubConnectionInputSchema.safeParse(access).success, true)
  for (const changes of [{ owner: 'https://evil.example' }, { repo: '../secrets' }, { repo: '..' }, { token: `${token}\r\nHeader: value` }, { owner: '-owner' }]) {
    assert.equal(githubConnectionInputSchema.safeParse({ ...access, ...changes }).success, false)
  }
})

test('授权加密使用随机 IV，拒绝跨账号、错误密钥和篡改密文', async () => {
  const encrypted = await encryptGitHubToken(token, 'user-a', secret)
  assert.ok(!encrypted.includes(token))
  assert.notEqual(encrypted, await encryptGitHubToken(token, 'user-a', secret))
  assert.equal(await decryptGitHubToken(encrypted, 'user-a', secret), token)
  await assert.rejects(decryptGitHubToken(encrypted, 'user-b', secret), /重新连接/)
  await assert.rejects(decryptGitHubToken(encrypted, 'user-a', `${secret}x`), /重新连接/)
  await assert.rejects(decryptGitHubToken(`${encrypted.slice(0, -5)}AAAAA`, 'user-a', secret), /重新连接/)
  await assert.rejects(encryptGitHubToken(token, 'user-a', undefined), /尚未启用/)
})

test('仓库验证拦截公开、归档、无写权限仓库，固定 GitHub API 且禁止重定向', async () => {
  const original = globalThis.fetch
  try {
    for (const changes of [{ private: false }, { archived: true }, { permissions: { push: false } }]) {
      globalThis.fetch = async (input, options) => {
        assert.equal(String(input), 'https://api.github.com/repos/keepdo-test/private-backups')
        assert.equal(options?.redirect, 'manual')
        return Response.json(repository(changes))
      }
      await assert.rejects(verifyGitHubRepository(access), /私有仓库|不可写入/)
    }
    globalThis.fetch = async () => Response.json(repository())
    assert.deepEqual(await verifyGitHubRepository(access), { owner: access.owner, repo: access.repo, branch: 'main' })
    globalThis.fetch = async () => Response.json({ message: `不应转发的敏感信息 ${token}` }, { status: 401 })
    await assert.rejects(verifyGitHubRepository(access), error => error instanceof Error && !error.message.includes(token) && /令牌无效/.test(error.message))
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://untrusted.example' } })
    await assert.rejects(verifyGitHubRepository(access), /暂时无法/)
  } finally { globalThis.fetch = original }
})

test('完整备份写入账号固定路径，更新携带旧 SHA，冲突不会覆盖文件', async () => {
  const original = globalThis.fetch
  const requests: string[] = []
  try {
    globalThis.fetch = async (input, options) => {
      requests.push(String(input))
      if (options?.method !== 'PUT') return Response.json({ type: 'file', sha })
      const body = JSON.parse(String(options.body)) as { sha: string; content: string; branch: string }
      assert.equal(body.sha, sha)
      assert.equal(body.branch, 'main')
      assert.equal(Buffer.from(body.content, 'base64').toString(), source())
      return Response.json({ commit: { sha } }, { status: 201 })
    }
    assert.equal(await uploadGitHubBackup(access, 'user-a', source()), sha)
    assert.ok(requests.every(path => path.includes('/contents/keepdo/user-a/backup.json')))
    assert.equal(requests.length, 2)
    globalThis.fetch = async (_input, options) => options?.method === 'PUT' ? Response.json({}, { status: 409 }) : Response.json({ type: 'file', sha })
    await assert.rejects(uploadGitHubBackup(access, 'user-a', source()), /已变化/)
    await assert.rejects(uploadGitHubBackup(access, 'user-a', 'x'.repeat(GITHUB_BACKUP_LIMIT + 1)), /8 MB/)
  } finally { globalThis.fetch = original }
})

test('首次备份可以创建文件，历史分页按账号文件筛选并处理空仓库', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (_input, options) => options?.method === 'PUT' ? Response.json({ commit: { sha } }, { status: 201 }) : Response.json({}, { status: 404 })
    assert.equal(await uploadGitHubBackup(access, 'user-a', source()), sha)
    globalThis.fetch = async input => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('path'), 'keepdo/user-a/backup.json')
      assert.equal(url.searchParams.get('page'), '2')
      return Response.json([{ sha, commit: { message: '备份完成\n更多内容', committer: { date: '2026-11-03T01:00:00Z' } } }], { headers: { Link: '<https://api.github.com/next>; rel="next"' } })
    }
    const history = await listGitHubBackups(access, 'user-a', 2)
    assert.equal(history.entries[0]?.message, '备份完成')
    assert.equal(history.hasMore, true)
    globalThis.fetch = async () => Response.json({ message: 'Git Repository is empty.' }, { status: 409 })
    assert.deepEqual(await listGitHubBackups(access, 'user-a', 1), { entries: [], hasMore: false })
  } finally { globalThis.fetch = original }
})

test('历史恢复读取指定提交的固定文件，损坏或超限备份会被拒绝', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (input, options) => {
      assert.match(String(input), new RegExp(`/contents/keepdo/user-a/backup.json\\?ref=${sha}$`))
      assert.equal((options?.headers as Record<string, string>).Accept, 'application/vnd.github.raw+json')
      return new Response(source())
    }
    assert.deepEqual(await readGitHubBackup(access, 'user-a', sha), JSON.parse(source()))
    for (const invalid of ['<html>错误响应</html>', '{"backupVersion":9}', 'x'.repeat(GITHUB_BACKUP_LIMIT + 1)]) {
      globalThis.fetch = async () => new Response(invalid)
      await assert.rejects(readGitHubBackup(access, 'user-a', sha))
    }
  } finally { globalThis.fetch = original }
})

function testEnvironment() {
  const rows = new Map<string, { owner: string; repo: string; branch: string; token_encrypted: string }>()
  const attempts = new Map<string, number>()
  const env = {
    GITHUB_BACKUP_SECRET: secret,
    DB: {
      prepare(sql: string) {
        let args: unknown[] = []
        return {
          bind(...values: unknown[]) { args = values; return this },
          async first() {
            if (sql.includes('INSERT INTO auth_rate_limits')) {
              const key = String(args[0])
              const count = (attempts.get(key) || 0) + 1
              attempts.set(key, count)
              return { attempts: count }
            }
            return rows.get(String(args[0])) || null
          },
          async run() {
            if (sql.startsWith('DELETE')) rows.delete(String(args[0]))
            else rows.set(String(args[0]), { owner: String(args[1]), repo: String(args[2]), branch: String(args[3]), token_encrypted: String(args[4]) })
          },
        }
      },
    },
  } as unknown as Env
  return { env, rows }
}

test('GitHub 接口按账号保存密文、状态不返回令牌、断开不删除远端文件', async () => {
  const original = globalThis.fetch
  const { env, rows } = testEnvironment()
  const user = { id: 'user-a', username: 'alice' }
  const request = (path = '', method = 'GET', body?: unknown) => new Request(`https://keepdo.example/api/github-backup${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  try {
    let calls = 0
    globalThis.fetch = async () => { calls++; return Response.json(repository()) }
    const connected = await handleGitHubBackup(request('', 'PUT', access), env, user)
    assert.equal(connected.status, 200)
    assert.equal(calls, 1)
    assert.ok(rows.get(user.id)?.token_encrypted.startsWith('v1.'))
    assert.equal(await decryptGitHubToken(rows.get(user.id)!.token_encrypted, user.id, secret), token)
    const status = await handleGitHubBackup(request(), env, user)
    assert.ok(!(await status.text()).includes(token))
    const other = await handleGitHubBackup(request(), env, { id: 'user-b', username: 'bob' })
    assert.equal((await other.json() as { connection: unknown }).connection, null)
    await assert.rejects(handleGitHubBackup(request('/history'), env, { id: 'user-b', username: 'bob' }), /先连接/)
    await assert.rejects(handleGitHubBackup(request('/snapshot', 'POST', { backup: {} }), env, user), /完整备份格式/)
    globalThis.fetch = async () => Response.json(repository({ private: false }))
    await assert.rejects(handleGitHubBackup(request('/history'), env, user), /私有仓库/)
    const disconnected = await handleGitHubBackup(request('', 'DELETE'), env, user)
    assert.equal(disconnected.status, 200)
    assert.equal(rows.size, 0)
  } finally { globalThis.fetch = original }
})

test('未配置密钥时可读状态和断开，但拒绝新增授权', async () => {
  const { env } = testEnvironment()
  delete env.GITHUB_BACKUP_SECRET
  const user = { id: 'user-a', username: 'alice' }
  const status = await handleGitHubBackup(new Request('https://keepdo.example/api/github-backup'), env, user)
  assert.equal((await status.json() as { available: boolean }).available, false)
  await assert.rejects(handleGitHubBackup(new Request('https://keepdo.example/api/github-backup', { method: 'PUT' }), env, user), /尚未启用/)
  assert.equal((await handleGitHubBackup(new Request('https://keepdo.example/api/github-backup', { method: 'DELETE' }), env, user)).status, 200)
})

test('已连接账号可上传和读取完整快照，错误版本及页码被拒绝', async () => {
  const original = globalThis.fetch
  const { env, rows } = testEnvironment()
  const user = { id: 'user-a', username: 'alice' }
  rows.set(user.id, { owner: access.owner, repo: access.repo, branch: access.branch, token_encrypted: await encryptGitHubToken(token, user.id, secret) })
  const request = (suffix: string, method = 'GET', body?: unknown) => new Request(`https://keepdo.example/api/github-backup${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  try {
    globalThis.fetch = async (input, options) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/private-backups')) return Response.json(repository())
      if (options?.method === 'PUT') return Response.json({ commit: { sha } }, { status: 201 })
      if (url.searchParams.get('ref') === sha) return new Response(source())
      return Response.json({}, { status: 404 })
    }
    const uploaded = await handleGitHubBackup(request('/snapshot', 'POST', { backup: JSON.parse(source()) }), env, user)
    assert.equal(uploaded.status, 201)
    assert.deepEqual(await uploaded.json(), { sha })
    const read = await handleGitHubBackup(request(`/snapshot?ref=${sha}`), env, user)
    assert.deepEqual(await read.json(), { backup: JSON.parse(source()) })
    await assert.rejects(handleGitHubBackup(request('/snapshot?ref=../../main'), env, user), /版本不正确/)
    await assert.rejects(handleGitHubBackup(request('/history?page=-1'), env, user), /页码不正确/)
    await assert.rejects(handleGitHubBackup(request('/unknown'), env, user), /接口不存在/)
    await assert.rejects(handleGitHubBackup(request('/snapshot', 'DELETE'), env, user), /不支持/)
  } finally { globalThis.fetch = original }
})

test('页面手动授权无需服务端密钥，上传与恢复按登录账号隔离且不保存令牌', async () => {
  const original = globalThis.fetch
  const { env, rows } = testEnvironment()
  delete env.GITHUB_BACKUP_SECRET
  const user = { id: 'user-a', username: 'alice' }
  const request = (body: unknown) => new Request('https://keepdo.example/api/github-backup/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  let calls = 0
  try {
    globalThis.fetch = async (input, options) => {
      calls++
      const url = new URL(String(input))
      if (url.pathname.endsWith('/private-backups')) return Response.json(repository())
      if (url.pathname.endsWith('/commits')) {
        assert.equal(url.searchParams.get('path'), 'keepdo/user-a/backup.json')
        return Response.json([])
      }
      if (url.pathname.includes('/keepdo/user-b/')) return Response.json({}, { status: 404 })
      assert.ok(url.pathname.includes('/keepdo/user-a/backup.json'))
      if (options?.method === 'PUT') return Response.json({ commit: { sha } }, { status: 201 })
      if (url.searchParams.get('ref') === sha) return new Response(source())
      return Response.json({}, { status: 404 })
    }
    for (const invalid of [{ ...access, action: 'read', ref: '../main' }, { ...access, action: 'history', page: -1 }, { ...access, action: 'upload', backup: {} }, { action: 'connect' }]) {
      await assert.rejects(handleGitHubBackup(request(invalid), env, user), /参数不正确/)
    }
    assert.equal(calls, 0)
    const connected = await handleGitHubBackup(request({ ...access, action: 'connect' }), env, user)
    assert.equal(connected.status, 200)
    assert.ok(!(await connected.text()).includes(token))
    const history = await handleGitHubBackup(request({ ...access, action: 'history', page: 1 }), env, user)
    assert.deepEqual(await history.json(), { entries: [], hasMore: false })
    const upload = await handleGitHubBackup(request({ ...access, action: 'upload', backup: JSON.parse(source()) }), env, user)
    assert.equal(upload.status, 201)
    const read = await handleGitHubBackup(request({ ...access, action: 'read', ref: sha }), env, user)
    assert.deepEqual(await read.json(), { backup: JSON.parse(source()) })
    await assert.rejects(handleGitHubBackup(request({ ...access, action: 'read', ref: sha }), env, { id: 'user-b', username: 'bob' }), /不存在/)
    assert.equal(rows.size, 0)
    globalThis.fetch = async () => Response.json(repository({ private: false }))
    await assert.rejects(handleGitHubBackup(request({ ...access, action: 'history', page: 1 }), env, user), /私有仓库/)
    await assert.rejects(handleGitHubBackup(new Request('https://keepdo.example/api/github-backup/session'), env, user), /不支持/)
  } finally { globalThis.fetch = original }
})
