<script setup lang="ts">
import type { JournalEntry } from '../../../shared/journal'
import { RECORD_EXPORT_WIDTH } from '../../../shared/record-image-export'
import JournalMarkdown from '../journal/JournalMarkdown.vue'

defineProps<{
  entries: JournalEntry[]
  titles: Map<string, string>
  summary: string
}>()
</script>

<template>
  <section class="records-export-sheet bg-[#f8f9fc] p-8 text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100" :style="{ width: `${RECORD_EXPORT_WIDTH}px` }">
    <header class="mb-6 rounded-3xl border border-indigo-200/60 bg-indigo-50 p-7 dark:border-indigo-900 dark:bg-[#171d35]">
      <p class="font-display text-sm font-bold tracking-widest text-indigo-600 dark:text-indigo-300">KeepDo · 成长档案</p>
      <h1 class="mt-3 text-3xl font-bold tracking-tight">记录时间线</h1>
      <p class="mt-4 text-sm leading-7 break-words text-slate-600 dark:text-slate-300">{{ summary }}</p>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">共 {{ entries.length }} 条记录 · 按记录日期从新到旧</p>
    </header>
    <article v-for="entry in entries" :key="entry.id" class="mb-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141b28]">
      <div class="mb-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ entry.date }} · {{ entry.subjectType === 'goal' ? '目标' : '习惯' }}</p>
        <h2 class="mt-2 text-lg leading-8 font-semibold break-words">{{ titles.get(`${entry.subjectType}:${entry.subjectId}`) || `已删除的${entry.subjectType === 'goal' ? '目标' : '习惯'}` }}</h2>
      </div>
      <JournalMarkdown v-if="entry.content" :content="entry.content" :id-prefix="`records-export-content-${entry.id}`" />
      <div v-if="entry.images.length" class="mt-4 space-y-3">
        <img v-for="(image, index) in entry.images" :key="image.id" :src="image.url" :alt="`${entry.date} 的第 ${index + 1} 张照片`" loading="eager" class="block h-auto max-h-[1000px] max-w-full rounded-xl object-contain" />
      </div>
    </article>
    <footer class="pt-3 text-center text-xs tracking-wide text-slate-400">每一次记录，都让成长有迹可循。 · KeepDo</footer>
  </section>
</template>

<style scoped>
/* 导出时展开横向滚动区域，避免代码和表格只截取可见部分。 */
.records-export-sheet :deep(pre),
.records-export-sheet :deep(pre code) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.records-export-sheet :deep(.journal-markdown-table) { overflow: visible; }
.records-export-sheet :deep(table) { table-layout: fixed; }
.records-export-sheet :deep(th),
.records-export-sheet :deep(td) { min-width: 0; overflow-wrap: anywhere; }
</style>
