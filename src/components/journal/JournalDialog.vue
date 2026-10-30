<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { BookOpen, Check, LoaderCircle, RefreshCw, X, Plus } from '@lucide/vue'
import type { Goal, Habit } from '../../types'
import type { JournalEntry, JournalImage, JournalSubjectType } from '../../../shared/journal'
import type { JournalDraft } from '../../composables/useJournal'
import { useNativeDialog } from '../../composables/useNativeDialog'
import { useJournal } from '../../composables/useJournal'
import { useJournalDeletion } from '../../composables/useJournalDeletion'
import { useKeepDoStore } from '../../stores/keepdo'
import { useJournalStore } from '../../stores/journal'
import GoalCheckInButton from '../GoalCheckInButton.vue'
import JournalEditor from './JournalEditor.vue'
import JournalTimeline from './JournalTimeline.vue'
import JournalImageViewer from './JournalImageViewer.vue'
import JournalDiscardDialog from './JournalDiscardDialog.vue'
import JournalDeleteDialog from './JournalDeleteDialog.vue'

const props = defineProps<{ isOpen: boolean; subject: Goal | Habit | null; subjectType: JournalSubjectType; date: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useKeepDoStore()
const index = useJournalStore()
const journal = useJournal(() => props.subject?.id || '', () => props.subjectType, () => props.isOpen)
const subjectLabel = computed(() => props.subjectType === 'goal' ? '目标' : '习惯')
const checkIns = computed(() => {
  if (!props.subject) return {}
  if (props.subjectType === 'goal') return (props.subject as Goal).checkIns || {}
  const habit = props.subject as Habit
  return Object.fromEntries(Object.entries(habit.records).map(([date, count]) => [date, count >= habit.targetPerDay]))
})
function toggleCheckIn() {
  if (!props.subject) return
  if (props.subjectType === 'goal') store.toggleGoalDay(props.subject.id, props.date)
  else store.toggleHabitDay(props.subject.id, props.date)
}
const editing = ref<JournalEntry | null>(null)
const editorKey = ref(0)
const dirty = ref(false)
const saving = ref(false)
const saveError = ref('')
const savedMessage = ref('')
const preview = ref<JournalImage | null>(null)
const editorOpen = ref(true)
const pendingDiscard = ref<'close' | 'cancel' | JournalEntry | null>(null)
const deletion = useJournalDeletion(entry => {
  journal.removeEntry(entry.id)
  if (editing.value?.id === entry.id) { resetEditor(); editorOpen.value = false }
  if (entry.images.some(image => image.id === preview.value?.id)) preview.value = null
  savedMessage.value = '记录已删除'
  void nextTick(() => document.getElementById('journal-refresh')?.focus())
})
const busy = computed(() => saving.value || deletion.deleting.value)
const selectedCount = computed(() => journal.entries.value.filter(entry => entry.date === props.date).length)
const { handleClose, handleBackdrop } = useNativeDialog('journalDialog', () => props.isOpen, requestClose)
function requestClose() {
  if (busy.value) return
  if (dirty.value) pendingDiscard.value = 'close'
  else emit('close')
}
function resetEditor() { editing.value = null; editorKey.value++; dirty.value = false; saveError.value = '' }
function cancelEdit() { if (dirty.value) pendingDiscard.value = 'cancel'; else resetEditor() }
function editEntry(entry: JournalEntry) {
  if (busy.value) return
  if (dirty.value) { pendingDiscard.value = entry; return }
  editing.value = entry
  editorOpen.value = true
  editorKey.value++
  saveError.value = ''
  void nextTick(() => document.getElementById('journal-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}
function discard() {
  const action = pendingDiscard.value
  pendingDiscard.value = null
  dirty.value = false
  if (action === 'close') emit('close')
  else if (action === 'cancel') resetEditor()
  else if (action) editEntry(action)
}
async function save(draft: JournalDraft) {
  if (busy.value) return
  saving.value = true
  saveError.value = ''
  savedMessage.value = ''
  try {
    // 新目标或习惯可能仍在保存队列中，先确认服务端已收到基础数据。
    await store.flushSync()
    const entry = await journal.save(draft)
    index.markDate(entry.subjectId, entry.date, entry.subjectType)
    resetEditor()
    editorOpen.value = false
    savedMessage.value = '记录已保存到账号'
  } catch (cause) { saveError.value = cause instanceof Error ? cause.message : '保存失败，请重试，草稿仍然保留' }
  finally { saving.value = false }
}
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' }
}
watch([() => props.isOpen, () => props.subject?.id, () => props.subjectType], ([open]) => {
  deletion.cancel()
  if (open) { resetEditor(); editorOpen.value = true; savedMessage.value = ''; window.addEventListener('beforeunload', warnBeforeUnload) }
  else { preview.value = null; window.removeEventListener('beforeunload', warnBeforeUnload) }
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <dialog :id="`${subjectType}-journal-dialog`" ref="journalDialog" :aria-labelledby="`${subjectType}-journal-heading`" class="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-[#f8f9fc] p-0 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#101722] dark:text-slate-100" @close="handleClose" @cancel.prevent="requestClose" @click="handleBackdrop">
    <div v-if="subject && isOpen" class="flex max-h-[90dvh] flex-col">
      <header class="shrink-0 border-b border-slate-200/70 bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#141b28]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-indigo-500 dark:text-indigo-400"><BookOpen class="h-3.5 w-3.5" />{{ subjectLabel }}日记</p>
            <h2 :id="`${subjectType}-journal-heading`" class="mt-2 text-lg leading-7 font-bold [overflow-wrap:anywhere]">{{ subject.title }}</h2>
            <p v-if="subject.description" class="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-500 dark:text-slate-400">{{ subject.description }}</p>
          </div>
          <button :id="`${subjectType}-journal-close`" type="button" :aria-label="`关闭${subjectLabel}日记`" :disabled="busy" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="requestClose"><X class="h-4 w-4" /></button>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ date }} <span class="ml-1 text-[10px] text-slate-400">{{ selectedCount ? `已载入 ${selectedCount} 条当日记录` : '记录当天的行动与感受' }}</span></span>
          <GoalCheckInButton :id="`journal-${subjectType}-checkin-${subject.id}-${date}`" :date="date" :title="subject.title" :subject-label="subjectLabel" :checked="checkIns[date] === true" @toggle="toggleCheckIn" />
        </div>
      </header>
      <div :id="`${subjectType}-journal-scroll`" class="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <JournalEditor v-if="editorOpen" :key="`${subjectType}-${subject.id}-${date}-${editorKey}`" :date="date" :entry="editing" :saving="busy" :error="saveError" @save="save" @cancel="cancelEdit" @delete="deletion.request" @dirty="dirty = $event" />
        <button v-else id="journal-compose" type="button" class="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20" @click="editorOpen = true"><Plus class="h-3.5 w-3.5" />再记一笔</button>
        <section aria-labelledby="journal-timeline-heading" class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div><h3 id="journal-timeline-heading" class="text-sm font-semibold">成长时间线</h3><p class="mt-1 text-[10px] text-slate-400">{{ subjectType === 'goal' ? '每一段记录，都是向目标靠近的痕迹' : '每一段记录，都是持续坚持的痕迹' }}</p></div>
            <button id="journal-refresh" type="button" :disabled="journal.loading.value || busy" :aria-label="`刷新${subjectLabel}时间线`" class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="journal.load()"><RefreshCw class="h-3.5 w-3.5" :class="journal.loading.value ? 'animate-spin' : ''" /></button>
          </div>
          <p v-if="journal.error.value" role="alert" class="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{{ journal.error.value }}<button id="journal-load-retry" type="button" class="ml-2 underline" :disabled="journal.loading.value" @click="journal.load()">重试</button></p>
          <p v-if="journal.loading.value && !journal.entries.value.length" role="status" class="flex items-center justify-center gap-2 py-7 text-xs text-slate-400"><LoaderCircle class="h-4 w-4 animate-spin" />正在载入时间线…</p>
          <JournalTimeline v-else :entries="journal.entries.value" :check-ins="checkIns" :selected-date="date" :subject-label="subjectLabel" :disabled="busy" @edit="editEntry" @delete="deletion.request" @preview="preview = $event" />
          <button v-if="journal.cursor.value" id="journal-load-more" type="button" :disabled="journal.loading.value" class="mx-auto flex min-h-8 items-center rounded-lg px-3 text-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="journal.load(true)">{{ journal.loading.value ? '正在载入…' : '查看更早的记录' }}</button>
        </section>
      </div>
      <footer class="flex shrink-0 items-center gap-1.5 border-t border-slate-200/70 px-5 py-3 text-[10px] text-slate-400 dark:border-slate-800" role="status"><Check v-if="savedMessage" class="h-3 w-3 text-emerald-500" />{{ saving ? '正在保存，请稍候…' : savedMessage || '图文随账号保存 · 仅自己可见' }}</footer>
    </div>
  </dialog>
  <JournalImageViewer :image="preview" @close="preview = null" />
  <JournalDiscardDialog :open="Boolean(pendingDiscard)" @keep="pendingDiscard = null" @discard="discard" />
  <JournalDeleteDialog v-if="deletion.pending.value" :entry="deletion.pending.value" :deleting="deletion.deleting.value" :error="deletion.error.value" @cancel="deletion.cancel" @confirm="deletion.confirm" />
</template>
<style scoped>
dialog::backdrop { background: rgb(8 15 28 / 55%); backdrop-filter: blur(6px); }
</style>
