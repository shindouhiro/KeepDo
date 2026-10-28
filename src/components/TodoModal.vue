<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, ListTodo, LoaderCircle } from '@lucide/vue'
import type { Todo, Priority } from '../types'
import { useKeepDoStore } from '../stores/keepdo'
import { useNativeDialog } from '../composables/useNativeDialog'

const props = defineProps<{ isOpen: boolean; todo: Todo | null; date: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useKeepDoStore()
const { handleClose, handleBackdrop } = useNativeDialog('todoDialog', () => props.isOpen, () => emit('close'))
const title = ref('')
const date = ref('')
const priority = ref<Priority>('medium')
const goalId = ref('')
const completed = ref(false)
const busy = ref(false)
const error = ref('')
const draftId = ref<string | undefined>()
watch(() => props.isOpen, open => {
  if (!open) return
  title.value = props.todo?.title ?? ''
  date.value = props.todo?.date ?? props.date
  priority.value = props.todo?.priority ?? 'medium'
  goalId.value = props.todo?.goalId ?? ''
  completed.value = props.todo?.completed ?? false
  error.value = ''
  draftId.value = props.todo?.id
}, { immediate: true })

async function save() {
  if (!title.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (draftId.value) {
      if (!store.todos.some(todo => todo.id === draftId.value)) throw new Error('事项已被删除，请刷新日程后重试')
      store.updateTodo(draftId.value, { title: title.value.trim(), date: date.value, priority: priority.value, goalId: goalId.value || null, completed: completed.value })
    } else {
      draftId.value = store.addTodo(title.value.trim(), priority.value, goalId.value || null, date.value)
    }
    await store.flushSync()
    emit('close')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { busy.value = false }
}
</script>

<template>
  <dialog ref="todoDialog" id="todo-editor-dialog" aria-labelledby="todo-editor-heading" class="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#121824] dark:text-white" @close="handleClose" @click="!busy && handleBackdrop($event)" @cancel="busy && $event.preventDefault()">
    <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
      <h2 id="todo-editor-heading" class="flex items-center gap-2 text-base font-bold"><ListTodo class="h-5 w-5 text-indigo-500" />{{ todo ? '待办详情与编辑' : '添加当日待办' }}</h2>
      <button id="todo-editor-close" type="button" :disabled="busy" aria-label="关闭待办编辑" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:hover:bg-slate-800" @click="emit('close')"><X class="h-4 w-4" /></button>
    </div>
    <form id="todo-editor-form" class="mt-5 space-y-4" @submit.prevent="save">
      <div>
        <label for="todo-editor-title" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">事项内容</label>
        <textarea id="todo-editor-title" v-model="title" required maxlength="200" rows="3" :disabled="busy" class="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="写下需要完成的具体事项"></textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="todo-editor-date" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">安排日期</label>
          <input id="todo-editor-date" v-model="date" required type="date" min="0001-01-01" max="9999-12-31" :disabled="busy" class="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>
        <div>
          <label for="todo-editor-priority" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">优先级</label>
          <select id="todo-editor-priority" v-model="priority" :disabled="busy" class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="high">高优先</option><option value="medium">中优先</option><option value="low">低优先</option></select>
        </div>
      </div>
      <div>
        <label for="todo-editor-goal" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">关联长期目标</label>
        <select id="todo-editor-goal" v-model="goalId" :disabled="busy" class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">不关联目标</option><option v-for="goal in store.goals" :key="goal.id" :value="goal.id">{{ goal.title }}</option></select>
      </div>
      <label v-if="todo" for="todo-editor-completed" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input id="todo-editor-completed" v-model="completed" type="checkbox" :disabled="busy" class="h-4 w-4 accent-indigo-600" />事项已完成</label>
      <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-xs leading-6 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">{{ error }}</p>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button id="todo-editor-cancel" type="button" :disabled="busy" class="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:hover:bg-slate-800" @click="emit('close')">取消</button>
        <button id="todo-editor-save" type="submit" :disabled="busy || !title.trim()" class="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"><LoaderCircle v-if="busy" class="h-3.5 w-3.5 animate-spin" />{{ busy ? '正在保存…' : '保存事项' }}</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
dialog::backdrop { background: rgb(0 0 0 / 60%); backdrop-filter: blur(6px); }
</style>
