<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { ImagePlus, LoaderCircle, X, PenLine, Trash2 } from '@lucide/vue'
import type { JournalEntry } from '../../../shared/journal'
import { JOURNAL_IMAGE_COUNT } from '../../../shared/journal'
import type { JournalDraft } from '../../composables/useJournal'
import { prepareJournalImage } from '../../lib/journal-images'
import { getPastedJournalImages } from '../../lib/journal-clipboard'
import { isJournalPreviewShortcut } from '../../lib/journal-shortcuts'
import JournalMarkdown from './JournalMarkdown.vue'

const props = defineProps<{ date: string; entry: JournalEntry | null; saving: boolean; error: string }>()
const emit = defineEmits<{ save: [draft: JournalDraft]; cancel: []; delete: [entry: JournalEntry]; dirty: [dirty: boolean] }>()
const content = ref(props.entry?.content || '')
const mode = shallowRef<'edit' | 'preview'>('edit')
const contentInput = useTemplateRef<HTMLTextAreaElement>('contentInput')
const previewRegion = useTemplateRef<HTMLElement>('previewRegion')
const existing = ref([...(props.entry?.images || [])])
const pending = ref<Array<{ id: string; file: File; url: string }>>([])
const processing = ref(false)
const fileError = ref('')
const id = props.entry?.id || crypto.randomUUID()
const operationId = ref(crypto.randomUUID())
const date = computed(() => props.entry?.date || props.date)
const dirty = computed(() => content.value !== (props.entry?.content || '') || pending.value.length > 0 || existing.value.length !== (props.entry?.images.length || 0))
const count = computed(() => existing.value.length + pending.value.length)
const canSave = computed(() => !processing.value && !props.saving && (content.value.trim().length > 0 || count.value > 0) && dirty.value)
watch([content, () => pending.value.length, () => existing.value.length], () => { operationId.value = crypto.randomUUID() })
watch(dirty, value => emit('dirty', value), { immediate: true })
let disposed = false
async function setMode(value: 'edit' | 'preview') {
  if (props.saving || processing.value) return
  mode.value = value
  await nextTick()
  if (disposed) return
  const target = value === 'edit' ? contentInput.value : previewRegion.value
  target?.focus({ preventScroll: true })
}
function handleShortcut(event: KeyboardEvent) {
  if (props.saving || processing.value || !isJournalPreviewShortcut(event)) return
  event.preventDefault()
  void setMode(mode.value === 'edit' ? 'preview' : 'edit')
}
function chooseImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  void addImages(files)
}
async function pasteImages(event: ClipboardEvent) {
  const files = getPastedJournalImages(event.clipboardData)
  if (!files.length) return
  event.preventDefault()
  if (props.saving || processing.value) return
  const target = event.target
  const text = event.clipboardData?.getData('text/plain') || ''
  // 图片处理会禁用输入框，先在光标处保留混合复制的文字，避免默认粘贴丢失。
  if (text && target instanceof HTMLTextAreaElement && !target.disabled && !target.readOnly) {
    const room = target.maxLength < 0 ? text.length : Math.max(0, target.maxLength - target.value.length + target.selectionEnd - target.selectionStart)
    target.setRangeText(text.slice(0, room), target.selectionStart, target.selectionEnd, 'end')
    content.value = target.value
  }
  await addImages(files)
  await nextTick()
  // 图片处理期间输入框会暂时禁用，完成后恢复焦点，便于继续书写。
  if (!disposed && target instanceof HTMLTextAreaElement && target.isConnected
    && (document.activeElement === document.body || document.activeElement === target)) target.focus({ preventScroll: true })
}
async function addImages(files: File[]) {
  if (!files.length || disposed || props.saving || processing.value) return
  fileError.value = ''
  if (files.length + count.value > JOURNAL_IMAGE_COUNT) { fileError.value = '每条记录最多 6 张图片，请移除部分图片后再添加'; return }
  processing.value = true
  try {
    for (const source of files) {
      const file = await prepareJournalImage(source)
      if (disposed) return
      pending.value.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })
    }
  } catch (cause) { if (!disposed) fileError.value = cause instanceof Error ? cause.message : '图片处理失败，请重新选择' }
  finally { if (!disposed) processing.value = false }
}
function removePending(id: string) {
  const item = pending.value.find(image => image.id === id)
  if (item) URL.revokeObjectURL(item.url)
  pending.value = pending.value.filter(image => image.id !== id)
}
function submit() {
  if (!canSave.value) return
  emit('save', { id, date: date.value, content: content.value.trim(), keepImageIds: existing.value.map(image => image.id), files: pending.value.map(image => image.file), version: props.entry?.version || 0, operationId: operationId.value })
}
onBeforeUnmount(() => { disposed = true; pending.value.forEach(image => URL.revokeObjectURL(image.url)) })
</script>

<template>
  <form id="journal-entry-form" class="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#141b28]" @submit.prevent="submit" @paste="pasteImages" @keydown="handleShortcut">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"><PenLine class="h-3.5 w-3.5 text-indigo-400" />{{ entry ? '编辑这条记录' : '记录这一天' }}</h3>
      <span class="text-[11px] tabular-nums text-slate-400">{{ date }}</span>
    </div>
    <fieldset :disabled="saving || processing" class="min-w-0 disabled:opacity-65">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="记录编辑模式" class="inline-flex gap-1 rounded-lg bg-slate-100/80 p-1 dark:bg-slate-950/50">
          <button id="journal-mode-edit" type="button" :aria-pressed="mode === 'edit'" aria-controls="journal-entry-content" aria-keyshortcuts="Control+E" title="切换编辑 / 预览（Ctrl + E）" class="min-h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 motion-reduce:transition-none" :class="mode === 'edit' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'" @click="setMode('edit')">编辑</button>
          <button id="journal-mode-preview" type="button" :aria-pressed="mode === 'preview'" aria-controls="journal-entry-preview" aria-keyshortcuts="Control+E" title="切换编辑 / 预览（Ctrl + E）" class="min-h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 motion-reduce:transition-none" :class="mode === 'preview' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'" @click="setMode('preview')">预览</button>
        </div>
        <span id="journal-markdown-hint" class="text-[10px] leading-5 text-slate-400">支持 Markdown · Ctrl + E 切换编辑 / 预览</span>
      </div>
      <label for="journal-entry-content" class="sr-only">当天的进展与详情</label>
      <textarea v-show="mode === 'edit'" id="journal-entry-content" ref="contentInput" v-model="content" autofocus rows="10" maxlength="5000" aria-describedby="journal-markdown-hint journal-image-hint" placeholder="今天做了什么？有什么收获、想法或值得记住的瞬间…&#10;&#10;试试 # 标题、**重点**、- 列表，点击「预览」查看排版。也可以直接粘贴图片。" class="min-h-[clamp(16rem,42dvh,32rem)] w-full resize-y rounded-xl border border-transparent bg-slate-50/70 px-3 py-2.5 text-sm leading-7 text-slate-700 placeholder:text-slate-400 focus:border-indigo-200 focus:outline-none dark:bg-slate-950/40 dark:text-slate-200 dark:focus:border-indigo-800"></textarea>
      <div v-if="mode === 'preview'" id="journal-entry-preview" ref="previewRegion" tabindex="-1" role="region" aria-label="记录 Markdown 预览" aria-describedby="journal-markdown-hint" class="min-h-[clamp(16rem,42dvh,32rem)] rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-3 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:border-slate-800 dark:bg-slate-950/30">
        <JournalMarkdown v-if="content.trim()" :content="content" :id-prefix="`journal-preview-${id}`" />
        <p v-else class="py-8 text-center text-xs leading-6 text-slate-400">还没有文字，切换到「编辑」写下第一行。<br>图片会展示在下方，也可以单独保存。</p>
      </div>
      <div v-if="count" class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="记录中的图片">
        <div v-for="image in existing" :key="image.id" class="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <img :src="image.url" alt="已保存的记录图片" class="h-full w-full object-cover" width="160" height="160" />
          <button :id="`journal-remove-existing-${image.id}`" type="button" aria-label="从记录中移除图片" class="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/65 text-white focus-visible:outline-2 focus-visible:outline-indigo-400" @click="existing = existing.filter(item => item.id !== image.id)"><X class="h-3 w-3" /></button>
        </div>
        <div v-for="image in pending" :key="image.id" class="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <img :src="image.url" alt="待上传的记录图片" class="h-full w-full object-cover" width="160" height="160" />
          <button :id="`journal-remove-pending-${image.id}`" type="button" aria-label="移除待上传图片" class="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/65 text-white focus-visible:outline-2 focus-visible:outline-indigo-400" @click="removePending(image.id)"><X class="h-3 w-3" /></button>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <label for="journal-image-input" class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 has-focus-visible:outline-2 has-focus-visible:outline-indigo-400 dark:text-slate-400 dark:hover:bg-slate-800" :class="count >= 6 ? 'pointer-events-none opacity-40' : ''">
            <ImagePlus class="h-4 w-4" />添加图片<span class="tabular-nums opacity-60">{{ count }}/6</span>
            <input id="journal-image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="count >= 6" class="sr-only" @change="chooseImages" />
          </label>
          <span id="journal-image-hint" class="ml-1 inline-block text-[10px] leading-5 text-slate-400">支持粘贴图片（⌘ / Ctrl + V）· 自动压缩 · JPG / PNG / WebP</span>
        </div>
        <span class="text-[10px] tabular-nums text-slate-400">{{ content.length }}/5000</span>
      </div>
    </fieldset>
    <p v-if="fileError || error" role="alert" class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{{ fileError || error }}</p>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <span class="text-[10px] text-slate-400" role="status">{{ processing ? '正在处理图片…' : saving ? '正在保存图文…' : dirty ? '草稿尚未保存' : '文字和图片都可以单独记录' }}</span>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="entry" id="journal-delete-editing" type="button" :disabled="saving || processing" aria-haspopup="dialog" class="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-400 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-950/30" @click="emit('delete', entry)"><Trash2 class="h-3.5 w-3.5" />删除记录</button>
        <button v-if="entry" id="journal-cancel-edit" type="button" :disabled="saving || processing" class="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="emit('cancel')">取消编辑</button>
        <button id="journal-save-entry" type="submit" :disabled="!canSave" class="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"><LoaderCircle v-if="saving || processing" class="h-3 w-3 animate-spin" />{{ entry ? '保存修改' : '保存记录' }}</button>
      </div>
    </div>
  </form>
</template>
