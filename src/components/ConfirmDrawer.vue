<script setup lang="ts">
import { ShieldAlert, X } from '@lucide/vue'
import type { ConfirmationOptions } from '../lib/confirmation-queue'
import { useNativeDialog } from '../composables/useNativeDialog'

const props = defineProps<{ pending: ConfirmationOptions | null }>()
const emit = defineEmits<{ settle: [accepted: boolean] }>()
function cancel() { emit('settle', false) }
const { handleClose, handleBackdrop } = useNativeDialog('confirmDrawer', () => Boolean(props.pending), cancel)
</script>

<template>
  <dialog id="app-confirm-drawer" ref="confirmDrawer" class="app-drawer drawer-sm overflow-hidden bg-white p-0 text-slate-900 dark:bg-[#121824] dark:text-slate-100" aria-labelledby="app-confirm-heading" aria-describedby="app-confirm-message" @close="handleClose" @cancel.prevent="cancel" @click="handleBackdrop">
    <div v-if="pending" class="flex h-full min-h-0 flex-col">
      <header class="drawer-header flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <h2 id="app-confirm-heading" class="flex min-w-0 items-center gap-2 text-base font-bold"><ShieldAlert class="h-5 w-5 shrink-0 text-amber-500" />{{ pending.title }}</h2>
        <button id="app-confirm-close" type="button" aria-label="关闭确认抽屉" class="drawer-close" @click="cancel"><X class="h-5 w-5" /></button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <p id="app-confirm-message" class="whitespace-pre-wrap text-sm leading-8 break-words text-slate-600 dark:text-slate-300">{{ pending.message }}</p>
      </div>
      <footer class="drawer-footer flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-5 dark:border-slate-800">
        <button id="app-confirm-cancel" type="button" autofocus class="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" @click="cancel">取消</button>
        <button id="app-confirm-accept" type="button" class="min-h-11 rounded-xl px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" :class="pending.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'" @click="emit('settle', true)">{{ pending.confirmLabel || '确认继续' }}</button>
      </footer>
    </div>
  </dialog>
</template>
