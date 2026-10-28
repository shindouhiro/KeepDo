import { z } from 'zod'

export const JOURNAL_IMAGE_LIMIT = 400_000
export const JOURNAL_IMAGE_COUNT = 6
export const JOURNAL_BODY_LIMIT = 2_500_000
export const JOURNAL_ACCOUNT_IMAGE_LIMIT = 50_000_000
export const journalInputSchema = z.object({
  date: z.iso.date(),
  content: z.string().trim().max(5000),
  keepImageIds: z.array(z.uuid()).max(JOURNAL_IMAGE_COUNT).refine(ids => new Set(ids).size === ids.length),
  version: z.number().int().nonnegative(),
  operationId: z.uuid(),
})
export interface JournalImage { id: string; url: string }
export interface GoalJournalEntry {
  id: string
  goalId: string
  date: string
  content: string
  images: JournalImage[]
  createdAt: string
  updatedAt: string
  version: number
}
export interface JournalPage { entries: GoalJournalEntry[]; nextCursor: string | null }
export type JournalDates = Record<string, string[]>
export function getGoalJournalDates(dates: JournalDates, goalId: string): string[] {
  return Object.hasOwn(dates, goalId) ? dates[goalId]! : []
}

export function getJournalImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

export function groupJournalEntries(entries: GoalJournalEntry[]) {
  const groups = new Map<string, GoalJournalEntry[]>()
  for (const entry of [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    const group = groups.get(entry.date) || []
    group.push(entry)
    groups.set(entry.date, group)
  }
  return Array.from(groups, ([date, records]) => ({ date, records }))
}
