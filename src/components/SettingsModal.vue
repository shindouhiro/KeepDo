<script setup lang="ts">
import { ref } from 'vue'
import { X, Download, Upload, RotateCcw, ShieldCheck, Settings } from '@lucide/vue'
import { useDataBackup } from '../composables/useDataBackup'

defineProps<{ isOpen: boolean }>()
defineEmits<{ (e: 'close'): void }>()

const fileInput = ref<HTMLInputElement | null>(null)
const { statusMessage, isError, busy, exporting, showLocalExport, handleExport, handleLocalExport, handleFileChange, handleReset } = useDataBackup()
function triggerImport() { if (!busy.value) fileInput.value?.click() }
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl transition-all dark:bg-[#121824] dark:border dark:border-slate-800" :aria-busy="busy">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Settings class="h-4 w-4" />
          </div>
          <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">设置与数据管理</h3>
        </div>
        <button
          id="settings-close-icon"
          :disabled="busy"
          aria-label="关闭设置"
          @click="$emit('close')"
          class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- 反馈消息 -->
      <div
        v-if="statusMessage"
        role="status"
        aria-live="polite"
        class="mt-3 rounded-2xl p-3 text-xs font-semibold transition-all"
        :class="isError ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'"
      >
        {{ statusMessage }}
      </div>

      <div class="mt-4 space-y-4">
        <!-- 隐私与存储说明 -->
        <div class="flex items-start gap-3 rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/50">
          <ShieldCheck class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div class="text-xs text-slate-600 dark:text-slate-300">
            <span class="font-bold text-slate-900 dark:text-white">账号独立 · 云端持久保存</span>
            <p class="mt-1 text-slate-500 dark:text-slate-400">
              数据保存到当前账号的云端数据库。完整备份需联网读取图文日记与图片；离线时请保留页面，可仅导出基础数据抢救未保存的修改。
            </p>
          </div>
        </div>

        <!-- 导出与导入 -->
        <div class="space-y-2">
          <button
            id="settings-export-data"
            :disabled="busy"
            @click="handleExport"
            class="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-98 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <div class="flex items-center gap-2.5">
              <Download class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>{{ exporting ? '正在生成完整备份…' : '导出全部数据 (JSON 备份)' }}</span>
            </div>
            <span class="text-[11px] font-normal text-slate-400">下载至本地</span>
          </button>
          <p class="px-1 text-[10px] leading-5 text-slate-400">包含目标、习惯、待办、分类、打卡记录，以及全部目标 / 习惯日记和图片原文件；不受时间线分页影响。</p>
          <button v-if="showLocalExport" id="settings-export-local-data" type="button" :disabled="busy" class="min-h-10 w-full rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-300" @click="handleLocalExport">仅导出页面基础数据（不含日记和图片）</button>

          <input
            id="settings-import-file"
            ref="fileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleFileChange"
          />

          <button
            id="settings-import-data"
            :disabled="busy"
            @click="triggerImport"
            class="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-98 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <div class="flex items-center gap-2.5">
              <Upload class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>从 JSON 备份恢复数据</span>
            </div>
            <span class="text-[11px] font-normal text-slate-400">选取文件</span>
          </button>
        </div>

        <!-- 重置示例数据 -->
        <div class="border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            id="settings-reset-sample"
            :disabled="busy"
            @click="handleReset"
            class="flex w-full items-center justify-between rounded-2xl border border-amber-200/70 bg-amber-50/50 p-3.5 text-xs font-bold text-amber-800 transition-all hover:bg-amber-100/60 active:scale-98 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
          >
            <div class="flex items-center gap-2.5">
              <RotateCcw class="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>载入精选示例数据</span>
            </div>
            <span class="text-[11px] font-normal opacity-70">重置体验</span>
          </button>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          id="settings-close-done"
          :disabled="busy"
          @click="$emit('close')"
          class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          完成
        </button>
      </div>
    </div>
  </div>
</template>
