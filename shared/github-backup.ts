import { z } from 'zod'
import { completeBackupSchema } from './backup.ts'

export const GITHUB_BACKUP_LIMIT = 8_000_000
export const GITHUB_HISTORY_PAGE_SIZE = 10

export const githubConnectionInputSchema = z.object({
  owner: z.string().trim().min(1).max(39).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/),
  repo: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/).refine(value => value !== '.' && value !== '..'),
  token: z.string().trim().min(20).max(255).regex(/^[a-zA-Z0-9_]+$/),
})
export const githubConnectionSchema = z.object({
  owner: z.string(), repo: z.string(), branch: z.string(),
})
export const githubStatusSchema = z.object({
  available: z.boolean(), connection: githubConnectionSchema.nullable(),
})
export const githubRevisionSchema = z.string().regex(/^[a-f0-9]{40}$/)
export const githubSessionInputSchema = githubConnectionInputSchema.and(z.discriminatedUnion('action', [
  z.object({ action: z.literal('connect') }),
  z.object({ action: z.literal('history'), page: z.number().int().min(1).max(1000) }),
  z.object({ action: z.literal('upload'), backup: completeBackupSchema }),
  z.object({ action: z.literal('read'), ref: githubRevisionSchema }),
]))
export const githubHistorySchema = z.object({
  entries: z.array(z.object({ sha: githubRevisionSchema, date: z.iso.datetime(), message: z.string() })),
  hasMore: z.boolean(),
})
export type GitHubConnection = z.infer<typeof githubConnectionSchema>
export type GitHubHistory = z.infer<typeof githubHistorySchema>
