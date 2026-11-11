import { RECORD_EXPORT_WIDTH, recordCaptureSize } from '../../shared/record-image-export'

async function waitForAssets<T>(ready: Promise<T>, signal: AbortSignal, message = '照片或字体加载超时，请检查网络后重新生成') {
  signal.throwIfAborted()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  try {
    return await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        cancel = () => reject(signal.reason)
        signal.addEventListener('abort', cancel, { once: true })
        timer = setTimeout(() => reject(new Error(message)), 20_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}

async function waitForImages(sheet: HTMLElement, signal: AbortSignal) {
  await Promise.all(Array.from(sheet.querySelectorAll('img'), async image => {
    signal.throwIfAborted()
    try { await image.decode() }
    catch { throw new Error('部分照片未能加载，请检查网络后重新生成图片') }
    signal.throwIfAborted()
  }))
}

export async function captureRecordImage(
  viewport: HTMLElement,
  sheet: HTMLElement,
  signal: AbortSignal,
) {
  const { getFontEmbedCSS, toBlob } = await import('html-to-image')
  await waitForAssets(Promise.all([document.fonts.ready, waitForImages(sheet, signal)]), signal)
  const fontEmbedCSS = await waitForAssets(getFontEmbedCSS(viewport, { preferredFontFormat: 'woff2', fetchRequestInit: { signal } }), signal)
  signal.throwIfAborted()
  const height = Math.ceil(sheet.getBoundingClientRect().height)
  const size = recordCaptureSize(height)
  try {
    viewport.style.height = `${height}px`
    const blob = await waitForAssets(toBlob(viewport, {
      width: RECORD_EXPORT_WIDTH,
      height,
      canvasWidth: size.width,
      canvasHeight: size.height,
      pixelRatio: 1,
      skipAutoScale: true,
      fontEmbedCSS,
      fetchRequestInit: { signal },
      onImageErrorHandler: () => { throw new Error('部分照片未能载入导出图片，请重试') },
    }), signal, '图片生成超时，请缩小日期范围后重试')
    signal.throwIfAborted()
    if (!blob) throw new Error('图片生成失败，请缩小日期范围后重试')
    return blob
  } finally {
    viewport.style.height = ''
  }
}
