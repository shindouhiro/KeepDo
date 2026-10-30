type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'defaultPrevented'>

export function isQuickAddShortcut(event: ShortcutEvent): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)
    && !event.altKey && !event.shiftKey && !event.repeat && !event.isComposing && !event.defaultPrevented
}
