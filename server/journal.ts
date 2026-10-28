import { z } from 'zod'
import type { Env, User } from './types.ts'
import type { JournalEntry, JournalImage, JournalSubjectType } from '../shared/journal.ts'
import { JOURNAL_ACCOUNT_IMAGE_LIMIT, JOURNAL_BODY_LIMIT, JOURNAL_IMAGE_COUNT, JOURNAL_IMAGE_LIMIT, getJournalImageType, journalInputSchema } from '../shared/journal.ts'
import { HttpError, json, readLimitedBytes } from './http.ts'

interface EntryRow {
  id: string; goal_id: string; subject_type: JournalSubjectType; date: string; content: string
  created_at: string; updated_at: string; version: number; mutation_id: string
}
interface ImageRow { id: string; entry_id: string; byte_size: number }
const uuid = z.uuid()

async function entriesWithImages(env: Env, userId: string, rows: EntryRow[]): Promise<JournalEntry[]> {
  if (!rows.length) return []
  const images = await env.DB.prepare(`SELECT id, entry_id FROM goal_journal_images WHERE user_id = ? AND entry_id IN (${rows.map(() => '?').join(',')}) ORDER BY position, id`)
    .bind(userId, ...rows.map(row => row.id)).all<ImageRow>()
  return rows.map(row => ({
    id: row.id, subjectType: row.subject_type, subjectId: row.goal_id,
    ...(row.subject_type === 'goal' ? { goalId: row.goal_id } : { habitId: row.goal_id }),
    date: row.date, content: row.content,
    createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
    images: images.results.filter(image => image.entry_id === row.id).map(image => ({ id: image.id, url: `/api/journal/images/${image.id}` } satisfies JournalImage)),
  }))
}

async function requireSubject(env: Env, userId: string, subjectType: JournalSubjectType, subjectId: string) {
  const account = await env.DB.prepare('SELECT data FROM user_data WHERE user_id = ?').bind(userId).first<{ data: string }>()
  const key = subjectType === 'goal' ? 'goals' : 'habits'
  const subject = account && (JSON.parse(account.data)[key] as Array<{ id: string; createdAt: string }>).find(item => item.id === subjectId)
  if (!subject) throw new HttpError(404, `${subjectType === 'goal' ? '目标' : '习惯'}不存在，请刷新后重试`)
  return subject
}

async function saveEntry(request: Request, env: Env, user: User, subjectType: JournalSubjectType, subjectId: string, entryId: string) {
  if (!uuid.safeParse(entryId).success) throw new HttpError(400, '记录标识不正确')
  const subject = await requireSubject(env, user.id, subjectType, subjectId)
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.startsWith('multipart/form-data;')) throw new HttpError(415, '请使用图文上传表单')
  const bytes = await readLimitedBytes(request, JOURNAL_BODY_LIMIT)
  let form: FormData
  try { form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData() }
  catch { throw new HttpError(400, '上传内容无法读取，请重新选择图片') }
  let input
  try { input = journalInputSchema.parse(JSON.parse(String(form.get('entry')))) }
  catch { throw new HttpError(400, '记录格式不正确，文字最多 5000 字，每条最多 6 张图片') }
  if (input.date < subject.createdAt) throw new HttpError(400, `记录日期不能早于${subjectType === 'goal' ? '目标' : '习惯'}创建日期`)
  const files = form.getAll('images')
  if (input.keepImageIds.length + files.length > JOURNAL_IMAGE_COUNT) throw new HttpError(400, '每条记录最多 6 张图片')
  if (!input.content && !files.length && !input.keepImageIds.length) throw new HttpError(400, '请填写记录或添加图片')
  const uploads = []
  for (const file of files) {
    if (typeof file === 'string' || !file.size || file.size > JOURNAL_IMAGE_LIMIT) throw new HttpError(413, '单张图片压缩后不能超过 400 KB')
    const imageBytes = new Uint8Array(await file.arrayBuffer())
    const mime = getJournalImageType(imageBytes)
    if (!mime || file.type !== mime) throw new HttpError(415, '只支持真实的 JPG、PNG 或 WebP 图片')
    uploads.push({ id: crypto.randomUUID(), mime, bytes: imageBytes })
  }
  const existing = await env.DB.prepare('SELECT * FROM goal_journal_entries WHERE id = ? AND user_id = ? AND subject_type = ? AND goal_id = ?').bind(entryId, user.id, subjectType, subjectId).first<EntryRow>()
  if (existing?.mutation_id === input.operationId) return json({ entry: (await entriesWithImages(env, user.id, [existing]))[0] })
  if ((!existing && input.version !== 0) || (existing && existing.version !== input.version)) throw new HttpError(409, '这条记录已在其他设备更新，请重新加载后编辑；当前草稿已保留')
  const priorImages = existing ? (await env.DB.prepare('SELECT id, entry_id, byte_size FROM goal_journal_images WHERE user_id = ? AND entry_id = ?').bind(user.id, entryId).all<ImageRow>()).results : []
  if (input.keepImageIds.some(id => !priorImages.some(image => image.id === id))) throw new HttpError(400, '图片与当前记录不匹配，请重新加载后重试')
  const removedBytes = priorImages.filter(image => !input.keepImageIds.includes(image.id)).reduce((sum, image) => sum + image.byte_size, 0)
  const deltaBytes = uploads.reduce((sum, image) => sum + image.bytes.byteLength, 0) - removedBytes
  const now = new Date().toISOString()
  const writeToken = crypto.randomUUID()
  const quota = '(SELECT COALESCE(SUM(byte_size), 0) FROM goal_journal_images WHERE user_id = ?) + ? <= ?'
  const statements = [existing
    ? env.DB.prepare(`UPDATE goal_journal_entries SET date = ?, content = ?, updated_at = ?, version = version + 1, mutation_id = ?, write_token = ? WHERE id = ? AND user_id = ? AND version = ? AND ${quota}`)
      .bind(input.date, input.content, now, input.operationId, writeToken, entryId, user.id, input.version, user.id, deltaBytes, JOURNAL_ACCOUNT_IMAGE_LIMIT)
    : env.DB.prepare(`INSERT OR IGNORE INTO goal_journal_entries (id, user_id, goal_id, subject_type, date, content, created_at, updated_at, version, mutation_id, write_token) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE ${quota} AND (SELECT COUNT(*) FROM goal_journal_entries WHERE user_id = ?) < 5000`)
      .bind(entryId, user.id, subjectId, subjectType, input.date, input.content, now, now, input.operationId, writeToken, user.id, deltaBytes, JOURNAL_ACCOUNT_IMAGE_LIMIT, user.id)]
  // 每个图片操作只属于成功写入的这次变更，与版本检查一起原子提交。
  const gate = 'EXISTS (SELECT 1 FROM goal_journal_entries WHERE id = ? AND user_id = ? AND write_token = ?)'
  for (const image of priorImages.filter(image => !input.keepImageIds.includes(image.id))) {
    statements.push(env.DB.prepare(`DELETE FROM goal_journal_images WHERE id = ? AND user_id = ? AND ${gate}`).bind(image.id, user.id, entryId, user.id, writeToken))
  }
  for (const [position, imageId] of input.keepImageIds.entries()) {
    statements.push(env.DB.prepare(`UPDATE goal_journal_images SET position = ? WHERE id = ? AND user_id = ? AND ${gate}`).bind(position, imageId, user.id, entryId, user.id, writeToken))
  }
  for (const [index, image] of uploads.entries()) {
    statements.push(env.DB.prepare(`INSERT INTO goal_journal_images (id, user_id, entry_id, mime_type, byte_size, position, data) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${gate}`)
      .bind(image.id, user.id, entryId, image.mime, image.bytes.byteLength, input.keepImageIds.length + index, image.bytes.buffer, entryId, user.id, writeToken))
  }
  const results = await env.DB.batch(statements)
  const saved = await env.DB.prepare('SELECT * FROM goal_journal_entries WHERE id = ? AND user_id = ? AND subject_type = ? AND goal_id = ?').bind(entryId, user.id, subjectType, subjectId).first<EntryRow>()
  if (!results[0]?.meta.changes && saved?.mutation_id !== input.operationId) throw new HttpError(409, '记录已更新或图片空间已满，请重新加载或减少图片；当前草稿已保留')
  if (!saved) throw new HttpError(500, '记录读取失败，请重试')
  return json({ entry: (await entriesWithImages(env, user.id, [saved]))[0] }, !existing && results[0]?.meta.changes ? 201 : 200)
}

export async function handleJournal(request: Request, env: Env, user: User, path: string): Promise<Response | null> {
  const url = new URL(request.url)
  if (path === '/api/journal/summary' && request.method === 'GET') {
    const dates = await env.DB.prepare('SELECT DISTINCT subject_type, goal_id, date FROM goal_journal_entries WHERE user_id = ? ORDER BY date DESC').bind(user.id).all<{ subject_type: JournalSubjectType; goal_id: string; date: string }>()
    const result: Record<string, string[]> = Object.create(null)
    const habitDates: Record<string, string[]> = Object.create(null)
    for (const row of dates.results) ((row.subject_type === 'goal' ? result : habitDates)[row.goal_id] ||= []).push(row.date)
    return json({ dates: result, habitDates })
  }
  const imageMatch = path.match(/^\/api\/journal\/images\/([^/]+)$/)
  if (imageMatch && request.method === 'GET') {
    if (!uuid.safeParse(imageMatch[1]).success) throw new HttpError(404, '图片不存在')
    const image = await env.DB.prepare('SELECT data, mime_type FROM goal_journal_images WHERE id = ? AND user_id = ?').bind(imageMatch[1], user.id).first<{ data: number[] | ArrayBuffer; mime_type: string }>()
    if (!image) throw new HttpError(404, '图片不存在')
    const data = Array.isArray(image.data) ? new Uint8Array(image.data) : new Uint8Array(image.data)
    return new Response(data, { headers: { 'Content-Type': image.mime_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' } })
  }
  const match = path.match(/^\/api\/(goals|habits)\/([^/]+)\/journal(?:\/([^/]+))?$/)
  if (!match) return null
  const subjectType: JournalSubjectType = match[1] === 'goals' ? 'goal' : 'habit'
  let subjectId: string
  try { subjectId = decodeURIComponent(match[2]!) }
  catch { throw new HttpError(400, '日记主体标识不正确') }
  if (match[3] && request.method === 'PUT') return saveEntry(request, env, user, subjectType, subjectId, match[3])
  if (!match[3] && request.method === 'GET') {
    await requireSubject(env, user.id, subjectType, subjectId)
    let cursor: [string, string, string] | undefined
    if (url.searchParams.has('cursor')) {
      try { cursor = z.tuple([z.iso.date(), z.iso.datetime(), z.uuid()]).parse(JSON.parse(atob(url.searchParams.get('cursor')!))) }
      catch { throw new HttpError(400, '时间线分页位置不正确') }
    }
    const rows = await env.DB.prepare(`SELECT * FROM goal_journal_entries WHERE user_id = ? AND subject_type = ? AND goal_id = ? ${cursor ? 'AND (date, created_at, id) < (?, ?, ?)' : ''} ORDER BY date DESC, created_at DESC, id DESC LIMIT 21`)
      .bind(user.id, subjectType, subjectId, ...(cursor || [])).all<EntryRow>()
    const page = rows.results.slice(0, 20)
    const last = page.at(-1)
    return json({ entries: await entriesWithImages(env, user.id, page), nextCursor: rows.results.length > 20 && last ? btoa(JSON.stringify([last.date, last.created_at, last.id])) : null })
  }
  throw new HttpError(405, '不支持此请求方法')
}
