import { JOURNAL_IMAGE_LIMIT } from '../../shared/journal'

export async function prepareJournalImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片')
  if (file.size > 12_000_000) throw new Error('原图不能超过 12 MB，请先缩小图片')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('图片无法读取，请重新选择有效图片') })
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('图片分辨率过大，请先缩小图片')
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器暂不支持图片处理')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.65, 0.45]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
      if (blob && blob.size <= JOURNAL_IMAGE_LIMIT) return new File([blob], 'progress.webp', { type: blob.type })
    }
    throw new Error('图片压缩后仍然过大，请选择尺寸更小的图片')
  } finally { bitmap.close() }
}
