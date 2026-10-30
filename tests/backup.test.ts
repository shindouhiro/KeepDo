import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base64ToBytes, bytesToBase64, completeBackupSchema, parseBackup } from '../shared/backup.ts'
import type { BackupManifest } from '../shared/backup.ts'
import { emptyAppData } from '../shared/schema.ts'
import { exportCompleteBackup } from '../src/lib/backup.ts'

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64'))
function entry(subjectType: 'goal' | 'habit' = 'goal') {
  return {
    id: crypto.randomUUID(), subjectType, subjectId: '已删除的主体', date: '2026-10-29', content: '保留历史图文内容',
    createdAt: '2026-10-29T01:00:00.000Z', updatedAt: '2026-10-29T02:00:00.000Z', version: 2,
    images: [{ id: crypto.randomUUID(), mimeType: 'image/png' as const, data: bytesToBase64(png) }],
  }
}
function backup() {
  return { ...emptyAppData(), format: 'keepdo-backup' as const, backupVersion: 2 as const, exportedAt: '2026-10-29T03:00:00.000Z', journal: [entry(), entry('habit')] }
}

test('完整备份 JSON 往返保留两类历史日记、时间、排序和图片原始字节', () => {
  const source = backup()
  const parsed = parseBackup(JSON.parse(JSON.stringify(source)))
  assert.equal(parsed.kind, 'complete')
  assert.deepEqual(parsed.data, source)
  assert.deepEqual(base64ToBytes(source.journal[0]!.images[0]!.data), png)
  const large = Uint8Array.from({ length: 400_000 }, (_, index) => index % 256)
  assert.deepEqual(base64ToBytes(bytesToBase64(large)), large)
})
test('旧版基础备份兼容，含完整备份标记的损坏文件禁止降级丢弃日记', () => {
  assert.deepEqual(parseBackup(emptyAppData()), { kind: 'legacy', data: emptyAppData() })
  for (const changes of [{ backupVersion: 3 }, { journal: undefined }, { exportedAt: '错误时间' }]) {
    assert.throws(() => parseBackup({ ...backup(), ...changes }))
  }
  assert.throws(() => parseBackup({ ...emptyAppData(), journal: [] }))
})
test('图片达到 400 KB 限制时可备份，超限图片会被拒绝', () => {
  const bytes = new Uint8Array(400_000)
  bytes.set(png)
  const source = backup()
  source.journal[0]!.images[0]!.data = bytesToBase64(bytes)
  assert.equal(completeBackupSchema.safeParse(source).success, true)
  source.journal[0]!.images[0]!.data = bytesToBase64(new Uint8Array([...bytes, 0]))
  assert.equal(completeBackupSchema.safeParse(source).success, false)
})
test('拒绝图片链接冒充文件、伪造格式、非法编码、重复标识与空日记', () => {
  const source = backup()
  const image = source.journal[0]!.images[0]!
  for (const change of [{ data: '/api/journal/images/example' }, { data: '%%%%' }, { data: btoa('<svg/>') }, { mimeType: 'image/jpeg' }, { data: '' }]) {
    const invalid = structuredClone(source)
    Object.assign(invalid.journal[0]!.images[0]!, change)
    assert.equal(completeBackupSchema.safeParse(invalid).success, false)
  }
  const repeated = structuredClone(source)
  repeated.journal[1]!.images[0]!.id = image.id
  assert.equal(completeBackupSchema.safeParse(repeated).success, false)
  const duplicates = structuredClone(source)
  duplicates.journal.push(duplicates.journal[0]!)
  assert.equal(completeBackupSchema.safeParse(duplicates).success, false)
  const empty = backup()
  empty.journal[0]!.images = []
  empty.journal[0]!.content = ' '
  assert.equal(completeBackupSchema.safeParse(empty).success, false)
})

test('导出读取全部元数据，包含超过一页的记录与图片，保留页面尚未保存的基础数据', async () => {
  const original = globalThis.fetch
  const entries = Array.from({ length: 25 }, (_, index) => entry(index % 2 ? 'habit' : 'goal'))
  const manifest: BackupManifest = {
    version: 2, journalRevision: '同一个完整快照',
    entries: entries.map(item => ({ ...item, images: item.images.map(image => ({ id: image.id, url: `/api/journal/images/${image.id}`, mimeType: image.mimeType, byteSize: png.length })) })),
  }
  const paths: string[] = []
  globalThis.fetch = async input => {
    const path = String(input)
    paths.push(path)
    return path === '/api/backup' ? Response.json(manifest) : new Response(png, { headers: { 'Content-Type': 'image/png' } })
  }
  try {
    const data = { ...emptyAppData(), categories: ['页面未保存的分类'] }
    const progress: string[] = []
    const result = parseBackup(JSON.parse(await exportCompleteBackup(data, message => progress.push(message))))
    assert.equal(result.kind, 'complete')
    if (result.kind !== 'complete') throw new Error('未生成完整备份')
    assert.equal(result.data.journal.length, 25)
    assert.deepEqual(result.data.journal, entries)
    assert.deepEqual(result.data.categories, data.categories)
    assert.equal(paths.filter(path => path === '/api/backup').length, 2)
    assert.equal(paths.length, 27)
    assert.match(progress.at(-1)!, /25\/25/)
  } finally { globalThis.fetch = original }
})
test('图片缺失、字节不符、网络错误或导出期间内容变化时不产生不完整文件', async () => {
  const original = globalThis.fetch
  const item = entry()
  const manifest = { version: 1, journalRevision: '初始快照', entries: [{ ...item, images: [{ id: item.images[0]!.id, url: '/api/journal/images/test', mimeType: 'image/png', byteSize: png.length }] }] }
  try {
    for (const mode of ['missing', 'corrupt', 'network', 'changed', 'changed-data']) {
      let reads = 0
      globalThis.fetch = async input => {
        if (String(input) === '/api/backup') {
          reads++
          return Response.json(reads === 2 ? { ...manifest, ...(mode === 'changed-data' ? { version: 2 } : { journalRevision: '另一个快照' }) } : manifest)
        }
        if (mode === 'network') throw new Error('网络中断')
        if (mode === 'missing') return new Response('', { status: 404 })
        return new Response(mode === 'corrupt' ? new Uint8Array([1, 2, 3]) : png)
      }
      await assert.rejects(exportCompleteBackup(emptyAppData()))
    }
  } finally { globalThis.fetch = original }
})
