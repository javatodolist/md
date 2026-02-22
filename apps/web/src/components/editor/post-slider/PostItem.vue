<script setup lang="ts">
import {
  ChevronRight,
  Edit3,
  Ellipsis,
  FileInput,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  History,
  Package,
  PlusSquare,
  Send,
  Trash2,
} from 'lucide-vue-next'
import { type Post, usePostStore } from '@/stores/post'
import { useTemplateStore } from '@/stores/template'
import { useUIStore } from '@/stores/ui'

const props = defineProps<{
  // 父文章的 ID，如果值是 null，则日表示这是第一层文件
  parentId: string | null
  // 排序好的文章列表
  sortedPosts: Post[]
  // 开始重命名文章
  startRenamePost: (id: string) => void
  // 打开历史记录对话框
  openHistoryDialog: (id: string) => void
  // 打开推送记录对话框
  openPushRecordDialog: (id: string) => void
  // 开始删除文章
  startDelPost: (id: string) => void
  // 拖拽目的地 ID
  dropTargetId: string | null
  // 设置拖拽目的地
  setDropTargetId: (id: string | null) => void
  // 被拖拽对象
  dragSourceId: string | null
  // 设置被拖拽对象
  setDragSourceId: (id: string | null) => void
  handleDrop: (targetId: string | null) => void
  handleDragEnd: () => void
  // 以添加子文章的方式打开对话框
  openAddPostDialog: (parentId: string) => void
  // 以添加子分组的方式打开对话框
  openAddGroupDialog: (parentId: string) => void
  // 选择模式
  isSelectMode: boolean
  selectedPostIds: Set<string>
  togglePostSelection: (id: string) => void
}>()

const postStore = usePostStore()
const templateStore = useTemplateStore()
const uiStore = useUIStore()
const { posts, currentPostId } = storeToRefs(postStore)
const { toggleShowTemplateDialog } = uiStore

/* ============ 新增内容 ============ */
const isOpenAddDialog = ref(false)
const addPostInputVal = ref(``)
watch(isOpenAddDialog, (o) => {
  if (o)
    addPostInputVal.value = ``
})

// 新增：拖拽开始时记录ID并设置数据
function handleDragStart(id: string, e: DragEvent) {
  props.setDragSourceId(id)
  e.dataTransfer?.setData(`text/plain`, id)
  e.dataTransfer!.effectAllowed = `move` // 明确拖拽效果
}

/* ============ 折叠展开 ============ */
function togglePostExpanded(postId: string) {
  const targetPost = posts.value.find(p => p.id === postId)
  if (targetPost) {
    targetPost.collapsed = !targetPost.collapsed
  }
}

/*
 * 判断文章是否有子文章
 */
function isHasChild(postId: string) {
  return props.sortedPosts.some(p => p.parentId === postId)
}

/*
 * 保存为模板
 */
function saveAsTemplate(postId: string) {
  const post = posts.value.find(p => p.id === postId)
  if (!post)
    return

  templateStore.createTemplate({
    name: post.title,
    content: post.content,
    description: `从「${post.title}」创建于 ${new Date().toLocaleString('zh-CN')}`,
  })
}

/*
 * 应用模板
 */
function applyTemplate(postId: string) {
  currentPostId.value = postId
  toggleShowTemplateDialog(true)
}
</script>

<template>
  <div v-for="post in props.sortedPosts.filter(p => (props.parentId == null && p.parentId == null) || p.parentId === props.parentId)" :key="post.id">
    <!-- 根文章外层容器 -->
    <a
      class="w-full inline-flex cursor-pointer items-center gap-1 rounded p-2 text-sm transition-colors"
      :class="[
        // eslint-disable-next-line vue/prefer-separate-static-class
        'hover:text-primary-foreground hover:bg-primary',
        {
          'bg-primary text-primary-foreground shadow-sm': currentPostId === post.id,
          'opacity-50': props.dragSourceId === post.id,
          'outline-2 outline-dashed outline-primary  border-gray-200 bg-gray-400/50 dark:border-gray-200 dark:bg-gray-500/50':
            props.dropTargetId === post.id,
        },
      ]"
      draggable="true"
      @dragstart="handleDragStart(post.id, $event)"
      @dragend="props.handleDragEnd"
      @drop.prevent="props.handleDrop(post.id)"
      @dragover.stop.prevent="props.setDropTargetId(post.id)"
      @dragleave.prevent="props.setDropTargetId(null)"
      @click="post.type === 'group' ? togglePostExpanded(post.id) : (props.isSelectMode ? props.togglePostSelection(post.id) : (currentPostId = post.id))"
    >
      <!-- 分组图标 -->
      <template v-if="post.type === 'group'">
        <Button size="xs" variant="ghost" class="h-max p-0.5" @click.stop="togglePostExpanded(post.id)">
          <FolderOpen v-if="!post.collapsed" class="size-4 text-amber-500" />
          <FolderClosed v-else class="size-4 text-amber-500" />
        </Button>
      </template>
      <!-- 内容折叠展开图标 -->
      <template v-else>
        <Button
          size="xs"
          variant="ghost"
          class="h-max p-0.5"
          :class="isHasChild(post.id) ? 'opacity-100' : 'opacity-0'"
          @click.stop="isHasChild(post.id) && togglePostExpanded(post.id)"
        >
          <ChevronRight
            class="size-4 transition-transform"
            :class="{ 'rotate-90': !post.collapsed }"
          />
        </Button>
      </template>

      <!-- 选择模式 checkbox（分组不可选） -->
      <div
        v-if="props.isSelectMode && post.type !== 'group'"
        class="shrink-0 size-4 rounded border cursor-pointer flex items-center justify-center"
        :class="props.selectedPostIds.has(post.id)
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-muted-foreground'"
        @click.stop="props.togglePostSelection(post.id)"
      >
        <svg v-if="props.selectedPostIds.has(post.id)" class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <span class="line-clamp-1">{{ post.title }}</span>

      <!-- 推送状态标记（分组不显示） -->
      <TooltipProvider v-if="post.type !== 'group' && post.pushRecords?.length" :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="inline-flex size-2 shrink-0 rounded-full bg-green-500" />
          </TooltipTrigger>
          <TooltipContent side="right" class="max-w-xs">
            <div class="text-xs space-y-1">
              <div v-for="(record, idx) in post.pushRecords.slice(-3)" :key="idx">
                {{ record.accountName }} ({{ record.status === 'draft' ? '草稿' : '已发布' }}) - {{ new Date(record.pushedAt).toLocaleString('zh-CN') }}
              </div>
              <div v-if="post.pushRecords.length > 3" class="text-muted-foreground">
                ...共 {{ post.pushRecords.length }} 条记录
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <!-- 每条文章操作 -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="xs"
            variant="ghost"
            class="ml-auto h-max p-0.5"
          >
            <Ellipsis class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <!-- 分组菜单 -->
        <DropdownMenuContent v-if="post.type === 'group'">
          <DropdownMenuItem @click.stop="props.openAddPostDialog(post.id)">
            <PlusSquare class="mr-2 size-4" /> 新增内容
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="props.openAddGroupDialog(post.id)">
            <FolderPlus class="mr-2 size-4" /> 新增分组
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="props.startRenamePost(post.id)">
            <Edit3 class="mr-2 size-4" /> 重命名
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click.stop="props.startDelPost(post.id)">
            <Trash2 class="mr-2 size-4" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
        <!-- 内容菜单 -->
        <DropdownMenuContent v-else>
          <DropdownMenuItem @click.stop="props.openAddPostDialog(post.id)">
            <PlusSquare class="mr-2 size-4" /> 新增内容
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="props.startRenamePost(post.id)">
            <Edit3 class="mr-2 size-4" /> 重命名
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="props.openHistoryDialog(post.id)">
            <History class="mr-2 size-4" /> 历史记录
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="props.openPushRecordDialog(post.id)">
            <Send class="mr-2 size-4" /> 推送记录
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click.stop="saveAsTemplate(post.id)">
            <Package class="mr-2 size-4" /> 存储为模板
          </DropdownMenuItem>
          <DropdownMenuItem @click.stop="applyTemplate(post.id)">
            <FileInput class="mr-2 size-4" /> 应用模板
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-if="posts.length > 1"
            @click.stop="props.startDelPost(post.id)"
          >
            <Trash2 class="mr-2 size-4" /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </a>

    <div
      v-if="isHasChild(post.id) && !post.collapsed"
      class="space-y-1 ml-4 mt-1 border-l-2 border-gray-300 pl-1 dark:border-gray-700"
    >
      <PostItem
        :parent-id="post.id"
        :sorted-posts="props.sortedPosts"
        :start-rename-post="props.startRenamePost"
        :open-history-dialog="props.openHistoryDialog"
        :open-push-record-dialog="props.openPushRecordDialog"
        :start-del-post="props.startDelPost"
        :drag-source-id="props.dragSourceId"
        :set-drag-source-id="props.setDragSourceId"
        :drop-target-id="props.dropTargetId"
        :set-drop-target-id="props.setDropTargetId"
        :handle-drag-end="props.handleDragEnd"
        :handle-drop="props.handleDrop"
        :open-add-post-dialog="props.openAddPostDialog"
        :open-add-group-dialog="props.openAddGroupDialog"
        :is-select-mode="props.isSelectMode"
        :selected-post-ids="props.selectedPostIds"
        :toggle-post-selection="props.togglePostSelection"
      />
    </div>
  </div>
</template>
