import { z } from 'zod'

export const SHARE_ENTRY_LIMIT = 200
export const SHARE_IMAGE_BYTES_LIMIT = 8_000_000
export const SHARE_ACCOUNT_BYTES_LIMIT = 50_000_000
export const SHARE_COUNT_LIMIT = 100
export const SHARE_SNAPSHOT_BYTES_LIMIT = 1_500_000
export const shareSelectionSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('entry'), entryId: z.uuid(), excerpt: z.string().trim().min(1).max(5000).optional() }).strict(),
  z.object({ scope: z.literal('day'), date: z.iso.date() }).strict(),
])
export const shareRequestSchema = z.object({
  selection: shareSelectionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()
export const shareRecordSchema = z.object({
  title: z.string(), subjectType: z.enum(['goal', 'habit', 'note']),
  date: z.iso.date(), content: z.string(),
  images: z.array(z.object({ id: z.uuid(), url: z.string() })),
})
export const shareSnapshotSchema = z.object({
  title: z.string(), scope: z.enum(['entry', 'day']), excerpt: z.boolean(),
  records: z.array(shareRecordSchema).min(1).max(SHARE_ENTRY_LIMIT),
}).refine(snapshot => new TextEncoder().encode(JSON.stringify(snapshot)).byteLength <= SHARE_SNAPSHOT_BYTES_LIMIT, '分享正文过多，请改为分享单条记录或文字片段')
export const sharePreviewSchema = z.object({ snapshot: shareSnapshotSchema, revision: z.string() })
export const shareLinkSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), url: z.url(), title: z.string(), createdAt: z.iso.datetime() })
export const shareListSchema = z.object({ shares: z.array(shareLinkSchema) })
export const publicShareSchema = z.object({ snapshot: shareSnapshotSchema, createdAt: z.iso.datetime() })
export type ShareSelection = z.infer<typeof shareSelectionSchema>
export type ShareSnapshot = z.infer<typeof shareSnapshotSchema>
export type SharePreview = z.infer<typeof sharePreviewSchema>
export type ShareLink = z.infer<typeof shareLinkSchema>
