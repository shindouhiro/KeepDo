import { randomBytes, createHash } from 'node:crypto'
import type { Env, User } from './types.ts'
import type { JournalSubjectType } from '../shared/journal.ts'
import { journalSubjectLabel } from '../shared/journal.ts'
import { SHARE_ACCOUNT_BYTES_LIMIT, SHARE_COUNT_LIMIT, SHARE_ENTRY_LIMIT, SHARE_IMAGE_BYTES_LIMIT, shareRequestSchema, shareSnapshotSchema } from '../shared/journal-share.ts'
import type { ShareSelection, ShareSnapshot } from '../shared/journal-share.ts'
import { HttpError, json, readBody } from './http.ts'

interface EntryRow {
  id: string; goal_id: string; subject_type: JournalSubjectType; date: string; content: string
  version: number; mutation_id: string
}
interface ImageRow { id: string; entry_id: string; byte_size: number }
interface ShareRow { token: string; title: string; created_at: string }
const tokenPattern = /^[a-f0-9]{64}$/
const publicHeaders = { 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer' }

function link(request: Request, row: ShareRow) {
  return { token: row.token, title: row.title, createdAt: row.created_at, url: `${new URL(request.url).origin}/share/${row.token}` }
}

function withPublicImages(snapshot: ShareSnapshot, token: string): ShareSnapshot {
  return { ...snapshot, records: snapshot.records.map(record => ({ ...record, images: record.images.map(image => ({
    id: image.id, url: `/api/public/journal-shares/${token}/images/${image.id}`,
  })) })) }
}

async function prepareSnapshot(env: Env, user: User, selection: ShareSelection) {
  const condition = selection.scope === 'day' ? 'date = ?' : 'id = ?'
  const value = selection.scope === 'day' ? selection.date : selection.entryId
  const rows = (await env.DB.prepare(`SELECT id, goal_id, subject_type, date, content, version, mutation_id FROM goal_journal_entries WHERE user_id = ? AND ${condition} ORDER BY created_at, id LIMIT ?`)
    .bind(user.id, value, SHARE_ENTRY_LIMIT + 1).all<EntryRow>()).results
  if (!rows.length) throw new HttpError(404, '没有可分享的记录，请刷新后重试')
  if (rows.length > SHARE_ENTRY_LIMIT) throw new HttpError(413, '当天记录超过 200 条，请改为分享单条记录')
  const excerpt = selection.scope === 'entry' ? selection.excerpt : undefined
  if (excerpt && !rows[0]!.content.includes(excerpt)) throw new HttpError(409, '片段必须来自原记录；记录可能已更新，请重新选择')
  const ids = JSON.stringify(rows.map(row => row.id))
  const images = excerpt ? [] : (await env.DB.prepare('SELECT id, entry_id, byte_size FROM goal_journal_images WHERE user_id = ? AND entry_id IN (SELECT value FROM json_each(?)) ORDER BY position, id')
    .bind(user.id, ids).all<ImageRow>()).results
  const imageBytes = images.reduce((sum, image) => sum + image.byte_size, 0)
  if (imageBytes > SHARE_IMAGE_BYTES_LIMIT) throw new HttpError(413, '分享图片超过 8 MB，请改为分享单条记录或文字片段')
  const account = await env.DB.prepare('SELECT data FROM user_data WHERE user_id = ?').bind(user.id).first<{ data: string }>()
  const data = account ? JSON.parse(account.data) as { goals: Array<{ id: string; title: string }>; habits: Array<{ id: string; title: string }> } : { goals: [], habits: [] }
  const snapshot: ShareSnapshot = {
    title: `${rows[0]!.date} · ${selection.scope === 'day' ? '一天的记录' : excerpt ? '记录片段' : '记录分享'}`,
    scope: selection.scope, excerpt: Boolean(excerpt),
    records: rows.map(row => ({
      title: row.subject_type === 'note' ? '随记' : data[row.subject_type === 'goal' ? 'goals' : 'habits'].find(item => item.id === row.goal_id)?.title || `已删除的${journalSubjectLabel(row.subject_type)}`,
      subjectType: row.subject_type, date: row.date, content: excerpt ?? row.content,
      images: images.filter(image => image.entry_id === row.id).map(image => ({ id: image.id, url: `/api/journal/images/${image.id}` })),
    })),
  }
  const versions = JSON.stringify(rows.map(row => ({ id: row.id, version: row.version, mutation: row.mutation_id })))
  // 按最终公开图片地址计算 UTF-8 大小，为 D1 单行限制留出余量。
  if (!shareSnapshotSchema.safeParse(withPublicImages(snapshot, '0'.repeat(64))).success) throw new HttpError(413, '分享正文过多，请改为分享单条记录或文字片段')
  const revision = createHash('sha256').update(JSON.stringify({ snapshot, versions })).digest('hex')
  return { snapshot, revision, versions, images, imageBytes, condition, value, count: rows.length }
}

export async function handleJournalShares(request: Request, env: Env, user: User, path: string): Promise<Response> {
  if (path === '/api/journal-shares' && request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT token, title, created_at FROM journal_shares WHERE user_id = ? ORDER BY created_at DESC, token DESC').bind(user.id).all<ShareRow>()
    return json({ shares: rows.results.map(row => link(request, row)) })
  }
  const removal = path.match(/^\/api\/journal-shares\/([a-f0-9]{64})$/)
  if (removal && request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM journal_shares WHERE token = ? AND user_id = ? RETURNING token').bind(removal[1], user.id).first()
    if (!result) throw new HttpError(404, '分享不存在或已撤销')
    return json({ success: true })
  }
  if (!['/api/journal-shares', '/api/journal-shares/preview'].includes(path)) throw new HttpError(404, '接口不存在')
  if (request.method !== 'POST') throw new HttpError(405, '不支持此请求方法')
  const parsed = shareRequestSchema.safeParse(await readBody(request))
  if (!parsed.success) throw new HttpError(400, '分享范围不正确，请重新选择')
  const prepared = await prepareSnapshot(env, user, parsed.data.selection)
  if (path.endsWith('/preview')) return json({ snapshot: prepared.snapshot, revision: prepared.revision })
  if (parsed.data.revision !== prepared.revision) throw new HttpError(409, '记录已变化，请重新预览后再生成链接')
  const token = randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()
  const snapshot = withPublicImages(prepared.snapshot, token)
  // 插入与图片复制在同一事务中进行，并再次验证版本及整天数量，防止预览后并发写入导致内容不一致。
  const result = await env.DB.batch([
    env.DB.prepare(`INSERT INTO journal_shares (token, user_id, title, snapshot, created_at, image_bytes)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM journal_shares WHERE user_id = ?) < ?
      AND (SELECT COALESCE(SUM(image_bytes), 0) FROM journal_shares WHERE user_id = ?) + ? <= ?
      AND (SELECT COUNT(*) FROM goal_journal_entries e JOIN json_each(?) v
        ON e.id = json_extract(v.value, '$.id') AND e.version = json_extract(v.value, '$.version') AND e.mutation_id = json_extract(v.value, '$.mutation') WHERE e.user_id = ?) = ?
      AND (SELECT COUNT(*) FROM goal_journal_entries WHERE user_id = ? AND ${prepared.condition}) = ?`)
      .bind(token, user.id, snapshot.title, JSON.stringify(snapshot), createdAt, prepared.imageBytes,
        user.id, SHARE_COUNT_LIMIT, user.id, prepared.imageBytes, SHARE_ACCOUNT_BYTES_LIMIT,
        prepared.versions, user.id, prepared.count, user.id, prepared.value, prepared.count),
    env.DB.prepare(`INSERT INTO journal_share_images (share_token, id, mime_type, data)
      SELECT ?, id, mime_type, data FROM goal_journal_images WHERE user_id = ?
      AND id IN (SELECT value FROM json_each(?)) AND EXISTS (SELECT 1 FROM journal_shares WHERE token = ?)`)
      .bind(token, user.id, JSON.stringify(prepared.images.map(image => image.id)), token),
  ])
  if (!result[0]?.meta.changes) {
    const usage = await env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(image_bytes), 0) AS bytes FROM journal_shares WHERE user_id = ?').bind(user.id).first<{ count: number; bytes: number }>()
    if (usage && (usage.count >= SHARE_COUNT_LIMIT || usage.bytes + prepared.imageBytes > SHARE_ACCOUNT_BYTES_LIMIT)) throw new HttpError(409, '分享空间已满（最多 100 个链接、50 MB 图片），请先撤销旧分享')
    throw new HttpError(409, '记录已变化，请重新预览后再生成链接')
  }
  return json(link(request, { token, title: snapshot.title, created_at: createdAt }), 201)
}

export async function handlePublicJournalShare(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method !== 'GET') throw new HttpError(405, '不支持此请求方法')
  const match = path.match(/^\/api\/public\/journal-shares\/([^/]+)(?:\/images\/([a-f0-9-]{36}))?$/)
  if (!match || !tokenPattern.test(match[1]!)) throw new HttpError(404, '分享不存在或已撤销')
  if (match[2]) {
    const row = await env.DB.prepare(`SELECT i.data, i.mime_type FROM journal_share_images i JOIN journal_shares s ON s.token = i.share_token WHERE i.share_token = ? AND i.id = ?`)
      .bind(match[1], match[2]).first<{ data: number[] | ArrayBuffer; mime_type: string }>()
    if (!row) throw new HttpError(404, '图片不存在或分享已撤销')
    return new Response(new Uint8Array(row.data), { headers: {
      ...publicHeaders, 'Content-Type': row.mime_type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin',
    } })
  }
  const row = await env.DB.prepare('SELECT snapshot, created_at FROM journal_shares WHERE token = ?').bind(match[1]).first<{ snapshot: string; created_at: string }>()
  if (!row) throw new HttpError(404, '分享不存在或已撤销')
  return json({ snapshot: shareSnapshotSchema.parse(JSON.parse(row.snapshot)), createdAt: row.created_at }, 200, publicHeaders)
}
