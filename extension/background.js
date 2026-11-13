// 复用已有扩展标签页，避免重复打开工作区。

chrome.action.onClicked.addListener(async () => {
  const keepdoUrl = chrome.runtime.getURL('index.html')
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find(tab => tab.url?.split(/[?#]/)[0] === keepdoUrl)

  if (existing && existing.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true })
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
  } else {
    await chrome.tabs.create({ url: keepdoUrl })
  }
})
