export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal ?? AbortSignal.timeout(20_000),
    })
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络后重试，未保存的内容仍保留在当前页面')
  }
  let result: T & { error?: string }
  try { result = await response.json() }
  catch { throw new ApiError(response.status, '服务响应异常，请稍后重试') }
  if (!response.ok) throw new ApiError(response.status, result.error ?? '请求失败，请稍后重试')
  return result
}
