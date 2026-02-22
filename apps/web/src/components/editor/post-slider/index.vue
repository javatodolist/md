<script setup lang="ts">
import { ArrowUpNarrowWide, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderClosed, FolderInput, FolderPlus, ListChecks, PlusSquare, Send, X } from 'lucide-vue-next'
import BatchPushDialog from './BatchPushDialog.vue'
import { useEditorStore } from '@/stores/editor'
import { getPlatformLabel, usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'
import { addPrefix } from '@/utils'
import { store } from '@/utils/storage'

const uiStore = useUIStore()
const { isMobile, isOpenPostSlider, isPostSliderCollapsed } = storeToRefs(uiStore)

const postStore = usePostStore()
const { posts } = storeToRefs(postStore)

const editorStore = useEditorStore()
const { editor } = storeToRefs(editorStore)

// 控制是否启用动画
const enableAnimation = ref(false)

// 监听 PostSlider 开关状态变化
watch(isOpenPostSlider, () => {
  if (isMobile.value) {
    // 在移动端，用户操作时启用动画
    enableAnimation.value = true
  }
})

// 监听设备类型变化，重置动画状态
watch(isMobile, () => {
  enableAnimation.value = false
})

/* ============ 新增内容 ============ */
const parentId = ref<string | null>(null)
const isOpenAddDialog = ref(false)
const addPostInputVal = ref(``)
watch(isOpenAddDialog, (o) => {
  if (o) {
    addPostInputVal.value = ``
    parentId.value = null
  }
})

function openAddPostDialog(id: string) {
  isOpenAddDialog.value = true
  nextTick(() => {
    parentId.value = id
  })
}

function addPost() {
  if (!addPostInputVal.value.trim())
    return toast.error(`内容标题不可为空`)
  if (posts.value.some(post => post.title === addPostInputVal.value.trim()))
    return toast.error(`内容标题已存在`)
  postStore.addPost(addPostInputVal.value.trim(), parentId.value)
  isOpenAddDialog.value = false
  toast.success(`内容新增成功`)
}

/* ============ 新增分组 ============ */
const groupParentId = ref<string | null>(null)
const isOpenAddGroupDialog = ref(false)
const addGroupInputVal = ref(``)
watch(isOpenAddGroupDialog, (o) => {
  if (o) {
    addGroupInputVal.value = ``
    groupParentId.value = null
  }
})

function openAddGroupDialog(id: string) {
  isOpenAddGroupDialog.value = true
  nextTick(() => {
    groupParentId.value = id
  })
}

function addGroup() {
  if (!addGroupInputVal.value.trim())
    return toast.error(`分组名称不可为空`)
  if (posts.value.some(post => post.title === addGroupInputVal.value.trim()))
    return toast.error(`分组名称已存在`)
  postStore.addGroup(addGroupInputVal.value.trim(), groupParentId.value)
  isOpenAddGroupDialog.value = false
  toast.success(`分组新增成功`)
}

/* ============ 重命名 / 删除 / 历史 对象 ============ */
const editId = ref<string | null>(null)
const isOpenEditDialog = ref(false)
const renamePostInputVal = ref(``)

function startRenamePost(id: string) {
  editId.value = id
  renamePostInputVal.value = postStore.getPostById(id)!.title
  isOpenEditDialog.value = true
}
function renamePost() {
  if (!renamePostInputVal.value.trim()) {
    return toast.error(`内容标题不可为空`)
  }

  if (
    posts.value.some(
      post => post.title === renamePostInputVal.value.trim() && post.id !== editId.value,
    )
  ) {
    return toast.error(`内容标题已存在`)
  }

  if (renamePostInputVal.value === postStore.getPostById(editId.value!)?.title) {
    isOpenEditDialog.value = false
    return
  }

  postStore.renamePost(editId.value!, renamePostInputVal.value.trim())
  toast.success(`内容重命名成功`)
  isOpenEditDialog.value = false
}

const delId = ref<string | null>(null)
const isOpenDelPostConfirmDialog = ref(false)

const delConfirmText = computed(() => {
  const post = postStore.getPostById(delId.value || ``)
  if (!post)
    return ``
  const short = post.title.length > 20 ? `${post.title.slice(0, 20)}…` : post.title
  if (post.type === `group`) {
    const childCount = posts.value.filter(p => p.parentId === post.id).length
    return childCount > 0
      ? `此操作将删除分组「${short}」，其下 ${childCount} 个子项将移至上级目录，是否继续？`
      : `此操作将删除分组「${short}」，是否继续？`
  }
  return `此操作将删除「${short}」，是否继续？`
})

function startDelPost(id: string) {
  delId.value = id
  isOpenDelPostConfirmDialog.value = true
}
function delPost() {
  postStore.delPost(delId.value!)
  isOpenDelPostConfirmDialog.value = false
  toast.success(`内容删除成功`)
}

/* ============ 历史记录 ============ */
const isOpenHistoryDialog = ref(false)
const currentPostId = ref<string | null>(null)
const currentHistoryIndex = ref(0)

function openHistoryDialog(id: string) {
  currentPostId.value = id
  currentHistoryIndex.value = 0
  isOpenHistoryDialog.value = true
}
function recoverHistory() {
  const post = postStore.getPostById(currentPostId.value!)
  if (!post) {
    isOpenHistoryDialog.value = false
    return
  }

  const content = post.history[currentHistoryIndex.value].content
  post.content = content
  const ed = toRaw(editor.value!)
  ed.dispatch({
    changes: { from: 0, to: ed.state.doc.length, insert: content },
  })
  toast.success(`记录恢复成功`)
  isOpenHistoryDialog.value = false
}

/* ============ 推送记录 ============ */
const isOpenPushRecordDialog = ref(false)
const pushRecordPostId = ref<string | null>(null)

const pushRecordPost = computed(() => {
  if (!pushRecordPostId.value)
    return null
  return postStore.getPostById(pushRecordPostId.value) ?? null
})

function openPushRecordDialog(id: string) {
  pushRecordPostId.value = id
  isOpenPushRecordDialog.value = true
}

/* ============ 批量推送 ============ */
const isOpenBatchPushDialog = ref(false)
const batchPushPostIds = ref<string[]>([])

function startBatchPush() {
  if (postStore.selectedCount === 0)
    return
  // 过滤掉分组，仅推送内容
  batchPushPostIds.value = [...postStore.selectedPostIds].filter(id => !postStore.isGroupPost(id))
  if (batchPushPostIds.value.length === 0) {
    return toast.error(`未选择任何内容文章`)
  }
  isOpenBatchPushDialog.value = true
}

/* ============ 批量移动分组 ============ */
const isOpenBatchMoveDialog = ref(false)
const batchMoveTargetId = ref<string | null>(null)

// 所有可选的分组列表（排除被选中的分组自身）
const availableGroups = computed(() => {
  return posts.value.filter(
    p => p.type === `group` && !postStore.selectedPostIds.has(p.id),
  )
})

function startBatchMove() {
  if (postStore.selectedCount === 0)
    return
  batchMoveTargetId.value = null
  isOpenBatchMoveDialog.value = true
}

function confirmBatchMove() {
  const targetId = batchMoveTargetId.value
  let movedCount = 0
  for (const id of postStore.selectedPostIds) {
    const post = postStore.getPostById(id)
    if (!post)
      continue
    // 跳过已在目标分组下的
    if (post.parentId === targetId)
      continue
    postStore.updatePostParentId(id, targetId)
    movedCount++
  }

  isOpenBatchMoveDialog.value = false

  if (movedCount > 0) {
    toast.success(`已移动 ${movedCount} 项`)
    postStore.clearSelection()
    postStore.toggleSelectMode()
  }
  else {
    toast.info(`所选内容已在目标分组下`)
  }
}

/* ============ 排序 ============ */
const sortMode = store.reactive(addPrefix(`sort_mode`), `create-old-new`)
const sortedPosts = computed(() => {
  return [...posts.value].sort((a, b) => {
    switch (sortMode.value) {
      case `A-Z`:
        return a.title.localeCompare(b.title)
      case `Z-A`:
        return b.title.localeCompare(a.title)
      case `update-new-old`:
        return +new Date(b.updateDatetime) - +new Date(a.updateDatetime)
      case `update-old-new`:
        return +new Date(a.updateDatetime) - +new Date(b.updateDatetime)
      case `create-new-old`:
        return +new Date(b.createDatetime) - +new Date(a.createDatetime)
      default:
        /* create-old-new */
        return +new Date(a.createDatetime) - +new Date(b.createDatetime)
    }
  })
})

/* ============ 拖拽功能 ============ */
const dragover = ref(false)
const dragSourceId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

function handleDrop(targetId: string | null) {
  const sourceId = dragSourceId.value
  if (!sourceId) {
    return
  }

  // 递归检索 ID，是不是父文件拖拽到了子文件上面
  const isParent = (id: string | null | undefined) => {
    if (!id) {
      return false
    }

    const post = postStore.getPostById(id)
    if (!post) {
      return false
    }

    if (post.parentId === sourceId) {
      return true
    }

    return isParent(post.parentId)
  }

  if (isParent(targetId)) {
    toast.error(`不能将内容拖拽到其子内容下面`)
  }
  else if (sourceId !== targetId) {
    postStore.updatePostParentId(sourceId, targetId || null)
  }

  dragSourceId.value = null
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDragEnd() {
  dragSourceId.value = null
  dropTargetId.value = null
  dragover.value = false
}
</script>

<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="isMobile && isOpenPostSlider"
    class="fixed inset-0 bg-black/50 z-40"
    @click="isOpenPostSlider = false"
  />

  <!-- 侧栏容器 -->
  <div
    class="post-slider-panel h-full w-full overflow-hidden mobile-drawer flex"
    :class="{
      // 移动端样式
      'fixed top-0 left-0 z-55 bg-background border-r shadow-lg': isMobile,
      'animate': isMobile && enableAnimation,
      // 桌面端样式
      'border-2 border-[#0000] border-dashed bg-gray/20 transition-colors': !isMobile,
      'border-gray-700 bg-gray-400/50 dark:border-gray-200 dark:bg-gray-500/50': !isMobile && dragover,
    }"
    :style="{
      transform: isMobile && isOpenPostSlider ? 'translateX(0)'
        : isMobile && !isOpenPostSlider ? 'translateX(-100%)'
          : undefined,
    }"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @dragend="handleDragEnd"
  >
    <!-- 桌面端收拢状态：竖条 -->
    <div
      v-if="!isMobile && isPostSliderCollapsed"
      class="collapsed-bar"
      @click="isPostSliderCollapsed = false"
    >
      <ChevronRight class="h-3.5 w-3.5 shrink-0" />
      <span class="collapsed-label">内容管理</span>
    </div>

    <!-- 展开状态：完整面板 -->
    <nav
      v-else
      class="h-full flex-1 flex flex-col transition-transform overflow-hidden min-w-0"
      :class="{ 'p-2': isMobile }"
      @dragover="handleDragOver"
      @drop.prevent="handleDrop(null)"
    >
      <!-- 移动端标题栏 -->
      <div v-if="isMobile" class="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b mb-2 bg-background">
        <h2 class="text-lg font-semibold">
          内容管理
        </h2>
        <Button variant="ghost" size="sm" @click="isOpenPostSlider = false">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- 桌面端标题栏（带收起按钮） -->
      <div v-if="!isMobile" class="flex items-center justify-between px-2 py-1.5 border-b shrink-0 bg-background">
        <span class="text-xs font-semibold text-muted-foreground">内容管理</span>
        <Button
          variant="ghost"
          size="sm"
          class="h-6 w-6 p-0 shrink-0"
          title="收起面板"
          @click="isPostSliderCollapsed = true"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </Button>
      </div>

      <!-- 顶部：新增 + 排序按钮 -->
      <div class="space-x-4 mb-2 flex justify-center shrink-0 py-2">
        <!-- 新增 -->
        <Dialog v-model:open="isOpenAddDialog">
          <DialogTrigger>
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="xs" class="h-max p-1">
                    <PlusSquare class="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  新增内容
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增内容</DialogTitle>
              <DialogDescription>请输入内容名称</DialogDescription>
            </DialogHeader>
            <Input v-model="addPostInputVal" @keyup.enter="addPost" />
            <DialogFooter>
              <Button @click="addPost">
                确 定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- 新增分组 -->
        <Dialog v-model:open="isOpenAddGroupDialog">
          <DialogTrigger>
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="xs" class="h-max p-1">
                    <FolderPlus class="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  新增分组
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增分组</DialogTitle>
              <DialogDescription>请输入分组名称</DialogDescription>
            </DialogHeader>
            <Input v-model="addGroupInputVal" @keyup.enter="addGroup" />
            <DialogFooter>
              <Button @click="addGroup">
                确 定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- 排序 -->
        <DropdownMenu>
          <DropdownMenuTrigger>
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="xs" class="h-max p-1">
                    <ArrowUpNarrowWide class="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  排序模式
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup v-model="sortMode">
              <DropdownMenuRadioItem value="A-Z">
                文件名（A-Z）
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="Z-A">
                文件名（Z-A）
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="update-new-old">
                编辑时间（新→旧）
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="update-old-new">
                编辑时间（旧→新）
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="create-new-old">
                创建时间（新→旧）
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="create-old-new">
                创建时间（旧→新）
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="xs" class="h-max p-1" @click="postStore.collapseAllPosts">
                <ChevronsDownUp class="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              全部收起
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="xs" class="h-max p-1" @click="postStore.expandAllPosts">
                <ChevronsUpDown class="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              全部展开
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="xs"
                class="h-max p-1"
                :class="{ 'bg-accent text-accent-foreground': postStore.isSelectMode }"
                @click="postStore.toggleSelectMode"
              >
                <ListChecks class="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              批量选择
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- 批量操作栏 -->
      <div
        v-if="postStore.isSelectMode"
        class="flex items-center justify-between px-2 py-1.5 border-y bg-muted/50 shrink-0"
      >
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span>已选 {{ postStore.selectedCount }} 篇</span>
          <Button variant="link" size="xs" class="h-auto p-0 text-xs" @click="postStore.selectAllPosts">
            全选
          </Button>
          <Button variant="link" size="xs" class="h-auto p-0 text-xs" @click="postStore.clearSelection">
            清除
          </Button>
        </div>
        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            :disabled="postStore.selectedCount === 0"
            @click="startBatchMove"
          >
            <FolderInput class="mr-1 size-3.5" />
            移动
          </Button>
          <Button
            size="xs"
            :disabled="postStore.selectedCount === 0"
            @click="startBatchPush"
          >
            <Send class="mr-1 size-3.5" />
            推送
          </Button>
        </div>
      </div>

      <!-- 列表 -->
      <div class="flex-1 overflow-y-auto space-y-1 px-1">
        <!-- 包裹根文章和子文章，保持间距 -->
        <PostItem
          :parent-id="null"
          :sorted-posts="sortedPosts"
          :start-rename-post="startRenamePost"
          :open-history-dialog="openHistoryDialog"
          :open-push-record-dialog="openPushRecordDialog"
          :start-del-post="startDelPost"
          :drop-target-id="dropTargetId"
          :set-drop-target-id="(id: string | null) => (dropTargetId = id)"
          :drag-source-id="dragSourceId"
          :set-drag-source-id="(id: string | null) => (dragSourceId = id)"
          :handle-drop="handleDrop"
          :handle-drag-end="handleDragEnd"
          :open-add-post-dialog="openAddPostDialog"
          :open-add-group-dialog="openAddGroupDialog"
          :is-select-mode="postStore.isSelectMode"
          :selected-post-ids="postStore.selectedPostIds"
          :toggle-post-selection="postStore.togglePostSelection"
        />
      </div>
    </nav>
  </div>

  <!-- 重命名弹窗 -->
  <Dialog v-model:open="isOpenEditDialog">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>编辑内容名称</DialogTitle>
        <DialogDescription>请输入新的内容名称</DialogDescription>
      </DialogHeader>
      <Input v-model="renamePostInputVal" @keyup.enter="renamePost" />
      <DialogFooter>
        <Button variant="outline" @click="isOpenEditDialog = false">
          取消
        </Button>
        <Button @click="renamePost">
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 删除确认 -->
  <AlertDialog v-model:open="isOpenDelPostConfirmDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>提示</AlertDialogTitle>
        <AlertDialogDescription>{{ delConfirmText }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="delPost">
          确定
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 历史记录 -->
  <Dialog v-model:open="isOpenHistoryDialog">
    <DialogContent class="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>历史记录</DialogTitle>
        <DialogDescription>每隔 30 秒自动保存，最多保留 10 条</DialogDescription>
      </DialogHeader>

      <div class="h-[50vh] flex">
        <!-- 左侧时间轴 -->
        <ul class="space-y-1.5 w-[180px]">
          <li
            v-for="(item, idx) in postStore.getPostById(currentPostId!)?.history"
            :key="item.datetime"
            class="min-h-[2.75rem] w-full inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors leading-tight"
            :class="[
              // eslint-disable-next-line vue/prefer-separate-static-class
              'hover:bg-primary hover:text-primary-foreground',
              {
                'bg-primary text-primary-foreground shadow-sm':
                  currentHistoryIndex === idx,
              },
            ]"
            @click="currentHistoryIndex = idx"
          >
            <span class="break-words w-full">{{ item.datetime }}</span>
          </li>
        </ul>

        <Separator orientation="vertical" class="mx-2" />

        <!-- 右侧内容 -->
        <div class="space-y-2 max-h-full flex-1 overflow-y-auto">
          <div
            class="whitespace-pre-wrap p-2"
            style="word-wrap: break-word; overflow-wrap: break-word; word-break: break-all; hyphens: auto;"
          >
            {{ postStore.getPostById(currentPostId!)?.history[currentHistoryIndex].content ?? '' }}
          </div>
        </div>
      </div>

      <DialogFooter>
        <AlertDialog>
          <AlertDialogTrigger><Button>恢 复</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>提示</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将用该记录替换当前文章内容，是否继续？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction @click="recoverHistory">
                恢 复
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <!-- 推送记录 -->
  <Dialog v-model:open="isOpenPushRecordDialog">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>推送记录</DialogTitle>
        <DialogDescription>
          {{ pushRecordPost?.title ?? '' }} - 共 {{ pushRecordPost?.pushRecords?.length ?? 0 }} 条记录
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[50vh] overflow-y-auto">
        <div v-if="!pushRecordPost?.pushRecords?.length" class="py-8 text-center text-sm text-muted-foreground">
          暂无推送记录
        </div>
        <table v-else class="w-full text-sm">
          <thead class="sticky top-0 bg-background border-b">
            <tr class="text-left text-muted-foreground">
              <th class="py-2 px-3 font-medium">
                渠道
              </th>
              <th class="py-2 px-3 font-medium">
                账号
              </th>
              <th class="py-2 px-3 font-medium">
                状态
              </th>
              <th class="py-2 px-3 font-medium">
                时间
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(record, idx) in [...(pushRecordPost?.pushRecords ?? [])].reverse()"
              :key="idx"
              class="border-b last:border-0 hover:bg-muted/50"
            >
              <td class="py-2 px-3">
                {{ getPlatformLabel(record.platform) }}
              </td>
              <td class="py-2 px-3">
                {{ record.accountName }}
              </td>
              <td class="py-2 px-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="record.status === 'published'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'"
                >
                  {{ record.status === 'published' ? '已发布' : '草稿' }}
                </span>
              </td>
              <td class="py-2 px-3 text-muted-foreground whitespace-nowrap">
                {{ new Date(record.pushedAt).toLocaleString('zh-CN') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>
  <!-- 批量移动分组 -->
  <Dialog v-model:open="isOpenBatchMoveDialog">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>移动到分组</DialogTitle>
        <DialogDescription>
          将已选的 {{ postStore.selectedCount }} 项移动到指定分组
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[300px] overflow-y-auto space-y-1">
        <!-- 根目录选项 -->
        <div
          class="flex items-center gap-2 rounded p-2 text-sm cursor-pointer transition-colors hover:bg-muted"
          :class="{ 'bg-primary text-primary-foreground hover:bg-primary': batchMoveTargetId === null }"
          @click="batchMoveTargetId = null"
        >
          <FolderClosed class="size-4 text-amber-500" />
          <span>根目录</span>
        </div>
        <!-- 分组列表 -->
        <div
          v-for="group in availableGroups"
          :key="group.id"
          class="flex items-center gap-2 rounded p-2 text-sm cursor-pointer transition-colors hover:bg-muted"
          :class="{ 'bg-primary text-primary-foreground hover:bg-primary': batchMoveTargetId === group.id }"
          @click="batchMoveTargetId = group.id"
        >
          <FolderClosed class="size-4 text-amber-500" />
          <span class="truncate">{{ group.title }}</span>
        </div>

        <div v-if="availableGroups.length === 0" class="py-4 text-center text-sm text-muted-foreground">
          暂无可用分组，请先创建分组
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpenBatchMoveDialog = false">
          取消
        </Button>
        <Button @click="confirmBatchMove">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 批量推送对话框 -->
  <BatchPushDialog
    v-model:open="isOpenBatchPushDialog"
    :post-ids="batchPushPostIds"
  />
</template>

<style scoped>
/* 移动端侧边栏动画 - 只有添加了 animate 类才启用 */
.mobile-drawer.animate {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 收拢竖条 */
.collapsed-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  width: 24px;
  height: 100%;
  cursor: pointer;
  background-color: hsl(var(--background));
  border-right: 1px solid hsl(var(--border));
  transition: background-color 0.15s ease;
  color: hsl(var(--muted-foreground));
}

.collapsed-bar:hover {
  background-color: hsl(var(--accent) / 0.1);
  color: hsl(var(--foreground));
}

.collapsed-label {
  writing-mode: vertical-rl;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  letter-spacing: 2px;
}
</style>
