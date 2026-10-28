<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Flame, ListTodo, Plus, Target } from '@lucide/vue'
import type { Goal, Habit, Todo } from '../types'
import type { CalendarView } from '../../shared/calendar'
import type { JournalDates } from '../../shared/journal'
import { getCalendarDates, getCalendarPlans, getDailyActionSummary } from '../../shared/calendar'
import { addDays, getTodayString } from '../utils/date'
import CalendarPlanItem from './CalendarPlanItem.vue'

const props = withDefaults(defineProps<{ date: string; goals: Goal[]; habits: Habit[]; todos: Todo[]; journalDates?: JournalDates; habitJournalDates?: JournalDates }>(), { journalDates: () => ({}), habitJournalDates: () => ({}) })
const emit = defineEmits<{
  'select-date': [date: string]
  'inspect-date': [date: string]
  'new-todo': [date: string]
  'check-in-goal': [goalId: string, date: string]
  'inspect-goal': [goalId: string, date: string]
  'inspect-habit': [habitId: string, date: string]
}>()
const view = shallowRef<CalendarView>('week')
const today = getTodayString()
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const days = computed(() => getCalendarDates(props.date, view.value).map((date, index) => ({
  date,
  day: Number(date.slice(-2)),
  weekday: weekdays[index % 7],
  inMonth: date.slice(0, 7) === props.date.slice(0, 7),
  plans: getCalendarPlans(props.goals, props.habits, props.todos, date, props.journalDates, props.habitJournalDates),
  summary: getDailyActionSummary(props.todos, props.habits, date),
})))
const heading = computed(() => `${Number(props.date.slice(0, 4))} 年 ${Number(props.date.slice(5, 7))} 月`)
const rangeLabel = computed(() => {
  const first = days.value[0]!.date
  const last = days.value[days.value.length - 1]!.date
  return view.value === 'month' ? '整月计划，一览有序' : `${Number(first.slice(5, 7))} 月 ${Number(first.slice(-2))} 日 — ${Number(last.slice(5, 7))} 月 ${Number(last.slice(-2))} 日`
})
function navigate(direction: number) {
  if (view.value === 'week') emit('select-date', addDays(props.date, direction * 7))
  else {
    const date = new Date(`${props.date.slice(0, 7)}-01T12:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + direction)
    emit('select-date', date.toISOString().slice(0, 10))
  }
}
function pickDate(event: Event) {
  const input = event.target as HTMLInputElement
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) emit('select-date', input.value)
  else input.value = props.date
}
function inspectPlan(kind: 'goal' | 'habit' | 'todo', id: string, date: string) {
  if (kind === 'goal') emit('inspect-goal', id, date)
  else if (kind === 'habit') emit('inspect-habit', id, date)
  else emit('inspect-date', date)
}
</script>

<template>
  <section aria-labelledby="calendar-planner-heading" class="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.15)] dark:border-slate-800 dark:bg-[#121824]">
    <header class="space-y-5 p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400"><CalendarDays class="h-3.5 w-3.5" />计划日历</p>
          <h1 id="calendar-planner-heading" class="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{{ heading }}</h1>
          <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{{ rangeLabel }}</p>
        </div>
        <button id="calendar-add-plan" type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" @click="emit('new-todo', date)"><Plus class="h-4 w-4" />添加计划</button>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
            <button id="calendar-prev-period" type="button" :aria-label="view === 'week' ? '上一周' : '上个月'" class="calendar-control" @click="navigate(-1)"><ChevronLeft class="h-4 w-4" /></button>
            <button id="calendar-goto-today" type="button" class="calendar-control px-2.5 text-xs font-semibold" @click="emit('select-date', getTodayString())">今天</button>
            <button id="calendar-next-period" type="button" :aria-label="view === 'week' ? '下一周' : '下个月'" class="calendar-control" @click="navigate(1)"><ChevronRight class="h-4 w-4" /></button>
          </div>
          <label for="calendar-date-picker" class="sr-only">跳转到指定日期</label>
          <input id="calendar-date-picker" type="date" min="0001-01-01" max="9999-12-31" :value="date" class="min-h-10 min-w-0 rounded-xl border border-slate-200 bg-transparent px-2 text-xs text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-300" @change="pickDate" />
        </div>
        <div class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="日历视图">
          <button id="calendar-view-week" type="button" :aria-pressed="view === 'week'" class="calendar-view-button" :class="{ 'calendar-view-active': view === 'week' }" @click="view = 'week'">周视图</button>
          <button id="calendar-view-month" type="button" :aria-pressed="view === 'month'" class="calendar-view-button" :class="{ 'calendar-view-active': view === 'month' }" @click="view = 'month'">月视图</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div class="flex items-center gap-4" aria-label="计划类型图例">
          <span class="flex items-center gap-1.5"><Target class="h-3.5 w-3.5 text-indigo-500" />长期目标</span>
          <span class="flex items-center gap-1.5"><Flame class="h-3.5 w-3.5 text-amber-500" />日常习惯</span>
          <span class="flex items-center gap-1.5"><ListTodo class="h-3.5 w-3.5 text-slate-500" />待办行动</span>
        </div>
        <span>目标可直接打卡 · 点击标题查看详情</span>
      </div>
    </header>

    <div id="calendar-planner-grid" :class="view === 'month' ? 'overflow-x-auto overscroll-x-contain [contain:paint]' : ''" :tabindex="view === 'month' ? 0 : undefined" :role="view === 'month' ? 'region' : undefined" :aria-label="view === 'month' ? '月计划日历，可横向滚动' : undefined">
      <div class="grid" :class="view === 'month' ? 'min-w-[840px] grid-cols-7' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7'">
        <article
          v-for="day in days"
          :key="day.date"
          :aria-label="`${day.date}，${day.plans.length} 项计划`"
          class="min-w-0 border-t border-r border-slate-200/80 p-2.5 dark:border-slate-800"
          :class="[day.date === date ? 'bg-indigo-50/45 dark:bg-indigo-950/15' : 'bg-slate-50/40 dark:bg-slate-900/20', view === 'month' && !day.inMonth ? 'bg-slate-100/70 dark:bg-slate-950/40' : '', view === 'week' ? 'lg:min-h-72' : 'min-h-44']"
        >
          <button
            :id="`calendar-date-${day.date}`"
            type="button"
            :aria-label="`查看 ${day.date} 详情，${day.plans.length} 项计划`"
            :aria-pressed="day.date === date"
            :aria-current="day.date === today ? 'date' : undefined"
            aria-haspopup="dialog"
            aria-controls="calendar-day-dialog"
            class="mb-2 flex min-h-11 w-full items-center justify-between gap-1 rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:outline-indigo-500"
            @click="emit('inspect-date', day.date)"
          >
            <span>
              <span class="block text-[10px] font-medium text-slate-500 dark:text-slate-400">周{{ day.weekday }}</span>
              <span class="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full font-display text-lg font-semibold" :class="day.date === today ? 'bg-indigo-600 text-white' : day.date === date ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'">{{ day.day }}</span>
            </span>
            <span v-if="day.date === today" class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">今天</span>
            <span v-else-if="day.date === date" class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">已选</span>
          </button>
          <p v-if="day.summary.total" class="mb-3 px-1 text-[10px] text-slate-500 dark:text-slate-400">行动 {{ day.summary.completed }}/{{ day.summary.total }} 已完成</p>
          <div v-if="day.plans.length" class="space-y-2">
            <CalendarPlanItem v-for="plan in day.plans" :key="plan.id" :plan="plan" :date="day.date" @inspect="inspectPlan(plan.kind, plan.sourceId, day.date)" @check-in="emit('check-in-goal', plan.sourceId, day.date)" />
          </div>
          <div v-else class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/80 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <span>留一点自由时间</span>
            <button :id="`calendar-empty-add-${day.date}`" type="button" :aria-label="`为 ${day.date} 添加计划`" class="flex min-h-9 items-center gap-1 rounded-lg px-2 text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950/50" @click="emit('new-todo', day.date)"><Plus class="h-3 w-3" />添加计划</button>
          </div>
        </article>
      </div>
    </div>
    <footer class="border-t border-slate-200/80 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">目标打卡按日期保存，点击已打卡可撤销；天数型累计 1 天，其他类型标记当日行动。行动完成数统计习惯和待办。<span v-if="view === 'month'" class="lg:hidden">左右滑动查看整周。</span></footer>
  </section>
</template>

<style scoped>
@reference "../style.css";
.calendar-control {
  @apply flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:hover:bg-slate-700;
}
.calendar-view-button {
  @apply min-h-8 rounded-lg px-3 text-xs font-semibold text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400;
}
.calendar-view-active {
  @apply bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white;
}
</style>
