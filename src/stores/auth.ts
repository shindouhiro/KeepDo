import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'

export interface Account { id: string; username: string }
export const useAuthStore = defineStore('auth', () => {
  const user = ref<Account | null>(null)
  const initializing = ref(true)
  const busy = ref(false)
  const error = ref('')
  const initializationError = ref('')
  async function initialize() {
    initializing.value = true
    initializationError.value = ''
    try { user.value = (await api<{ user: Account | null }>('/api/auth/session')).user }
    catch (cause) { initializationError.value = cause instanceof Error ? cause.message : '无法连接账号服务' }
    finally { initializing.value = false }
  }
  async function authenticate(mode: 'login' | 'register', username: string, password: string) {
    busy.value = true
    error.value = ''
    try {
      const result = await api<{ user: Account }>(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password }) })
      user.value = result.user
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '登录失败，请重试'
      return false
    } finally { busy.value = false }
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' })
    user.value = null
    error.value = ''
  }
  return { user, initializing, busy, error, initializationError, initialize, authenticate, logout }
})
