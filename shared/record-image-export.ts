export const RECORD_EXPORT_WIDTH = 760
export const RECORD_EXPORT_MAX_DIMENSION = 16_384
export const RECORD_EXPORT_MAX_PIXELS = 16_000_000

export function recordCaptureSize(height: number) {
  if (!Number.isFinite(height) || height <= 0) throw new Error('记录图片尺寸不正确')
  // 完整内容始终合成一张图片，等比缩放以同时满足画布边长和内存限制。
  const scale = Math.min(
    1.5,
    RECORD_EXPORT_MAX_DIMENSION / Math.max(RECORD_EXPORT_WIDTH, height),
    Math.sqrt(RECORD_EXPORT_MAX_PIXELS / (RECORD_EXPORT_WIDTH * height)),
  )
  return {
    width: Math.max(1, Math.floor(RECORD_EXPORT_WIDTH * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }
}
