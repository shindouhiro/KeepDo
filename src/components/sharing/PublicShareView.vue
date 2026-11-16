<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { BookOpen, Link2Off } from '@lucide/vue'
import { publicShareSchema } from '../../../shared/journal-share'
import type { ShareSnapshot } from '../../../shared/journal-share'
import { api } from '../../lib/api'
import ShareContent from './ShareContent.vue'

const snapshot = shallowRef<ShareSnapshot | null>(null)
const loading = shallowRef(true)
const error = shallowRef('')
const controller = new AbortController()
const token = location.pathname.match(/^\/share\/([a-f0-9]{64})\/?$/)?.[1]
// 公开页沿用主题偏好，但不初始化包含私密账号数据的 store。
let dark = window.matchMedia('(prefers-color-scheme: dark)').matches
try {
  const saved = localStorage.getItem('keepdo_dark_mode')
  if (saved !== null) dark = saved === 'true'
} catch { /* 无本地存储权限时跟随系统主题。 */ }
document.documentElement.classList.toggle('dark', dark)
function meta(name: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`) ?? document.createElement('meta')
  element.name = name; element.content = content
  if (!element.isConnected) document.head.append(element)
}
meta('robots', 'noindex, nofollow, noarchive')
meta('referrer', 'no-referrer')
meta('description', '通过 KeepDo 分享的一段记录，打开链接即可阅读。')
document.title = '记录分享 · KeepDo'
async function load() {
  loading.value = true; error.value = ''; snapshot.value = null
  try {
    if (!token) throw new Error('分享链接不正确或已失效')
    const result = publicShareSchema.parse(await api(`/api/public/journal-shares/${token}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) }))
    snapshot.value = result.snapshot
    document.title = `${result.snapshot.title} · KeepDo`
  } catch (cause) { if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '暂时无法读取分享，请稍后重试' }
  finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <main class="min-h-dvh bg-[#f8f9fc] px-4 py-8 text-slate-800 sm:py-14 dark:bg-[#0b0f17] dark:text-slate-100">
    <div class="mx-auto max-w-3xl space-y-6">
      <header class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 sm:p-8 dark:border-indigo-900/50 dark:from-indigo-950/50 dark:via-[#141b28] dark:to-[#141b28]">
        <p class="flex items-center gap-2 text-xs font-semibold tracking-wide text-indigo-600 dark:text-indigo-300"><BookOpen class="h-4 w-4" />KeepDo · 记录分享</p>
        <h1 class="mt-4 text-2xl leading-snug font-bold tracking-tight sm:text-3xl">{{ snapshot?.title ?? '一段值得分享的记录' }}</h1>
        <p class="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ snapshot ? `共 ${snapshot.records.length} 条记录 · ${snapshot.excerpt ? '文字片段' : '图文快照'}` : '记录生活，也分享每一步成长。' }}</p>
      </header>
      <p v-if="loading" role="status" class="py-16 text-center text-sm text-slate-500">正在打开分享…</p>
      <section v-else-if="error" class="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#141b28]">
        <Link2Off class="mx-auto h-8 w-8 text-slate-400" />
        <h2 class="mt-4 font-semibold">暂时无法查看这份分享</h2>
        <p role="alert" class="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{{ error }}</p>
        <button id="public-share-retry" type="button" class="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" @click="load">重新加载</button>
      </section>
      <ShareContent v-else-if="snapshot" :snapshot="snapshot" id-prefix="public-share" />
      <footer class="py-6 text-center text-xs leading-6 text-slate-400">由 KeepDo 记录与分享 · 内容为生成链接时的快照</footer>
    </div>
  </main>
</template>
