<script setup lang="ts">
import { ref } from 'vue'
import { useKeepDoStore } from './stores/keepdo'
import type { Goal } from './types'
import Navbar from './components/Navbar.vue'
import TodayView from './components/TodayView.vue'
import GoalsView from './components/GoalsView.vue'
import StatsView from './components/StatsView.vue'
import GoalModal from './components/GoalModal.vue'
import HabitModal from './components/HabitModal.vue'
import SettingsModal from './components/SettingsModal.vue'

const store = useKeepDoStore()

// 弹窗状态管理
const isGoalModalOpen = ref(false)
const goalToEdit = ref<Goal | null>(null)

const isHabitModalOpen = ref(false)
const habitIdToEdit = ref<string | null>(null)

const isSettingsModalOpen = ref(false)

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
    <!-- 顶部导航 -->
    <Navbar @open-settings="isSettingsModalOpen = true" />

    <!-- 主体容器 -->
    <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Transition mode="out-in" name="fade">
        <!-- 页面 1：今日专注 -->
        <TodayView
          v-if="store.activeTab === 'today'"
          @new-habit="openNewHabitModal"
          @edit-habit="openEditHabitModal"
        />

        <!-- 页面 2：长期目标 -->
        <GoalsView
          v-else-if="store.activeTab === 'goals'"
          @new-goal="openNewGoalModal"
          @edit-goal="openEditGoalModal"
        />

        <!-- 页面 3：统计复盘 -->
        <StatsView
          v-else-if="store.activeTab === 'stats'"
        />
      </Transition>
    </main>

    <!-- 弹窗组件群 -->
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
