<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useKeepDoStore } from '../stores/keepdo'
import { useJournalStore } from '../stores/journal'
import { getTodayString } from '../utils/date'
import type { Goal, Todo } from '../types'
import type { JournalSubjectType } from '../../shared/journal'
import CalendarGoals from './CalendarGoals.vue'
import CalendarPlanner from './CalendarPlanner.vue'
import CalendarDayDialog from './CalendarDayDialog.vue'
import TodoModal from './TodoModal.vue'
import { getGoalsForDate, getHabitsForDate } from '../../shared/calendar'
import TodayHabits from './TodayHabits.vue'
import TodayTodos from './TodayTodos.vue'
import DailyMomentum from './DailyMomentum.vue'

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
    <DailyMomentum :todos="store.todos" :habits="store.habits" :date="store.selectedDate" :today="getTodayString()" />
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
      <div class="min-w-0">
        <CalendarGoals stacked :goals="selectedGoals" :date="store.selectedDate" @edit-goal="$emit('edit-goal', $event)" @show-goals="store.activeTab = 'goals'" @check-in-goal="store.toggleGoalDay" @open-journal="openGoalJournal" />
        <section v-if="!selectedGoals.length" class="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">暂无进行中的长期目标。<button id="today-empty-show-goals" type="button" class="mt-3 block rounded font-semibold text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="store.activeTab = 'goals'">前往设立目标</button></section>
      </div>
      <TodayHabits class="min-w-0" :habits="selectedHabits" :date="store.selectedDate" :journal-dates="journalIndex.habitDates" @new="emit('new-habit')" @edit="emit('edit-habit', $event)" @journal="openHabitJournal" />
      <TodayTodos class="min-w-0" @edit="openTodoEditor" />
    </div>
    <JournalDialog v-if="journalItem && journalSubject" :key="`${journalSubject.type}-${journalSubject.id}`" :is-open="true" :subject="journalItem" :subject-type="journalSubject.type" :date="store.selectedDate" @close="journalSubject = null" />

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
    <TodoModal v-if="isTodoModalOpen" :is-open="true" :todo="todoToEdit" :date="store.selectedDate" @close="isTodoModalOpen = false" />
  </div>
</template>
