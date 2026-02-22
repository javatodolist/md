import { browser, defineBackground } from '#imports'

export default defineBackground({
  type: `module`,
  main() {
    browser.runtime.onInstalled.addListener((detail) => {
      if (import.meta.env.COMMAND === `serve`) {
        browser.runtime.openOptionsPage()
        return
      }
      if (detail.reason === `install`) {
        browser.tabs.create({ url: `https://md-pages.doocs.org/welcome` })
      }
      else if (detail.reason === `update`) {
        browser.runtime.openOptionsPage()
      }
    })

    browser.runtime.onInstalled.addListener(() => {
      if (typeof browser.sidePanel === `undefined`)
        return

      browser.contextMenus.create({
        id: `openSidePanel`,
        title: `MD 公众号编辑器`,
        documentUrlPatterns: [`https://mp.weixin.qq.com/cgi-bin/appmsg*`],
        contexts: [`all`],
      })

      browser.contextMenus.create({
        id: `importToEditor`,
        title: `导入此页到 MD 编辑器`,
        contexts: [`page`],
      })
    })

    browser.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === `openSidePanel`) {
        browser.sidePanel.open({ tabId: tab!.id! })
      }
      else if (info.menuItemId === `importToEditor`) {
        const tabId = tab!.id!
        const pageUrl = tab!.url || info.pageUrl
        browser.sidePanel.open({ tabId }).then(() => {
          // 等待 Side Panel 加载完成后发送消息
          setTimeout(() => {
            browser.runtime.sendMessage({ type: `importPageUrl`, url: pageUrl })
          }, 500)
        })
      }
    })
  },
})
