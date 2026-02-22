// types/chrome.d.ts
declare namespace chrome {
  namespace runtime {
    const id: string | undefined
  }
  namespace tabs {
    interface Tab {
      id?: number
      index: number
      windowId: number
    }
    function query(queryOptions: { active: boolean, lastFocusedWindow: boolean }): Promise<[chrome.tabs.Tab]>
    function sendMessage(tabId: number, message: any): void
  }
}

const isInExtension = typeof chrome !== `undefined` && chrome.runtime && chrome.runtime.id

// 监听来自 background 的消息，转发为自定义事件供 Vue 应用消费
if (isInExtension && typeof browser !== `undefined` && browser.runtime) {
  browser.runtime.onMessage.addListener((message: { type: string, url?: string }) => {
    if (message.type === `importPageUrl` && message.url) {
      window.dispatchEvent(new CustomEvent(`importPageUrl`, { detail: { url: message.url } }))
    }
    return true
  })
}

async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true }
  if (typeof browser !== `undefined` && browser.tabs && browser.tabs.query) {
    const [tab] = await browser.tabs.query(queryOptions)
    return tab
  }
  const [tab] = await chrome.tabs.query(queryOptions)
  return tab
}
window.addEventListener(`copyToMp`, (e) => {
  const customEvent = e as CustomEvent
  if (!isInExtension)
    return
  getCurrentTab().then(async (tab) => {
    const tabId = tab.id!
    chrome.tabs.sendMessage(tabId, {
      type: `copyToMp`,
      content: customEvent.detail.content,
    })

    // 从微信公众平台页面获取真实账号名称，回传给编辑器
    try {
      const sendMessage = typeof browser !== `undefined` && browser.tabs?.sendMessage
        ? browser.tabs.sendMessage.bind(browser.tabs)
        : chrome.tabs.sendMessage.bind(chrome.tabs)
      const response = await sendMessage(tabId, { type: `getAccountInfo` })
      if (response?.accountName) {
        window.dispatchEvent(new CustomEvent(`pushAccountInfo`, {
          detail: { accountName: response.accountName },
        }))
      }
    }
    catch {
      // 内容脚本未注入或不在微信页面，静默忽略
    }
  })
})
