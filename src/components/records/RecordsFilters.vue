<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { JournalFeedFilter } from '../../../shared/journal-feed'
import type { DateRangePreset } from '../../utils/date'
import { dateRangePresets, getDateRangePreset, getTodayString } from '../../utils/date'

const props = defineProps<{
  filter: JournalFeedFilter
  subjects: Array<{ id: string; title: string }>
}>()
const emit = defineEmits<{ update: [value: JournalFeedFilter] }>()
const types = [
  { value: 'all', label: '全部' }, { value: 'goal', label: '目标' }, { value: 'habit', label: '习惯' },
] as const

const preferredPreset = shallowRef<DateRangePreset | null>(null)
const activePreset = computed(() => {
  const today = getTodayString()
  const matches = (preset: DateRangePreset) => {
    const range = getDateRangePreset(preset, today)
    return range.from === props.filter.from && range.to === props.filter.to
  }
  // 月初等日期范围重合时，保留用户刚刚点击的选项。
  if (preferredPreset.value && matches(preferredPreset.value)) return preferredPreset.value
  return dateRangePresets.find(preset => matches(preset.value))?.value ?? null
})

function selectDateRange(preset: DateRangePreset) {
  preferredPreset.value = preset
  update(getDateRangePreset(preset))
}

function update(patch: Partial<JournalFeedFilter>) {
  emit('update', { ...props.filter, ...patch })
}
</script>

<template>
  <div class="mt-5 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="记录类型" class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        <button v-for="item in types" :id="`records-filter-${item.value}`" :key="item.value" type="button" :aria-pressed="filter.type === item.value" class="min-h-9 rounded-lg px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 motion-reduce:transition-none" :class="filter.type === item.value ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'" @click="update({ type: item.value, subjectId: '' })">{{ item.label }}</button>
      </div>
      <button v-if="filter.type !== 'all' || filter.from || filter.to" id="records-filter-reset" type="button" class="min-h-9 rounded-lg px-2 text-xs text-slate-500 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400" @click="update({ type: 'all', subjectId: '', from: '', to: '' })">重置筛选</button>
    </div>
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span id="records-date-presets-label">快捷日期</span>
        <span v-if="!activePreset" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">自定义</span>
      </div>
      <div role="group" aria-labelledby="records-date-presets-label" class="flex flex-wrap gap-2">
        <button v-for="preset in dateRangePresets" :id="`records-date-preset-${preset.value}`" :key="preset.value" type="button" :aria-pressed="activePreset === preset.value" class="min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 motion-reduce:transition-none" :class="activePreset === preset.value ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:text-indigo-300'" @click="selectDateRange(preset.value)">{{ preset.label }}</button>
      </div>
      <p class="text-[10px] leading-5 text-slate-400">最近 7 / 30 天包含今天；本周从周一、本月从 1 日算至今天。</p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2" :class="filter.type !== 'all' ? 'lg:grid-cols-3' : ''">
      <label v-if="filter.type !== 'all'" class="min-w-0 space-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400" for="records-filter-subject">
        <span>具体{{ filter.type === 'goal' ? '目标' : '习惯' }}</span>
        <select id="records-filter-subject" :value="filter.subjectId" class="block min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" @change="update({ subjectId: ($event.target as HTMLSelectElement).value })">
          <option value="">全部{{ filter.type === 'goal' ? '目标' : '习惯' }}</option>
          <option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.title }}</option>
        </select>
      </label>
      <label for="records-filter-from" class="min-w-0 space-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>开始日期</span>
        <input id="records-filter-from" type="date" :value="filter.from" :max="filter.to || undefined" class="block min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" @change="update({ from: ($event.target as HTMLInputElement).value })" />
      </label>
      <label for="records-filter-to" class="min-w-0 space-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>结束日期</span>
        <input id="records-filter-to" type="date" :value="filter.to" :min="filter.from || undefined" class="block min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" @change="update({ to: ($event.target as HTMLInputElement).value })" />
      </label>
    </div>
  </div>
</template>
