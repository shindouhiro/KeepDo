<script setup lang="ts">
import type { ShareSnapshot } from '../../../shared/journal-share'
import { journalSubjectLabel } from '../../../shared/journal'
import JournalMarkdown from '../journal/JournalMarkdown.vue'
import JournalImage from '../journal/JournalImage.vue'

defineProps<{ snapshot: ShareSnapshot; idPrefix: string }>()
</script>

<template>
  <div class="space-y-5">
    <article v-for="(record, index) in snapshot.records" :key="index" class="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-[#141b28]">
      <header class="mb-5 border-b border-slate-100 pb-4 dark:border-slate-800">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ record.date }} · {{ journalSubjectLabel(record.subjectType) }}<span v-if="snapshot.excerpt"> · 文字片段</span></p>
        <h2 class="mt-2 text-lg font-bold break-words text-slate-800 dark:text-slate-100">{{ record.title }}</h2>
      </header>
      <JournalMarkdown v-if="record.content" :content="record.content" :id-prefix="`${idPrefix}-${index}`" />
      <div v-if="record.images.length" class="mt-5 space-y-3">
        <JournalImage v-for="(image, imageIndex) in record.images" :key="image.id" :src="image.url" :alt="`${record.date} 的第 ${imageIndex + 1} 张照片`" loading="lazy" class="block h-auto max-h-[1000px] max-w-full rounded-xl object-contain" />
      </div>
    </article>
  </div>
</template>
