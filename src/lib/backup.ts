import type { AppData } from '../types/index.ts'
import type { BackupEntry, BackupManifest } from '../../shared/backup.ts'
import { bytesToBase64, completeBackupSchema } from '../../shared/backup.ts'
import { getJournalImageType } from '../../shared/journal.ts'
import { api } from './api.ts'

export async function exportCompleteBackup(data: AppData, onProgress?: (message: string) => void): Promise<string> {
  onProgress?.('正在读取全部图文记录…')
  const manifest = await api<BackupManifest>('/api/backup')
  const count = manifest.entries.reduce((sum, entry) => sum + entry.images.length, 0)
  let completed = 0
  const journal: BackupEntry[] = []
  for (const entry of manifest.entries) {
    const images: BackupEntry['images'] = []
    for (const image of entry.images) {
      onProgress?.(`正在备份图片 ${completed + 1}/${count}…`)
      const response = await fetch(image.url, { credentials: 'same-origin', signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error('图片读取失败，完整备份尚未生成，请重试')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength !== image.byteSize || getJournalImageType(bytes) !== image.mimeType) throw new Error('图片校验失败，完整备份尚未生成，请重试')
      images.push({ id: image.id, mimeType: image.mimeType as BackupEntry['images'][number]['mimeType'], data: bytesToBase64(bytes) })
      completed++
    }
    journal.push({ ...entry, images })
  }
  // 图片下载期间若有其他设备修改记录，拒绝生成混合版本的备份。
  const latest = await api<BackupManifest>('/api/backup')
  if (latest.journalRevision !== manifest.journalRevision || latest.version !== manifest.version) throw new Error('导出期间账号内容发生变化，请重新导出完整备份')
  const backup = completeBackupSchema.parse({ ...data, format: 'keepdo-backup', backupVersion: 2, exportedAt: new Date().toISOString(), journal })
  return JSON.stringify(backup)
}
