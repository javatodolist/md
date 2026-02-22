import type { PostAccount } from '@md/shared/types'
import { useEditorStore } from '@/stores/editor'
import { usePlatformContentStore } from '@/stores/platformContent'
import { usePostStore } from '@/stores/post'
import { useRenderStore } from '@/stores/render'
import { useThemeStore } from '@/stores/theme'
import { sanitizeForPublish } from '@/utils'

export interface BatchPushItem {
  postId: string
  title: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'partial'
  error?: string
  // COSE 每个平台的状态
  platformStatuses?: {
    type: string
    title: string
    displayName: string
    icon: string
    status: string
    error?: string
    draftLink?: string
  }[]
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function useBatchPush() {
  const postStore = usePostStore()
  const editorStore = useEditorStore()
  const renderStore = useRenderStore()
  const themeStore = useThemeStore()

  const isRunning = ref(false)
  const items = ref<BatchPushItem[]>([])
  const currentIndex = ref(-1)
  const totalCount = ref(0)
  const isCancelled = ref(false)

  const progressPercent = computed(() => {
    if (totalCount.value === 0)
      return 0
    const completed = items.value.filter(
      i => i.status === `success` || i.status === `failed` || i.status === `partial`,
    ).length
    return Math.round((completed / totalCount.value) * 100)
  })

  /**
   * 从渲染后的 #output DOM 中提取文章元数据
   * 与 PostInfo.vue prePost() 逻辑一致
   */
  function extractPostMeta() {
    return {
      thumb: document.querySelector<HTMLImageElement>(`#output img`)?.src ?? ``,
      title: [1, 2, 3, 4, 5, 6]
        .map(h => document.querySelector(`#output h${h}`)!)
        .find(h => h)
        ?.textContent ?? ``,
      desc: document.querySelector(`#output p`)?.textContent?.trim() ?? ``,
    }
  }

  /**
   * 通过 COSE 发布单篇文章到选中的平台
   * 与单篇发布（PostInfo → PostTaskDialog）流程一致
   */
  async function publishSinglePost(
    postId: string,
    content: string,
    accounts: PostAccount[],
    itemIndex: number,
  ): Promise<void> {
    // 1. 按目标平台合并开头/结尾内容
    const platformContentStore = usePlatformContentStore()
    const platformType = accounts[0]?.type ?? `default`
    const mergedContent = platformContentStore.mergeContent(content, platformType)

    // 2. 渲染合并后的文章获取 HTML
    themeStore.updateCodeTheme()
    renderStore.render(mergedContent, { skipMerge: true })
    await nextTick()

    // 3. 从 DOM 提取元数据
    const meta = extractPostMeta()

    // 4. 构造与 PostTaskDialog 一致的 taskData
    const taskData = {
      post: {
        title: meta.title,
        content: sanitizeForPublish(renderStore.output),
        markdown: mergedContent,
        thumb: meta.thumb,
        desc: meta.desc,
      },
      accounts: accounts.map(a => ({ ...a })),
    }

    // 4. 初始化平台状态列表
    items.value[itemIndex].platformStatuses = accounts.map(a => ({
      type: a.type,
      title: a.title,
      displayName: a.displayName,
      icon: a.icon,
      status: `pending`,
    }))

    // 5. 通过 COSE addTask 发布（Promise 包装回调）
    const recordedAccounts = new Set<string>()

    await new Promise<void>((resolve, reject) => {
      if (!window.$cose?.addTask) {
        reject(new Error(`COSE 扩展未安装或不可用`))
        return
      }

      const onProgress = (taskStatus: any) => {
        if (!taskStatus?.accounts)
          return

        // 更新每个平台的状态
        for (const account of taskStatus.accounts) {
          const ps = items.value[itemIndex].platformStatuses?.find(
            p => p.type === account.type,
          )
          if (ps) {
            ps.status = account.status
            ps.error = account.error
            ps.draftLink = account.editResp?.draftLink
          }

          // 记录推送（与 PostTaskDialog 逻辑一致）
          const accountKey = `${account.type}_${account.uid || account.displayName}`
          if (account.status === `done` && !recordedAccounts.has(accountKey)) {
            recordedAccounts.add(accountKey)
            postStore.addPushRecord(postId, {
              platform: account.type,
              accountId: account.uid || account.displayName || `default`,
              accountName: account.displayName || account.title || account.type,
              pushedAt: new Date().toISOString(),
              status: `draft`,
            })
          }
        }
      }

      const onComplete = () => {
        resolve()
      }

      try {
        window.$cose.addTask(taskData, onProgress, onComplete)
      }
      catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 执行批量发布
   * @param postIds 选中的文章 ID 列表
   * @param accounts 选中的平台账号列表
   */
  async function executeBatchPush(postIds: string[], accounts: PostAccount[]) {
    const originalPostId = postStore.currentPostId

    isRunning.value = true
    isCancelled.value = false
    totalCount.value = postIds.length
    currentIndex.value = 0
    items.value = postIds.map((id) => {
      const post = postStore.getPostById(id)
      return {
        postId: id,
        title: post?.title ?? `未知文章`,
        status: `pending` as const,
      }
    })

    for (let i = 0; i < items.value.length; i++) {
      if (isCancelled.value)
        break

      currentIndex.value = i
      items.value[i].status = `processing`

      const post = postStore.getPostById(items.value[i].postId)
      if (!post) {
        items.value[i].status = `failed`
        items.value[i].error = `文章不存在`
        continue
      }

      try {
        await publishSinglePost(post.id, post.content, accounts, i)

        // 根据平台结果判断整体状态
        const statuses = items.value[i].platformStatuses ?? []
        const allDone = statuses.every(p => p.status === `done`)
        const allFailed = statuses.every(p => p.status === `failed`)
        if (allDone) {
          items.value[i].status = `success`
        }
        else if (allFailed) {
          items.value[i].status = `failed`
          items.value[i].error = `所有平台发布失败`
        }
        else {
          items.value[i].status = `partial`
        }
      }
      catch (err) {
        items.value[i].status = `failed`
        items.value[i].error = err instanceof Error ? err.message : String(err)
      }

      // 文章间短暂间隔
      if (i < items.value.length - 1 && !isCancelled.value) {
        await delay(1000)
      }
    }

    // 恢复原始文章渲染
    postStore.currentPostId = originalPostId
    themeStore.updateCodeTheme()
    const currentPost = postStore.getPostById(originalPostId)
    if (currentPost) {
      renderStore.render(currentPost.content)
    }
    else {
      renderStore.render(editorStore.getContent())
    }

    isRunning.value = false
  }

  function cancelBatchPush() {
    isCancelled.value = true
  }

  function resetState() {
    isRunning.value = false
    items.value = []
    currentIndex.value = -1
    totalCount.value = 0
    isCancelled.value = false
  }

  return {
    isRunning,
    items,
    currentIndex,
    totalCount,
    progressPercent,
    executeBatchPush,
    cancelBatchPush,
    resetState,
  }
}
