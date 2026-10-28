import type { Env } from './types.ts'
import { getUser, handleAuth } from './auth.ts'
import { HttpError, assertSameOrigin, json, readBody } from './http.ts'
import { saveDataSchema } from '../shared/schema.ts'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request)
      if (path.startsWith('/api/auth/')) return await handleAuth(request, env, path)
      if (path === '/api/health' && request.method === 'GET') return json({ status: 'ok' })
      const user = await getUser(request, env)
      if (!user) throw new HttpError(401, '请先登录')
      if (path !== '/api/data') throw new HttpError(404, '接口不存在')
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT data, version FROM user_data WHERE user_id = ?').bind(user.id).first<{ data: string; version: number }>()
        if (!row) throw new HttpError(404, '账号数据不存在')
        return json({ data: JSON.parse(row.data), version: row.version })
      }
      if (request.method === 'PUT') {
        const parsed = saveDataSchema.safeParse(await readBody(request))
        if (!parsed.success) throw new HttpError(400, '数据格式不正确，请检查导入文件或输入内容')
        const { data, version } = parsed.data
        const updated = await env.DB.prepare('UPDATE user_data SET data = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ? RETURNING version')
          .bind(JSON.stringify(data), Math.floor(Date.now() / 1000), user.id, version).first<{ version: number }>()
        if (!updated) throw new HttpError(409, '其他设备已更新数据。请先导出当前内容备份，再刷新读取最新数据')
        return json({ version: updated.version })
      }
      throw new HttpError(405, '不支持此请求方法')
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('接口处理失败', error instanceof Error ? error.name : '未知错误')
      return json({ error: '服务暂时不可用，请稍后重试' }, 500)
    }
  },
}
