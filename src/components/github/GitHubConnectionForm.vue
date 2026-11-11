<script setup lang="ts">
defineProps<{ available: boolean; connected: boolean; busy: boolean; disabled: boolean; formValid: boolean; action: string }>()
const emit = defineEmits<{ connect: [] }>()
const owner = defineModel<string>('owner', { required: true })
const repo = defineModel<string>('repo', { required: true })
const token = defineModel<string>('token', { required: true })
</script>

<template>
      <details id="github-backup-connection-details" :open="!connected" class="rounded-xl bg-white/70 p-3 dark:bg-slate-900/60">
        <summary id="github-backup-connection-summary" class="cursor-pointer text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-200">{{ connected ? '更换仓库或更新授权' : '连接备份仓库' }}</summary>
        <ol class="mt-3 space-y-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400" aria-label="手动授权步骤">
          <li>1. 准备一个 GitHub 私有仓库。</li>
          <li>2. 点击下方链接创建令牌，仅选择该仓库，设置 Contents → Read and write。</li>
          <li>3. 填写仓库信息和令牌，点击连接后即可备份。</li>
        </ol>
        <form id="github-backup-connect-form" class="mt-3" @submit.prevent="emit('connect')">
          <fieldset :disabled="busy || disabled" class="space-y-3 disabled:opacity-60">
            <div>
              <label for="github-backup-owner" class="github-label">仓库所有者</label>
              <input id="github-backup-owner" v-model="owner" type="text" required maxlength="39" autocomplete="off" spellcheck="false" placeholder="你的 GitHub 用户名或组织名" class="github-input" />
            </div>
            <div>
              <label for="github-backup-repo" class="github-label">私有仓库名</label>
              <input id="github-backup-repo" v-model="repo" type="text" required maxlength="100" autocomplete="off" spellcheck="false" placeholder="例如 keepdo-backups" class="github-input" />
            </div>
            <div>
              <label for="github-backup-token" class="github-label">细粒度访问令牌</label>
              <input id="github-backup-token" v-model="token" type="password" required minlength="20" maxlength="255" autocomplete="new-password" spellcheck="false" placeholder="github_pat_…" aria-describedby="github-backup-token-help" class="github-input" />
              <p id="github-backup-token-help" class="mt-1.5 text-[10px] leading-5 text-slate-500 dark:text-slate-400">仅授权备份仓库的 Contents 读写权限。{{ available ? '令牌在服务端加密保存。' : '令牌仅在当前设置面板内存中保留，关闭设置或刷新后清除。' }}提交后输入框会清空。</p>
              <a id="github-backup-create-token" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block text-[11px] font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-300">在 GitHub 创建细粒度令牌 ↗</a>
            </div>
            <button id="github-backup-connect" type="submit" :disabled="!formValid" class="github-primary">{{ action === 'connect' ? '正在验证仓库…' : '验证并连接私有仓库' }}</button>
          </fieldset>
        </form>
      </details>
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
