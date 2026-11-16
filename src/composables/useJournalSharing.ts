import { onScopeDispose, shallowRef } from 'vue'
import { api } from '../lib/api'
import { copyText } from '../lib/platform'
import { shareLinkSchema, shareListSchema, sharePreviewSchema } from '../../shared/journal-share'
import type { ShareLink, SharePreview, ShareSelection } from '../../shared/journal-share'
import { useConfirmDrawer } from './useConfirmDrawer'

export function useJournalSharing() {
  const preview = shallowRef<SharePreview | null>(null)
  const created = shallowRef<ShareLink | null>(null)
  const shares = shallowRef<ShareLink[]>([])
  const busy = shallowRef(false)
  const error = shallowRef('')
  const notice = shallowRef('')
  const loaded = shallowRef(false)
  const confirm = useConfirmDrawer()
  const controller = new AbortController()
  onScopeDispose(() => controller.abort())

  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    try { await action() }
    catch (cause) { if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试' }
    finally { busy.value = false }
  }
  function resetPreview() { preview.value = null; created.value = null; error.value = ''; notice.value = '' }
  async function loadPreview(selection: ShareSelection) {
    await run(async () => {
      preview.value = sharePreviewSchema.parse(await api('/api/journal-shares/preview', {
        method: 'POST', body: JSON.stringify({ selection }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
      }))
    })
  }
  async function create(selection: ShareSelection) {
    const revision = preview.value?.revision
    if (!revision) return
    await run(async () => {
      created.value = shareLinkSchema.parse(await api('/api/journal-shares', { method: 'POST', body: JSON.stringify({ selection, revision }) }))
      notice.value = '分享链接已生成，可以复制给其他人。'
    })
  }
  async function loadShares() {
    await run(async () => {
      shares.value = shareListSchema.parse(await api('/api/journal-shares', { signal: controller.signal })).shares
      loaded.value = true
    })
  }
  async function copy(url: string) {
    await run(async () => {
      try { await copyText(url) }
      catch { throw new Error('自动复制未成功，请选中下方链接手动复制') }
      notice.value = '链接已复制'
    })
  }
  async function revoke(share: ShareLink) {
    if (busy.value || !await confirm({ title: '撤销这个分享？', message: '撤销后，其他人将无法通过原链接查看记录和图片。已保存或截图的内容不会被收回。', confirmLabel: '撤销分享', danger: true })) return
    await run(async () => {
      await api(`/api/journal-shares/${share.token}`, { method: 'DELETE' })
      shares.value = shares.value.filter(item => item.token !== share.token)
      if (created.value?.token === share.token) created.value = null
      notice.value = '分享已撤销，原链接已失效'
    })
  }
  return { preview, created, shares, busy, error, notice, loaded, resetPreview, loadPreview, create, loadShares, copy, revoke }
}
