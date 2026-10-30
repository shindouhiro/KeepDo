<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { getDailyActionSummary } from '../../shared/calendar'

withDefaults(defineProps<{ summary: ReturnType<typeof getDailyActionSummary>; compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="inline-flex items-center gap-1.5" :class="summary.state === 'completed' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'">
    <span class="relative inline-flex shrink-0 items-center justify-center" :class="compact ? 'h-5 w-5' : 'h-9 w-9'" aria-hidden="true">
      <svg viewBox="0 0 36 36" class="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" class="opacity-15" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" pathLength="100" :stroke-dasharray="`${summary.percent} 100`" stroke-linecap="round" class="text-emerald-500 transition-all duration-300 motion-reduce:transition-none" />
      </svg>
      <Check v-if="summary.state === 'completed'" class="absolute h-3 w-3" />
      <span v-else-if="!compact" class="absolute text-[9px] font-bold">{{ summary.percent }}%</span>
    </span>
    <span :class="compact ? 'text-[10px]' : 'text-xs font-semibold'">{{ summary.total ? `${summary.completed}/${summary.total}${summary.state === 'completed' ? ' 全达成' : ' 已完成'}` : '未安排' }}</span>
  </span>
</template>
