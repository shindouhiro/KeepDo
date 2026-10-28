<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { getTodayString } from '../utils/date'

const props = defineProps<{ id: string; date: string; title: string; checked: boolean; iconOnly?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const isFuture = computed(() => props.date > getTodayString())
const label = computed(() => isFuture.value ? '未到日期' : props.checked ? '已打卡' : '打卡')
const action = computed(() => isFuture.value ? '未来日期暂不能打卡' : props.checked ? '取消打卡' : '打卡')
</script>

<template>
  <button
    :id="id"
    type="button"
    :disabled="isFuture"
    :aria-pressed="checked"
    :aria-label="`${date}，${action}：${title}`"
    :title="isFuture ? '可以在当天或过去的日期打卡' : checked ? '点击撤销当天打卡' : '标记这一天已为目标行动'"
    class="group/checkin inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md text-[10px] font-medium transition-colors duration-150 hover:bg-black/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 dark:hover:bg-white/5 motion-reduce:transition-none"
    :class="[iconOnly ? 'w-7' : 'px-1.5', checked ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400']"
    @click="emit('toggle')"
  >
    <span class="flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors" :class="checked ? 'border-emerald-500/80 bg-emerald-500 text-white shadow-[0_1px_3px_rgba(16,185,129,0.18)] dark:border-emerald-400/70 dark:bg-emerald-500/90' : 'border-slate-400/45 bg-white/50 group-hover/checkin:border-indigo-400 dark:border-slate-500/60 dark:bg-slate-900/30 dark:group-hover/checkin:border-indigo-400'">
      <Check class="h-2.5 w-2.5 stroke-[2.5] transition-opacity" :class="checked ? 'opacity-100' : 'text-indigo-500 opacity-0 group-hover/checkin:opacity-60 group-focus-visible/checkin:opacity-60'" />
    </span>
    <span :class="iconOnly ? 'sr-only' : ''">{{ label }}</span>
  </button>
</template>
