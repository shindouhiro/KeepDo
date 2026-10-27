<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import {
  formatDisplayDate,
  addDays,
  getTodayString,
  getWeekDays,
  calculateHabitStreak
} from '../utils/date'
import type { Priority } from '../types'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  Target,
  Check,
  Trash2,
  Sparkles,
  Smile,
  ListTodo
} from '@lucide/vue'

const store = useKeepDoStore()

defineEmits<{
  (e: 'new-habit'): void
  (e: 'edit-habit', habitId: string): void
}>()

// 待办过滤器
const todoFilter = ref<'all' | 'active' | 'completed'>('all')

// 新建待办表单状态
const newTodoTitle = ref('')
const newTodoPriority = ref<Priority>('medium')
const newTodoGoalId = ref<string>('')

function handleAddTodo() {
  if (!newTodoTitle.value.trim()) return
  store.addTodo(
    newTodoTitle.value,
    newTodoPriority.value,
    newTodoGoalId.value || null,
    store.selectedDate
  )
  newTodoTitle.value = ''
}

// 快速日期切换
function prevDay() {
  store.selectedDate = addDays(store.selectedDate, -1)
}
function nextDay() {
  store.selectedDate = addDays(store.selectedDate, 1)
}
function gotoToday() {
  store.selectedDate = getTodayString()
}
function selectDate(date: string) {
  store.selectedDate = date
}

// 7天周历列表
const weekDays = computed(() => {
  return getWeekDays(store.selectedDate)
})

// 检查某天是否有完成记录
function getDayCompletionStatus(dateStr: string): 'none' | 'partial' | 'completed' {
  const dayTodos = store.todos.filter(t => t.date === dateStr)
  const dayHabits = store.habits
  const total = dayTodos.length + dayHabits.length
  if (total === 0) return 'none'

  const doneTodos = dayTodos.filter(t => t.completed).length
  const doneHabits = dayHabits.filter(h => (h.records[dateStr] || 0) >= h.targetPerDay).length
  const doneTotal = doneTodos + doneHabits

  if (doneTotal === 0) return 'none'
  if (doneTotal === total) return 'completed'
  return 'partial'
}

// 过滤后的待办列表
const filteredTodos = computed(() => {
  const list = store.todosForSelectedDate
  if (todoFilter.value === 'active') return list.filter(t => !t.completed)
  if (todoFilter.value === 'completed') return list.filter(t => t.completed)
  return list
})

// 习惯打卡完成统计
const completedHabitsCount = computed(() => {
  return store.habits.filter(h => (h.records[store.selectedDate] || 0) >= h.targetPerDay).length
})

const uncompletedTodosCount = computed(() => {
  return store.todosForSelectedDate.filter(t => !t.completed).length
})

const isToday = computed(() => store.selectedDate === getTodayString())
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部：交互式周历与专注总览 Hero 卡片 -->
    <div class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all dark:border-slate-800/80 dark:bg-[#121824]">
      <!-- 柔和背景光晕微装饰 -->
      <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-600/15"></div>
      <div class="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-600/10"></div>

      <!-- 第一行：日期导航与快速跳转 -->
      <div class="relative z-10 flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/60">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <button
              @click="prevDay"
              title="前一天"
              class="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
            <button
              @click="nextDay"
              title="后一天"
              class="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="font-display text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-white">
              {{ formatDisplayDate(store.selectedDate) }}
            </span>
            <button
              v-if="!isToday"
              @click="gotoToday"
              class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-950/70 dark:text-indigo-400 dark:hover:bg-indigo-900"
            >
              回今天
            </button>
          </div>
        </div>

        <!-- 今日完成统计徽章 -->
        <div class="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>待办剩 {{ uncompletedTodosCount }} 项</span>
          <span class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
          <span>习惯剩 {{ store.habits.length - completedHabitsCount }} 项</span>
        </div>
      </div>

      <!-- 第二行：周历切换条 (Week Calendar Strip) -->
      <div class="relative z-10 grid grid-cols-7 gap-1.5 pt-4 sm:gap-2">
        <button
          v-for="item in weekDays"
          :key="item.date"
          @click="selectDate(item.date)"
          class="group flex flex-col items-center rounded-2xl p-2 transition-all active:scale-95"
          :class="item.date === store.selectedDate
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-500/20'
            : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100/90 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:bg-slate-800'"
        >
          <span class="text-[11px] font-medium" :class="item.date === store.selectedDate ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'">
            周{{ item.weekDayName }}
          </span>
          <span class="mt-0.5 font-display text-sm font-bold sm:text-base">
            {{ item.dayNumber }}
          </span>

          <!-- 状态小圆点 -->
          <div class="mt-1 flex h-1.5 items-center justify-center">
            <span
              v-if="getDayCompletionStatus(item.date) === 'completed'"
              class="h-1.5 w-1.5 rounded-full"
              :class="item.date === store.selectedDate ? 'bg-white' : 'bg-emerald-500'"
            ></span>
            <span
              v-else-if="getDayCompletionStatus(item.date) === 'partial'"
              class="h-1.5 w-1.5 rounded-full"
              :class="item.date === store.selectedDate ? 'bg-indigo-200' : 'bg-amber-400'"
            ></span>
            <span
              v-else-if="item.isToday"
              class="h-1 w-1 rounded-full"
              :class="item.date === store.selectedDate ? 'bg-white/60' : 'bg-indigo-400'"
            ></span>
          </div>
        </button>
      </div>

      <!-- 进度指示条 -->
      <div class="relative z-10 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-4 py-2.5 dark:bg-slate-800/40">
        <div class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-indigo-500" />
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {{ store.todayProgress === 100 ? '🎉 太棒了！今日全部目标与行动已圆满搞定！' : `今日行动已达成 ${store.todayProgress}% · 稳步前进` }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <div class="h-2 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              :style="{ width: `${store.todayProgress}%` }"
            ></div>
          </div>
          <span class="font-display text-xs font-bold text-slate-900 dark:text-white">
            {{ store.todayProgress }}%
          </span>
        </div>
      </div>
    </div>

    <!-- 模块一：每日习惯打卡 (Tactile Habits) -->
    <section class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Flame class="h-3.5 w-3.5" />
          </div>
          <h2 class="font-display text-base font-bold text-slate-900 dark:text-white">日常习惯</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {{ completedHabitsCount }} / {{ store.habits.length }} 已完成
          </span>
        </div>

        <button
          @click="$emit('new-habit')"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
        >
          <Plus class="h-3.5 w-3.5" />
          <span>新建习惯</span>
        </button>
      </div>

      <!-- 习惯卡片网格 -->
      <div v-if="store.habits.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="habit in store.habits"
          :key="habit.id"
          class="group relative flex items-center justify-between rounded-2xl border p-4 transition-all duration-200"
          :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay
            ? 'border-emerald-200/80 bg-emerald-50/30 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/15'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#121824] dark:hover:border-slate-700'"
        >
          <div class="min-w-0 flex-1 pr-3">
            <div class="flex items-center gap-2">
              <span
                class="truncate text-sm font-bold text-slate-900 transition-colors dark:text-white"
                :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? 'text-emerald-950 dark:text-emerald-200' : ''"
              >
                {{ habit.title }}
              </span>
            </div>

            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <!-- 连续连击天数徽章 -->
              <span
                class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                :class="calculateHabitStreak(habit.records, habit.targetPerDay).currentStreak > 0
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'"
              >
                <Flame class="h-3 w-3 fill-amber-400 text-amber-500" />
                <span>{{ calculateHabitStreak(habit.records, habit.targetPerDay).currentStreak }} 天连击</span>
              </span>

              <!-- 关联的长期目标徽章 -->
              <span
                v-if="store.getGoalById(habit.goalId)"
                class="inline-flex max-w-[120px] items-center gap-1 truncate rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
              >
                <Target class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ store.getGoalById(habit.goalId)?.title }}</span>
              </span>
            </div>
          </div>

          <!-- 触觉打卡按钮 -->
          <div class="flex items-center gap-2">
            <button
              @click="store.toggleHabitDay(habit.id, store.selectedDate)"
              class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 active:scale-90"
              :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay
                ? 'bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                : 'border border-slate-200/80 bg-slate-50 text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400'"
              :title="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? '点击取消打卡' : '点击完成打卡'"
            >
              <Check
                class="h-6 w-6 transition-transform"
                :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? 'scale-100 stroke-[2.8]' : 'scale-90 stroke-[2]'"
              />
            </button>

            <!-- 管理习惯入口 -->
            <button
              @click="$emit('edit-habit', habit.id)"
              class="opacity-0 transition-opacity hover:text-indigo-600 group-hover:opacity-100 dark:hover:text-indigo-400"
              title="管理习惯"
            >
              <span class="text-[11px] font-medium text-slate-400 underline">编辑</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 空习惯引导 -->
      <div
        v-else
        class="rounded-3xl border border-dashed border-slate-300/80 p-8 text-center dark:border-slate-800"
      >
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/30">
          <Flame class="h-6 w-6" />
        </div>
        <h4 class="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">设立一个微习惯</h4>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">把长期的大目标拆解为每天只要做一点点的小坚持。</p>
        <button
          @click="$emit('new-habit')"
          class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus class="h-3.5 w-3.5" />
          <span>设立第一个习惯</span>
        </button>
      </div>
    </section>

    <!-- 模块二：每日待办清单 (Daily Todos) -->
    <section class="space-y-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <ListTodo class="h-3.5 w-3.5" />
          </div>
          <h2 class="font-display text-base font-bold text-slate-900 dark:text-white">待办行动</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {{ store.todosForSelectedDate.filter(t => t.completed).length }} / {{ store.todosForSelectedDate.length }} 已完成
          </span>
        </div>

        <!-- 过滤器 -->
        <div class="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-500 dark:bg-slate-800/90 dark:text-slate-400">
          <button
            @click="todoFilter = 'all'"
            class="rounded-lg px-3 py-1 transition-all"
            :class="todoFilter === 'all' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'hover:text-slate-800 dark:hover:text-slate-200'"
          >
            全部
          </button>
          <button
            @click="todoFilter = 'active'"
            class="rounded-lg px-3 py-1 transition-all"
            :class="todoFilter === 'active' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'hover:text-slate-800 dark:hover:text-slate-200'"
          >
            未完成
          </button>
          <button
            @click="todoFilter = 'completed'"
            class="rounded-lg px-3 py-1 transition-all"
            :class="todoFilter === 'completed' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'hover:text-slate-800 dark:hover:text-slate-200'"
          >
            已完成
          </button>
        </div>
      </div>

      <!-- 极简高质感新建输入框 -->
      <div class="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 dark:border-slate-800 dark:bg-[#121824] dark:focus-within:border-indigo-500">
        <form @submit.prevent="handleAddTodo" class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div class="flex flex-1 items-center gap-2 px-2">
            <Plus class="h-4 w-4 text-slate-400" />
            <input
              v-model="newTodoTitle"
              type="text"
              placeholder="添加今天的具体行动... (回车添加)"
              class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div class="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0 dark:border-slate-800">
            <!-- 关联长期目标 -->
            <select
              v-model="newTodoGoalId"
              class="rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="">🎯 关联长期目标</option>
              <option v-for="goal in store.goals" :key="goal.id" :value="goal.id">
                🎯 {{ goal.title }}
              </option>
            </select>

            <!-- 优先级 -->
            <select
              v-model="newTodoPriority"
              class="rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="high">🔴 高优先</option>
              <option value="medium">🟡 中优先</option>
              <option value="low">🟢 低优先</option>
            </select>

            <!-- 提交按钮 -->
            <button
              type="submit"
              :disabled="!newTodoTitle.trim()"
              class="flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
            >
              <span>添加</span>
            </button>
          </div>
        </form>
      </div>

      <!-- 待办清单项 -->
      <div v-if="filteredTodos.length > 0" class="space-y-2">
        <div
          v-for="todo in filteredTodos"
          :key="todo.id"
          class="group flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-200"
          :class="todo.completed
            ? 'border-slate-200/50 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-900/30'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-[#121824] dark:hover:border-slate-700'"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <!-- 弹簧质感 Checkbox -->
            <button
              @click="store.toggleTodo(todo.id)"
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-90"
              :class="todo.completed
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'"
            >
              <Check v-if="todo.completed" class="h-3.5 w-3.5 stroke-[3]" />
            </button>

            <!-- 标题内容与标签 -->
            <div class="min-w-0 flex-1">
              <span
                class="block truncate text-sm transition-all"
                :class="todo.completed
                  ? 'text-slate-400 line-through dark:text-slate-500'
                  : 'font-semibold text-slate-800 dark:text-slate-100'"
              >
                {{ todo.title }}
              </span>

              <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <!-- 优先级 -->
                <span
                  v-if="todo.priority === 'high'"
                  class="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  <span>高优先</span>
                </span>
                <span
                  v-else-if="todo.priority === 'medium'"
                  class="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>中优先</span>
                </span>

                <!-- 关联目标 -->
                <span
                  v-if="store.getGoalById(todo.goalId)"
                  class="inline-flex max-w-[140px] items-center gap-1 truncate rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Target class="h-3 w-3 shrink-0 text-indigo-500" />
                  <span class="truncate">{{ store.getGoalById(todo.goalId)?.title }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- 删除按钮 -->
          <button
            @click="store.deleteTodo(todo.id)"
            class="text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-rose-400"
            title="删除待办"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- 空待办提示 -->
      <div
        v-else
        class="rounded-3xl border border-dashed border-slate-200/80 p-8 text-center dark:border-slate-800"
      >
        <Smile class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {{ todoFilter === 'all' ? '今天暂无待办事项，轻松从容，或者在上方输入添加一个行动！' : '该筛选条件下暂无待办事项' }}
        </p>
      </div>
    </section>
  </div>
</template>
