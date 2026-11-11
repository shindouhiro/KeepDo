import { z } from 'zod'
import type { GitHubConnection, GitHubHistory } from '../shared/github-backup.ts'
import { GITHUB_BACKUP_LIMIT, GITHUB_HISTORY_PAGE_SIZE, githubRevisionSchema } from '../shared/github-backup.ts'
import { bytesToBase64, completeBackupSchema } from '../shared/backup.ts'
import { HttpError, readLimitedBytes } from './http.ts'

type Access = GitHubConnection & { token: string }
const repositorySchema = z.object({
  private: z.boolean(), archived: z.boolean(), disabled: z.boolean().optional(),
  name: z.string(), owner: z.object({ login: z.string() }), default_branch: z.string(),
  permissions: z.object({ push: z.boolean().optional() }).optional(),
})

function upstreamError(status: number): never {
  if (status === 401) throw new HttpError(400, 'GitHub 令牌无效或已过期，请重新连接')
  if (status === 403 || status === 429) throw new HttpError(429, 'GitHub 拒绝访问或请求过于频繁，请检查仓库权限，稍后重试')
  if (status === 404) throw new HttpError(404, 'GitHub 仓库或备份不存在，请检查仓库与令牌权限')
  if (status === 409 || status === 422) throw new HttpError(409, 'GitHub 仓库内容已变化或分支禁止写入，请刷新历史后重试')
  throw new HttpError(502, 'GitHub 暂时无法完成请求，请稍后重试')
}

async function githubRequest(access: Pick<Access, 'owner' | 'repo' | 'token'>, suffix = '', options: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`https://api.github.com/repos/${encodeURIComponent(access.owner)}/${encodeURIComponent(access.repo)}${suffix}`, {
      // Workers 不支持 redirect: error；手动模式保留 3xx，由状态检查拒绝。
      ...options, redirect: 'manual', signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'KeepDo-Backup',
        Authorization: `Bearer ${access.token}`, ...options.headers,
      },
    })
  } catch { throw new HttpError(502, '无法连接 GitHub，请稍后重试，当前账号数据未更改') }
}

async function readGitHubJSON(response: Response): Promise<unknown> {
  if (!response.ok) upstreamError(response.status)
  try { return JSON.parse(new TextDecoder().decode(await readLimitedBytes(response, 1_000_000))) }
  catch { throw new HttpError(502, 'GitHub 响应异常，请稍后重试') }
}

function parseGitHub<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(502, 'GitHub 响应格式异常，请稍后重试')
  return result.data
}

export async function verifyGitHubRepository(access: Pick<Access, 'owner' | 'repo' | 'token'>): Promise<GitHubConnection> {
  const repo = parseGitHub(repositorySchema, await readGitHubJSON(await githubRequest(access)))
  if (!repo.private) throw new HttpError(400, '请使用私有仓库，避免公开个人日记与图片')
  if (repo.archived || repo.disabled || repo.permissions?.push === false) throw new HttpError(400, '仓库不可写入，请检查归档状态及 Contents 读写权限')
  return { owner: repo.owner.login, repo: repo.name, branch: repo.default_branch }
}

function filePath(userId: string) {
  return `keepdo/${encodeURIComponent(userId)}/backup.json`
}

export async function uploadGitHubBackup(access: Access, userId: string, source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source)
  if (bytes.byteLength > GITHUB_BACKUP_LIMIT) throw new HttpError(413, '完整备份超过 GitHub 单次 8 MB 上限，请使用本地导出')
  const path = filePath(userId)
  const current = await githubRequest(access, `/contents/${path}?ref=${encodeURIComponent(access.branch)}`, { headers: { Accept: 'application/vnd.github.object+json' } })
  let sha: string | undefined
  if (current.status !== 404) {
    sha = parseGitHub(z.object({ type: z.literal('file'), sha: githubRevisionSchema }), await readGitHubJSON(current)).sha
  }
  const result = await githubRequest(access, `/contents/${path}`, {
    method: 'PUT', body: JSON.stringify({
      message: `KeepDo 完整备份 ${new Date().toISOString()}`, branch: access.branch,
      content: bytesToBase64(bytes), ...(sha ? { sha } : {}),
    }),
  })
  return parseGitHub(z.object({ commit: z.object({ sha: githubRevisionSchema }) }), await readGitHubJSON(result)).commit.sha
}

export async function listGitHubBackups(access: Access, userId: string, page: number): Promise<GitHubHistory> {
  const query = new URLSearchParams({ path: decodeURIComponent(filePath(userId)), sha: access.branch, per_page: String(GITHUB_HISTORY_PAGE_SIZE), page: String(page) })
  const response = await githubRequest(access, `/commits?${query}`)
  // 新建但尚未提交文件的空仓库没有历史。
  if (response.status === 409) {
    const error = await response.json() as { message?: unknown }
    if (error.message === 'Git Repository is empty.') return { entries: [], hasMore: false }
    upstreamError(response.status)
  }
  const rows = parseGitHub(z.array(z.object({
    sha: githubRevisionSchema, commit: z.object({ message: z.string(), committer: z.object({ date: z.iso.datetime({ offset: true }) }) }),
  })), await readGitHubJSON(response))
  return {
    entries: rows.map(row => ({ sha: row.sha, date: new Date(row.commit.committer.date).toISOString(), message: row.commit.message.split('\n')[0]!.slice(0, 200) })),
    hasMore: /rel="next"/.test(response.headers.get('Link') || ''),
  }
}

export async function readGitHubBackup(access: Access, userId: string, revision: string) {
  const response = await githubRequest(access, `/contents/${filePath(userId)}?ref=${revision}`, { headers: { Accept: 'application/vnd.github.raw+json' } })
  if (!response.ok) upstreamError(response.status)
  const bytes = await readLimitedBytes(response, GITHUB_BACKUP_LIMIT)
  try { return completeBackupSchema.parse(JSON.parse(new TextDecoder().decode(bytes))) }
  catch { throw new HttpError(400, '该版本不是有效的完整备份或图片已损坏，当前数据未更改') }
}
