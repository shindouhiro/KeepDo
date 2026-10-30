<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Target, Check, Trash2, Smile, ListTodo } from '@lucide/vue'
import type { Priority, Todo } from '../types'
import { useKeepDoStore } from '../stores/keepdo'

const store = useKeepDoStore()
const emit = defineEmits<{ edit: [todo: Todo] }>()
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

// 过滤后的待办列表
const filteredTodos = computed(() => {
  const list = store.todosForSelectedDate
  if (todoFilter.value === 'active') return list.filter(t => !t.completed)
  if (todoFilter.value === 'completed') return list.filter(t => t.completed)
  return list
})

</script>

<template>
  <!-- 模块二：每日待办清单 -->
  <section class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
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
          id="today-todos-filter-all"
          type="button"
          :aria-pressed="todoFilter === 'all'"
          @click="todoFilter = 'all'"
          class="rounded-lg px-3 py-1 transition-all"
          :class="todoFilter === 'all' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'hover:text-slate-800 dark:hover:text-slate-200'"
        >
          全部
        </button>
        <button
          id="today-todos-filter-active"
          type="button"
          :aria-pressed="todoFilter === 'active'"
          @click="todoFilter = 'active'"
          class="rounded-lg px-3 py-1 transition-all"
          :class="todoFilter === 'active' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'hover:text-slate-800 dark:hover:text-slate-200'"
        >
          未完成
        </button>
        <button
          id="today-todos-filter-completed"
          type="button"
          :aria-pressed="todoFilter === 'completed'"
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
      <form id="today-todo-create-form" @submit.prevent="handleAddTodo" class="flex flex-col gap-2.5">
        <div class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
          <Plus class="h-4 w-4 text-slate-400" />
          <input
            id="today-todo-title"
            aria-label="待办行动内容"
            v-model="newTodoTitle"
            type="text"
            required maxlength="200"
            :placeholder="`添加 ${store.selectedDate} 的行动…`"
            class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <!-- 关联长期目标 -->
          <select
            id="today-todo-goal"
            aria-label="关联长期目标"
            v-model="newTodoGoalId"
            class="min-w-0 max-w-full flex-1 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="">🎯 关联长期目标</option>
            <option v-for="goal in store.goals" :key="goal.id" :value="goal.id">
              🎯 {{ goal.title }}
            </option>
          </select>

          <!-- 优先级 -->
          <select
            id="today-todo-priority"
            aria-label="待办优先级"
            v-model="newTodoPriority"
            class="rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="high">🔴 高优先</option>
            <option value="medium">🟡 中优先</option>
            <option value="low">🟢 低优先</option>
          </select>

          <!-- 提交按钮 -->
          <button
            id="today-todo-submit"
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
          <!-- 待办完成按钮 -->
          <button
            :id="`today-todo-toggle-${todo.id}`"
            type="button"
            :aria-label="`${todo.completed ? '取消完成' : '完成'}：${todo.title}`"
            :aria-pressed="todo.completed"
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
              @click="emit('edit', todo)"
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
          :id="`today-todo-delete-${todo.id}`"
          type="button"
          :aria-label="`删除待办：${todo.title}`"
          @click="store.deleteTodo(todo.id)"
          class="ml-2 shrink-0 rounded p-2 text-slate-400 transition-opacity hover:text-rose-500 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:text-rose-400"
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
</template>
