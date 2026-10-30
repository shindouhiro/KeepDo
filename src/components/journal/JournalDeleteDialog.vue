<script setup lang="ts">
import { LoaderCircle, Trash2 } from '@lucide/vue'
import type { JournalEntry } from '../../../shared/journal'
import { useNativeDialog } from '../../composables/useNativeDialog'

const props = defineProps<{ entry: JournalEntry; deleting: boolean; error: string }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
function cancel() { if (!props.deleting) emit('cancel') }
const { handleClose } = useNativeDialog('deleteDialog', () => true, cancel)
</script>

<template>
  <dialog id="journal-delete-dialog" ref="deleteDialog" aria-labelledby="journal-delete-heading" aria-describedby="journal-delete-description" :aria-busy="deleting" class="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-3rem)] max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#18202e] dark:text-slate-100" @close="handleClose" @cancel.prevent="cancel">
    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"><Trash2 class="h-5 w-5" /></div>
    <h3 id="journal-delete-heading" class="text-sm font-semibold">确定删除这条记录？</h3>
    <div class="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p class="text-[11px] tabular-nums text-slate-400">{{ entry.date }} · {{ entry.subjectType === 'goal' ? '目标' : '习惯' }}记录<span v-if="entry.images.length"> · {{ entry.images.length }} 张图片</span></p>
      <p class="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 dark:text-slate-300">{{ entry.content || '这是一条图片记录' }}</p>
    </div>
    <p id="journal-delete-description" class="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">删除后，记录中的文字和图片将一并移除，且无法恢复。目标、习惯及打卡状态不受影响。</p>
    <p v-if="error" role="alert" class="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{{ error }}</p>
    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button id="journal-delete-cancel" type="button" autofocus :disabled="deleting" class="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700" @click="cancel">保留记录</button>
      <button id="journal-delete-confirm" type="button" :disabled="deleting" class="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-medium text-white transition hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-wait disabled:opacity-50" @click="emit('confirm')"><LoaderCircle v-if="deleting" class="h-3.5 w-3.5 animate-spin" />{{ deleting ? '正在删除…' : '确认删除' }}</button>
    </div>
  </dialog>
</template>

<style scoped>
dialog::backdrop { background: rgb(8 15 28 / 55%); backdrop-filter: blur(3px); }
</style>
