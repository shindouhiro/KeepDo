<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { isNative, platformFetch } from '../../lib/platform'
import { bytesToBase64 } from '../../../shared/backup'
import { getJournalImageType, JOURNAL_IMAGE_LIMIT } from '../../../shared/journal'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ src: string; alt: string }>()
const source = shallowRef('')
const error = shallowRef('')
let release = () => {}

watch(() => props.src, async (src, _, onCleanup) => {
  const controller = new AbortController()
  release()
  release = () => controller.abort()
  onCleanup(release)
  error.value = ''
  source.value = ''
  if (!isNative || !src.startsWith('/api/')) { source.value = src; return }
  try {
    const response = await platformFetch(src, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
    if (!response.ok) throw new Error('图片加载失败')
    const bytes = new Uint8Array(await response.arrayBuffer())
    const mimeType = getJournalImageType(bytes)
    if (!mimeType || bytes.byteLength > JOURNAL_IMAGE_LIMIT) throw new Error('图片格式不正确或内容过大')
    if (controller.signal.aborted) return
    // 数据地址可直接嵌入导出 SVG，避免 WebKit 再次请求带鉴权的照片或临时 blob。
    source.value = `data:${mimeType};base64,${bytesToBase64(bytes)}`
  } catch (cause) {
    if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '图片加载失败'
  }
}, { immediate: true })

onBeforeUnmount(() => release())
</script>

<template>
  <img v-bind="$attrs" :src="source || undefined" :alt="error ? `${alt}（${error}）` : alt" :aria-busy="!source && !error" :data-image-loading="!source && !error ? '' : undefined" :data-image-error="error || undefined" />
</template>
