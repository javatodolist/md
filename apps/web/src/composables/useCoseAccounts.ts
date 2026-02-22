import type { PostAccount } from '@md/shared/types'

/**
 * 平台分类配置（与 PostInfo.vue 保持一致）
 */
export const platformCategories = [
  {
    name: `媒体平台`,
    platforms: [`wechat`, `toutiao`, `zhihu`, `baijiahao`, `wangyihao`, `sohu`, `weibo`, `bilibili`, `sspai`, `twitter`, `douyin`, `xiaohongshu`],
  },
  {
    name: `博客平台`,
    platforms: [`csdn`, `cnblogs`, `juejin`, `medium`, `cto51`, `segmentfault`, `oschina`, `infoq`, `jianshu`],
  },
  {
    name: `云平台及开发者社区`,
    platforms: [`tencentcloud`, `aliyun`, `huaweicloud`, `huaweidev`, `qianfan`, `alipayopen`, `modelscope`, `volcengine`, `elecfans`],
  },
]

declare global {
  interface Window {
    $cose: any
  }
}

/**
 * COSE 扩展账号管理
 * 封装扩展检测、账号加载、登录检测等逻辑
 */
export function useCoseAccounts() {
  const extensionInstalled = ref(false)
  const allAccounts = ref<PostAccount[]>([])
  const isCheckingLogin = ref(false)

  // 按分类获取账号
  const accountsByCategory = computed(() => {
    return platformCategories.map(category => ({
      name: category.name,
      accounts: category.platforms
        .map(type => allAccounts.value.find(a => a.type === type))
        .filter((a): a is PostAccount => a !== undefined),
    }))
  })

  // 是否有可用的已选账号
  const hasCheckedAccounts = computed(() => {
    return allAccounts.value.some(a => a.checked && a.loggedIn)
  })

  // 获取已选账号
  const checkedAccounts = computed(() => {
    return allAccounts.value.filter(a => a.checked && a.loggedIn)
  })

  // 获取初始平台列表（不带登录状态）
  function getInitialPlatforms(): PostAccount[] {
    if (window.$cose !== undefined && typeof window.$cose.getPlatforms === `function`) {
      return window.$cose.getPlatforms().map((p: any) => ({
        ...p,
        checked: false,
        loggedIn: false,
        isChecking: true,
      }))
    }
    return []
  }

  // 开始登录检测（渐进式更新）
  function startLoginDetection() {
    if (window.$cose === undefined)
      return

    const initialPlatforms = getInitialPlatforms()
    if (initialPlatforms.length > 0) {
      allAccounts.value = initialPlatforms
    }

    isCheckingLogin.value = true
    let hasReceivedAny = false

    const timeoutId = setTimeout(() => {
      if (!hasReceivedAny) {
        allAccounts.value = allAccounts.value.map(a => ({ ...a, isChecking: false }))
        isCheckingLogin.value = false
      }
    }, 15000)

    if (typeof window.$cose.getAccountsProgressive === `function`) {
      window.$cose.getAccountsProgressive(
        (account: PostAccount, _completed: number, _total: number) => {
          hasReceivedAny = true
          const idx = allAccounts.value.findIndex(a => a.type === account.type)
          if (idx !== -1) {
            allAccounts.value[idx] = { ...account, checked: false, isChecking: false }
          }
        },
        () => {
          clearTimeout(timeoutId)
          isCheckingLogin.value = false
        },
      )
    }
    else {
      window.$cose.getAccounts((resp: PostAccount[]) => {
        hasReceivedAny = true
        clearTimeout(timeoutId)
        allAccounts.value = resp.map(a => ({ ...a, checked: false, isChecking: false }))
        isCheckingLogin.value = false
      })
    }
  }

  // 检测扩展并加载账号
  function checkExtension() {
    if (window.$cose !== undefined) {
      extensionInstalled.value = true
      startLoginDetection()
      return
    }

    let count = 0
    const timer = setInterval(() => {
      if (window.$cose !== undefined) {
        extensionInstalled.value = true
        startLoginDetection()
        clearInterval(timer)
        return
      }
      count++
      if (count > 10) {
        clearInterval(timer)
      }
    }, 500)
  }

  // 分类全选判断
  function isCategoryAllSelected(accounts: PostAccount[]) {
    const loggedIn = accounts.filter(a => a.loggedIn)
    return loggedIn.length > 0 && loggedIn.every(a => a.checked)
  }

  function isCategoryIndeterminate(accounts: PostAccount[]) {
    const loggedIn = accounts.filter(a => a.loggedIn)
    const checkedCount = loggedIn.filter(a => a.checked).length
    return checkedCount > 0 && checkedCount < loggedIn.length
  }

  function toggleCategorySelectAll(accounts: PostAccount[]) {
    const loggedIn = accounts.filter(a => a.loggedIn)
    const allSelected = loggedIn.every(a => a.checked)
    loggedIn.forEach(a => a.checked = !allSelected)
  }

  return {
    extensionInstalled,
    allAccounts,
    isCheckingLogin,
    accountsByCategory,
    hasCheckedAccounts,
    checkedAccounts,
    checkExtension,
    isCategoryAllSelected,
    isCategoryIndeterminate,
    toggleCategorySelectAll,
  }
}
