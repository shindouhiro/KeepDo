import { RECORD_EXPORT_WIDTH, recordCaptureSize, recordSvgBlob } from '../../shared/record-image-export.ts'

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

export async function waitForRecordImages(sheet: HTMLElement, signal: AbortSignal) {
  await Promise.all(Array.from(sheet.querySelectorAll('img'), async image => {
    signal.throwIfAborted()
    // 导出内容在屏幕外排版，懒加载图片不会进入视口，必须主动加载后再等待解码。
    image.loading = 'eager'
    if (image.hasAttribute('data-image-loading')) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { observer.disconnect(); clearTimeout(timer); signal.removeEventListener('abort', abort) }
        const abort = () => { cleanup(); reject(signal.reason) }
        const observer = new MutationObserver(() => {
          if (!image.hasAttribute('data-image-loading')) { cleanup(); resolve() }
        })
        const timer = setTimeout(() => { cleanup(); reject(new Error('照片加载超时，请重新生成')) }, 20_000)
        observer.observe(image, { attributes: true, attributeFilter: ['src', 'data-image-loading', 'data-image-error'] })
        signal.addEventListener('abort', abort, { once: true })
      })
    }
    if (image.hasAttribute('data-image-error')) throw new Error('部分照片未能加载，请检查网络后重新生成图片')
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
  const { getFontEmbedCSS, toSvg } = await import('html-to-image')
  await waitForAssets(Promise.all([document.fonts.ready, waitForRecordImages(sheet, signal)]), signal)
  const fontEmbedCSS = await waitForAssets(getFontEmbedCSS(viewport, { preferredFontFormat: 'woff2', fetchRequestInit: { signal } }), signal)
  signal.throwIfAborted()
  const height = Math.ceil(sheet.getBoundingClientRect().height)
  const size = recordCaptureSize(height)
  try {
    viewport.style.height = `${height}px`
    const svgUrl = await waitForAssets(toSvg(viewport, {
      width: RECORD_EXPORT_WIDTH,
      height,
      fontEmbedCSS,
      fetchRequestInit: { signal },
      onImageErrorHandler: () => { throw new Error('部分照片未能载入导出图片，请重试') },
    }), signal, '图片生成超时，请缩小日期范围后重试')
    signal.throwIfAborted()
    const svg = recordSvgBlob(svgUrl)
    const source = new Image()
    source.src = svgUrl
    await waitForAssets(source.decode(), signal)
    signal.throwIfAborted()
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    try {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器暂不支持图片生成，请更换浏览器重试')
      context.drawImage(source, 0, 0, size.width, size.height)
      const png = await waitForAssets(new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')), signal)
      signal.throwIfAborted()
      if (!png) throw new Error('图片生成失败，请缩小日期范围后重试')
      return { png, svg, width: size.width, height: size.height }
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    viewport.style.height = ''
  }
}
