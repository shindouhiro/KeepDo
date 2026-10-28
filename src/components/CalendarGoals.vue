<script setup lang="ts">
import { computed } from 'vue'
import { Target, CalendarClock, ArrowUpRight } from '@lucide/vue'
import type { Goal } from '../types'
import { getGoalDateStatus, getGoalProgressPercent } from '../../shared/calendar'
import GoalCheckInButton from './GoalCheckInButton.vue'

const props = withDefaults(defineProps<{ goals: Goal[]; date: string; detailed?: boolean; idPrefix?: string }>(), {
  detailed: false,
  idPrefix: 'calendar',
})
const emit = defineEmits<{ 'edit-goal': [goal: Goal]; 'show-goals': []; 'check-in-goal': [goalId: string, date: string] }>()
const entries = computed(() => props.goals.map(goal => ({
  goal,
  percent: getGoalProgressPercent(goal),
  status: getGoalDateStatus(goal, props.date),
  current: goal.type === 'milestones' ? goal.milestones.filter(item => item.completed).length : goal.currentValue,
  total: goal.type === 'milestones' ? goal.milestones.length : goal.targetValue,
  unit: goal.type === 'milestones' ? '项里程碑' : goal.unit,
})))
const labels = { active: '进行中', due: '当日截止', overdue: '已逾期', completed: '已达成' }
const statusClasses = {
  active: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
  due: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  overdue: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
}
</script>

<template>
  <section v-if="entries.length" :id="`${idPrefix}-goals`" :aria-labelledby="`${idPrefix}-goals-heading`" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"><Target class="h-3.5 w-3.5" /></span>
        <h2 :id="`${idPrefix}-goals-heading`" class="text-base font-bold text-slate-900 dark:text-white">当日关注的长期目标</h2>
        <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{{ entries.length }} 项</span>
      </div>
      <button :id="`${idPrefix}-show-all-goals`" type="button" class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950/50" @click="emit('show-goals')">全部目标<ArrowUpRight class="h-3.5 w-3.5" /></button>
    </div>
    <div class="grid gap-3" :class="detailed ? 'grid-cols-1' : 'sm:grid-cols-2'">
      <article v-for="entry in entries" :key="entry.goal.id" :id="`${idPrefix}-goal-${entry.goal.id}`" class="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-start justify-between gap-3">
          <h3 class="min-w-0 break-words text-sm leading-6 font-bold text-slate-900 dark:text-white">{{ entry.goal.title }}</h3>
          <span class="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold" :class="statusClasses[entry.status]">{{ labels[entry.status] }}</span>
        </div>
        <p v-if="detailed && entry.goal.description" class="mt-3 text-xs leading-6 whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{{ entry.goal.description }}</p>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{{ entry.current }} / {{ entry.total }} {{ entry.unit }}</span>
          <span class="font-bold text-indigo-600 dark:text-indigo-300">{{ entry.percent }}%</span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" :aria-label="`${entry.goal.title}当前累计进度`" :aria-valuenow="entry.percent" :aria-valuemin="0" :aria-valuemax="100"><div class="h-full rounded-full bg-indigo-500 transition-all duration-300" :style="{width: `${entry.percent}%`}"></div></div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ date }} · {{ entry.goal.type === 'days' ? '当天与关联习惯合计 1 天' : '记录当天已为目标行动' }}</span>
          <GoalCheckInButton :id="`${idPrefix}-goal-checkin-${date}-${entry.goal.id}`" :date="date" :title="entry.goal.title" :checked="entry.goal.checkIns?.[date] === true" @toggle="emit('check-in-goal', entry.goal.id, date)" />
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span class="flex items-center gap-1 text-slate-500 dark:text-slate-400"><CalendarClock class="h-3.5 w-3.5" />{{ entry.goal.deadline ? `截止 ${entry.goal.deadline}` : '未设截止日' }}</span>
          <button :id="`${idPrefix}-edit-goal-${entry.goal.id}`" type="button" :aria-label="`编辑目标：${entry.goal.title}`" class="rounded px-1 py-0.5 font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="emit('edit-goal', entry.goal)">编辑目标</button>
        </div>
        <div v-if="detailed" class="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>{{ entry.goal.category }} · 创建于 {{ entry.goal.createdAt }}</p>
          <ul v-if="entry.goal.milestones.length" class="mt-2 space-y-1">
            <li v-for="milestone in entry.goal.milestones" :key="milestone.id" class="break-words">{{ milestone.completed ? '✓ 已达成' : '○ 未达成' }} · {{ milestone.title }}</li>
          </ul>
        </div>
      </article>
    </div>
    <p class="px-1 text-[11px] leading-5 text-slate-400">目标进度为当前累计值；当日行动完成率单独统计习惯和待办。</p>
  </section>
</template>
