import { defineContentScript, injectScript } from '#imports'

/**
 * 从微信公众平台页面 DOM 中提取当前登录的账号名称
 */
function extractAccountName(): string {
  const selectors = [
    `.weui-desktop-account__nickname`,
    `.nickname`,
    `.new-creation__nick-name`,
    `#js_name`,
    `.head_title_nick`,
  ]
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el?.textContent?.trim()) {
      return el.textContent.trim()
    }
  }
  // 回退：从页面标题提取
  const title = document.title || ``
  const match = title.match(/^(.+?)[\s]*[-|–]/)
  if (match?.[1]?.trim()) {
    return match[1].trim()
  }
  return ``
}

export default defineContentScript({
  matches: [`https://mp.weixin.qq.com/cgi-bin/appmsg*`],
  async main() {
    await injectScript(`/injected.js`, {
      keepInDom: true,
    })
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === `copyToMp`) {
        console.log(`Copying content to MP editor:`, message.content)
        const customEventData = { type: `copyToMp`, content: message.content }
        window.postMessage(customEventData)
        return Promise.resolve(true)
      }
      if (message.type === `getAccountInfo`) {
        return Promise.resolve({ accountName: extractAccountName() })
      }
      return true
    })
  },
})
