<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Copy, ExternalLink, Link2, X } from '@lucide/vue'
import type { JournalEntry } from '../../../shared/journal'
import type { ShareSelection } from '../../../shared/journal-share'
import { useJournalSharing } from '../../composables/useJournalSharing'
import { useNativeDialog } from '../../composables/useNativeDialog'
import { useConfirmDrawer } from '../../composables/useConfirmDrawer'
import ShareContent from './ShareContent.vue'
import { journalShareBlocks } from '../../lib/journal-share-blocks'

const props = defineProps<{ target: { entry: JournalEntry } | { date: string } | { manage: true } }>()
const emit = defineEmits<{ close: [] }>()
const sharing = useJournalSharing()
const confirm = useConfirmDrawer()
const mode = ref<'full' | 'block' | 'excerpt'>('full')
const entry = computed(() => 'entry' in props.target ? props.target.entry : null)
const blocks = computed(() => journalShareBlocks(entry.value?.content ?? ''))
const selectedBlockId = ref('')
const selectedBlock = computed(() => blocks.value.find(block => block.id === selectedBlockId.value))
const managing = computed(() => 'manage' in props.target)
const excerpt = ref(entry.value?.content ?? '')
const selection = computed<ShareSelection | null>(() => entry.value
  ? { scope: 'entry', entryId: entry.value.id, ...(mode.value === 'excerpt' ? { excerpt: excerpt.value.trim() } : mode.value === 'block' ? { excerpt: selectedBlock.value?.content ?? '' } : {}) }
  : 'date' in props.target ? { scope: 'day', date: props.target.date } : null)
const valid = computed(() => mode.value === 'block' ? Boolean(selectedBlock.value) : mode.value !== 'excerpt' || Boolean(excerpt.value.trim() && entry.value?.content.includes(excerpt.value.trim())))
const heading = computed(() => managing.value ? '管理分享' : entry.value ? '分享这条记录' : '分享当天全部记录')
watch(selection, sharing.resetPreview)

async function close() {
  if (sharing.busy.value) return
  if (!sharing.created.value && mode.value === 'excerpt' && excerpt.value !== entry.value?.content
    && !await confirm({ title: '放弃当前分享片段？', message: '片段尚未生成分享链接，关闭后需要重新选择。原记录不会改变。', confirmLabel: '放弃片段' })) return
  emit('close')
}
const { handleClose, handleBackdrop } = useNativeDialog('shareDialog', () => true, () => { void close() })
onMounted(() => { if (managing.value) void sharing.loadShares(); else if (selection.value) void sharing.loadPreview(selection.value) })
</script>

<template>
  <Teleport to="body">
    <dialog id="journal-share-dialog" ref="shareDialog" aria-labelledby="journal-share-heading" class="app-drawer drawer-lg bg-white p-0 text-slate-800 dark:bg-[#121824] dark:text-slate-100" @close="handleClose" @cancel.prevent="close" @click="handleBackdrop">
      <div class="flex h-full min-h-0 flex-col">
        <header class="drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 dark:border-slate-800">
          <div><p class="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-500"><Link2 class="h-4 w-4" />KeepDo · 链接分享</p><h2 id="journal-share-heading" class="text-lg font-bold">{{ heading }}</h2></div>
          <button id="journal-share-close" class="drawer-close" type="button" aria-label="关闭分享" :disabled="sharing.busy.value" @click="close"><X class="h-4 w-4" /></button>
        </header>
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <p class="rounded-xl bg-indigo-50 p-4 text-xs leading-6 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">持有链接的人无需登录即可查看。分享保留生成时的文字和图片，之后修改或删除原记录不会更新链接；可在“管理分享”中撤销。</p>
          <template v-if="managing">
            <button id="journal-share-list-refresh" type="button" class="share-secondary" :disabled="sharing.busy.value" @click="sharing.loadShares">刷新分享列表</button>
            <p v-if="sharing.loaded.value && !sharing.shares.value.length" class="py-8 text-center text-sm text-slate-500">还没有分享链接</p>
            <article v-for="share in sharing.shares.value" :key="share.token" class="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 class="text-sm font-semibold">{{ share.title }}</h3>
              <p class="text-xs text-slate-500">{{ new Date(share.createdAt).toLocaleString('zh-CN') }}</p>
              <label :for="`share-url-${share.token}`" class="sr-only">分享链接</label>
              <input :id="`share-url-${share.token}`" :value="share.url" readonly class="share-input" @focus="($event.target as HTMLInputElement).select()" />
              <div class="flex flex-wrap gap-2">
                <button :id="`share-copy-${share.token}`" type="button" class="share-secondary" :disabled="sharing.busy.value" @click="sharing.copy(share.url)">复制链接</button>
                <a :id="`share-open-${share.token}`" :href="share.url" target="_blank" rel="noopener noreferrer" class="share-secondary">打开分享</a>
                <button :id="`share-revoke-${share.token}`" type="button" class="share-secondary text-rose-600 dark:text-rose-400" :disabled="sharing.busy.value" @click="sharing.revoke(share)">撤销分享</button>
              </div>
            </article>
          </template>
          <template v-else>
            <fieldset v-if="entry && !sharing.created.value" :disabled="sharing.busy.value" class="space-y-3">
              <legend class="mb-3 text-sm font-semibold">分享范围</legend>
              <div class="flex flex-wrap gap-4 text-sm">
                <label for="share-mode-full" class="flex min-h-10 items-center gap-2"><input id="share-mode-full" v-model="mode" type="radio" value="full" name="share-mode" class="accent-indigo-600" />完整记录（含图片）</label>
                <label for="share-mode-block" class="flex min-h-10 items-center gap-2"><input id="share-mode-block" v-model="mode" type="radio" value="block" name="share-mode" :disabled="!blocks.length" class="accent-indigo-600" />选择内容块</label>
                <label for="share-mode-excerpt" class="flex min-h-10 items-center gap-2"><input id="share-mode-excerpt" v-model="mode" type="radio" value="excerpt" name="share-mode" :disabled="!entry.content.trim()" class="accent-indigo-600" />自定义文字片段</label>
              </div>
              <div v-if="mode === 'block'" class="space-y-2">
                <p class="text-xs leading-6 text-slate-500">选择要分享的章节或段落，仅包含选中块的正文，不包含附件图片。生成链接前可预览。</p>
                <label v-for="block in blocks" :key="block.id" :for="`share-${block.id}`" class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors motion-reduce:transition-none" :class="selectedBlockId === block.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'">
                  <input :id="`share-${block.id}`" v-model="selectedBlockId" type="radio" name="share-block" :value="block.id" class="mt-1 accent-indigo-600" />
                  <span class="min-w-0"><span class="block break-words text-sm font-semibold">{{ block.title }}</span><span class="mt-1 block line-clamp-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{{ block.content.slice(0, 180) }}</span></span>
                </label>
              </div>
              <template v-if="mode === 'excerpt'">
                <label for="share-excerpt" class="block text-xs leading-6 text-slate-500">删除不想分享的前后文字，保留原文中连续的一段。此模式不包含附件图片，也不会修改原记录。</label>
                <textarea id="share-excerpt" v-model="excerpt" rows="8" maxlength="5000" class="share-input resize-y leading-7" />
                <p v-if="!valid" role="alert" class="text-xs text-amber-700 dark:text-amber-300">请保留原文中非空、连续的一段文字。</p>
              </template>
            </fieldset>
            <p v-if="selection?.scope === 'day'" class="text-sm leading-7 text-slate-600 dark:text-slate-300">{{ selection.date }} 的全部目标、习惯和随记记录，包含尚未加载的分页内容，不受当前列表筛选限制。</p>
            <section v-if="sharing.created.value" aria-labelledby="share-success-heading" class="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h3 id="share-success-heading" class="font-semibold text-emerald-800 dark:text-emerald-200">链接已生成</h3>
              <label for="share-created-url" class="sr-only">已生成的分享链接</label>
              <input id="share-created-url" :value="sharing.created.value.url" readonly class="share-input" @focus="($event.target as HTMLInputElement).select()" />
              <div class="flex flex-wrap gap-2">
                <button id="share-copy-created" type="button" class="share-primary" :disabled="sharing.busy.value" @click="sharing.copy(sharing.created.value.url)"><Copy class="h-4 w-4" />复制链接</button>
                <a id="share-open-created" :href="sharing.created.value.url" target="_blank" rel="noopener noreferrer" class="share-secondary"><ExternalLink class="h-4 w-4" />打开分享页</a>
              </div>
            </section>
            <div v-if="sharing.preview.value" class="space-y-3">
              <h3 class="text-sm font-semibold">{{ sharing.created.value ? '已分享的内容' : '分享内容预览' }} · {{ sharing.preview.value.snapshot.records.length }} 条</h3>
              <ShareContent :snapshot="sharing.preview.value.snapshot" id-prefix="share-preview" />
            </div>
          </template>
        </div>
        <footer class="shrink-0 space-y-3 border-t border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-[#121824]">
          <p v-if="sharing.error.value" role="alert" class="text-xs leading-6 text-amber-700 dark:text-amber-300">{{ sharing.error.value }}</p>
          <p v-if="sharing.notice.value || sharing.busy.value" role="status" class="text-xs leading-6 text-indigo-600 dark:text-indigo-300">{{ sharing.busy.value ? '正在处理，请稍候…' : sharing.notice.value }}</p>
          <div v-if="!managing && !sharing.created.value" class="flex flex-wrap justify-end gap-3">
            <button id="share-preview-button" type="button" class="share-secondary" :disabled="!valid || sharing.busy.value" @click="selection && sharing.loadPreview(selection)">{{ sharing.preview.value ? '重新预览' : '预览分享内容' }}</button>
            <button id="share-create-button" type="button" class="share-primary" :disabled="!sharing.preview.value || !valid || sharing.busy.value" @click="selection && sharing.create(selection)"><Link2 class="h-4 w-4" />生成分享链接</button>
          </div>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.share-input { @apply w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900; }
.share-primary { @apply inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40; }
.share-secondary { @apply inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800; }
</style>
