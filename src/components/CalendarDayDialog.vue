<script setup lang="ts">
import { computed } from 'vue'
import { X, ChevronLeft, ChevronRight, CalendarDays, Check, Flame, ListTodo, Plus } from '@lucide/vue'
import type { Goal, Todo } from '../types'
import { useKeepDoStore } from '../stores/keepdo'
import { useJournalStore } from '../stores/journal'
import { useNativeDialog } from '../composables/useNativeDialog'
import { addDays, formatDisplayDate } from '../utils/date'
import { getDailyActionSummary, getGoalsForDate, getHabitsForDate } from '../../shared/calendar'
import CalendarGoals from './CalendarGoals.vue'

const props = defineProps<{ isOpen: boolean; date: string }>()
const emit = defineEmits<{
  close: []
  'update-date': [date: string]
  'edit-goal': [goal: Goal]
  'edit-habit': [id: string]
  'edit-todo': [todo: Todo]
  'new-todo': []
  'show-goals': []
  'open-journal': [goalId: string, date: string]
}>()
const store = useKeepDoStore()
const journalIndex = useJournalStore()
const { handleClose, handleBackdrop } = useNativeDialog('calendarDayDialog', () => props.isOpen, () => emit('close'))
const goals = computed(() => getGoalsForDate(store.goals, props.date, journalIndex.dates))
const habits = computed(() => getHabitsForDate(store.habits, props.date))
const todos = computed(() => store.todos.filter(todo => todo.date === props.date))
const summary = computed(() => getDailyActionSummary(store.todos, store.habits, props.date))
const priorities = { high: '高优先', medium: '中优先', low: '低优先' }
function selectDate(event: Event) {
  const input = event.target as HTMLInputElement
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) emit('update-date', input.value)
  else input.value = props.date
}
</script>

<template>
  <dialog ref="calendarDayDialog" id="calendar-day-dialog" aria-labelledby="calendar-day-heading" class="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-[#f8f9fa] p-0 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0B0F17] dark:text-white" @close="handleClose" @click="handleBackdrop">
    <div class="flex max-h-[90dvh] flex-col">
      <header class="shrink-0 border-b border-slate-200/70 bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400"><CalendarDays class="h-4 w-4" />日程详情</p>
            <h2 id="calendar-day-heading" class="mt-1.5 text-lg font-bold">{{ formatDisplayDate(date) }}</h2>
            <p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ goals.length }} 个目标 · {{ habits.length }} 个习惯 · {{ todos.length }} 项待办<span v-if="summary.total"> · 行动已完成 {{ summary.completed }}/{{ summary.total }}</span></p>
          </div>
          <button id="calendar-day-close" type="button" aria-label="关闭日程详情" class="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800" @click="emit('close')"><X class="h-5 w-5" /></button>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button id="calendar-day-prev" type="button" aria-label="详情前一天" class="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800" @click="emit('update-date', addDays(date, -1))"><ChevronLeft class="h-4 w-4" /></button>
          <label for="calendar-day-picker" class="sr-only">选择详情日期</label>
          <input id="calendar-day-picker" type="date" min="0001-01-01" max="9999-12-31" :value="date" class="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" @change="selectDate" />
          <button id="calendar-day-next" type="button" aria-label="详情后一天" class="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800" @click="emit('update-date', addDays(date, 1))"><ChevronRight class="h-4 w-4" /></button>
        </div>
      </header>
      <div class="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <p v-if="store.syncError" role="alert" class="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{{ store.syncError }}。未保存时请保留页面，并在设置中导出备份。</p>
        <CalendarGoals v-if="goals.length" :goals="goals" :date="date" detailed id-prefix="calendar-detail" @edit-goal="emit('edit-goal', $event)" @show-goals="emit('show-goals')" @check-in-goal="store.toggleGoalDay" @open-journal="(goalId, date) => emit('open-journal', goalId, date)" />
        <p v-else class="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">这一天没有关联的长期目标。</p>
        <section aria-labelledby="calendar-day-habits-heading" class="space-y-3">
          <h3 id="calendar-day-habits-heading" class="flex items-center gap-2 text-sm font-bold"><Flame class="h-4 w-4 text-amber-500" />当日习惯 <span class="font-normal text-slate-400">{{ habits.length }} 个</span></h3>
          <article v-for="habit in habits" :key="habit.id" class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#121824]">
            <div class="flex items-start gap-3">
              <button :id="`calendar-day-habit-toggle-${habit.id}`" type="button" :aria-label="`${(habit.records[date] || 0) >= habit.targetPerDay ? '取消打卡' : '打卡'}：${habit.title}`" :aria-pressed="(habit.records[date] || 0) >= habit.targetPerDay" class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-indigo-500" :class="(habit.records[date] || 0) >= habit.targetPerDay ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-400 dark:border-slate-600'" @click="store.toggleHabitDay(habit.id, date)"><Check class="h-4 w-4" /></button>
              <div class="min-w-0 flex-1">
                <h4 class="break-words text-sm font-semibold">{{ habit.title }}</h4>
                <p class="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ (habit.records[date] || 0) >= habit.targetPerDay ? '已打卡' : '待打卡' }} · {{ habit.records[date] || 0 }} / {{ habit.targetPerDay }} {{ habit.unit }}</p>
                <p v-if="store.getGoalById(habit.goalId)" class="mt-1 break-words text-xs leading-6 text-indigo-600 dark:text-indigo-300">关联目标：{{ store.getGoalById(habit.goalId)?.title }}</p>
                <p class="mt-1 text-[11px] text-slate-400">创建于 {{ habit.createdAt }}</p>
              </div>
              <button :id="`calendar-day-edit-habit-${habit.id}`" type="button" :aria-label="`编辑习惯：${habit.title}`" class="shrink-0 rounded px-1 py-0.5 text-xs font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="emit('edit-habit', habit.id)">编辑</button>
            </div>
          </article>
          <p v-if="!habits.length" class="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">这一天没有习惯安排。</p>
        </section>
        <section aria-labelledby="calendar-day-todos-heading" class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 id="calendar-day-todos-heading" class="flex items-center gap-2 text-sm font-bold"><ListTodo class="h-4 w-4 text-indigo-500" />具体待办 <span class="font-normal text-slate-400">{{ todos.length }} 项</span></h3>
            <button id="calendar-day-add-todo" type="button" class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950/50" @click="emit('new-todo')"><Plus class="h-3.5 w-3.5" />添加待办</button>
          </div>
          <article v-for="todo in todos" :key="todo.id" class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#121824]">
            <div class="flex items-start gap-3">
              <button :id="`calendar-day-todo-toggle-${todo.id}`" type="button" :aria-label="`${todo.completed ? '取消完成待办' : '完成待办'}：${todo.title}`" :aria-pressed="todo.completed" class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-indigo-500" :class="todo.completed ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 text-slate-400 dark:border-slate-600'" @click="store.toggleTodo(todo.id)"><Check v-if="todo.completed" class="h-4 w-4" /></button>
              <div class="min-w-0 flex-1">
                <h4 class="whitespace-pre-wrap break-words text-sm font-semibold">{{ todo.title }}</h4>
                <p class="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ todo.completed ? '已完成' : '未完成' }} · {{ priorities[todo.priority] }} · {{ todo.date }}</p>
                <p v-if="store.getGoalById(todo.goalId)" class="mt-1 break-words text-xs leading-6 text-indigo-600 dark:text-indigo-300">关联目标：{{ store.getGoalById(todo.goalId)?.title }}</p>
                <p class="mt-1 text-[11px] text-slate-400">创建于 {{ todo.createdAt }}</p>
              </div>
              <button :id="`calendar-day-edit-todo-${todo.id}`" type="button" :aria-label="`编辑待办：${todo.title}`" class="shrink-0 rounded px-1 py-0.5 text-xs font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="emit('edit-todo', todo)">详情 / 编辑</button>
            </div>
          </article>
          <p v-if="!todos.length" class="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">这一天暂无具体待办，可以直接添加。</p>
        </section>
      </div>
      <footer class="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/70 bg-white px-5 py-3 text-xs dark:border-slate-800 dark:bg-[#121824]">
        <span class="text-slate-400" role="status">{{ store.syncState === 'saving' ? '正在保存更改…' : store.hasUnsavedChanges ? '有修改尚未保存' : '更改已保存到账号' }}</span>
        <button id="calendar-day-done" type="button" class="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" @click="emit('close')">完成</button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
dialog::backdrop { background: rgb(0 0 0 / 60%); backdrop-filter: blur(6px); }
</style>
