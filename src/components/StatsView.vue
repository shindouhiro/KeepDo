<script setup lang="ts">
import { computed } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { getPastNDays, calculateHabitStreak } from '../utils/date'
import {
  Flame,
  CheckCircle2,
  Target,
  Calendar,
  Sparkles,
  TrendingUp,
  Award
} from '@lucide/vue'

const store = useKeepDoStore()

// 过去 84 天（12 周）的打卡热力图数据
const heatmapDays = computed(() => {
  const days = getPastNDays(84)
  return days.map(day => {
    let habitCount = 0
    store.habits.forEach(h => {
      if ((h.records[day] || 0) >= h.targetPerDay) {
        habitCount++
      }
    })
    const todoCount = store.todos.filter(t => t.date === day && t.completed).length
    const total = habitCount + todoCount
    return {
      date: day,
      habitCount,
      todoCount,
      total
    }
  })
})

// 累计指标
const totalHabitPunchCount = computed(() => {
  let count = 0
  store.habits.forEach(h => {
    count += Object.keys(h.records).length
  })
  return count
})

const totalCompletedTodos = computed(() => {
  return store.todos.filter(t => t.completed).length
})

const maxStreak = computed(() => {
  let max = 0
  store.habits.forEach(h => {
    const { longestStreak } = calculateHabitStreak(h.records, h.targetPerDay)
    if (longestStreak > max) max = longestStreak
  })
  return max
})

function getHeatmapLevelClass(total: number): string {
  if (total === 0) return 'bg-slate-100 dark:bg-slate-800/80 hover:ring-1 hover:ring-slate-300'
  if (total === 1) return 'bg-emerald-200 dark:bg-emerald-900/60'
  if (total <= 3) return 'bg-emerald-400 dark:bg-emerald-600'
  return 'bg-emerald-600 dark:bg-emerald-400'
}
</script>

<template>
  <div class="space-y-6">
    <!-- 数据指标 Bento Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <!-- 卡片 1 -->
      <div class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Flame class="h-3.5 w-3.5 fill-amber-400" />
          </div>
          <span>历史最高连击</span>
        </div>
        <div class="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {{ maxStreak }} <span class="text-xs font-normal text-slate-400">天</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">坚韧自律的记录</p>
      </div>

      <!-- 卡片 2 -->
      <div class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 class="h-3.5 w-3.5" />
          </div>
          <span>累计达成待办</span>
        </div>
        <div class="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {{ totalCompletedTodos }} <span class="text-xs font-normal text-slate-400">项</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">落地执行的脚印</p>
      </div>

      <!-- 卡片 3 -->
      <div class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <Sparkles class="h-3.5 w-3.5" />
          </div>
          <span>习惯总打卡</span>
        </div>
        <div class="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {{ totalHabitPunchCount }} <span class="text-xs font-normal text-slate-400">次</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">积跬步以至千里</p>
      </div>

      <!-- 卡片 4 -->
      <div class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <Target class="h-3.5 w-3.5" />
          </div>
          <span>长期目标数</span>
        </div>
        <div class="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {{ store.goals.length }} <span class="text-xs font-normal text-slate-400">个</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">清晰笃定的航向</p>
      </div>
    </div>

    <!-- 近 12 周行动热力图 (GitHub / Linear 风格) -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <Calendar class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">
            行动热力图（近 12 周持续沉淀）
          </h3>
        </div>

        <!-- 图例 -->
        <div class="flex items-center gap-1.5 text-xs text-slate-400">
          <span>少</span>
          <span class="h-3 w-3 rounded-xs bg-slate-100 dark:bg-slate-800"></span>
          <span class="h-3 w-3 rounded-xs bg-emerald-200 dark:bg-emerald-900/60"></span>
          <span class="h-3 w-3 rounded-xs bg-emerald-400 dark:bg-emerald-600"></span>
          <span class="h-3 w-3 rounded-xs bg-emerald-600 dark:bg-emerald-400"></span>
          <span>多</span>
        </div>
      </div>

      <!-- 热力格子滚动容器 -->
      <div class="mt-5 overflow-x-auto pb-2">
        <div class="flex items-start gap-2" style="width: max-content;">
          <!-- 星期指示标签 -->
          <div class="grid grid-rows-7 gap-1.5 text-[10px] font-semibold text-slate-400">
            <span class="h-3.5 flex items-center">周一</span>
            <span class="h-3.5"></span>
            <span class="h-3.5 flex items-center">周三</span>
            <span class="h-3.5"></span>
            <span class="h-3.5 flex items-center">周五</span>
            <span class="h-3.5"></span>
            <span class="h-3.5 flex items-center">周日</span>
          </div>

          <!-- 热力格子网格 -->
          <div class="grid grid-flow-col grid-rows-7 gap-1.5">
            <div
              v-for="item in heatmapDays"
              :key="item.date"
              :title="`${item.date}：完成 ${item.total} 次行动（打卡 ${item.habitCount} 次，待办 ${item.todoCount} 项）`"
              class="h-3.5 w-3.5 rounded-xs transition-all duration-150 hover:scale-125 hover:ring-2 hover:ring-indigo-500/50"
              :class="getHeatmapLevelClass(item.total)"
            ></div>
          </div>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <Award class="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>每一个绿色格子，都是你战胜拖延、向长期目标迈进的印记。</span>
      </div>
    </div>

    <!-- 目标大盘进度排行列表 -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#121824]">
      <div class="flex items-center gap-2">
        <TrendingUp class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">
          长期目标进度总览
        </h3>
      </div>

      <div v-if="store.goals.length > 0" class="mt-4 space-y-3">
        <div
          v-for="goal in store.goals"
          :key="goal.id"
          class="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
        >
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ goal.title }}</span>
              <span class="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {{ goal.category }}
              </span>
            </div>

            <span class="font-display font-bold text-indigo-600 dark:text-indigo-400">
              <template v-if="goal.type === 'milestones'">
                {{ goal.milestones.filter(m => m.completed).length }} / {{ goal.milestones.length }} 项里程碑
              </template>
              <template v-else>
                {{ goal.currentValue }} / {{ goal.targetValue }} {{ goal.unit }}
              </template>
            </span>
          </div>

          <div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              :style="{
                width: `${goal.type === 'milestones'
                  ? (goal.milestones.length ? Math.round((goal.milestones.filter(m => m.completed).length / goal.milestones.length) * 100) : 0)
                  : (goal.targetValue ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0)}%`
              }"
            ></div>
          </div>
        </div>
      </div>

      <div v-else class="mt-4 text-center text-xs text-slate-400">
        暂无长期目标数据
      </div>
    </div>
  </div>
</template>
