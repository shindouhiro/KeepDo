import { nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue'

export function useNativeDialog(refName: string, isOpen: () => boolean, emitClose: () => void) {
  const dialogRef = useTemplateRef<HTMLDialogElement>(refName)
  watch(isOpen, async (open) => {
    await nextTick()
    const dialog = dialogRef.value
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, { immediate: true, flush: 'post' })

  function handleClose() {
    if (isOpen()) emitClose()
  }
  function handleBackdrop(event: MouseEvent) {
    const dialog = dialogRef.value
    if (!dialog || event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) emitClose()
  }
  onBeforeUnmount(() => { dialogRef.value?.close() })
  return { handleClose, handleBackdrop }
}
