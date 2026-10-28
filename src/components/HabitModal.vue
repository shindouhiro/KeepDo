<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { X, Trash2, Flame } from '@lucide/vue'

const props = defineProps<{
  isOpen: boolean
  habitIdToEdit?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useKeepDoStore()

const title = ref('')
const goalId = ref<string>('')
const targetPerDay = ref(1)
const unit = ref('次')
const color = ref('indigo')

watch(
  () => props.habitIdToEdit,
  (id) => {
    if (id) {
      const habit = store.habits.find(h => h.id === id)
      if (habit) {
        title.value = habit.title
        goalId.value = habit.goalId || ''
        targetPerDay.value = habit.targetPerDay
        unit.value = habit.unit
        color.value = habit.color
      }
    } else {
      title.value = ''
      goalId.value = ''
      targetPerDay.value = 1
      unit.value = '次'
      color.value = 'indigo'
    }
  },
  { immediate: true }
)

function handleSave() {
  if (!title.value.trim()) return

  if (props.habitIdToEdit) {
    store.updateHabit(props.habitIdToEdit, {
      title: title.value.trim(),
      goalId: goalId.value || null,
      targetPerDay: Number(targetPerDay.value),
      unit: unit.value.trim() || '次',
      color: color.value
    })
  } else {
    store.addHabit({
      title: title.value.trim(),
      goalId: goalId.value || null,
      targetPerDay: Number(targetPerDay.value),
      unit: unit.value.trim() || '次',
      color: color.value
    })
  }

  emit('close')
}

function handleDelete() {
  if (props.habitIdToEdit) {
    store.deleteHabit(props.habitIdToEdit)
    emit('close')
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all dark:bg-[#121824] dark:border dark:border-slate-800">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/50">
            <Flame class="h-4 w-4 fill-amber-400" />
          </div>
          <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">
            {{ habitIdToEdit ? '管理日常习惯' : '设立每日微习惯' }}
          </h3>
        </div>
        <button
          id="habit-close"
          aria-label="关闭弹窗"
          @click="$emit('close')"
          class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <form @submit.prevent="handleSave" class="mt-4 space-y-4">
        <!-- 习惯名称 -->
        <div>
          <label for="habit-title" class="block text-xs font-bold text-slate-700 dark:text-slate-300">习惯名称</label>
          <input
            id="habit-title"
            v-model="title"
            required
            type="text"
            placeholder="例如：早读 30 分钟、喝足 2000ml 水、健身"
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
          />
        </div>

        <!-- 关联长期目标 -->
        <div>
          <label for="habit-goal" class="block text-xs font-bold text-slate-700 dark:text-slate-300">关联长期目标（可选）</label>
          <select
            id="habit-goal"
            v-model="goalId"
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
          >
            <option value="">🎯 独立习惯（不绑定特定目标）</option>
            <option v-for="goal in store.goals" :key="goal.id" :value="goal.id">
              🎯 {{ goal.title }} ({{ goal.category }})
            </option>
          </select>
          <p class="mt-1.5 text-[11px] text-slate-400">若关联了天数型目标，每日打卡将同步自动累计该目标的坚持天数！</p>
        </div>

        <!-- 每日目标频次与单位 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="habit-target-per-day" class="block text-xs font-bold text-slate-700 dark:text-slate-300">每日目标次数</label>
            <input
              id="habit-target-per-day"
              v-model.number="targetPerDay"
              type="number"
              min="1"
              required
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>
          <div>
            <label for="habit-unit" class="block text-xs font-bold text-slate-700 dark:text-slate-300">单位</label>
            <input
              id="habit-unit"
              v-model="unit"
              type="text"
              placeholder="次 / 杯 / 分钟"
              required
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <button
              v-if="habitIdToEdit"
              type="button"
              id="habit-delete"
              @click="handleDelete"
              class="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <Trash2 class="h-3.5 w-3.5" />
              <span>删除习惯</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              id="habit-cancel"
              type="button"
              @click="$emit('close')"
              class="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              id="habit-save"
              type="submit"
              class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-95"
            >
              保存
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
