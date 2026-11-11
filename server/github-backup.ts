import { z } from 'zod'
import type { Env, User } from './types.ts'
import { completeBackupSchema } from '../shared/backup.ts'
import { GITHUB_BACKUP_LIMIT, githubConnectionInputSchema, githubRevisionSchema, githubSessionInputSchema } from '../shared/github-backup.ts'
import { HttpError, json, readBody, readLimitedBytes } from './http.ts'
import { decryptGitHubToken, encryptGitHubToken } from './github-secrets.ts'
import { listGitHubBackups, readGitHubBackup, uploadGitHubBackup, verifyGitHubRepository } from './github-client.ts'
import { hashToken } from './password.ts'

interface ConnectionRow { owner: string; repo: string; branch: string; token_encrypted: string }

async function limitRequests(env: Env, user: User, upload: boolean) {
  const now = Math.floor(Date.now() / 1000)
  const result = await env.DB.prepare(`INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts`)
    .bind(hashToken(`github:${upload ? 'upload' : 'request'}:${user.id}`), now + 60, now, now).first<{ attempts: number }>()
  if (!result || result.attempts > (upload ? 6 : 30)) throw new HttpError(429, 'GitHub 备份操作过于频繁，请稍后重试')
}

export async function handleGitHubBackup(request: Request, env: Env, user: User): Promise<Response> {
  const url = new URL(request.url)
  // 页面授权随每次 POST 传入，仅用于当前请求；不写入 D1、Cookie 或 URL。
  if (url.pathname === '/api/github-backup/session') {
    if (request.method !== 'POST') throw new HttpError(405, '不支持此请求方法')
    if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 请求')
    await limitRequests(env, user, false)
    const bytes = await readLimitedBytes(request, GITHUB_BACKUP_LIMIT + 2048)
    let input: unknown
    try { input = JSON.parse(new TextDecoder().decode(bytes)) }
    catch { throw new HttpError(400, '备份 JSON 格式不正确') }
    const parsed = githubSessionInputSchema.safeParse(input)
    if (!parsed.success) throw new HttpError(400, '仓库、令牌或备份参数不正确，请检查后重试')
    const data = parsed.data
    if (data.action === 'upload') await limitRequests(env, user, true)
    const connection = await verifyGitHubRepository(data)
    const access = { ...connection, token: data.token }
    if (data.action === 'connect') return json({ connection })
    if (data.action === 'history') return json(await listGitHubBackups(access, user.id, data.page))
    if (data.action === 'read') return json({ backup: await readGitHubBackup(access, user.id, data.ref) })
    return json({ sha: await uploadGitHubBackup(access, user.id, JSON.stringify(data.backup)) }, 201)
  }
  const root = url.pathname === '/api/github-backup'
  const history = url.pathname === '/api/github-backup/history'
  const snapshot = url.pathname === '/api/github-backup/snapshot'
  if (!root && !history && !snapshot) throw new HttpError(404, '接口不存在')
  const available = Boolean(env.GITHUB_BACKUP_SECRET && env.GITHUB_BACKUP_SECRET.length >= 32)
  const row = await env.DB.prepare('SELECT owner, repo, branch, token_encrypted FROM github_backup_connections WHERE user_id = ?').bind(user.id).first<ConnectionRow>()
  if (root && request.method === 'GET') return json({ available, connection: row ? { owner: row.owner, repo: row.repo, branch: row.branch } : null })
  if (root && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM github_backup_connections WHERE user_id = ?').bind(user.id).run()
    return json({ success: true })
  }
  if (!available) throw new HttpError(503, 'GitHub 备份尚未启用，请联系部署者配置服务端密钥')
  await limitRequests(env, user, snapshot && request.method === 'POST')
  if (root && request.method === 'PUT') {
    const parsed = githubConnectionInputSchema.safeParse(await readBody(request))
    if (!parsed.success) throw new HttpError(400, '请填写有效的仓库所有者、仓库名和 GitHub 细粒度令牌')
    const connection = await verifyGitHubRepository(parsed.data)
    const encrypted = await encryptGitHubToken(parsed.data.token, user.id, env.GITHUB_BACKUP_SECRET)
    await env.DB.prepare(`INSERT INTO github_backup_connections (user_id, owner, repo, branch, token_encrypted, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET owner = excluded.owner, repo = excluded.repo, branch = excluded.branch, token_encrypted = excluded.token_encrypted, updated_at = excluded.updated_at`)
      .bind(user.id, connection.owner, connection.repo, connection.branch, encrypted, Math.floor(Date.now() / 1000)).run()
    return json({ available: true, connection })
  }
  if (!(history && request.method === 'GET') && !(snapshot && ['GET', 'POST'].includes(request.method))) throw new HttpError(405, '不支持此请求方法')
  if (!row) throw new HttpError(400, '请先连接 GitHub 私有仓库')
  const access = { owner: row.owner, repo: row.repo, branch: row.branch, token: await decryptGitHubToken(row.token_encrypted, user.id, env.GITHUB_BACKUP_SECRET) }
  // 仓库可能被用户改为公开；所有读写都重新检查，防止继续上传私人内容。
  await verifyGitHubRepository(access)
  if (history) {
    const page = z.coerce.number().int().min(1).max(1000).safeParse(url.searchParams.get('page') ?? '1')
    if (!page.success) throw new HttpError(400, '页码不正确')
    return json(await listGitHubBackups(access, user.id, page.data))
  }
  if (request.method === 'GET') {
    const ref = githubRevisionSchema.safeParse(url.searchParams.get('ref'))
    if (!ref.success) throw new HttpError(400, '备份版本不正确')
    return json({ backup: await readGitHubBackup(access, user.id, ref.data) })
  }
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 请求')
  const bytes = await readLimitedBytes(request, GITHUB_BACKUP_LIMIT + 100)
  let input: unknown
  try { input = JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new HttpError(400, '备份 JSON 格式不正确') }
  const parsed = z.object({ backup: completeBackupSchema }).safeParse(input)
  if (!parsed.success) throw new HttpError(400, '完整备份格式不正确或图片损坏，尚未上传到 GitHub')
  const sha = await uploadGitHubBackup(access, user.id, JSON.stringify(parsed.data.backup))
  return json({ sha }, 201)
}
