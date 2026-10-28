<script setup lang="ts">
import { useKeepDoStore } from '../stores/keepdo'
import {
  Target,
  BarChart3,
  ListTodo,
  BookOpen,
  Moon,
  Sun,
  Settings,
  Sparkles
} from '@lucide/vue'

const store = useKeepDoStore()

defineEmits<{
  (e: 'open-settings'): void
}>()
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl transition-colors dark:border-slate-800/80 dark:bg-[#0B0F17]/80">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
      <!-- 品牌 Logo -->
      <div class="flex shrink-0 items-center gap-3">
        <div class="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20 transition-transform hover:scale-105">
          <Target class="h-5 w-5" />
          <div class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0B0F17]"></div>
        </div>

        <div>
          <div class="flex items-center gap-2">
            <span class="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              KeepDo
            </span>
            <span class="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              PRO
            </span>
          </div>
          <p class="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
            行于微末 · 成于浩瀚
          </p>
        </div>
      </div>

      <!-- 居中选项卡导航 (Segmented Control) -->
      <nav aria-label="主导航" class="order-3 grid w-full grid-cols-4 items-center rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60 lg:order-none lg:flex lg:w-auto dark:bg-slate-900/90 dark:ring-slate-800">
        <button
          id="nav-today"
          type="button"
          :aria-current="store.activeTab === 'today' ? 'page' : undefined"
          @click="store.activeTab = 'today'"
          class="relative flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm lg:flex-none"
          :class="store.activeTab === 'today'
            ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200/60 dark:bg-slate-800 dark:text-white dark:shadow-none'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
        >
          <ListTodo class="hidden h-4 w-4 shrink-0 sm:block" />
          <span>今日专注</span>
          <span
            v-if="store.dailyActionSummary.state === 'completed'"
            class="flex h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-900"
          ></span>
        </button>

        <button
          id="nav-goals"
          type="button"
          :aria-current="store.activeTab === 'goals' ? 'page' : undefined"
          @click="store.activeTab = 'goals'"
          class="relative flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm lg:flex-none"
          :class="store.activeTab === 'goals'
            ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200/60 dark:bg-slate-800 dark:text-white dark:shadow-none'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
        >
          <Target class="hidden h-4 w-4 shrink-0 sm:block" />
          <span>长期目标</span>
          <span class="hidden rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 sm:inline-flex dark:bg-slate-700 dark:text-slate-300">
            {{ store.goals.length }}
          </span>
        </button>

        <button
          id="nav-records"
          type="button"
          :aria-current="store.activeTab === 'records' ? 'page' : undefined"
          @click="store.activeTab = 'records'"
          class="relative flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm lg:flex-none"
          :class="store.activeTab === 'records'
            ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200/60 dark:bg-slate-800 dark:text-white dark:shadow-none'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
        >
          <BookOpen class="hidden h-4 w-4 shrink-0 sm:block" />
          <span>记录</span>
        </button>

        <button
          id="nav-stats"
          type="button"
          :aria-current="store.activeTab === 'stats' ? 'page' : undefined"
          @click="store.activeTab = 'stats'"
          class="relative flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm lg:flex-none"
          :class="store.activeTab === 'stats'
            ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200/60 dark:bg-slate-800 dark:text-white dark:shadow-none'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
        >
          <BarChart3 class="hidden h-4 w-4 shrink-0 sm:block" />
          <span>统计复盘</span>
        </button>
      </nav>

      <!-- 右侧快捷操作与主题 -->
      <div class="flex items-center gap-2">
        <!-- 今日完成度胶囊 -->
        <div class="hidden items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-xs font-medium text-slate-600 lg:flex dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <Sparkles class="h-3.5 w-3.5 text-amber-500" />
          <span>{{ store.dailyActionSummary.total ? `当日 ${store.todayProgress}%` : '当日未安排' }}</span>
        </div>

        <button
          id="nav-toggle-theme"
          @click="store.toggleDarkMode"
          title="切换深浅主题"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Sun v-if="store.isDarkMode" class="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
          <Moon v-else class="h-4 w-4 transition-transform rotate-0 hover:-rotate-12" />
        </button>

        <button
          id="nav-open-settings"
          @click="$emit('open-settings')"
          title="设置与数据备份"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Settings class="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
</template>
