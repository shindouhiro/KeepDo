<script setup lang="ts">
import { PenLine } from '@lucide/vue'
import { useNativeDialog } from '../../composables/useNativeDialog'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ keep: []; discard: [] }>()
const { handleClose } = useNativeDialog('journalDiscardDialog', () => props.open, () => emit('keep'))
</script>
<template>
  <dialog id="journal-discard-dialog" ref="journalDiscardDialog" aria-labelledby="journal-discard-heading" class="fixed inset-0 m-auto w-[calc(100%-3rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#18202e] dark:text-slate-100" @close="handleClose" @cancel.prevent="emit('keep')">
    <PenLine class="mb-3 h-5 w-5 text-indigo-400" />
    <h3 id="journal-discard-heading" class="text-sm font-semibold">还有一段记录没有保存</h3>
    <p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">继续编辑可以保留当前文字和图片。放弃后，这份草稿将不会保存。</p>
    <div class="mt-5 flex justify-end gap-2">
      <button id="journal-discard-draft" type="button" class="rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:hover:bg-slate-700" @click="emit('discard')">放弃草稿</button>
      <button id="journal-keep-draft" type="button" autofocus class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400" @click="emit('keep')">继续编辑</button>
    </div>
  </dialog>
</template>
<style scoped>
dialog::backdrop { background: rgb(8 15 28 / 45%); backdrop-filter: blur(3px); }
</style>
