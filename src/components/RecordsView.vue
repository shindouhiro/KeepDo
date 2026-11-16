<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, useTemplateRef } from 'vue'
import { BookOpen, Clock3, Flame, LoaderCircle, NotebookPen, RefreshCw, Share2, Target } from '@lucide/vue'
import type { JournalEntry, JournalImage } from '../../shared/journal'
import { journalSubjectLabel } from '../../shared/journal'
import type { JournalFeedFilter } from '../../shared/journal-feed'
import { useJournalFeed } from '../composables/useJournalFeed'
import { useJournalDeletion } from '../composables/useJournalDeletion'
import { useKeepDoStore } from '../stores/keepdo'
import { getTodayString } from '../utils/date'
import JournalTimeline from './journal/JournalTimeline.vue'
import RecordsFilters from './records/RecordsFilters.vue'
import RecordsImageExport from './records/RecordsImageExport.vue'

const JournalImageViewer = defineAsyncComponent(() => import('./journal/JournalImageViewer.vue'))
const JournalDeleteDialog = defineAsyncComponent(() => import('./journal/JournalDeleteDialog.vue'))
const JournalDialog = defineAsyncComponent(() => import('./journal/JournalDialog.vue'))
const JournalShareDrawer = defineAsyncComponent(() => import('./sharing/JournalShareDrawer.vue'))
const shareTarget = shallowRef<{ entry: JournalEntry } | { date: string } | { manage: true } | null>(null)
const imageExporter = useTemplateRef<InstanceType<typeof RecordsImageExport>>('imageExporter')
const store = useKeepDoStore()
const filter = ref<JournalFeedFilter>({ type: 'all', subjectId: '', from: '', to: '' })
const feed = useJournalFeed(() => filter.value)
const preview = ref<JournalImage | null>(null)
const statusMessage = shallowRef('')
const noteDialog = shallowRef<{ date: string; initialEntry: JournalEntry | null } | null>(null)
const deletion = useJournalDeletion(entry => {
  feed.removeEntry(entry.id)
  if (entry.images.some(image => image.id === preview.value?.id)) preview.value = null
  statusMessage.value = '记录已删除'
  void nextTick(() => document.getElementById('records-refresh')?.focus())
})
const subjects = computed(() => filter.value.type === 'goal' ? store.goals : filter.value.type === 'habit' ? store.habits : [])
const filterSummary = computed(() => {
  const current = filter.value
  const type = current.type === 'all' ? '全部记录' : `${journalSubjectLabel(current.type)}记录`
  const subject = current.subjectId ? subjects.value.find(item => item.id === current.subjectId)?.title : ''
  const dates = current.from || current.to ? `${current.from || '最早'} 至 ${current.to || '至今'}` : '全部日期'
  return [type, subject, dates].filter(Boolean).join(' · ')
})
const subjectTitles = computed(() => new Map([
  ...store.goals.map(goal => [`goal:${goal.id}`, goal.title] as const),
  ...store.habits.map(habit => [`habit:${habit.id}`, habit.title] as const),
]))
function subjectTitle(entry: JournalEntry) {
  if (entry.subjectType === 'note') return '随记'
  return subjectTitles.value.get(`${entry.subjectType}:${entry.subjectId}`)
    || `已删除的${journalSubjectLabel(entry.subjectType)}`
}
function canEdit(entry: JournalEntry) { return entry.subjectType === 'note' }
function openNote(entry: JournalEntry | null = null) {
  if (entry && !canEdit(entry)) return
  statusMessage.value = ''
  noteDialog.value = { date: entry?.date ?? getTodayString(), initialEntry: entry }
}
function noteSaved(entry: JournalEntry) {
  const current = filter.value
  const matches = (current.type === 'all' || current.type === 'note')
    && (!current.from || entry.date >= current.from)
    && (!current.to || entry.date <= current.to)
  statusMessage.value = matches ? '随记已保存' : '随记已保存；当前筛选未包含这条记录，可切换到“随记”并调整日期查看。'
  void feed.load()
}
function noteDeleted(entry: JournalEntry) {
  feed.removeEntry(entry.id)
  if (entry.images.some(image => image.id === preview.value?.id)) preview.value = null
  statusMessage.value = '随记已删除'
  void feed.load()
}
function exportCardImage(entry: JournalEntry) {
  const title = subjectTitle(entry)
  const summary = `${entry.date} · ${journalSubjectLabel(entry.subjectType)}「${title}」`
  imageExporter.value?.exportEntry(entry, summary)
}
</script>

<template>
  <section aria-labelledby="records-heading" class="mx-auto max-w-3xl space-y-6">
    <header class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-[#121824]">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400"><BookOpen class="h-3.5 w-3.5" />成长档案</p>
          <h1 id="records-heading" class="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">记录时间线</h1>
          <p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">目标进展、习惯日记和随手记下的生活，都在这里。</p>
        </div>
        <div class="relative group inline-flex">
          <button id="records-refresh" type="button" aria-label="刷新记录时间线" title="刷新记录时间线" :disabled="feed.loading.value" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800" @click="feed.load()"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': feed.loading.value }" /></button>
          <span role="tooltip" class="pointer-events-none absolute top-full right-0 mt-2 z-10 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">刷新记录时间线</span>
        </div>
      </div>
      <button id="records-new-note" type="button" :disabled="deletion.deleting.value" aria-haspopup="dialog" aria-controls="note-journal-dialog" class="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40 motion-reduce:transition-none" @click="openNote()"><NotebookPen class="h-4 w-4" />随手记</button>
      <RecordsFilters :filter="filter" :subjects="subjects" @update="filter = $event" />
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span class="text-[11px] text-slate-400" role="status">{{ feed.loading.value ? '正在载入…' : `已载入 ${feed.entries.value.length} 条 · 最新在前` }}</span>
        <div class="flex items-center gap-2">
          <div class="relative group inline-flex">
            <button id="records-manage-shares" type="button" aria-haspopup="dialog" aria-controls="journal-share-dialog" aria-label="记录分享" title="记录分享" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-[#121824] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300" @click="shareTarget = { manage: true }">
              <Share2 class="h-4 w-4" />
            </button>
            <span role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 hidden group-hover:flex group-focus-within:flex items-center rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md whitespace-nowrap dark:bg-slate-800 dark:text-slate-100 dark:border dark:border-slate-700">记录分享</span>
          </div>
          <RecordsImageExport ref="imageExporter" :filter="filter" :summary="filterSummary" :titles="subjectTitles" :disabled="feed.loading.value || Boolean(feed.error.value) || !feed.entries.value.length || deletion.deleting.value" />
        </div>
      </div>
      <p class="mt-2 text-[11px] leading-5 text-slate-400">保存为照片会自动包含全部筛选结果，无需逐页加载。</p>
    </header>

    <div v-if="feed.error.value" role="alert" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">{{ feed.error.value }}<button id="records-retry" type="button" :disabled="feed.loading.value" class="ml-2 rounded underline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40" @click="feed.load()">重新加载</button></div>
    <p v-if="statusMessage" role="status" class="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{{ statusMessage }}</p>
    <p v-if="feed.loading.value && !feed.entries.value.length" role="status" class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><LoaderCircle class="h-4 w-4 animate-spin" />正在整理你的记录…</p>
    <div v-else-if="feed.entries.value.length" :aria-busy="feed.loading.value">
      <JournalTimeline :entries="feed.entries.value" subject-label="记录" :editable="canEdit" :disabled="deletion.deleting.value" shareable exportable @share="shareTarget = { entry: $event }" @share-day="shareTarget = { date: $event }" @export-image="exportCardImage" @edit="openNote" @delete="deletion.request" @preview="preview = $event">
        <template #source="{ entry }">
          <div class="flex min-w-0 items-start gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold" :class="entry.subjectType === 'goal' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300' : entry.subjectType === 'habit' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'"><component :is="entry.subjectType === 'goal' ? Target : entry.subjectType === 'habit' ? Flame : NotebookPen" class="h-3 w-3" />{{ journalSubjectLabel(entry.subjectType) }}</span>
            <h3 class="min-w-0 pt-0.5 text-sm leading-6 font-semibold break-words text-slate-800 dark:text-slate-200">{{ subjectTitle(entry) }}</h3>
          </div>
        </template>
      </JournalTimeline>
    </div>
    <div v-else-if="!feed.error.value" class="rounded-3xl border border-dashed border-slate-200 px-5 py-16 text-center dark:border-slate-700">
      <Clock3 class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <h2 class="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">没有符合条件的记录</h2>
      <p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">试试调整筛选条件，或写一条随记，留下今天的想法与瞬间。</p>
      <button id="records-empty-new-note" type="button" aria-haspopup="dialog" aria-controls="note-journal-dialog" class="mt-5 min-h-10 rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" @click="openNote()">记下今天</button>
    </div>
    <button v-if="feed.cursor.value" id="records-load-more" type="button" :disabled="feed.loading.value" class="mx-auto flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:border-slate-700 dark:bg-[#121824] dark:text-slate-300 dark:hover:bg-slate-800" @click="feed.load(true)"><LoaderCircle v-if="feed.loading.value" class="h-3.5 w-3.5 animate-spin" />{{ feed.loading.value ? '正在载入…' : '查看更早的记录' }}</button>
    <JournalImageViewer v-if="preview" :image="preview" @close="preview = null" />
    <JournalShareDrawer v-if="shareTarget" :target="shareTarget" @close="shareTarget = null" />
    <JournalDeleteDialog v-if="deletion.pending.value" :entry="deletion.pending.value" :deleting="deletion.deleting.value" :error="deletion.error.value" @cancel="deletion.cancel" @confirm="deletion.confirm" />
    <JournalDialog v-if="noteDialog" :key="noteDialog.initialEntry?.id ?? 'new-note'" :is-open="true" :subject="null" subject-type="note" :date="noteDialog.date" :initial-entry="noteDialog.initialEntry" @saved="noteSaved" @deleted="noteDeleted" @close="noteDialog = null" />
  </section>
</template>
