import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto'

// 使用原生 scrypt，参数采用 32 MiB 内存与三轮并行工作的组合。
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key))
  })
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, hash] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(hash ?? '')) return false
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash!, 'hex'))
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
export function createToken(): string {
  return randomBytes(32).toString('base64url')
}
