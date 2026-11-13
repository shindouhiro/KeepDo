import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
const shell = readFileSync(new URL('../extension/shell.js', import.meta.url), 'utf8')
const background = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8')
const settle = () => new Promise<void>(resolve => setImmediate(resolve))

class Element extends EventTarget {
  hidden = false
  disabled = false
  children: Element[] = []
  src = ''
  href = ''
  title = ''
  allow = ''
  replaceChildren(...children: Element[]) { this.children = children }
  click() { this.dispatchEvent(new Event('click')) }
}

function startShell(fetch: typeof globalThis.fetch) {
  const elements = new Map<string, Element>()
  const timers = new Map<number, () => void>()
  let nextTimer = 0
  let reloads = 0
  function element(id: string) {
    if (!elements.has(id)) elements.set(id, new Element())
    return elements.get(id)!
  }
  runInNewContext(shell, {
    chrome: { runtime: { getManifest: () => manifest } },
    document: { getElementById: element, createElement: () => new Element() },
    window: { location: { reload: () => { reloads++ } } },
    URL, AbortController, fetch,
    setTimeout: (callback: () => void) => { timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: (id: number) => timers.delete(id),
  })
  return { element, timers, frame: () => element('extension-content').children[0], reloads: () => reloads }
}

const healthy = () => Promise.resolve(Response.json({ status: 'ok' }))

test('扩展只连接 KeepDo 站点，业务页面使用 HTTPS 同源服务', async () => {
  const origin = new URL(manifest.homepage_url).origin
  assert.deepEqual(manifest.host_permissions, [`${origin}/*`])
  assert.deepEqual(manifest.permissions, ['sidePanel'])
  assert.ok(manifest.content_security_policy.extension_pages.includes(`frame-src ${origin};`))
  const requests: Array<{ url: string; options?: RequestInit }> = []
  const app = startShell(async (url, options) => {
    requests.push({ url: String(url), options })
    return healthy()
  })
  assert.equal(app.element('extension-loading').hidden, false)
  assert.equal(app.element('extension-reload').disabled, true)
  await settle()
  assert.equal(requests[0]?.url, `${origin}/api/health`)
  assert.equal(requests[0]?.options?.credentials, 'omit')
  assert.equal(app.frame().src, manifest.homepage_url)
  assert.equal(app.frame().allow, 'clipboard-write')
  app.frame().dispatchEvent(new Event('load'))
  assert.equal(app.element('extension-connection').hidden, true)
  assert.equal(app.element('extension-content').hidden, false)
  assert.equal(app.element('extension-reload').disabled, false)
  assert.equal(app.timers.size, 0)
})

test('扩展连接失败后能重试恢复，错误响应不会作为应用页面打开', async () => {
  let fail = true
  const app = startShell(() => fail ? Promise.resolve(new Response('', { status: 503 })) : healthy())
  await settle()
  assert.equal(app.element('extension-error').hidden, false)
  assert.equal(app.frame(), undefined)
  fail = false
  app.element('extension-retry').click()
  await settle()
  app.frame().dispatchEvent(new Event('load'))
  assert.equal(app.element('extension-error').hidden, true)
  assert.equal(app.element('extension-content').hidden, false)
})

test('健康检查超时会取消请求，迟到响应不能覆盖错误状态', async () => {
  let finish!: (response: Response) => void
  let signal: AbortSignal | null | undefined
  const app = startShell((_, options) => {
    signal = options?.signal
    return new Promise(resolve => { finish = resolve })
  })
  for (const callback of [...app.timers.values()]) callback()
  assert.equal(signal?.aborted, true)
  assert.equal(app.element('extension-error').hidden, false)
  finish(Response.json({ status: 'ok' }))
  await settle()
  assert.equal(app.frame(), undefined)
  assert.equal(app.element('extension-error').hidden, false)
})

test('重试后忽略旧页面的加载事件，页面超时仍可恢复', async () => {
  const app = startShell(healthy)
  await settle()
  const prior = app.frame()
  prior.dispatchEvent(new Event('error'))
  app.element('extension-retry').click()
  await settle()
  prior.dispatchEvent(new Event('load'))
  assert.equal(app.element('extension-connection').hidden, false)
  assert.equal(app.element('extension-content').hidden, true)
  for (const callback of [...app.timers.values()]) callback()
  assert.equal(app.element('extension-error').hidden, false)
  app.element('extension-retry').click()
  await settle()
  app.frame().dispatchEvent(new Event('load'))
  assert.equal(app.element('extension-content').hidden, false)
})

test('重新加载交给浏览器处理，保留内嵌页面的未保存草稿保护', async () => {
  const app = startShell(healthy)
  await settle()
  const frame = app.frame()
  frame.dispatchEvent(new Event('load'))
  app.element('extension-reload').click()
  assert.equal(app.reloads(), 1)
  assert.equal(app.frame(), frame)
})

test('点击扩展图标优先复用正确标签页，不误用相似路径', async () => {
  const url = 'chrome-extension://keepdo/index.html'
  for (const existing of [undefined, { id: 0, windowId: 0, url: `${url}?view=main` }]) {
    const actions: Array<[string, unknown]> = []
    let click!: () => Promise<void>
    runInNewContext(background, {
      chrome: {
        runtime: { getURL: () => url },
        action: { onClicked: { addListener: (handler: () => Promise<void>) => { click = handler } } },
        tabs: {
          query: async () => [{ id: 9, url: `${url}.other` }, ...(existing ? [existing] : [])],
          update: async (id: number) => { actions.push(['tab', id]) },
          create: async (options: { url: string }) => { actions.push(['create', options.url]) },
        },
        windows: { update: async (id: number) => { actions.push(['window', id]) } },
      },
    })
    await click()
    assert.deepEqual(actions, existing ? [['tab', 0], ['window', 0]] : [['create', url]])
  }
})
