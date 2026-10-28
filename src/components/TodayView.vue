<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { useJournalStore } from '../stores/journal'
import {
  calculateHabitStreak
} from '../utils/date'
import type { Goal, Priority, Todo } from '../types'
import type { JournalSubjectType } from '../../shared/journal'
import { getJournalDates } from '../../shared/journal'
import CalendarGoals from './CalendarGoals.vue'
import CalendarPlanner from './CalendarPlanner.vue'
import CalendarDayDialog from './CalendarDayDialog.vue'
import TodoModal from './TodoModal.vue'
import { getGoalsForDate, getHabitsForDate } from '../../shared/calendar'
import {
  Plus,
  Flame,
  Target,
  Check,
  Trash2,
  Smile,
  ListTodo
} from '@lucide/vue'

const store = useKeepDoStore()
const journalIndex = useJournalStore()
const JournalDialog = defineAsyncComponent(() => import('./journal/JournalDialog.vue'))
const journalSubject = ref<{ type: JournalSubjectType; id: string } | null>(null)
const journalItem = computed(() => {
  const selected = journalSubject.value
  if (!selected) return null
  return (selected.type === 'goal' ? store.goals : store.habits).find(item => item.id === selected.id) || null
})
function openJournal(type: JournalSubjectType, id: string, date: string) {
  isDayDetailsOpen.value = false
  store.selectedDate = date
  journalSubject.value = { type, id }
}
function openGoalJournal(id: string, date: string) { openJournal('goal', id, date) }
function openHabitJournal(id: string, date: string) { openJournal('habit', id, date) }
onMounted(() => { void journalIndex.refresh() })
onBeforeUnmount(() => journalIndex.clear())

const emit = defineEmits<{
  (e: 'new-habit'): void
  (e: 'edit-habit', habitId: string): void
  (e: 'edit-goal', goal: Goal): void
}>()

const isDayDetailsOpen = ref(false)
const isTodoModalOpen = ref(false)
const todoToEdit = ref<Todo | null>(null)
function openTodoEditor(todo: Todo | null) {
  isDayDetailsOpen.value = false
  todoToEdit.value = todo
  isTodoModalOpen.value = true
}
function editGoalFromDetails(goal: Goal) {
  isDayDetailsOpen.value = false
  emit('edit-goal', goal)
}
function editHabitFromDetails(id: string) {
  isDayDetailsOpen.value = false
  emit('edit-habit', id)
}
function showGoalsFromDetails() {
  isDayDetailsOpen.value = false
  store.activeTab = 'goals'
}

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

function selectDate(date: string) {
  store.selectedDate = date
  isDayDetailsOpen.value = true
}
function addCalendarTodo(date: string) {
  store.selectedDate = date
  openTodoEditor(null)
}

const selectedHabits = computed(() => getHabitsForDate(store.habits, store.selectedDate))
const selectedGoals = computed(() => getGoalsForDate(store.goals, store.selectedDate, journalIndex.dates))

// 过滤后的待办列表
const filteredTodos = computed(() => {
  const list = store.todosForSelectedDate
  if (todoFilter.value === 'active') return list.filter(t => !t.completed)
  if (todoFilter.value === 'completed') return list.filter(t => t.completed)
  return list
})

// 习惯打卡完成统计
const completedHabitsCount = computed(() => {
  return selectedHabits.value.filter(h => (h.records[store.selectedDate] || 0) >= h.targetPerDay).length
})

</script>

<template>
  <div class="space-y-6">
    <CalendarPlanner
      :date="store.selectedDate"
      :goals="store.goals"
      :habits="store.habits"
      :todos="store.todos"
      :journal-dates="journalIndex.dates"
      :habit-journal-dates="journalIndex.habitDates"
      @select-date="store.selectedDate = $event"
      @inspect-date="selectDate"
      @new-todo="addCalendarTodo"
      @check-in-goal="store.toggleGoalDay"
      @inspect-goal="openGoalJournal"
      @inspect-habit="openHabitJournal"
    />

    <p v-if="journalIndex.error" class="text-xs text-amber-700 dark:text-amber-300">历史日记标记暂未加载。<button id="journal-index-retry" type="button" class="ml-1 underline" @click="journalIndex.refresh">重新加载</button></p>
    <CalendarGoals :goals="selectedGoals" :date="store.selectedDate" @edit-goal="$emit('edit-goal', $event)" @show-goals="store.activeTab = 'goals'" @check-in-goal="store.toggleGoalDay" @open-journal="openGoalJournal" />
    <JournalDialog v-if="journalItem && journalSubject" :key="`${journalSubject.type}-${journalSubject.id}`" :is-open="true" :subject="journalItem" :subject-type="journalSubject.type" :date="store.selectedDate" @close="journalSubject = null" />

    <!-- 模块一：每日习惯打卡 (Tactile Habits) -->
    <section class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Flame class="h-3.5 w-3.5" />
          </div>
          <h2 class="font-display text-base font-bold text-slate-900 dark:text-white">日常习惯</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {{ completedHabitsCount }} / {{ selectedHabits.length }} 已完成
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
      <div v-if="selectedHabits.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="habit in selectedHabits"
          :key="habit.id"
          class="group relative flex items-center justify-between rounded-2xl border p-4 transition-all duration-200"
          :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay
            ? 'border-emerald-200/80 bg-emerald-50/30 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/15'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#121824] dark:hover:border-slate-700'"
        >
          <div class="min-w-0 flex-1 pr-3">
            <div class="flex items-center gap-2">
              <button
                :id="`today-habit-title-${habit.id}`"
                type="button"
                :aria-label="`查看习惯日记：${habit.title}`"
                aria-haspopup="dialog"
                aria-controls="habit-journal-dialog"
                class="min-w-0 truncate rounded text-left text-sm font-bold text-slate-900 transition-colors hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-white"
                :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? 'text-emerald-950 dark:text-emerald-200' : ''"
                @click="openHabitJournal(habit.id, store.selectedDate)"
              >
                {{ habit.title }}
              </button>
            </div>
            <p v-if="habit.description" class="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{{ habit.description }}</p>

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
            <button :id="`today-habit-journal-${habit.id}`" type="button" :aria-label="`记录与时间线：${habit.title}`" aria-haspopup="dialog" aria-controls="habit-journal-dialog" class="mt-2 rounded px-0.5 py-1 text-[11px] font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="openHabitJournal(habit.id, store.selectedDate)">记录 / 时间线<span v-if="getJournalDates(journalIndex.habitDates, habit.id).includes(store.selectedDate)" class="ml-1.5 text-emerald-600 dark:text-emerald-400">· 有记录</span></button>
          </div>

          <!-- 触觉打卡按钮 -->
          <div class="flex items-center gap-2">
            <button
              :id="`today-habit-checkin-${store.selectedDate}-${habit.id}`"
              type="button"
              :aria-label="`${(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? '取消打卡' : '打卡'}：${habit.title}`"
              :aria-pressed="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay"
              @click="store.toggleHabitDay(habit.id, store.selectedDate)"
              class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:scale-95"
              :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay
                ? 'border-emerald-300/80 bg-emerald-50 text-emerald-600 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-slate-200/90 bg-transparent text-slate-300 hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400'"
              :title="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? '点击取消打卡' : '点击完成打卡'"
            >
              <Check
                class="h-4 w-4"
                :class="(habit.records[store.selectedDate] || 0) >= habit.targetPerDay ? 'stroke-[2.5]' : 'stroke-[1.5]'"
              />
            </button>

            <!-- 管理习惯入口 -->
            <button
              :id="`today-habit-edit-${habit.id}`"
              type="button"
              :aria-label="`编辑习惯：${habit.title}`"
              @click="$emit('edit-habit', habit.id)"
              class="transition-opacity hover:text-indigo-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-indigo-400"
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
              <button
                :id="`today-todo-details-${todo.id}`"
                type="button"
                title="查看或编辑待办"
                @click="openTodoEditor(todo)"
                class="block w-full truncate rounded text-left text-sm transition-all focus-visible:outline-2 focus-visible:outline-indigo-500"
                :class="todo.completed
                  ? 'text-slate-400 line-through dark:text-slate-500'
                  : 'font-semibold text-slate-800 dark:text-slate-100'"
              >
                {{ todo.title }}
              </button>

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
    <CalendarDayDialog
      :is-open="isDayDetailsOpen"
      :date="store.selectedDate"
      @close="isDayDetailsOpen = false"
      @update-date="store.selectedDate = $event"
      @edit-goal="editGoalFromDetails"
      @edit-habit="editHabitFromDetails"
      @edit-todo="openTodoEditor"
      @new-todo="openTodoEditor(null)"
      @show-goals="showGoalsFromDetails"
      @open-journal="openGoalJournal"
      @open-habit-journal="openHabitJournal"
    />
    <TodoModal :is-open="isTodoModalOpen" :todo="todoToEdit" :date="store.selectedDate" @close="isTodoModalOpen = false" />
  </div>
</template>
