<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { BookOpen, Check, LoaderCircle, RefreshCw, X } from '@lucide/vue'
import type { Goal } from '../../types'
import type { GoalJournalEntry, JournalImage } from '../../../shared/journal'
import type { JournalDraft } from '../../composables/useGoalJournal'
import { useNativeDialog } from '../../composables/useNativeDialog'
import { useGoalJournal } from '../../composables/useGoalJournal'
import { useKeepDoStore } from '../../stores/keepdo'
import { useJournalStore } from '../../stores/journal'
import GoalCheckInButton from '../GoalCheckInButton.vue'
import GoalJournalEditor from './GoalJournalEditor.vue'
import GoalJournalTimeline from './GoalJournalTimeline.vue'
import JournalImageViewer from './JournalImageViewer.vue'

const props = defineProps<{ isOpen: boolean; goal: Goal | null; date: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useKeepDoStore()
const index = useJournalStore()
const journal = useGoalJournal(() => props.goal?.id || '', () => props.isOpen)
const editing = ref<GoalJournalEntry | null>(null)
const editorKey = ref(0)
const dirty = ref(false)
const saving = ref(false)
const saveError = ref('')
const savedMessage = ref('')
const preview = ref<JournalImage | null>(null)
const selectedCount = computed(() => journal.entries.value.filter(entry => entry.date === props.date).length)
const { handleClose, handleBackdrop } = useNativeDialog('goalJournalDialog', () => props.isOpen, requestClose)
function canDiscard() { return !dirty.value || window.confirm('有尚未保存的图文记录，确定放弃草稿吗？') }
function requestClose() { if (!saving.value && canDiscard()) emit('close') }
function resetEditor() { editing.value = null; editorKey.value++; dirty.value = false; saveError.value = '' }
function cancelEdit() { if (canDiscard()) resetEditor() }
function editEntry(entry: GoalJournalEntry) {
  if (saving.value || !canDiscard()) return
  editing.value = entry
  editorKey.value++
  saveError.value = ''
  document.getElementById('journal-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
async function save(draft: JournalDraft) {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  savedMessage.value = ''
  try {
    // 新目标可能仍在基础数据保存队列中，先确认服务端已收到目标。
    await store.flushSync()
    const entry = await journal.save(draft)
    index.markDate(entry.goalId, entry.date)
    resetEditor()
    savedMessage.value = '记录已保存到账号'
  } catch (cause) { saveError.value = cause instanceof Error ? cause.message : '保存失败，请重试，草稿仍然保留' }
  finally { saving.value = false }
}
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) { event.preventDefault(); event.returnValue = '' }
}
watch(() => props.isOpen, open => {
  if (open) { resetEditor(); savedMessage.value = ''; window.addEventListener('beforeunload', warnBeforeUnload) }
  else { preview.value = null; window.removeEventListener('beforeunload', warnBeforeUnload) }
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
</script>

<template>
  <dialog id="goal-journal-dialog" ref="goalJournalDialog" aria-labelledby="goal-journal-heading" class="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-[#f8f9fc] p-0 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#101722] dark:text-slate-100" @close="handleClose" @cancel.prevent="requestClose" @click="handleBackdrop">
    <div v-if="goal && isOpen" class="flex max-h-[90dvh] flex-col">
      <header class="shrink-0 border-b border-slate-200/70 bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#141b28]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-indigo-500 dark:text-indigo-400"><BookOpen class="h-3.5 w-3.5" />目标日记</p>
            <h2 id="goal-journal-heading" class="mt-2 text-lg leading-7 font-bold [overflow-wrap:anywhere]">{{ goal.title }}</h2>
            <p v-if="goal.description" class="mt-1.5 line-clamp-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ goal.description }}</p>
          </div>
          <button id="goal-journal-close" type="button" aria-label="关闭目标日记" :disabled="saving" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="requestClose"><X class="h-4 w-4" /></button>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ date }} <span class="ml-1 text-[10px] text-slate-400">{{ selectedCount ? `已载入 ${selectedCount} 条当日记录` : '记录当天的行动与感受' }}</span></span>
          <GoalCheckInButton :id="`journal-goal-checkin-${goal.id}-${date}`" :date="date" :title="goal.title" :checked="goal.checkIns?.[date] === true" @toggle="store.toggleGoalDay(goal.id, date)" />
        </div>
      </header>
      <div id="goal-journal-scroll" class="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <GoalJournalEditor :key="`${goal.id}-${date}-${editorKey}`" :date="date" :entry="editing" :saving="saving" :error="saveError" @save="save" @cancel="cancelEdit" @dirty="dirty = $event" />
        <section aria-labelledby="journal-timeline-heading" class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div><h3 id="journal-timeline-heading" class="text-sm font-semibold">成长时间线</h3><p class="mt-1 text-[10px] text-slate-400">每一段记录，都是向目标靠近的痕迹</p></div>
            <button id="journal-refresh" type="button" :disabled="journal.loading.value || saving" aria-label="刷新目标时间线" class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="journal.load()"><RefreshCw class="h-3.5 w-3.5" :class="journal.loading.value ? 'animate-spin' : ''" /></button>
          </div>
          <p v-if="journal.error.value" role="alert" class="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{{ journal.error.value }}<button id="journal-load-retry" type="button" class="ml-2 underline" :disabled="journal.loading.value" @click="journal.load()">重试</button></p>
          <p v-if="journal.loading.value && !journal.entries.value.length" role="status" class="flex items-center justify-center gap-2 py-7 text-xs text-slate-400"><LoaderCircle class="h-4 w-4 animate-spin" />正在载入时间线…</p>
          <GoalJournalTimeline v-else :entries="journal.entries.value" :check-ins="goal.checkIns" :selected-date="date" @edit="editEntry" @preview="preview = $event" />
          <button v-if="journal.cursor.value" id="journal-load-more" type="button" :disabled="journal.loading.value" class="mx-auto flex min-h-8 items-center rounded-lg px-3 text-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:hover:bg-slate-800" @click="journal.load(true)">{{ journal.loading.value ? '正在载入…' : '查看更早的记录' }}</button>
        </section>
      </div>
      <footer class="flex shrink-0 items-center gap-1.5 border-t border-slate-200/70 px-5 py-3 text-[10px] text-slate-400 dark:border-slate-800" role="status"><Check v-if="savedMessage" class="h-3 w-3 text-emerald-500" />{{ saving ? '正在保存，请稍候…' : savedMessage || '图文随账号保存 · 仅自己可见' }}</footer>
    </div>
  </dialog>
  <JournalImageViewer :image="preview" @close="preview = null" />
</template>
<style scoped>
dialog::backdrop { background: rgb(8 15 28 / 55%); backdrop-filter: blur(6px); }
</style>
