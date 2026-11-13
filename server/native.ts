import { HttpError } from './http.ts'

// 原生请求由 Rust 发出，不开放浏览器跨域访问，也不接受 Cookie 认证。
export function assertNativeRequest(request: Request): void {
  if (request.headers.get('X-KeepDo-Client') !== 'native-v1'
    || request.headers.has('Origin') || request.headers.has('Sec-Fetch-Site')) {
    throw new HttpError(403, '请使用 KeepDo 客户端访问此接口')
  }
}

export function nativeToken(request: Request): string | undefined {
  return /^Bearer ([a-zA-Z0-9_-]{43})$/.exec(request.headers.get('Authorization') ?? '')?.[1]
}
