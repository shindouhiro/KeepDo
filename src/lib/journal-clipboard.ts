type ClipboardImageSource = {
  items?: ArrayLike<Pick<DataTransferItem, 'kind' | 'getAsFile'>>
  files?: ArrayLike<File>
}

export function getPastedJournalImages(clipboard: ClipboardImageSource | null): File[] {
  if (!clipboard) return []
  const files = Array.from(clipboard.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file?.type.startsWith('image/')))
  // 同一张图片通常同时出现在 items 和 files 中，只取一份。
  return files.length ? files : Array.from(clipboard.files ?? []).filter(file => file.type.startsWith('image/'))
}
