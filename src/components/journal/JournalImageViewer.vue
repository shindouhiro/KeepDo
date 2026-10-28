<script setup lang="ts">
import { X } from '@lucide/vue'
import type { JournalImage } from '../../../shared/journal'
import { useNativeDialog } from '../../composables/useNativeDialog'
const props = defineProps<{ image: JournalImage | null }>()
const emit = defineEmits<{ close: [] }>()
const { handleClose, handleBackdrop } = useNativeDialog('journalImageViewer', () => Boolean(props.image), () => emit('close'))
</script>
<template>
  <dialog id="journal-image-viewer" ref="journalImageViewer" aria-label="图文记录大图" class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-4xl rounded-2xl border border-slate-700 bg-[#101722] p-3 text-white shadow-2xl" @close="handleClose" @click="handleBackdrop">
    <div class="mb-2 flex justify-end"><button id="journal-image-close" type="button" aria-label="关闭大图" class="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-400" @click="emit('close')"><X class="h-4 w-4" /></button></div>
    <img v-if="image" :src="image.url" alt="图文记录大图" class="max-h-[75dvh] w-full rounded-xl object-contain" />
  </dialog>
</template>
<style scoped>
dialog::backdrop { background: rgb(0 0 0 / 75%); backdrop-filter: blur(8px); }
</style>
