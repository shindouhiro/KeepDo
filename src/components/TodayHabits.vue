<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Flame, Target, Check } from '@lucide/vue'
import type { Habit } from '../types'
import type { JournalDates } from '../../shared/journal'
import { getJournalDates } from '../../shared/journal'
import { calculateHabitStreak } from '../utils/date'
import { useKeepDoStore } from '../stores/keepdo'

const props = defineProps<{ habits: Habit[]; date: string; journalDates: JournalDates }>()
const emit = defineEmits<{ new: []; edit: [id: string]; journal: [id: string, date: string] }>()
const store = useKeepDoStore()
const completedHabitsCount = computed(() => props.habits.filter(h => (h.records[props.date] || 0) >= h.targetPerDay).length)
</script>

<template>
  <!-- 模块一：每日习惯打卡 -->
  <section class="space-y-3">
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          <Flame class="h-3.5 w-3.5" />
        </div>
        <h2 class="font-display text-base font-bold text-slate-900 dark:text-white">日常习惯</h2>
        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {{ completedHabitsCount }} / {{ habits.length }} 已完成
        </span>
      </div>

      <button
        id="today-new-habit" type="button" @click="emit('new')"
        class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>新建习惯</span>
      </button>
    </div>

    <!-- 习惯卡片网格 -->
    <div v-if="habits.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
      <div
        v-for="habit in habits"
        :key="habit.id"
        class="group relative flex items-center justify-between rounded-2xl border p-4 transition-all duration-200"
        :class="(habit.records[date] || 0) >= habit.targetPerDay
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
              :class="(habit.records[date] || 0) >= habit.targetPerDay ? 'text-emerald-950 dark:text-emerald-200' : ''"
              @click="emit('journal', habit.id, date)"
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
          <button :id="`today-habit-journal-${habit.id}`" type="button" :aria-label="`记录与时间线：${habit.title}`" aria-haspopup="dialog" aria-controls="habit-journal-dialog" class="mt-2 rounded px-0.5 py-1 text-[11px] font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400" @click="emit('journal', habit.id, date)">记录 / 时间线<span v-if="getJournalDates(journalDates, habit.id).includes(date)" class="ml-1.5 text-emerald-600 dark:text-emerald-400">· 有记录</span></button>
        </div>

        <!-- 触觉打卡按钮 -->
        <div class="flex items-center gap-2">
          <button
            :id="`today-habit-checkin-${date}-${habit.id}`"
            type="button"
            :aria-label="`${(habit.records[date] || 0) >= habit.targetPerDay ? '取消打卡' : '打卡'}：${habit.title}`"
            :aria-pressed="(habit.records[date] || 0) >= habit.targetPerDay"
            @click="store.toggleHabitDay(habit.id, date)"
            class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:scale-95"
            :class="(habit.records[date] || 0) >= habit.targetPerDay
              ? 'border-emerald-300/80 bg-emerald-50 text-emerald-600 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-slate-200/90 bg-transparent text-slate-300 hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400'"
            :title="(habit.records[date] || 0) >= habit.targetPerDay ? '点击取消打卡' : '点击完成打卡'"
          >
            <Check
              class="h-4 w-4"
              :class="(habit.records[date] || 0) >= habit.targetPerDay ? 'stroke-[2.5]' : 'stroke-[1.5]'"
            />
          </button>

          <!-- 管理习惯入口 -->
          <button
            :id="`today-habit-edit-${habit.id}`"
            type="button"
            :aria-label="`编辑习惯：${habit.title}`"
            @click="emit('edit', habit.id)"
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
        id="today-first-habit"
        type="button"
        @click="emit('new')"
        class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>设立第一个习惯</span>
      </button>
    </div>
  </section>

</template>
