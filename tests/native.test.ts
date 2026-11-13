import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNativeRequest, nativeToken } from '../server/native.ts'
import { assertSameOrigin } from '../server/http.ts'

test('原生通道拒绝浏览器请求、缺失标识与错误标识', () => {
  const request = (headers: HeadersInit) => new Request('https://keepdo.example/api/native/data', { headers })
  assert.doesNotThrow(() => assertNativeRequest(request({ 'X-KeepDo-Client': 'native-v1' })))
  for (const headers of [{}, { 'X-KeepDo-Client': 'other' }, { 'X-KeepDo-Client': 'native-v1', Origin: 'https://keepdo.example' }, { 'X-KeepDo-Client': 'native-v1', 'Sec-Fetch-Site': 'same-origin' }]) {
    assert.throws(() => assertNativeRequest(request(headers)))
  }
  assert.throws(() => assertSameOrigin(request({ 'X-KeepDo-Client': 'native-v1' })))
})

test('原生通道只接受严格 Bearer 格式，不从 Cookie 读取令牌', () => {
  const token = 'a'.repeat(43)
  const request = (headers: HeadersInit) => new Request('https://keepdo.example/api/native/data', { headers })
  assert.equal(nativeToken(request({ Authorization: `Bearer ${token}` })), token)
  for (const value of ['Basic abc', 'Bearer short', `Bearer ${token}!`, `Bearer ${'a'.repeat(44)}`]) {
    assert.equal(nativeToken(request({ Authorization: value })), undefined)
  }
  assert.equal(nativeToken(request({ Cookie: `__Host-keepdo_session=${token}` })), undefined)
})
