import { z } from 'zod'
import type { Env, User } from './types.ts'
import type { JournalSubjectType } from '../shared/journal.ts'
import { BACKUP_BODY_LIMIT, base64ToBytes, completeBackupSchema } from '../shared/backup.ts'
import { appDataSchema } from '../shared/schema.ts'
import { HttpError, json, readLimitedBytes } from './http.ts'

interface EntryRow {
  id: string; goal_id: string; subject_type: JournalSubjectType; date: string; content: string
  created_at: string; updated_at: string; version: number; mutation_id: string
}
interface ImageRow { id: string; entry_id: string; mime_type: string; byte_size: number }
// 与元数据查询采用相同排序，覆盖新增、修改、删除以及删除后重建的情况。
const revisionSQL = "(SELECT json_group_array(json_array(id, version, mutation_id) ORDER BY id) FROM goal_journal_entries WHERE user_id = ?)"

export async function handleBackup(request: Request, env: Env, user: User): Promise<Response> {
  if (request.method === 'GET') {
    // 一次事务读取完整元数据，不受时间线分页或已删除主体影响。
    const [accounts, entries, images] = await env.DB.batch([
      env.DB.prepare('SELECT version FROM user_data WHERE user_id = ?').bind(user.id),
      env.DB.prepare('SELECT * FROM goal_journal_entries WHERE user_id = ? ORDER BY id').bind(user.id),
      env.DB.prepare('SELECT id, entry_id, mime_type, byte_size FROM goal_journal_images WHERE user_id = ? ORDER BY entry_id, position, id').bind(user.id),
    ])
    const account = accounts!.results[0] as { version: number } | undefined
    if (!account) throw new HttpError(404, '账号数据不存在')
    const rows = entries!.results as unknown as EntryRow[]
    const byEntry = new Map<string, ImageRow[]>()
    for (const image of images!.results as unknown as ImageRow[]) {
      const group = byEntry.get(image.entry_id) || []
      group.push(image)
      byEntry.set(image.entry_id, group)
    }
    return json({
      version: account.version,
      journalRevision: JSON.stringify(rows.map(row => [row.id, row.version, row.mutation_id])),
      entries: rows.map(row => ({
        id: row.id, subjectType: row.subject_type, subjectId: row.goal_id,
        date: row.date, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
        images: (byEntry.get(row.id) || []).map(image => ({ id: image.id, url: `/api/journal/images/${image.id}`, mimeType: image.mime_type, byteSize: image.byte_size })),
      })),
    })
  }
  if (request.method !== 'PUT') throw new HttpError(405, '不支持此请求方法')
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 请求')
  const bytes = await readLimitedBytes(request, BACKUP_BODY_LIMIT)
  let input: unknown
  try { input = JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new HttpError(400, 'JSON 格式不正确') }
  const parsed = z.object({
    backup: completeBackupSchema,
    version: z.number().int().nonnegative(),
    journalRevision: z.string().max(1_000_000),
  }).safeParse(input)
  if (!parsed.success) throw new HttpError(400, '备份格式不正确或图片损坏，当前数据未更改')
  const { backup, version, journalRevision } = parsed.data
  const data = JSON.stringify(appDataSchema.parse(backup))
  if (new TextEncoder().encode(data).byteLength > 990_000) throw new HttpError(413, '基础数据超过大小限制，当前数据未更改')
  // 后续语句只在本次版本检查成功时执行，避免过期请求清空任何数据。
  const now = Math.floor(Date.now() / 1000)
  const token = crypto.randomUUID()
  const gate = 'EXISTS (SELECT 1 FROM user_data WHERE user_id = ? AND restore_token = ?)'
  const gateValues = [user.id, token]
  const statements = [
    env.DB.prepare(`UPDATE user_data SET data = ?, version = version + 1, updated_at = ?, restore_token = ? WHERE user_id = ? AND version = ? AND ${revisionSQL} = ?`)
      .bind(data, now, token, user.id, version, user.id, journalRevision),
    env.DB.prepare(`DELETE FROM goal_journal_entries WHERE user_id = ? AND ${gate}`).bind(user.id, ...gateValues),
  ]
  for (const entry of backup.journal) {
    // 新建全局标识，避免跨账号恢复碰撞；主体标识与原基础数据保持关联。
    const id = crypto.randomUUID()
    statements.push(env.DB.prepare(`INSERT INTO goal_journal_entries (id, user_id, goal_id, subject_type, date, content, created_at, updated_at, version, mutation_id, write_token) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gate}`)
      .bind(id, user.id, entry.subjectId, entry.subjectType, entry.date, entry.content, entry.createdAt, entry.updatedAt, entry.version, crypto.randomUUID(), crypto.randomUUID(), ...gateValues))
    for (const [position, image] of entry.images.entries()) {
      const imageBytes = base64ToBytes(image.data)
      statements.push(env.DB.prepare(`INSERT INTO goal_journal_images (id, user_id, entry_id, mime_type, byte_size, position, data) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${gate}`)
        .bind(crypto.randomUUID(), user.id, id, image.mimeType, imageBytes.byteLength, position, imageBytes.buffer, ...gateValues))
    }
  }
  const result = await env.DB.batch(statements)
  if (!result[0]?.meta.changes) throw new HttpError(409, '导入前账号内容已发生变化，请刷新后重新确认恢复')
  return json({ version: version + 1 })
}
