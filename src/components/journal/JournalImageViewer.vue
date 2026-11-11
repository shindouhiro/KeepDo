<script setup lang="ts">
import { X } from '@lucide/vue'
import type { JournalImage } from '../../../shared/journal'
import { useNativeDialog } from '../../composables/useNativeDialog'
const props = defineProps<{ image: JournalImage | null }>()
const emit = defineEmits<{ close: [] }>()
const { handleClose, handleBackdrop } = useNativeDialog('journalImageViewer', () => Boolean(props.image), () => emit('close'))
</script>
<template>
  <dialog id="journal-image-viewer" ref="journalImageViewer" aria-labelledby="journal-image-heading" class="app-drawer drawer-xl overflow-hidden bg-[#101722] p-0 text-white" @close="handleClose" @click="handleBackdrop">
    <div class="flex h-full min-h-0 flex-col">
      <header class="drawer-header flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4"><h2 id="journal-image-heading" class="text-base font-semibold">图文记录大图</h2><button id="journal-image-close" type="button" aria-label="关闭大图" class="drawer-close" @click="emit('close')"><X class="h-5 w-5" /></button></header>
      <div class="min-h-0 flex-1 overflow-auto p-4"><img v-if="image" :src="image.url" alt="图文记录大图" class="h-full w-full rounded-xl object-contain" /></div>
    </div>
  </dialog>
</template>
