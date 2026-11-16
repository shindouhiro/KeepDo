<script setup lang="ts">
import JournalPhoto from './JournalImage.vue'
import { computed } from 'vue'
import { CalendarDays, Check, Pencil, Clock3, ImageDown, Images, Share2, Trash2 } from '@lucide/vue'
import type { JournalEntry, JournalImage } from '../../../shared/journal'
import { groupJournalEntries } from '../../../shared/journal'
import JournalMarkdown from './JournalMarkdown.vue'

const props = withDefaults(defineProps<{ entries: JournalEntry[]; checkIns?: Record<string, boolean>; selectedDate?: string; subjectLabel?: string; editable?: boolean | ((entry: JournalEntry) => boolean); disabled?: boolean; shareable?: boolean; exportable?: boolean; idPrefix?: string }>(), { selectedDate: '', subjectLabel: '目标', editable: true, disabled: false, shareable: false, exportable: false, idPrefix: 'journal' })
defineSlots<{ source?(props: { entry: JournalEntry }): unknown }>()
const emit = defineEmits<{ edit: [entry: JournalEntry]; delete: [entry: JournalEntry]; preview: [image: JournalImage]; share: [entry: JournalEntry]; shareDay: [date: string]; exportImage: [entry: JournalEntry] }>()
const groups = computed(() => groupJournalEntries(props.entries))
const timeFormatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' })
function time(iso: string) { return timeFormatter.format(new Date(iso)) }
function canEdit(entry: JournalEntry) { return typeof props.editable === 'function' ? props.editable(entry) : props.editable }
</script>

<template>
  <div v-if="!groups.length" class="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center dark:border-slate-800">
    <Clock3 class="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
    <p class="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">时间线从这一刻开始</p>
    <p class="mt-1.5 text-xs leading-6 text-slate-400">写下进展，添一张照片，让每一小步都有迹可循。</p>
  </div>
  <ol v-else class="space-y-6" :aria-label="`${subjectLabel}成长时间线`">
    <li v-for="group in groups" :key="group.date" class="relative pl-5">
      <span class="absolute top-1 left-0 h-2 w-2 rounded-full ring-4 ring-white dark:ring-[#101722]" :class="group.date === selectedDate ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'"></span>
      <div class="absolute top-5 bottom-0 left-[3px] w-px bg-slate-200/70 dark:bg-slate-800"></div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <h3 class="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ group.date }}</h3>
        <span v-if="group.date === selectedDate" class="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] text-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300">所选日期</span>
        <span v-if="checkIns?.[group.date]" class="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"><Check class="h-3 w-3" />已打卡</span>
        <div v-if="shareable" class="relative group ml-auto inline-flex">
          <button :id="`${idPrefix}-share-day-${group.date}`" type="button" :disabled="disabled" :aria-label="`分享 ${group.date} 的全部记录`" title="分享当天全部记录" aria-haspopup="dialog" aria-controls="journal-share-dialog" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-indigo-600 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-100/80 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60" @click="emit('shareDay', group.date)">
            <div class="relative flex h-4 w-4 items-center justify-center">
              <CalendarDays class="h-4 w-4" />
              <span class="absolute -bottom-1 -right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-indigo-600 text-white ring-1.5 ring-white dark:bg-indigo-400 dark:text-slate-900 dark:ring-[#101722]"><Share2 class="h-1.5 w-1.5 stroke-[2.5]" /></span>
            </div>
          </button>
          <span role="tooltip" class="pointer-events-none absolute bottom-full right-0 mb-2 z-30 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] leading-tight font-medium text-white shadow-lg whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">分享当天全部记录</span>
        </div>
      </div>
      <div class="space-y-3">
        <article v-for="entry in group.records" :key="entry.id" :id="`${idPrefix}-entry-${entry.id}`" class="rounded-2xl border border-slate-200/70 bg-white p-3.5 dark:border-slate-800 dark:bg-[#141b28]">
          <div v-if="$slots.source" class="mb-3"><slot name="source" :entry="entry" /></div>
          <JournalMarkdown v-if="entry.content" :content="entry.content" :id-prefix="`${idPrefix}-content-${entry.id}`" />
          <div v-if="entry.images.length" class="grid gap-2" :class="[entry.images.length === 1 ? 'max-w-xs grid-cols-1' : entry.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3', entry.content ? 'mt-3' : '']">
            <button v-for="(image, index) in entry.images" :id="`${idPrefix}-preview-${image.id}`" :key="image.id" type="button" :aria-label="`查看 ${entry.date} 的第 ${index + 1} 张图片`" aria-haspopup="dialog" aria-controls="journal-image-viewer" class="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-slate-900" @click="emit('preview', image)">
              <JournalPhoto :src="image.url" :alt="`${entry.date} 的${subjectLabel}进展照片 ${index + 1}`" loading="lazy" width="320" height="240" class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none" />
              <Images class="absolute right-2 bottom-2 h-3.5 w-3.5 text-white/90 drop-shadow" />
            </button>
          </div>
          <div class="relative z-20 mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>{{ time(entry.createdAt) }}<span v-if="entry.version > 1"> · 已编辑</span></span>
            <div class="flex items-center gap-1">
              <div v-if="shareable" class="relative group inline-flex">
                <button :id="`${idPrefix}-share-${entry.id}`" type="button" :disabled="disabled" aria-haspopup="dialog" aria-controls="journal-share-dialog" :aria-label="`分享 ${entry.date} ${time(entry.createdAt)} 的记录`" title="分享这条记录" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" @click="emit('share', entry)"><Share2 class="h-3.5 w-3.5" /></button>
                <span role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] leading-tight font-medium text-white shadow-lg whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">分享这条记录</span>
              </div>
              <div v-if="exportable" class="relative group inline-flex">
                <button :id="`${idPrefix}-export-image-${entry.id}`" type="button" :disabled="disabled" aria-haspopup="dialog" aria-controls="records-export-dialog" :aria-label="`保存 ${entry.date} 的卡片为照片`" title="保存为照片" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" @click="emit('exportImage', entry)"><ImageDown class="h-3.5 w-3.5" /></button>
                <span role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] leading-tight font-medium text-white shadow-lg whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">保存为照片</span>
              </div>
              <div v-if="canEdit(entry)" class="relative group inline-flex">
                <button :id="`${idPrefix}-edit-${entry.id}`" type="button" :disabled="disabled" :aria-label="`编辑 ${entry.date} ${time(entry.createdAt)} 的记录`" title="编辑" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300" @click="emit('edit', entry)"><Pencil class="h-3.5 w-3.5" /></button>
                <span role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] leading-tight font-medium text-white shadow-lg whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">编辑</span>
              </div>
              <div class="relative group inline-flex">
                <button :id="`${idPrefix}-delete-${entry.id}`" type="button" :disabled="disabled" :aria-label="`删除 ${entry.date} ${time(entry.createdAt)} 的记录`" title="删除" aria-haspopup="dialog" class="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-400 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950/30" @click="emit('delete', entry)"><Trash2 class="h-3.5 w-3.5" /></button>
                <span role="tooltip" class="pointer-events-none absolute bottom-full right-0 mb-2 z-30 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] leading-tight font-medium text-white shadow-lg whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">删除</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </li>
  </ol>
</template>
