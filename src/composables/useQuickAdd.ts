import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isQuickAddShortcut } from '../../shared/quick-add'

export function useQuickAdd(canOpen: () => boolean, onOpen: () => void) {
  const isOpen = ref(false)
  function open() {
    if (canOpen() && !document.querySelector('dialog[open]')) {
      onOpen()
      isOpen.value = true
    }
  }
  function handleKeydown(event: KeyboardEvent) {
    if (!isQuickAddShortcut(event) || !canOpen() || isOpen.value) return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return
    if (document.querySelector('dialog[open]')) return
    event.preventDefault()
    open()
  }
  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
  return { isOpen, open }
}
