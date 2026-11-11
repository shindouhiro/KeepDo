type PreviewShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'defaultPrevented'>

export function isJournalPreviewShortcut(event: PreviewShortcutEvent) {
  return event.key.toLowerCase() === 'e' && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    && !event.repeat && !event.isComposing && !event.defaultPrevented
}
