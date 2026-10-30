<script setup lang="ts">
import { computed } from 'vue'
import { Award, Sparkles } from '@lucide/vue'
import type { Habit, Todo } from '../types'
import { getDailyActionSummary } from '../../shared/calendar'
import { getRecentAchievements } from '../../shared/momentum'
import DailyProgress from './DailyProgress.vue'

const props = defineProps<{ todos: Todo[]; habits: Habit[]; date: string; today: string }>()
const summary = computed(() => getDailyActionSummary(props.todos, props.habits, props.date))
const achievements = computed(() => getRecentAchievements(props.todos, props.habits, props.today))
const message = computed(() => {
  if (summary.value.state === 'empty') return '从一个小行动开始'
  if (props.date > props.today) return '为未来留好行动空间'
  return summary.value.state === 'completed' ? '当日行动全部达成，给坚持一个掌声' : `再完成 ${summary.value.total - summary.value.completed} 项，就能点亮这一天`
})
</script>

<template>
  <section aria-label="行动成就" class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900">
    <div class="min-w-0" aria-live="polite" aria-atomic="true">
      <h2 class="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100"><Sparkles class="h-4 w-4 shrink-0 text-emerald-600" />{{ message }}</h2>
      <p class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{{ date }} · 习惯与待办进度 <span v-if="date > today">· 未来计划不计入徽章</span></p>
    </div>
    <DailyProgress :summary="summary" />
    <div class="flex items-center gap-2 border-l border-emerald-200 pl-4 dark:border-emerald-900">
      <Award class="h-6 w-6 shrink-0" :class="achievements.badge ? 'text-amber-500' : 'text-slate-400'" />
      <div>
        <p id="momentum-badge" class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ achievements.badge || '等待第一枚徽章' }}</p>
        <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">近七天达成 {{ achievements.completedDays }} 天<span v-if="achievements.next"> · {{ achievements.next }} 天解锁下一枚</span></p>
      </div>
    </div>
  </section>
</template>
