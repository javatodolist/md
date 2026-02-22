import { v4 as uuid } from 'uuid'
import DEFAULT_CONTENT from '@/assets/example/markdown.md?raw'
import { addPrefix } from '@/utils'
import { store } from '@/utils/storage'

/**
 * 推送记录
 */
export interface PushRecord {
  platform: string
  accountId: string
  accountName: string
  pushedAt: string
  status: 'draft' | 'published'
}

/**
 * 平台显示名称映射
 */
export const PLATFORM_LABELS: Record<string, string> = {
  wechat: `微信公众号`,
  html: `HTML`,
  csdn: `CSDN`,
  juejin: `掘金`,
  zhihu: `知乎`,
  toutiao: `头条号`,
  baijiahao: `百家号`,
  wangyihao: `网易号`,
  sohu: `搜狐`,
  weibo: `微博`,
  bilibili: `哔哩哔哩`,
  sspai: `少数派`,
  twitter: `Twitter`,
  douyin: `抖音`,
  xiaohongshu: `小红书`,
  cnblogs: `博客园`,
  medium: `Medium`,
  cto51: `51CTO`,
  segmentfault: `SegmentFault`,
  oschina: `开源中国`,
  infoq: `InfoQ`,
  jianshu: `简书`,
  tencentcloud: `腾讯云`,
  aliyun: `阿里云`,
  huaweicloud: `华为云`,
  huaweidev: `华为开发者`,
  qianfan: `千帆`,
  alipayopen: `支付宝开放`,
  modelscope: `ModelScope`,
  volcengine: `火山引擎`,
  elecfans: `电子发烧友`,
}

/**
 * 获取平台显示名称
 */
export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}

/**
 * 复制模式 → 平台信息映射
 */
export function getCopyModePlatformInfo(mode: string) {
  switch (mode) {
    case `txt`: return { platform: `wechat`, accountName: `微信公众号` }
    case `html`: return { platform: `html`, accountName: `HTML` }
    case `html-without-style`: return { platform: `html`, accountName: `HTML（无样式）` }
    case `html-and-style`: return { platform: `html`, accountName: `HTML（兼容样式）` }
    default: return { platform: `other`, accountName: `其他` }
  }
}

/**
 * 推送去重检测结果
 */
export interface DuplicatePushInfo {
  postId: string
  postTitle: string
  duplicates: {
    platform: string
    accountId: string
    accountName: string
    lastPushedAt: string
  }[]
}

/**
 * Post 结构接口
 */
export interface Post {
  id: string
  title: string
  content: string
  history: {
    datetime: string
    content: string
  }[]
  createDatetime: Date
  updateDatetime: Date
  // 父标签
  parentId?: string | null
  // 展开状态
  collapsed?: boolean
  // 推送记录
  pushRecords?: PushRecord[]
  // 类型：分组 or 内容（默认 content，兼容已有数据）
  type?: 'group' | 'content'
}

/**
 * 文章管理 Store
 * 负责管理文章列表、当前文章、文章 CRUD 操作
 */
export const usePostStore = defineStore(`post`, () => {
  // 内容列表
  const posts = store.reactive<Post[]>(addPrefix(`posts`), [
    {
      id: uuid(),
      title: `内容1`,
      content: DEFAULT_CONTENT,
      history: [
        { datetime: new Date().toLocaleString(`zh-cn`), content: DEFAULT_CONTENT },
      ],
      createDatetime: new Date(),
      updateDatetime: new Date(),
    },
  ])

  // 当前文章 ID
  const currentPostId = store.reactive(addPrefix(`current_post_id`), ``)

  // 在补齐 id 后，若 currentPostId 无效 ➜ 自动指向第一篇
  onBeforeMount(() => {
    posts.value = posts.value.map((post, index) => {
      const now = Date.now()
      return {
        ...post,
        id: post.id ?? uuid(),
        createDatetime: post.createDatetime ?? new Date(now + index),
        updateDatetime: post.updateDatetime ?? new Date(now + index),
      }
    })

    // 去重：保留每个标题的第一篇，删除后续重复项
    const seenTitles = new Set<string>()
    posts.value = posts.value.filter((post) => {
      if (seenTitles.has(post.title)) {
        return false
      }
      seenTitles.add(post.title)
      return true
    })

    // 兼容：如果本地没有 currentPostId，或指向的文章已不存在
    if (!currentPostId.value || !posts.value.some(p => p.id === currentPostId.value)) {
      currentPostId.value = posts.value[0]?.id ?? ``
    }
  })

  // 根据 id 找索引
  const findIndexById = (id: string) => posts.value.findIndex(p => p.id === id)

  // computed: 让旧代码还能用 index，但底层映射 id
  const currentPostIndex = computed<number>({
    get: () => findIndexById(currentPostId.value),
    set: (idx) => {
      if (idx >= 0 && idx < posts.value.length) {
        currentPostId.value = posts.value[idx].id
      }
    },
  })

  // 获取 Post
  const getPostById = (id: string) => posts.value.find(p => p.id === id)

  // 获取当前文章
  const currentPost = computed(() => getPostById(currentPostId.value))

  // 判断标题是否已存在
  const isTitleExists = (title: string, excludeId?: string) => {
    return posts.value.some(p => p.title === title && p.id !== excludeId)
  }

  // 添加文章（标题重复时自动追加序号）
  const addPost = (title: string, parentId: string | null = null) => {
    let finalTitle = title
    if (isTitleExists(finalTitle)) {
      let i = 2
      while (isTitleExists(`${title} (${i})`)) i++
      finalTitle = `${title} (${i})`
    }

    const newPost: Post = {
      id: uuid(),
      title: finalTitle,
      content: `# ${finalTitle}`,
      history: [
        { datetime: new Date().toLocaleString(`zh-cn`), content: `# ${finalTitle}` },
      ],
      createDatetime: new Date(),
      updateDatetime: new Date(),
      parentId,
    }
    posts.value.push(newPost)
    currentPostId.value = newPost.id
  }

  // 添加分组（标题重复时自动追加序号）
  const addGroup = (title: string, parentId: string | null = null) => {
    let finalTitle = title
    if (isTitleExists(finalTitle)) {
      let i = 2
      while (isTitleExists(`${title} (${i})`)) i++
      finalTitle = `${title} (${i})`
    }

    const newGroup: Post = {
      id: uuid(),
      title: finalTitle,
      content: ``,
      history: [],
      createDatetime: new Date(),
      updateDatetime: new Date(),
      parentId,
      type: `group`,
    }
    posts.value.push(newGroup)
  }

  // 判断是否为分组
  const isGroupPost = (id: string) => {
    const post = getPostById(id)
    return post?.type === `group`
  }

  // 重命名文章
  const renamePost = (id: string, title: string) => {
    const post = getPostById(id)
    if (post) {
      post.title = title
      post.updateDatetime = new Date()
    }
  }

  // 删除文章/分组
  const delPost = (id: string) => {
    const idx = findIndexById(id)
    if (idx === -1)
      return

    const post = posts.value[idx]

    // 删除分组时，将子项移至上级目录
    if (post.type === `group`) {
      const parentOfGroup = post.parentId ?? null
      posts.value
        .filter(p => p.parentId === id)
        .forEach((child) => { child.parentId = parentOfGroup })
    }

    posts.value.splice(idx, 1)

    // 若删除的是当前选中的文章，重新定位到下一个内容项
    if (currentPostId.value === id) {
      const nextContent = posts.value.find(p => p.type !== `group`)
      currentPostId.value = nextContent?.id ?? ``
    }
  }

  // 更新文章父 ID
  const updatePostParentId = (postId: string, parentId: string | null) => {
    const post = getPostById(postId)
    if (post) {
      post.parentId = parentId
      post.updateDatetime = new Date()
    }
  }

  // 更新文章内容
  const updatePostContent = (id: string, content: string) => {
    const post = getPostById(id)
    if (post) {
      post.content = content
      post.updateDatetime = new Date()
    }
  }

  // 收起所有文章
  const collapseAllPosts = () => {
    posts.value.forEach((post) => {
      post.collapsed = true
    })
  }

  // 展开所有文章
  const expandAllPosts = () => {
    posts.value.forEach((post) => {
      post.collapsed = false
    })
  }

  // ============ 选择模式 ============
  const selectedPostIds = ref<Set<string>>(new Set())
  const isSelectMode = ref(false)
  const selectedCount = computed(() => selectedPostIds.value.size)

  function toggleSelectMode() {
    isSelectMode.value = !isSelectMode.value
    if (!isSelectMode.value) {
      selectedPostIds.value = new Set()
    }
  }

  function togglePostSelection(id: string) {
    const next = new Set(selectedPostIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selectedPostIds.value = next
  }

  function selectAllPosts() {
    selectedPostIds.value = new Set(
      posts.value.filter(p => p.type !== `group`).map(p => p.id),
    )
  }

  function clearSelection() {
    selectedPostIds.value = new Set()
  }

  // 添加推送记录
  const addPushRecord = (postId: string, record: PushRecord) => {
    const post = getPostById(postId)
    if (post) {
      if (!post.pushRecords) {
        post.pushRecords = []
      }
      post.pushRecords.push(record)
    }
  }

  // 获取推送记录
  const getPushRecords = (postId: string): PushRecord[] => {
    const post = getPostById(postId)
    return post?.pushRecords ?? []
  }

  // 检测重复推送
  const findDuplicatePushes = (
    postIds: string[],
    accounts: { platform: string, accountId: string, accountName: string }[],
  ): DuplicatePushInfo[] => {
    const results: DuplicatePushInfo[] = []

    for (const postId of postIds) {
      const post = getPostById(postId)
      if (!post?.pushRecords?.length)
        continue

      const duplicates: DuplicatePushInfo['duplicates'] = []
      for (const account of accounts) {
        const matching = post.pushRecords.filter(
          r => r.platform === account.platform && r.accountId === account.accountId,
        )
        if (matching.length > 0) {
          const latest = matching.reduce((a, b) =>
            new Date(a.pushedAt) > new Date(b.pushedAt) ? a : b,
          )
          duplicates.push({
            platform: account.platform,
            accountId: account.accountId,
            accountName: account.accountName,
            lastPushedAt: latest.pushedAt,
          })
        }
      }

      if (duplicates.length > 0) {
        results.push({ postId, postTitle: post.title, duplicates })
      }
    }

    return results
  }

  return {
    // State
    posts,
    currentPostId,
    currentPostIndex,
    currentPost,

    // Getters
    getPostById,
    findIndexById,
    isTitleExists,

    // Actions
    addPost,
    addGroup,
    isGroupPost,
    renamePost,
    delPost,
    updatePostParentId,
    updatePostContent,
    collapseAllPosts,
    expandAllPosts,
    addPushRecord,
    getPushRecords,
    findDuplicatePushes,

    // Selection
    selectedPostIds,
    isSelectMode,
    selectedCount,
    toggleSelectMode,
    togglePostSelection,
    selectAllPosts,
    clearSelection,
  }
})
