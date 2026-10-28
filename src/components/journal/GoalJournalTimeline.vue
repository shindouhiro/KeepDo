<script setup lang="ts">
import { computed } from 'vue'
import { Check, Pencil, Clock3, Images } from '@lucide/vue'
import type { GoalJournalEntry, JournalImage } from '../../../shared/journal'
import { groupJournalEntries } from '../../../shared/journal'

const props = defineProps<{ entries: GoalJournalEntry[]; checkIns?: Record<string, boolean>; selectedDate: string }>()
const emit = defineEmits<{ edit: [entry: GoalJournalEntry]; preview: [image: JournalImage] }>()
const groups = computed(() => groupJournalEntries(props.entries))
function time(iso: string) { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) }
</script>

<template>
  <div v-if="!groups.length" class="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center dark:border-slate-800">
    <Clock3 class="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
    <p class="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">时间线从这一刻开始</p>
    <p class="mt-1.5 text-xs leading-6 text-slate-400">写下进展，添一张照片，让每一小步都有迹可循。</p>
  </div>
  <ol v-else class="space-y-6" aria-label="目标成长时间线">
    <li v-for="group in groups" :key="group.date" class="relative pl-5">
      <span class="absolute top-1 left-0 h-2 w-2 rounded-full ring-4 ring-white dark:ring-[#101722]" :class="group.date === selectedDate ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'"></span>
      <div class="absolute top-5 bottom-0 left-[3px] w-px bg-slate-200/70 dark:bg-slate-800"></div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <h3 class="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ group.date }}</h3>
        <span v-if="group.date === selectedDate" class="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] text-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300">所选日期</span>
        <span v-if="checkIns?.[group.date]" class="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"><Check class="h-3 w-3" />已打卡</span>
      </div>
      <div class="space-y-3">
        <article v-for="entry in group.records" :key="entry.id" :id="`journal-entry-${entry.id}`" class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3.5 dark:border-slate-800 dark:bg-[#141b28]">
          <p v-if="entry.content" class="text-sm leading-7 whitespace-pre-wrap [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300">{{ entry.content }}</p>
          <div v-if="entry.images.length" class="grid gap-2" :class="[entry.images.length === 1 ? 'max-w-xs grid-cols-1' : entry.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3', entry.content ? 'mt-3' : '']">
            <button v-for="(image, index) in entry.images" :id="`journal-preview-${image.id}`" :key="image.id" type="button" :aria-label="`查看 ${entry.date} 的第 ${index + 1} 张图片`" aria-haspopup="dialog" aria-controls="journal-image-viewer" class="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-slate-900" @click="emit('preview', image)">
              <img :src="image.url" :alt="`${entry.date} 的目标进展照片 ${index + 1}`" loading="lazy" width="320" height="240" class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none" />
              <Images class="absolute right-2 bottom-2 h-3.5 w-3.5 text-white/90 drop-shadow" />
            </button>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>{{ time(entry.createdAt) }}<span v-if="entry.version > 1"> · 已编辑</span></span>
            <button :id="`journal-edit-${entry.id}`" type="button" :aria-label="`编辑 ${entry.date} ${time(entry.createdAt)} 的记录`" class="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 hover:bg-slate-50 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:hover:bg-slate-800" @click="emit('edit', entry)"><Pencil class="h-3 w-3" />编辑</button>
          </div>
        </article>
      </div>
    </li>
  </ol>
</template>
