export const RECORD_EXPORT_WIDTH = 760
export const RECORD_EXPORT_MAX_DIMENSION = 16_384
export const RECORD_EXPORT_MAX_PIXELS = 16_000_000

export function recordCaptureSize(height: number) {
  if (!Number.isFinite(height) || height <= 0) throw new Error('记录图片尺寸不正确')
  // 完整内容始终合成一张图片，等比缩放以同时满足画布边长和内存限制。
  const scale = Math.min(
    3,
    RECORD_EXPORT_MAX_DIMENSION / Math.max(RECORD_EXPORT_WIDTH, height),
    Math.sqrt(RECORD_EXPORT_MAX_PIXELS / (RECORD_EXPORT_WIDTH * height)),
  )
  return {
    width: Math.max(1, Math.floor(RECORD_EXPORT_WIDTH * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }
}

export function recordSvgBlob(dataUrl: string) {
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  if (!dataUrl.startsWith(prefix)) throw new Error('矢量图片格式不正确')
  return new Blob([decodeURIComponent(dataUrl.slice(prefix.length))], { type: 'image/svg+xml' })
}
