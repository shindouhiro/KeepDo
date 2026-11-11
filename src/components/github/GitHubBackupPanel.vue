<script setup lang="ts">
import { watch } from 'vue'
import GitHubConnectionForm from './GitHubConnectionForm.vue'
import type { CompleteBackup } from '../../../shared/backup'
import { useGitHubBackup } from '../../composables/useGitHubBackup'

const props = defineProps<{ disabled: boolean; restoreBackup: (backup: CompleteBackup) => Promise<boolean> }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const { available, initialized, connection, owner, repo, token, busy, action, message, isError, entries, hasMore, formValid, initialize, connect, disconnect, upload, restore, refresh, loadMore } = useGitHubBackup(props.restoreBackup)
watch(busy, value => emit('busy', value), { immediate: true })

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <section aria-labelledby="github-backup-heading" :aria-busy="busy" class="space-y-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/30 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/15">
    <header>
      <div class="flex items-center justify-between gap-2">
        <h4 id="github-backup-heading" class="text-sm font-bold text-slate-900 dark:text-white">GitHub 异地备份</h4>
        <span class="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">私有仓库</span>
      </div>
      <p class="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">手动保存完整快照，并从历史版本恢复。单次上限 8 MB，较大的备份请使用本地导出。</p>
    </header>

    <p v-if="message" role="status" aria-live="polite" class="break-words rounded-xl p-3 text-xs leading-5" :class="isError ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'">{{ message }}</p>
    <p v-if="!initialized && busy" class="text-xs text-slate-500">正在读取 GitHub 连接状态…</p>
    <button v-if="!initialized && !busy" id="github-backup-retry" type="button" :disabled="disabled" class="github-secondary" @click="initialize">重新读取连接状态</button>

    <div v-if="initialized && !available" class="rounded-xl bg-slate-100 p-3 text-xs leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      可直接在下方手动授权，无需配置服务端密钥。授权仅在本次设置页面有效；关闭设置或刷新后，重新填写令牌即可连接原仓库。
    </div>

    <template v-if="initialized">
      <div v-if="connection" class="rounded-xl bg-white/80 p-3 text-xs dark:bg-slate-900/70">
        <p class="font-semibold text-emerald-700 dark:text-emerald-300">{{ available ? '已连接私有仓库' : '已连接私有仓库 · 本次页面有效' }}</p>
        <p class="mt-1 break-all font-medium text-slate-800 dark:text-slate-200">{{ connection.owner }}/{{ connection.repo }}</p>
        <p class="mt-1 break-all text-[10px] text-slate-500">分支：{{ connection.branch }}</p>
      </div>

      <GitHubConnectionForm v-model:owner="owner" v-model:repo="repo" v-model:token="token" :available="available" :connected="Boolean(connection)" :busy="busy" :disabled="disabled" :form-valid="formValid" :action="action" @connect="connect" />

      <div v-if="connection" class="space-y-3">
        <button id="github-backup-upload" type="button" :disabled="busy || disabled" class="github-primary w-full" @click="upload">{{ action === 'upload' ? '正在备份到 GitHub…' : '立即备份到 GitHub' }}</button>
        <div class="flex items-center justify-between gap-2">
          <h5 class="text-xs font-bold text-slate-700 dark:text-slate-200">历史备份</h5>
          <button id="github-backup-refresh" type="button" :disabled="busy || disabled" class="github-secondary" @click="refresh">刷新</button>
        </div>
        <p v-if="!entries.length" class="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[11px] leading-5 text-slate-500 dark:border-slate-700">{{ isError ? '历史备份暂未读取，请重试。' : '还没有备份，点击上方按钮保存第一份完整快照。' }}</p>
        <ol v-else class="space-y-2" aria-label="GitHub 历史备份">
          <li v-for="entry in entries" :key="entry.sha" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 dark:bg-slate-900/70">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ formatTime(entry.date) }}</p>
              <p class="mt-1 truncate text-[10px] text-slate-500" :title="entry.message">{{ entry.message }}</p>
              <p class="mt-1 font-mono text-[10px] text-slate-400">{{ entry.sha.slice(0, 7) }}</p>
            </div>
            <button :id="`github-backup-restore-${entry.sha}`" type="button" :disabled="busy || disabled" :aria-label="`恢复 ${formatTime(entry.date)} 的备份`" class="github-secondary shrink-0" @click="restore(entry.sha)">恢复此版本</button>
          </li>
        </ol>
        <button v-if="hasMore" id="github-backup-load-more" type="button" :disabled="busy || disabled" class="github-secondary w-full" @click="loadMore">加载更早备份</button>
        <p class="text-[10px] leading-5 text-slate-500 dark:text-slate-400">恢复前会展示数据数量并再次确认。恢复将替换当前账号数据，请先备份当前内容。</p>
      </div>
    </template>
    <button v-if="connection" id="github-backup-disconnect" type="button" :disabled="busy || disabled" class="min-h-10 rounded-lg px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40" @click="disconnect">断开连接（保留历史备份）</button>
  </section>
</template>

<style scoped>
@reference "../../style.css";

.github-label {
  @apply block text-xs font-semibold text-slate-700 dark:text-slate-200;
}
.github-input {
  @apply mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100;
}
.github-primary {
  @apply min-h-10 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50;
}
.github-secondary {
  @apply min-h-10 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100/60 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-900/40;
}
</style>
