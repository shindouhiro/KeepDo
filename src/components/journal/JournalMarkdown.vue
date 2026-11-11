<script setup lang="ts">
import { computed } from 'vue'
import { renderJournalMarkdown } from '../../lib/journal-markdown'

const props = defineProps<{ content: string; idPrefix: string }>()
const html = computed(() => renderJournalMarkdown(props.content, props.idPrefix))
</script>

<template>
  <!-- HTML 已由关闭原始 HTML 的 Markdown 解析器生成，禁止直接传入用户 HTML。 -->
  <div class="journal-markdown min-w-0 text-sm leading-7 text-slate-600 dark:text-slate-300" v-html="html"></div>
</template>

<style scoped>
@reference "../../style.css";

.journal-markdown {
  overflow-wrap: anywhere;
}
.journal-markdown :deep(p),
.journal-markdown :deep(ul),
.journal-markdown :deep(ol),
.journal-markdown :deep(blockquote),
.journal-markdown :deep(pre),
.journal-markdown :deep(.journal-markdown-table) {
  margin-block: 0.75rem;
}
.journal-markdown :deep(h1),
.journal-markdown :deep(h2),
.journal-markdown :deep(h3),
.journal-markdown :deep(h4),
.journal-markdown :deep(h5),
.journal-markdown :deep(h6) {
  margin-block: 1.25rem 0.5rem;
  font-weight: 700;
  line-height: 1.5;
  @apply text-slate-800 dark:text-slate-100;
}
.journal-markdown :deep(h1) { font-size: 1.5rem; }
.journal-markdown :deep(h2) { font-size: 1.25rem; }
.journal-markdown :deep(h3) { font-size: 1.125rem; }
.journal-markdown :deep(h4),
.journal-markdown :deep(h5),
.journal-markdown :deep(h6) { font-size: 1rem; }
.journal-markdown :deep(ul) { list-style: disc; padding-left: 1.5rem; }
.journal-markdown :deep(ol) { list-style: decimal; padding-left: 1.5rem; }
.journal-markdown :deep(li > ul),
.journal-markdown :deep(li > ol) { margin-block: 0.25rem; }
.journal-markdown :deep(blockquote) {
  border-left: 3px solid;
  border-radius: 0 0.5rem 0.5rem 0;
  padding: 0.25rem 0.875rem;
  @apply border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/25;
}
.journal-markdown :deep(a) {
  text-decoration: underline;
  text-underline-offset: 3px;
  @apply rounded-sm text-indigo-600 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 dark:text-indigo-400;
}
.journal-markdown :deep(code) {
  border-radius: 0.375rem;
  padding: 0.125rem 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.875em;
  @apply bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200;
}
.journal-markdown :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  white-space: pre;
  overflow-wrap: normal;
  @apply bg-slate-100 dark:bg-slate-950/60;
}
.journal-markdown :deep(pre code) { padding: 0; background: transparent; }
.journal-markdown :deep(.hljs-keyword),
.journal-markdown :deep(.hljs-selector-tag),
.journal-markdown :deep(.hljs-literal) { @apply text-violet-700 dark:text-violet-300; }
.journal-markdown :deep(.hljs-string),
.journal-markdown :deep(.hljs-regexp),
.journal-markdown :deep(.hljs-template-tag),
.journal-markdown :deep(.hljs-addition) { @apply text-emerald-700 dark:text-emerald-300; }
.journal-markdown :deep(.hljs-number),
.journal-markdown :deep(.hljs-symbol),
.journal-markdown :deep(.hljs-bullet),
.journal-markdown :deep(.hljs-type) { @apply text-amber-700 dark:text-amber-300; }
.journal-markdown :deep(.hljs-title),
.journal-markdown :deep(.hljs-section),
.journal-markdown :deep(.hljs-selector-class),
.journal-markdown :deep(.hljs-selector-id) { @apply text-blue-700 dark:text-blue-300; }
.journal-markdown :deep(.hljs-attr),
.journal-markdown :deep(.hljs-attribute),
.journal-markdown :deep(.hljs-property),
.journal-markdown :deep(.hljs-variable) { @apply text-sky-700 dark:text-sky-300; }
.journal-markdown :deep(.hljs-tag),
.journal-markdown :deep(.hljs-name),
.journal-markdown :deep(.hljs-deletion) { @apply text-rose-700 dark:text-rose-300; }
.journal-markdown :deep(.hljs-built_in),
.journal-markdown :deep(.hljs-meta) { @apply text-orange-700 dark:text-orange-300; }
.journal-markdown :deep(.hljs-comment),
.journal-markdown :deep(.hljs-quote) { font-style: italic; @apply text-slate-500 dark:text-slate-400; }
.journal-markdown :deep(.hljs-emphasis) { font-style: italic; }
.journal-markdown :deep(.hljs-strong) { font-weight: 700; }
.journal-markdown :deep(.journal-markdown-table) {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid;
  border-radius: 0.75rem;
  @apply border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 dark:border-slate-700;
}
.journal-markdown :deep(table) { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.journal-markdown :deep(th),
.journal-markdown :deep(td) {
  border: 1px solid;
  padding: 0.5rem 0.75rem;
  min-width: 6rem;
  @apply border-slate-200 dark:border-slate-700;
}
.journal-markdown :deep(th) { font-weight: 600; @apply bg-slate-50 dark:bg-slate-800/70; }
.journal-markdown :deep(img) { display: block; max-width: 100%; height: auto; border-radius: 0.75rem; margin-block: 0.75rem; }
.journal-markdown :deep(hr) { margin-block: 1.25rem; @apply border-slate-200 dark:border-slate-700; }
.journal-markdown :deep(> :first-child) { margin-top: 0; }
.journal-markdown :deep(> :last-child) { margin-bottom: 0; }
</style>
