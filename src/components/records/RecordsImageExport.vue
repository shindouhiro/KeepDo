<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { Download, ImageDown, LoaderCircle, X } from '@lucide/vue'
import type { JournalFeedFilter } from '../../../shared/journal-feed'
import { useRecordsImageExport } from '../../composables/useRecordsImageExport'
import { useNativeDialog } from '../../composables/useNativeDialog'
import { RECORD_EXPORT_WIDTH } from '../../../shared/record-image-export'
import RecordsExportSheet from './RecordsExportSheet.vue'

const props = defineProps<{
  filter: JournalFeedFilter
  summary: string
  titles: Map<string, string>
  disabled: boolean
}>()
const viewport = useTemplateRef<HTMLElement>('viewport')
const sheet = useTemplateRef<HTMLElement>('sheet')
const snapshot = shallowRef({ filter: props.filter, summary: props.summary, titles: props.titles })
const exporter = useRecordsImageExport(() => viewport.value, () => sheet.value)
const isOpen = computed(() => exporter.opened.value)
const { handleClose, handleBackdrop } = useNativeDialog('exportDialog', () => isOpen.value, exporter.close)

function generate() {
  snapshot.value = { filter: { ...props.filter }, summary: props.summary, titles: new Map(props.titles) }
  void exporter.generate(snapshot.value.filter)
}
</script>

<template>
  <button id="records-export-image" type="button" :disabled="disabled || exporter.busy.value" aria-haspopup="dialog" aria-controls="records-export-dialog" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40 motion-reduce:transition-none" @click="generate"><ImageDown class="h-4 w-4" />保存为图片</button>

  <Teleport to="body">
    <dialog id="records-export-dialog" ref="exportDialog" aria-labelledby="records-export-heading" aria-describedby="records-export-description" class="app-drawer drawer-lg overflow-hidden bg-white p-0 text-slate-800 dark:bg-[#121824] dark:text-slate-100" @close="handleClose" @click="handleBackdrop">
      <div class="flex h-full min-h-0 flex-col">
        <header class="drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 dark:border-slate-800">
          <div>
            <h2 id="records-export-heading" class="text-lg font-bold">保存记录图片</h2>
            <p id="records-export-description" class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">将全部筛选记录、照片与正文保存为一张完整长图。内容较长时自动调整图片尺寸。</p>
          </div>
          <button id="records-export-close" type="button" :aria-label="exporter.busy.value ? '取消生成并关闭' : '关闭图片预览'" class="drawer-close" @click="exporter.close"><X class="h-4 w-4" /></button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <p class="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-6 break-words text-slate-500 dark:bg-slate-900 dark:text-slate-400">{{ snapshot.summary }}</p>
          <div v-if="exporter.busy.value" class="py-12 text-center" role="status" aria-live="polite">
            <LoaderCircle class="mx-auto h-7 w-7 animate-spin text-indigo-500 motion-reduce:animate-none" />
            <p class="mt-4 text-sm">{{ exporter.progress.value }}</p>
            <button id="records-export-cancel" type="button" class="mt-5 min-h-10 rounded-xl border border-slate-200 px-5 text-xs text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800" @click="exporter.close">取消生成</button>
          </div>
          <div v-else-if="exporter.error.value" class="mt-5 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30">
            <p role="alert" class="text-sm leading-6 text-amber-800 dark:text-amber-300">{{ exporter.error.value }}</p>
            <button id="records-export-retry" type="button" class="mt-3 min-h-10 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500" @click="exporter.generate(snapshot.filter)">重新生成</button>
          </div>
          <div v-else-if="exporter.image.value" class="mt-5 space-y-5">
            <p role="status" class="text-xs text-emerald-700 dark:text-emerald-400">{{ exporter.progress.value }}</p>
            <p class="text-xs leading-6 text-slate-500 dark:text-slate-400">点击下载 PNG 保存到设备，手机端也可以长按预览图片保存。</p>
            <figure class="space-y-3">
              <a id="records-export-download" :href="exporter.image.value.url" :download="exporter.image.value.filename" class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"><Download class="h-4 w-4" />下载完整 PNG 长图</a>
              <div id="records-export-preview" tabindex="0" role="region" aria-label="完整记录长图预览，可滚动查看全部内容" class="max-h-[55dvh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900">
                <img :src="exporter.image.value.url" alt="包含全部筛选记录的完整长图" class="block h-auto w-full" />
              </div>
            </figure>
          </div>
        </div>
      </div>
    </dialog>
    <div v-if="exporter.entries.value.length" inert aria-hidden="true" class="pointer-events-none fixed top-0 left-[-10000px]" :style="{ width: `${RECORD_EXPORT_WIDTH}px` }">
      <div ref="viewport" class="overflow-hidden" :style="{ width: `${RECORD_EXPORT_WIDTH}px` }">
        <div ref="sheet">
          <RecordsExportSheet :entries="exporter.entries.value" :summary="snapshot.summary" :titles="snapshot.titles" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
