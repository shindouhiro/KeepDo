<script setup lang="ts">
import { X } from '@lucide/vue'
import { platformNotice } from '../lib/platform'
import { useNativeLifecycle } from '../composables/useNativeLifecycle'

useNativeLifecycle()
</script>

<template>
  <div v-if="platformNotice" role="alert" class="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[100] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 shadow-lg dark:border-amber-900 dark:bg-slate-900 dark:text-amber-200">
    <p class="min-w-0 flex-1 break-words">{{ platformNotice }}</p>
    <button id="native-notice-dismiss" type="button" aria-label="关闭系统提示" class="flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-slate-800" @click="platformNotice = ''"><X class="h-4 w-4" /></button>
  </div>
</template>
