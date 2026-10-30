<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import type { Goal } from '../types'
import Navbar from './Navbar.vue'
import AccountBar from './auth/AccountBar.vue'
import TodayView from './TodayView.vue'
import GoalsView from './GoalsView.vue'
import StatsView from './StatsView.vue'
import GoalModal from './GoalModal.vue'
import HabitModal from './HabitModal.vue'
import SettingsModal from './SettingsModal.vue'
import TodoModal from './TodoModal.vue'
import { useQuickAdd } from '../composables/useQuickAdd'
import { getTodayString } from '../utils/date'

const RecordsView = defineAsyncComponent(() => import('./RecordsView.vue'))

const store = useKeepDoStore()
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (store.hasUnsavedChanges || store.isRestoring) { event.preventDefault(); event.returnValue = '' }
}
function refreshOnFocus() {
  if (store.isReady && !store.hasUnsavedChanges && !store.isLoading && !store.isRestoring) void store.loadData()
}
onMounted(() => {
  void store.loadData()
  window.addEventListener('beforeunload', warnBeforeUnload)
  window.addEventListener('focus', refreshOnFocus)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  window.removeEventListener('focus', refreshOnFocus)
  store.clearAccount()
})

// 弹窗状态管理
const isGoalModalOpen = ref(false)
const goalToEdit = ref<Goal | null>(null)

const isHabitModalOpen = ref(false)
const habitIdToEdit = ref<string | null>(null)

const isSettingsModalOpen = ref(false)
const quickAddMessage = ref('')
const quickAddDate = ref(getTodayString())
const { isOpen: isQuickAddOpen, open: startQuickAdd } = useQuickAdd(
  () => store.isReady && !store.isRestoring && !store.isLoading
    && !isGoalModalOpen.value && !isHabitModalOpen.value && !isSettingsModalOpen.value,
  () => {
    quickAddDate.value = getTodayString()
    quickAddMessage.value = ''
  },
)

// 目标弹窗
function openNewGoalModal() {
  goalToEdit.value = null
  isGoalModalOpen.value = true
}

function openEditGoalModal(goal: Goal) {
  goalToEdit.value = goal
  isGoalModalOpen.value = true
}

// 习惯弹窗
function openNewHabitModal() {
  habitIdToEdit.value = null
  isHabitModalOpen.value = true
}

function openEditHabitModal(habitId: string) {
  habitIdToEdit.value = habitId
  isHabitModalOpen.value = true
}
</script>

<template>
  <div class="min-h-screen bg-[#F8F9FA] transition-colors duration-200 dark:bg-[#0B0F17]">
    <AccountBar @open-settings="isSettingsModalOpen = true" />
    <!-- 顶部导航 -->
    <Navbar v-if="store.isReady" @open-settings="isSettingsModalOpen = true" @quick-add="startQuickAdd" />
    <p v-if="quickAddMessage" role="status" class="mx-auto max-w-[1440px] px-4 pt-4 text-xs text-emerald-700 sm:px-6 dark:text-emerald-300">{{ quickAddMessage }}</p>

    <!-- 主体容器 -->
    <main v-if="store.isReady" class="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8" :class="store.activeTab === 'today' ? 'max-w-[1440px]' : 'max-w-6xl'">
      <Transition mode="out-in" name="fade">
        <!-- 页面 1：今日专注 -->
        <TodayView
          v-if="store.activeTab === 'today'"
          @new-habit="openNewHabitModal"
          @edit-habit="openEditHabitModal"
          @edit-goal="openEditGoalModal"
        />

        <!-- 页面 2：长期目标 -->
        <GoalsView
          v-else-if="store.activeTab === 'goals'"
          @new-goal="openNewGoalModal"
          @edit-goal="openEditGoalModal"
        />

        <RecordsView v-else-if="store.activeTab === 'records'" :key="store.backupRestoreRevision" />

        <!-- 页面 4：统计复盘 -->
        <StatsView
          v-else-if="store.activeTab === 'stats'"
        />
      </Transition>
    </main>

    <section v-else class="mx-auto max-w-md px-5 py-24 text-center" role="status">
      <p class="text-sm leading-6 text-slate-500">{{ store.loadError || '正在加载账号数据…' }}</p>
      <button v-if="store.loadError" id="account-data-retry" type="button" :disabled="store.isLoading" class="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" @click="store.loadData">重新加载</button>
    </section>
    <!-- 弹窗组件群 -->
    <TodoModal v-if="isQuickAddOpen" :is-open="true" :todo="null" :date="quickAddDate" @close="isQuickAddOpen = false" @saved="quickAddMessage = '行动已保存，可在计划日历中按安排日期查看。'" />
    <GoalModal
      :is-open="isGoalModalOpen"
      :goal-to-edit="goalToEdit"
      @close="isGoalModalOpen = false"
    />

    <HabitModal
      :is-open="isHabitModalOpen"
      :habit-id-to-edit="habitIdToEdit"
      @close="isHabitModalOpen = false"
    />

    <SettingsModal
      v-if="store.isReady"
      :is-open="isSettingsModalOpen"
      @close="isSettingsModalOpen = false"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
