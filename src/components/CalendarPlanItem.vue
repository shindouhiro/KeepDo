<script setup lang="ts">
import { Check, Flame, ListTodo, Target } from '@lucide/vue'
import type { CalendarPlan } from '../../shared/calendar'
import GoalCheckInButton from './GoalCheckInButton.vue'

defineProps<{ plan: CalendarPlan; date: string; compact?: boolean }>()
const emit = defineEmits<{ inspect: []; 'check-in': [] }>()
const kinds = {
  goal: { label: '目标', icon: Target, style: 'border-indigo-200/60 bg-indigo-50/70 text-indigo-800 hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200' },
  habit: { label: '习惯', icon: Flame, style: 'border-amber-200/60 bg-amber-50/70 text-amber-900 hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200' },
  todo: { label: '待办', icon: ListTodo, style: 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200' },
}
</script>

<template>
  <div class="group w-full min-w-0 overflow-hidden rounded-xl border transition-colors duration-150 motion-reduce:transition-none" :class="kinds[plan.kind].style">
    <div class="flex min-h-8 items-center justify-between gap-1 px-2.5 pt-1.5">
      <span class="flex items-center gap-1 text-[10px] font-medium opacity-70"><component :is="kinds[plan.kind].icon" class="h-3 w-3 shrink-0" />{{ kinds[plan.kind].label }}</span>
      <GoalCheckInButton v-if="plan.kind === 'goal'" :id="`calendar-checkin-${date}-${plan.sourceId}`" :date="date" :title="plan.title" :checked="plan.checkedIn === true" icon-only @toggle="emit('check-in')" />
      <span v-else-if="plan.completed" class="flex items-center gap-0.5 text-[10px] opacity-70"><Check class="h-3 w-3" />已完成</span>
    </div>
    <button
      :id="`calendar-plan-${date}-${plan.id}`"
      type="button"
      :aria-label="`${date}，${kinds[plan.kind].label}：${plan.title}，${plan.completed ? (plan.kind === 'goal' ? '已达成' : '已完成') : plan.detail}${plan.checkedIn ? '，当天已打卡' : ''}${plan.attention ? `，${plan.attention}` : ''}，查看详情`"
      aria-haspopup="dialog"
      :aria-controls="plan.kind === 'todo' ? 'calendar-day-dialog' : `${plan.kind}-journal-dialog`"
      class="w-full min-w-0 rounded-lg px-2.5 pt-0.5 pb-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
      @click="emit('inspect')"
    >
      <span class="text-xs leading-5 font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]" :class="[compact ? 'line-clamp-2' : 'block', { 'line-through decoration-current/30 opacity-65': plan.completed && plan.kind !== 'goal' }]">{{ plan.title }}</span>
      <span class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-4">
        <span class="opacity-65">{{ plan.detail }}</span>
        <span v-if="plan.checkedIn" class="font-medium text-emerald-700 dark:text-emerald-300">已打卡</span>
        <span v-if="plan.hasJournal" class="font-medium opacity-80">有记录</span>
        <span v-if="plan.kind === 'goal' && plan.completed" class="font-medium opacity-75">已达成</span>
      </span>
      <span v-if="plan.percent !== undefined" class="mt-2 block h-[3px] overflow-hidden rounded-full bg-indigo-200/60 dark:bg-indigo-900/60" aria-hidden="true"><span class="block h-full rounded-full bg-indigo-400/90" :style="{ width: `${plan.percent}%` }"></span></span>
      <span v-if="plan.attention" class="mt-2 inline-flex rounded-md bg-rose-100/80 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">{{ plan.attention }}</span>
    </button>
  </div>
</template>
