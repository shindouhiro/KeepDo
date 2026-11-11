import { shallowRef } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { useJournalStore } from '../stores/journal'
import { api } from '../lib/api'
import { BACKUP_BODY_LIMIT, parseBackup } from '../../shared/backup'
import type { BackupManifest, CompleteBackup } from '../../shared/backup'
import { getTodayString } from '../utils/date'
import { useConfirmDrawer } from './useConfirmDrawer'

export function useDataBackup() {
  const store = useKeepDoStore()
  const journal = useJournalStore()
  const confirm = useConfirmDrawer()
  const statusMessage = shallowRef('')
  const isError = shallowRef(false)
  const busy = shallowRef(false)
  const exporting = shallowRef(false)
  const showLocalExport = shallowRef(false)

  function download(json: string, partial = false) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `keepdo-${partial ? 'basic-data' : 'backup'}-${getTodayString()}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function fail(cause: unknown) {
    statusMessage.value = cause instanceof Error ? cause.message : '操作失败，请重试'
    isError.value = true
  }
  async function handleExport() {
    if (busy.value) return
    busy.value = exporting.value = true
    isError.value = showLocalExport.value = false
    try {
      const json = await store.exportDataAsJSON(message => { statusMessage.value = message })
      download(json)
      statusMessage.value = '完整备份已下载，包含基础数据、全部图文日记和图片。'
    } catch (cause) {
      fail(cause)
      showLocalExport.value = true
    } finally { busy.value = exporting.value = false }
  }
  function handleLocalExport() {
    download(store.exportLocalDataAsJSON(), true)
    statusMessage.value = '已导出页面基础数据（含未保存修改），不包含图文日记和图片。完整备份需要联网后重新导出。'
    isError.value = false
  }
  async function restoreBackup(backup: CompleteBackup): Promise<boolean> {
    await store.flushSync()
    const point = await api<BackupManifest>('/api/backup')
    const count = backup.journal.reduce((sum, entry) => sum + entry.images.length, 0)
    if (!(await confirm({ title: '恢复完整备份', message: `将恢复 ${backup.goals.length} 个目标、${backup.habits.length} 个习惯、${backup.todos.length} 项待办、${backup.journal.length} 条图文日记和 ${count} 张图片，并替换当前账号的全部业务数据。建议先备份当前内容。`, confirmLabel: '确认恢复', danger: true }))) return false
    statusMessage.value = '正在恢复基础数据、日记和图片，请保持页面打开…'
    await store.restoreCompleteBackup(backup, point)
    journal.clear()
    await journal.refresh()
    statusMessage.value = '完整备份已恢复并保存到当前账号，日记和图片均已恢复！'
    isError.value = false
    return true
  }
  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''
    if (!file || busy.value) return
    busy.value = true
    isError.value = false
    statusMessage.value = '正在检查备份文件…'
    try {
      if (file.size > BACKUP_BODY_LIMIT - 1_000_000) throw new Error('备份文件过大，无法恢复，请保留原始文件')
      let parsed: ReturnType<typeof parseBackup>
      try { parsed = parseBackup(JSON.parse(await file.text())) }
      catch { throw new Error('导入失败：JSON 格式不匹配、版本不支持或图片损坏，当前数据未更改。') }
      if (parsed.kind === 'complete') {
        if (!await restoreBackup(parsed.data)) statusMessage.value = ''
      } else {
        if (!(await confirm({ title: '恢复基础数据', message: '这是旧版基础数据备份，将替换当前账号的目标、习惯、待办与分类；现有图文日记及图片会保留。', confirmLabel: '确认恢复', danger: true }))) { statusMessage.value = ''; return }
        if (!store.importDataFromJSON(JSON.stringify(parsed.data))) throw new Error('导入失败，基础数据格式不正确')
        await store.flushSync()
        statusMessage.value = '基础数据已恢复并保存。此文件不含图文日记和图片，账号原有日记已保留。'
      }
    } catch (cause) { fail(cause) }
    finally { busy.value = false }
  }
  async function handleReset() {
    if (busy.value || !(await confirm({ title: '载入精选示例数据', message: '当前基础数据将被覆盖，图文日记与图片会保留。建议先导出备份。', confirmLabel: '载入示例数据', danger: true }))) return
    busy.value = true
    isError.value = false
    try {
      store.resetToSample()
      await store.flushSync()
      statusMessage.value = '示例数据已保存到当前账号！'
    } catch (cause) { fail(cause) }
    finally { busy.value = false }
  }
  return { statusMessage, isError, busy, exporting, showLocalExport, handleExport, handleLocalExport, handleFileChange, handleReset, restoreBackup }
}
