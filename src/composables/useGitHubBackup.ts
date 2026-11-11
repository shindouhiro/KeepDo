import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import type { CompleteBackup } from '../../shared/backup'
import { completeBackupSchema } from '../../shared/backup'
import { GITHUB_BACKUP_LIMIT, githubConnectionInputSchema, githubConnectionSchema, githubHistorySchema, githubStatusSchema } from '../../shared/github-backup'
import type { GitHubConnection, GitHubHistory } from '../../shared/github-backup'
import { api } from '../lib/api'
import { useKeepDoStore } from '../stores/keepdo'
import { useConfirmDrawer } from './useConfirmDrawer'

export function useGitHubBackup(restoreBackup: (backup: CompleteBackup) => Promise<boolean>) {
  const store = useKeepDoStore()
  const confirm = useConfirmDrawer()
  const available = shallowRef(false)
  const initialized = shallowRef(false)
  const connection = shallowRef<GitHubConnection | null>(null)
  const owner = shallowRef('')
  const repo = shallowRef('')
  const token = shallowRef('')
  // 本次页面授权只保留在闭包，关闭设置即释放，不进入浏览器存储。
  let sessionAccess: { owner: string; repo: string; token: string } | null = null
  let disposed = false
  const busy = shallowRef(false)
  const action = shallowRef('')
  const message = shallowRef('')
  const isError = shallowRef(false)
  const entries = shallowRef<GitHubHistory['entries']>([])
  const hasMore = shallowRef(false)
  const page = shallowRef(0)
  const formValid = computed(() => githubConnectionInputSchema.safeParse({ owner: owner.value, repo: repo.value, token: token.value }).success)

  async function run(name: string, work: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    action.value = name
    isError.value = false
    message.value = ''
    try { await work() }
    catch (cause) {
      isError.value = true
      message.value = cause instanceof Error ? cause.message : 'GitHub 备份操作失败，请重试'
    } finally { busy.value = false; action.value = '' }
  }
  async function loadHistory(nextPage = 1) {
    const result = githubHistorySchema.parse(sessionAccess
      ? await sessionRequest({ action: 'history', page: nextPage })
      : await api(`/api/github-backup/history?page=${nextPage}`))
    entries.value = nextPage === 1 ? result.entries : [...entries.value, ...result.entries.filter(item => !entries.value.some(previous => previous.sha === item.sha))]
    hasMore.value = result.hasMore
    page.value = nextPage
  }
  function sessionRequest<T>(payload: Record<string, unknown>): Promise<T> {
    if (!sessionAccess) throw new Error('本次授权已结束，请重新连接仓库')
    return api<T>('/api/github-backup/session', { method: 'POST', body: JSON.stringify({ ...sessionAccess, ...payload }), signal: AbortSignal.timeout(90_000) })
  }
  async function initialize() {
    await run('loading', async () => {
      const status = githubStatusSchema.parse(await api('/api/github-backup'))
      available.value = status.available
      connection.value = status.available ? status.connection : null
      owner.value = status.connection?.owner || ''
      repo.value = status.connection?.repo || ''
      initialized.value = true
      if (status.available && status.connection) await loadHistory()
    })
  }
  async function connect() {
    await run('connect', async () => {
      const input = githubConnectionInputSchema.parse({ owner: owner.value, repo: repo.value, token: token.value })
      try {
        if (available.value) {
          const status = githubStatusSchema.parse(await api('/api/github-backup', { method: 'PUT', body: JSON.stringify(input) }))
          connection.value = status.connection
        } else {
          const result = await api<{ connection: unknown }>('/api/github-backup/session', { method: 'POST', body: JSON.stringify({ ...input, action: 'connect' }), signal: AbortSignal.timeout(45_000) })
          if (disposed) return
          connection.value = githubConnectionSchema.parse(result.connection)
          sessionAccess = input
        }
        entries.value = []
        hasMore.value = false
        message.value = available.value ? '私有仓库已连接，授权令牌已加密保存。' : '本次页面授权成功，可以立即备份。关闭设置或刷新后需重新授权。'
        try { await loadHistory() }
        catch { message.value += ' 历史列表暂未读取，可点击刷新重试。' }
      } finally { token.value = '' }
    })
  }
  async function disconnect() {
    await run('disconnect', async () => {
      if (!(await confirm({ title: '断开 GitHub 连接', message: '断开后将移除当前账号保存的 GitHub 授权，仓库中的历史备份会保留。', confirmLabel: '确认断开', danger: true }))) return
      if (!sessionAccess) await api('/api/github-backup', { method: 'DELETE' })
      sessionAccess = null
      connection.value = null
      token.value = ''
      entries.value = []
      hasMore.value = false
      message.value = '已断开连接，GitHub 中的历史备份仍保留。'
    })
  }
  async function upload() {
    await run('upload', async () => {
      // 先落盘当前页面修改，再生成一致的完整快照。
      await store.flushSync()
      const source = await store.exportDataAsJSON(progress => { message.value = progress })
      if (new TextEncoder().encode(source).byteLength > GITHUB_BACKUP_LIMIT) throw new Error('完整备份超过 GitHub 单次 8 MB 上限，请使用上方的本地导出。')
      message.value = '正在上传完整备份，请保持页面打开…'
      if (sessionAccess) await sessionRequest({ action: 'upload', backup: JSON.parse(source) })
      else await api('/api/github-backup/snapshot', { method: 'POST', body: `{"backup":${source}}`, signal: AbortSignal.timeout(90_000) })
      message.value = '完整备份已保存到 GitHub，包含全部图文记录和图片。'
      try { await loadHistory() }
      catch { message.value += ' 历史列表刷新失败，可稍后点击刷新。' }
    })
  }
  async function restore(sha: string) {
    await run('restore', async () => {
      message.value = '正在读取并校验历史备份…'
      const result = sessionAccess
        ? await sessionRequest<{ backup: unknown }>({ action: 'read', ref: sha })
        : await api<{ backup: unknown }>(`/api/github-backup/snapshot?ref=${sha}`, { signal: AbortSignal.timeout(60_000) })
      const backup = completeBackupSchema.parse(result.backup)
      message.value = '备份已校验，等待确认恢复…'
      message.value = await restoreBackup(backup) ? '历史备份已恢复到当前账号。' : '已取消恢复，当前数据未更改。'
    })
  }
  function refresh() { return run('history', () => loadHistory()) }
  function loadMore() { return run('history', () => loadHistory(page.value + 1)) }
  onMounted(() => { void initialize() })
  onBeforeUnmount(() => { disposed = true; token.value = ''; sessionAccess = null })
  return { available, initialized, connection, owner, repo, token, busy, action, message, isError, entries, hasMore, formValid, initialize, connect, disconnect, upload, restore, refresh, loadMore }
}
