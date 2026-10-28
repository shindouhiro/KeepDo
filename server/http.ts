export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export function json(value: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(extra)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(JSON.stringify(value), { status, headers })
}
export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 请求')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, '请求内容不能为空')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 1_000_000) { await reader.cancel(); throw new HttpError(413, '数据超过 1 MB，请减少历史记录后重试') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new HttpError(400, 'JSON 格式不正确') }
}
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin')
  const url = new URL(request.url)
  const local = ['localhost', '127.0.0.1'].includes(url.hostname)
  const localDev = local && origin === 'http://localhost:5173'
  if ((!origin || origin !== url.origin) && !localDev) throw new HttpError(403, '请求来源校验失败，请刷新页面重试')
}
