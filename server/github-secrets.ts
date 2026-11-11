import { base64ToBytes, bytesToBase64 } from '../shared/backup.ts'
import { HttpError } from './http.ts'

async function encryptionKey(secret: string | undefined) {
  if (!secret || secret.length < 32) throw new HttpError(503, 'GitHub 备份尚未启用，请联系部署者配置服务端密钥')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptGitHubToken(token: string, userId: string, secret: string | undefined): Promise<string> {
  const key = await encryptionKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) }, key, new TextEncoder().encode(token))
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

export async function decryptGitHubToken(ciphertext: string, userId: string, secret: string | undefined): Promise<string> {
  const key = await encryptionKey(secret)
  try {
    const [version, iv, data] = ciphertext.split('.')
    if (version !== 'v1' || !iv || !data) throw new Error('密文无效')
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: new TextEncoder().encode(userId) }, key, base64ToBytes(data))
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new HttpError(503, 'GitHub 授权无法读取，请重新连接仓库')
  }
}
