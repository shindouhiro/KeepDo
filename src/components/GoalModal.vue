<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import type { Goal, GoalType, Milestone } from '../types'
import { X, Trash2, Target } from '@lucide/vue'

const props = defineProps<{
  isOpen: boolean
  goalToEdit?: Goal | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useKeepDoStore()

const title = ref('')
const description = ref('')
const category = ref('学习')
const type = ref<GoalType>('days')
const targetValue = ref(100)
const unit = ref('天')
const deadline = ref('')
const milestones = ref<Milestone[]>([])
const newMilestoneText = ref('')

watch(
  () => props.goalToEdit,
  (newGoal) => {
    if (newGoal) {
      title.value = newGoal.title
      description.value = newGoal.description || ''
      category.value = newGoal.category
      type.value = newGoal.type
      targetValue.value = newGoal.targetValue
      unit.value = newGoal.unit
      deadline.value = newGoal.deadline || ''
      milestones.value = JSON.parse(JSON.stringify(newGoal.milestones || []))
    } else {
      title.value = ''
      description.value = ''
      category.value = '学习'
      type.value = 'days'
      targetValue.value = 100
      unit.value = '天'
      deadline.value = ''
      milestones.value = []
    }
  },
  { immediate: true }
)

watch(type, (newType) => {
  if (newType === 'days') {
    unit.value = '天'
  } else if (newType === 'milestones') {
    unit.value = '项'
  } else if (unit.value === '天' || unit.value === '项') {
    unit.value = '次'
  }
})

function addMilestone() {
  if (!newMilestoneText.value.trim()) return
  milestones.value.push({
    id: `m-${Date.now()}-${Math.random()}`,
    title: newMilestoneText.value.trim(),
    completed: false
  })
  newMilestoneText.value = ''
}

function removeMilestone(index: number) {
  milestones.value.splice(index, 1)
}

function handleSave() {
  if (!title.value.trim()) return

  if (props.goalToEdit) {
    store.updateGoal(props.goalToEdit.id, {
      title: title.value.trim(),
      description: description.value.trim(),
      category: category.value,
      type: type.value,
      targetValue: type.value === 'milestones' ? milestones.value.length : Number(targetValue.value),
      unit: unit.value,
      deadline: deadline.value || undefined,
      milestones: milestones.value
    })
  } else {
    store.addGoal({
      title: title.value.trim(),
      description: description.value.trim(),
      category: category.value,
      type: type.value,
      targetValue: type.value === 'milestones' ? milestones.value.length : Number(targetValue.value),
      currentValue: 0,
      unit: unit.value,
      deadline: deadline.value || undefined,
      milestones: milestones.value,
      color: 'indigo'
    })
  }

  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all dark:bg-[#121824] dark:border dark:border-slate-800">
      <!-- 弹窗标题 -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Target class="h-4 w-4" />
          </div>
          <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">
            {{ goalToEdit ? '编辑长期目标' : '设立新的长期目标' }}
          </h3>
        </div>
        <button
          id="goal-close"
          aria-label="关闭弹窗"
          @click="$emit('close')"
          class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <form @submit.prevent="handleSave" class="mt-4 space-y-4">
        <!-- 目标名称 -->
        <div>
          <label for="goal-title" class="block text-xs font-bold text-slate-700 dark:text-slate-300">目标名称</label>
          <input
            id="goal-title"
            v-model="title"
            required
            type="text"
            placeholder="例如：今年读完 12 本书、坚持复盘 100 天"
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
          />
        </div>

        <!-- 目标分类与目标类型 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="goal-category" class="block text-xs font-bold text-slate-700 dark:text-slate-300">所属分类</label>
            <select
              id="goal-category"
              v-model="category"
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            >
              <option v-for="cat in store.categories.filter(c => c !== '全部')" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <div>
            <label for="goal-type" class="block text-xs font-bold text-slate-700 dark:text-slate-300">衡量模式</label>
            <select
              id="goal-type"
              v-model="type"
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            >
              <option value="days">📅 天数累计型</option>
              <option value="number">🔢 数值量化型</option>
              <option value="milestones">🚩 关键里程碑型</option>
            </select>
          </div>
        </div>

        <!-- 天数或数值量化 -->
        <div v-if="type !== 'milestones'" class="grid grid-cols-2 gap-3">
          <div>
            <label for="goal-target-value" class="block text-xs font-bold text-slate-700 dark:text-slate-300">目标量化数值</label>
            <input
              id="goal-target-value"
              v-model.number="targetValue"
              type="number"
              min="1"
              required
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>
          <div>
            <label for="goal-unit" class="block text-xs font-bold text-slate-700 dark:text-slate-300">计数单位</label>
            <input
              id="goal-unit"
              v-model="unit"
              type="text"
              placeholder="天 / 本 / 公里 / 页"
              required
              class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>
        </div>

        <!-- 里程碑型列表添加 -->
        <div v-if="type === 'milestones'" class="space-y-2">
          <label for="goal-milestone-title" class="block text-xs font-bold text-slate-700 dark:text-slate-300">关键里程碑 Checklist</label>
          <div class="flex gap-2">
            <input
              id="goal-milestone-title"
              v-model="newMilestoneText"
              type="text"
              placeholder="添加一个具体阶段目标..."
              @keydown.enter.prevent="addMilestone"
              class="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
            <button
              type="button"
              id="goal-add-milestone"
              @click="addMilestone"
              class="rounded-2xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            >
              添加
            </button>
          </div>

          <div v-if="milestones.length" class="max-h-36 overflow-y-auto space-y-1.5 pt-1">
            <div
              v-for="(ms, idx) in milestones"
              :key="ms.id"
              class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
            >
              <span class="truncate font-medium text-slate-700 dark:text-slate-300">{{ idx + 1 }}. {{ ms.title }}</span>
              <button
                type="button"
                :id="`goal-remove-milestone-${ms.id}`"
                aria-label="删除里程碑"
                @click="removeMilestone(idx)"
                class="text-slate-400 hover:text-rose-500"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- 截止日期 -->
        <div>
          <label for="goal-deadline" class="block text-xs font-bold text-slate-700 dark:text-slate-300">计划完成截止日期（可选）</label>
          <input
            id="goal-deadline"
            v-model="deadline"
            type="date"
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
          />
        </div>

        <!-- 目标描述 / 初衷 -->
        <div>
          <label for="goal-description" class="block text-xs font-bold text-slate-700 dark:text-slate-300">初衷与说明（可选）</label>
          <textarea
            id="goal-description"
            v-model="description"
            rows="2"
            placeholder="写下你为什么想要达成这个目标..."
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:focus:bg-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
          ></textarea>
        </div>

        <!-- 底部按钮 -->
        <div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            id="goal-cancel"
            type="button"
            @click="$emit('close')"
            class="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            id="goal-save"
            type="submit"
            class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-95"
          >
            保存目标
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
