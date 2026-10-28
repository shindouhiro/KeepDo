<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloudCheck, CloudUpload, LogOut, RefreshCw } from '@lucide/vue'
import { useAuthStore } from '../../stores/auth'
import { useKeepDoStore } from '../../stores/keepdo'

const emit = defineEmits<{ 'open-settings': [] }>()
const auth = useAuthStore()
const store = useKeepDoStore()
const busy = ref(false)
const error = ref('')
const status = computed(() => {
  if (!store.isReady) return '正在加载'
  if (store.isLoading) return '正在刷新'
  if (store.syncState === 'saving') return '正在保存…'
  if (store.syncState === 'error') return '保存或连接失败'
  if (store.syncState === 'conflict') return '需要处理同步冲突'
  return '已保存到账号'
})
async function logout() {
  busy.value = true
  error.value = ''
  try {
    if (store.hasUnsavedChanges && store.sessionExpired) {
      if (!confirm('登录已过期。请先在设置中导出未保存的数据；继续退出会丢弃当前页面的未保存修改。确定退出吗？')) return
    } else await store.flushSync()
    await auth.logout()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '退出失败，请重试' }
  finally { busy.value = false }
}
async function refresh() {
  if (store.hasUnsavedChanges && !confirm('当前有未保存的修改。建议先在设置中导出备份，刷新会读取云端数据并替换当前内容。继续吗？')) return
  busy.value = true
  error.value = ''
  try { await store.reloadData() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '刷新失败' }
  finally { busy.value = false }
}
async function retry() {
  error.value = ''
  try {
    if (store.hasUnsavedChanges) await store.flushSync()
    else await store.loadData()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败' }
}
async function importLegacy() {
  if (!confirm('将本机旧版本的数据导入当前账号，并替换当前账号内容？建议先导出当前账号备份。旧本地原始数据会保留。')) return
  busy.value = true
  error.value = ''
  try { await store.importLegacyData() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '导入失败' }
  finally { busy.value = false }
}
</script>

<template>
  <aside class="border-b border-slate-200/70 bg-white/90 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/80" aria-label="账号与保存状态">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div class="flex min-w-0 items-center gap-3">
        <span class="max-w-40 truncate font-semibold text-slate-700 dark:text-slate-200">{{ auth.user?.username }}</span>
        <span class="flex items-center gap-1.5 text-slate-500" role="status" aria-live="polite"><CloudUpload v-if="store.syncState === 'saving'" class="h-3.5 w-3.5 animate-pulse" /><CloudCheck v-else class="h-3.5 w-3.5" />{{ status }}</span>
      </div>
      <div class="flex items-center gap-3">
        <button id="account-refresh" type="button" :disabled="busy || store.isLoading" class="flex items-center gap-1 rounded text-slate-500 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50" @click="refresh"><RefreshCw class="h-3.5 w-3.5" />刷新</button>
        <button id="account-logout" type="button" :disabled="busy || store.syncState === 'saving'" class="flex items-center gap-1 rounded text-slate-500 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-500 disabled:opacity-50" @click="logout"><LogOut class="h-3.5 w-3.5" />{{ busy ? '处理中…' : '退出登录' }}</button>
      </div>
    </div>
    <div v-if="store.syncError || error" role="alert" class="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 leading-6 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p class="min-w-0 flex-1">{{ error || store.syncError }}</p>
      <button v-if="store.isReady" id="account-error-backup" type="button" class="rounded font-bold underline" @click="emit('open-settings')">导出备份</button>
      <button v-if="store.syncState !== 'conflict' && !store.sessionExpired" id="account-sync-retry" type="button" :disabled="busy || store.syncState === 'saving'" class="rounded font-bold underline disabled:opacity-50" @click="retry">重试</button>
    </div>
    <div v-if="store.hasLegacyData && store.isReady" class="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-3 rounded-xl bg-indigo-50 p-3 leading-6 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
      <p class="min-w-0 flex-1">发现本机旧版数据，可导入当前账号；原始本地备份会保留。</p>
      <button id="account-import-legacy" type="button" :disabled="busy" class="rounded font-bold underline disabled:opacity-50" @click="importLegacy">导入旧数据</button>
      <button id="account-dismiss-legacy" type="button" :disabled="busy" class="rounded text-slate-500 hover:text-indigo-700" @click="store.hasLegacyData = false">暂不导入</button>
    </div>
  </aside>
</template>
