import { z } from 'zod'
import { appDataSchema } from './schema.ts'
import { JOURNAL_ACCOUNT_IMAGE_LIMIT, JOURNAL_IMAGE_COUNT, JOURNAL_IMAGE_LIMIT, getJournalImageType } from './journal.ts'
import type { JournalEntry } from './journal.ts'

export const BACKUP_BODY_LIMIT = 90_000_000
const mimeType = z.enum(['image/png', 'image/jpeg', 'image/webp'])
const imageSchema = z.object({
  id: z.uuid(),
  mimeType,
  data: z.string().min(4).max(4 * Math.ceil(JOURNAL_IMAGE_LIMIT / 3))
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
})
const entrySchema = z.object({
  id: z.uuid(), subjectType: z.enum(['goal', 'habit']), subjectId: z.string().min(1).max(100),
  date: z.iso.date(), content: z.string().max(5000),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), version: z.number().int().positive(),
  images: z.array(imageSchema).max(JOURNAL_IMAGE_COUNT),
}).refine(entry => Boolean(entry.content.trim() || entry.images.length), '日记不能为空')

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}
export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

export const completeBackupSchema = z.intersection(appDataSchema, z.object({
  format: z.literal('keepdo-backup'), backupVersion: z.literal(2), exportedAt: z.iso.datetime(),
  journal: z.array(entrySchema).max(5000),
})).superRefine((backup, context) => {
  const entryIds = new Set<string>()
  const imageIds = new Set<string>()
  let total = 0
  for (const entry of backup.journal) {
    if (entryIds.has(entry.id)) context.addIssue({ code: 'custom', message: '日记标识重复' })
    entryIds.add(entry.id)
    for (const image of entry.images) {
      let bytes: Uint8Array
      try { bytes = base64ToBytes(image.data) }
      catch { context.addIssue({ code: 'custom', message: '图片编码损坏' }); continue }
      total += bytes.byteLength
      if (imageIds.has(image.id) || bytes.byteLength > JOURNAL_IMAGE_LIMIT || getJournalImageType(bytes) !== image.mimeType) {
        context.addIssue({ code: 'custom', message: '图片重复、损坏或超过大小限制' })
      }
      imageIds.add(image.id)
    }
  }
  if (total > JOURNAL_ACCOUNT_IMAGE_LIMIT) context.addIssue({ code: 'custom', message: '图片总大小超过账号空间限制' })
})
export type CompleteBackup = z.infer<typeof completeBackupSchema>
export type BackupEntry = CompleteBackup['journal'][number]
export interface BackupManifest {
  version: number
  journalRevision: string
  entries: Array<Omit<JournalEntry, 'images'> & {
    images: Array<{ id: string; url: string; mimeType: string; byteSize: number }>
  }>
}

export function parseBackup(value: unknown) {
  if (value && typeof value === 'object' && ['format', 'backupVersion', 'journal'].some(key => Object.hasOwn(value, key))) {
    return { kind: 'complete' as const, data: completeBackupSchema.parse(value) }
  }
  return { kind: 'legacy' as const, data: appDataSchema.parse(value) }
}
