<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { getDaysRemaining } from '../utils/date'
import { getGoalProgressPercent } from '../../shared/calendar'
import type { Goal } from '../types'
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  Flame,
  Check,
  Clock,
  Sparkles
} from '@lucide/vue'

const store = useKeepDoStore()

const selectedCategory = ref('全部')

defineEmits<{
  (e: 'new-goal'): void
  (e: 'edit-goal', goal: Goal): void
}>()

const filteredGoals = computed(() => {
  if (selectedCategory.value === '全部') {
    return store.goals
  }
  return store.goals.filter(g => g.category === selectedCategory.value)
})

function getLinkedHabitsCount(goalId: string): number {
  return store.habits.filter(h => h.goalId === goalId).length
}
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部操作栏与分类筛选 -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
      <!-- 分类标签切换 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="cat in store.categories"
          :key="cat"
          @click="selectedCategory = cat"
          class="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all"
          :class="selectedCategory === cat
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 ring-2 ring-indigo-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-[#121824] dark:text-slate-300 dark:hover:bg-slate-800'"
        >
          {{ cat }}
        </button>
      </div>

      <!-- 新建目标按钮 -->
      <button
        @click="$emit('new-goal')"
        class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95"
      >
        <Plus class="h-4 w-4 stroke-[2.5]" />
        <span>设立新目标</span>
      </button>
    </div>

    <!-- 目标卡片列表 (Bento-like Grid) -->
    <div v-if="filteredGoals.length > 0" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        v-for="goal in filteredGoals"
        :key="goal.id"
        class="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-[#121824] dark:hover:border-slate-700"
      >
        <div>
          <!-- 顶部状态栏：分类与截止倒计时 -->
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-lg bg-indigo-50/80 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              {{ goal.category }}
            </span>

            <div class="flex items-center gap-2">
              <span
                v-if="goal.deadline"
                class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="(getDaysRemaining(goal.deadline) ?? 0) < 0
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : (getDaysRemaining(goal.deadline) ?? 0) <= 7
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
              >
                <Clock class="h-3 w-3" />
                <span v-if="(getDaysRemaining(goal.deadline) ?? 0) < 0">已截止</span>
                <span v-else>剩 {{ getDaysRemaining(goal.deadline) }} 天</span>
              </span>

              <!-- 操作管理按钮 -->
              <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  @click="$emit('edit-goal', goal)"
                  class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="编辑目标"
                >
                  <Edit3 class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="store.deleteGoal(goal.id)"
                  class="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  title="删除目标"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- 标题与初衷描述 -->
          <h3 class="mt-3.5 font-display text-base font-bold text-slate-900 dark:text-white">
            {{ goal.title }}
          </h3>
          <p v-if="goal.description" class="mt-1 text-xs text-slate-500 line-clamp-2 dark:text-slate-400">
            {{ goal.description }}
          </p>

          <!-- 进度展示区 -->
          <div class="mt-4 rounded-2xl bg-slate-50/70 p-3.5 dark:bg-slate-800/40">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-slate-600 dark:text-slate-400">
                <template v-if="goal.type === 'days'">
                  已坚持 <strong class="font-display font-bold text-indigo-600 dark:text-indigo-400">{{ goal.currentValue }}</strong> / {{ goal.targetValue }} 天
                </template>
                <template v-else-if="goal.type === 'number'">
                  已累计 <strong class="font-display font-bold text-indigo-600 dark:text-indigo-400">{{ goal.currentValue }}</strong> / {{ goal.targetValue }} {{ goal.unit }}
                </template>
                <template v-else-if="goal.type === 'milestones'">
                  已达成 <strong class="font-display font-bold text-indigo-600 dark:text-indigo-400">{{ goal.milestones.filter(m => m.completed).length }}</strong> / {{ goal.milestones.length }} 项里程碑
                </template>
              </span>

              <span class="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                {{ getGoalProgressPercent(goal) }}%
              </span>
            </div>

            <!-- 进度条 -->
            <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
              <div
                class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                :style="{ width: `${getGoalProgressPercent(goal)}%` }"
              ></div>
            </div>

            <!-- 数值量化型：快速登记按钮 -->
            <div v-if="goal.type === 'number'" class="mt-3 flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span class="text-[11px] font-medium text-slate-400">快速登记：</span>
              <button
                @click="store.adjustGoalValue(goal.id, 1)"
                class="rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                +1 {{ goal.unit }}
              </button>
              <button
                @click="store.adjustGoalValue(goal.id, 5)"
                class="rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                +5 {{ goal.unit }}
              </button>
              <button
                @click="store.adjustGoalValue(goal.id, -1)"
                class="rounded-lg border border-slate-200/80 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800"
              >
                -1
              </button>
            </div>
          </div>

          <!-- 里程碑型：清单展示与勾选 -->
          <div v-if="goal.type === 'milestones' && goal.milestones.length" class="mt-3 space-y-1.5">
            <div
              v-for="ms in goal.milestones"
              :key="ms.id"
              @click="store.toggleMilestone(goal.id, ms.id)"
              class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 p-2 text-xs transition-colors hover:bg-slate-50 dark:border-slate-800/80 dark:hover:bg-slate-800/50"
            >
              <div
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all"
                :class="ms.completed ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'"
              >
                <Check v-if="ms.completed" class="h-3 w-3 stroke-[3]" />
              </div>
              <span
                class="truncate font-medium"
                :class="ms.completed ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'"
              >
                {{ ms.title }}
              </span>
            </div>
          </div>
        </div>

        <!-- 底部关联习惯统计 -->
        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <span class="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
            <Flame class="h-3.5 w-3.5 text-amber-500" />
            <span>{{ getLinkedHabitsCount(goal.id) }} 个习惯每日驱动</span>
          </span>

          <span v-if="getGoalProgressPercent(goal) === 100" class="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles class="h-3.5 w-3.5" />
            <span>已圆满达成！</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="rounded-3xl border border-dashed border-slate-200/80 p-12 text-center dark:border-slate-800"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
        <Target class="h-7 w-7" />
      </div>
      <h4 class="mt-4 font-display text-base font-bold text-slate-800 dark:text-slate-200">
        该分类下暂无目标
      </h4>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        明确一个长期目标，让每一天的坚持都拥有方向与复利。
      </p>
      <button
        @click="$emit('new-goal')"
        class="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
      >
        <Plus class="h-4 w-4" />
        <span>设立第一个长期目标</span>
      </button>
    </div>
  </div>
</template>
