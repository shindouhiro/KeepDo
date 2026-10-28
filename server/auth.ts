import type { Env, User } from './types.ts'
import { credentialsSchema, emptyAppData } from '../shared/schema.ts'
import { createToken, hashToken, hashPassword, verifyPassword } from './password.ts'
import { HttpError, json, readBody } from './http.ts'

const sessionDuration = 30 * 24 * 60 * 60
const dummyHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
function cookieName(request: Request): string {
  return new URL(request.url).protocol === 'https:' ? '__Host-keepdo_session' : 'keepdo_session'
}
function sessionCookie(request: Request, token: string, maxAge = sessionDuration): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}
function requestToken(request: Request): string | undefined {
  return request.headers.get('Cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName(request)}=`))?.split('=')[1]
}
export async function getUser(request: Request, env: Env): Promise<User | null> {
  const token = requestToken(request)
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null
  return env.DB.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?')
    .bind(hashToken(token), Math.floor(Date.now() / 1000)).first<User>()
}
async function rateLimit(env: Env, request: Request, action: string, username: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const window = action === 'register' ? 3600 : 900
  const keys = [{ value: `${action}:ip:${ip}`, limit: action === 'register' ? 10 : 40 }]
  if (action === 'login') keys.push({ value: `${action}:username:${username}`, limit: 15 })
  for (const key of keys) {
    const result = await env.DB.prepare(`INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts`)
      .bind(hashToken(key.value), now + window, now, now).first<{ attempts: number }>()
    if (!result || result.attempts > key.limit) throw new HttpError(429, '尝试次数过多，请稍后再试')
  }
}
export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/auth/session' && request.method === 'GET') return json({ user: await getUser(request, env) })
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = requestToken(request)
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hashToken(token)).run()
    return json({ success: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) })
  }
  if (!['/api/auth/login', '/api/auth/register'].includes(path) || request.method !== 'POST') throw new HttpError(404, '接口不存在')
  const parsed = credentialsSchema.safeParse(await readBody(request))
  if (!parsed.success) throw new HttpError(400, '用户名需为 3–32 位字母、数字或下划线，密码需为 10–128 位')
  const { username, password } = parsed.data
  const action = path.endsWith('/register') ? 'register' : 'login'
  await rateLimit(env, request, action, username)
  const now = Math.floor(Date.now() / 1000)
  const token = createToken()
  const statements = []
  let user: User
  if (action === 'register') {
    const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (exists) throw new HttpError(409, '这个用户名已被注册')
    user = { id: crypto.randomUUID(), username }
    const passwordHash = await hashPassword(password)
    statements.push(env.DB.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').bind(user.id, username, passwordHash, now))
    statements.push(env.DB.prepare('INSERT INTO user_data (user_id, data, version, updated_at) VALUES (?, ?, 0, ?)').bind(user.id, JSON.stringify(emptyAppData()), now))
  } else {
    const account = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').bind(username).first<User & { password_hash: string }>()
    const valid = await verifyPassword(password, account?.password_hash ?? dummyHash)
    if (!account || !valid) throw new HttpError(401, '用户名或密码不正确')
    user = { id: account.id, username: account.username }
  }
  statements.push(env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(hashToken(token), user.id, now + sessionDuration))
  statements.push(env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now))
  statements.push(env.DB.prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?').bind(now))
  try { await env.DB.batch(statements) }
  catch (error) {
    if (action === 'register' && String(error).includes('UNIQUE')) throw new HttpError(409, '这个用户名已被注册')
    throw error
  }
  return json({ user }, action === 'register' ? 201 : 200, { 'Set-Cookie': sessionCookie(request, token) })
}
