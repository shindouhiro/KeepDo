<script setup lang="ts">
import { PenLine, X } from '@lucide/vue'
import { useNativeDialog } from '../../composables/useNativeDialog'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ keep: []; discard: [] }>()
const { handleClose, handleBackdrop } = useNativeDialog('journalDiscardDialog', () => props.open, () => emit('keep'))
</script>
<template>
  <dialog id="journal-discard-dialog" ref="journalDiscardDialog" aria-labelledby="journal-discard-heading" aria-describedby="journal-discard-description" class="app-drawer drawer-sm overflow-hidden bg-white p-0 text-slate-900 dark:bg-[#18202e] dark:text-slate-100" @close="handleClose" @cancel.prevent="emit('keep')" @click="handleBackdrop">
    <div class="flex h-full min-h-0 flex-col">
      <header class="drawer-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <h2 id="journal-discard-heading" class="flex items-center gap-2 text-base font-semibold"><PenLine class="h-5 w-5 shrink-0 text-indigo-400" />还有一段记录没有保存</h2>
        <button id="journal-discard-close" type="button" aria-label="继续编辑并关闭确认" class="drawer-close" @click="emit('keep')"><X class="h-5 w-5" /></button>
      </header>
      <p id="journal-discard-description" class="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-8 text-slate-500 dark:text-slate-400">继续编辑可以保留当前文字和图片。放弃后，这份草稿将不会保存。</p>
      <footer class="drawer-footer flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-5 dark:border-slate-800">
        <button id="journal-discard-draft" type="button" class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:hover:bg-slate-700" @click="emit('discard')">放弃草稿</button>
        <button id="journal-keep-draft" type="button" autofocus class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400" @click="emit('keep')">继续编辑</button>
      </footer>
    </div>
  </dialog>
</template>
