import { z } from 'zod'
import type { JournalEntry, JournalPage } from './journal.ts'

export const journalFeedFilterSchema = z.object({
  type: z.enum(['all', 'goal', 'habit']).default('all'),
  subjectId: z.string().max(200).default(''),
  from: z.union([z.literal(''), z.iso.date()]).default(''),
  to: z.union([z.literal(''), z.iso.date()]).default(''),
}).refine(value => !value.subjectId || value.type !== 'all', '请先选择目标或习惯类型')
  .refine(value => !value.from || !value.to || value.from <= value.to, '开始日期不能晚于结束日期')

export type JournalFeedFilter = z.infer<typeof journalFeedFilterSchema>

export function journalFeedQuery(filter: JournalFeedFilter, cursor?: string | null) {
  const query = new URLSearchParams({ type: filter.type })
  if (filter.subjectId) query.set('subjectId', filter.subjectId)
  if (filter.from) query.set('from', filter.from)
  if (filter.to) query.set('to', filter.to)
  if (cursor) query.set('cursor', cursor)
  return query.toString()
}

export async function collectJournalPages(
  readPage: (cursor: string | null) => Promise<JournalPage>,
  onProgress: (count: number) => void,
  signal: AbortSignal,
): Promise<JournalEntry[]> {
  const entries = new Map<string, JournalEntry>()
  const cursors = new Set<string>()
  let cursor: string | null = null
  do {
    signal.throwIfAborted()
    const page = await readPage(cursor)
    signal.throwIfAborted()
    for (const entry of page.entries) entries.set(entry.id, entry)
    onProgress(entries.size)
    cursor = page.nextCursor
    if (cursor && cursors.has(cursor)) throw new Error('记录分页异常，请刷新后重试')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return [...entries.values()]
}
