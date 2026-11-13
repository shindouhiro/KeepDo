import { test } from 'node:test'
import assert from 'node:assert/strict'

type BridgeInput = { id: string; path: string; method: string; contentType: string | null; body: string | null }
type BridgeArgs = { input?: BridgeInput; id?: string }
const runtime = globalThis as typeof globalThis & { isTauri?: boolean; __TAURI_INTERNALS__?: { invoke: (command: string, args: BridgeArgs) => Promise<unknown> } }
let handler: (command: string, args: BridgeArgs) => Promise<unknown> = async () => undefined
runtime.isTauri = true
runtime.__TAURI_INTERNALS__ = { invoke: (command, args) => handler(command, args) }
Object.defineProperty(globalThis, 'window', { value: runtime, configurable: true })
const { platformFetch } = await import('../src/lib/platform/index.ts')
const response = (body: string, contentType = 'application/json', status = 200) => ({ status, contentType, body: Buffer.from(body).toString('base64') })

test('原生请求桥编码 JSON 并完整保留错误状态与二进制响应', async () => {
  handler = async (command, { input }) => {
    assert.equal(command, 'api_request')
    assert.equal(input!.path, '/api/data')
    assert.equal(input!.method, 'PUT')
    assert.equal(input!.contentType, 'application/json')
    assert.deepEqual(JSON.parse(Buffer.from(input!.body!, 'base64').toString()), { version: 2 })
    return response('{"error":"版本冲突"}', 'application/json', 409)
  }
  const result = await platformFetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"version":2}' })
  assert.equal(result.status, 409)
  assert.deepEqual(await result.json(), { error: '版本冲突' })
  handler = async () => ({ status: 200, contentType: 'image/png', body: Buffer.from([0, 255, 128, 1]).toString('base64') })
  const image = await platformFetch('/api/journal/images/example')
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), new Uint8Array([0, 255, 128, 1]))
})

test('原生 multipart 保留 boundary、中文记录与图片原始字节', async () => {
  const form = new FormData()
  form.set('entry', '{"content":"中文记录"}')
  form.append('images', new Blob([new Uint8Array([0, 255, 128, 1])], { type: 'image/png' }), 'photo.png')
  handler = async (_, { input }) => {
    assert.match(input!.contentType!, /^multipart\/form-data; boundary=/)
    const encoded = new Response(Buffer.from(input!.body!, 'base64'), { headers: { 'Content-Type': input!.contentType! } })
    const decoded = await encoded.formData()
    assert.equal(decoded.get('entry'), '{"content":"中文记录"}')
    const file = decoded.get('images') as File
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([0, 255, 128, 1]))
    return response('{}')
  }
  assert.equal((await platformFetch('/api/goals/test/journal/test', { method: 'PUT', body: form })).status, 200)
})

test('原生请求取消会通知 Rust，预先取消不发出请求，错误消息可供重试', async () => {
  const controller = new AbortController()
  let requestId = ''
  let cancelledId = ''
  handler = async (command, args) => {
    if (command === 'cancel_request') { cancelledId = args.id!; return }
    requestId = args.input!.id
    queueMicrotask(() => controller.abort())
    return new Promise(() => {})
  }
  await assert.rejects(platformFetch('/api/journal', { signal: controller.signal }))
  assert.equal(cancelledId, requestId)
  handler = async () => { throw new Error('不应调用') }
  await assert.rejects(platformFetch('/api/data', { signal: controller.signal }), { name: 'AbortError' })
  handler = async () => { throw '系统密钥环已锁定' }
  await assert.rejects(platformFetch('/api/data'), /系统密钥环已锁定/)
  await assert.rejects(platformFetch('https://evil.example/api/data'), /请求地址不正确/)
})
