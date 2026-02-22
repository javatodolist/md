<script setup lang="ts">
import type { FileSystemNode } from '@/stores/folderSource'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  FolderTree as FolderTreeIcon,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { useFolderFileSync } from '@/composables/useFolderFileSync'
import { useFolderSourceStore } from '@/stores/folderSource'
import { usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'
import FolderTree from './FolderTree.vue'

const folderSourceStore = useFolderSourceStore()
const postStore = usePostStore()
const uiStore = useUIStore()
const { setCurrentFilePath } = useFolderFileSync()

const {
  folderHandles,
  folderTrees,
  selectedFilePath,
  isLoading,
  loadError,
  isFileSystemAPISupported,
} = storeToRefs(folderSourceStore)

// 根据 postStore.posts 的标题集合来判断文件是否已加载（持久化，刷新后不丢失）
const { posts } = storeToRefs(postStore)
const loadedTitles = computed(() => new Set(posts.value.map(p => p.title)))

// 整个面板的收拢/展开（向左收拢），使用 UI Store 的状态以便 ResizablePanel 联动
const { isFolderPanelCollapsed: isPanelCollapsed } = storeToRefs(uiStore)

// 每个文件夹的展开/折叠状态（文件夹面板级别）
const expandedFolderIds = ref<Set<string>>(new Set())

// 文件树内部的展开路径（所有文件夹共用）
const expandedPaths = ref<Set<string>>(new Set())

// 页面加载时恢复之前打开的文件夹
onMounted(async () => {
  await folderSourceStore.restoreFolders()
  // 展开所有恢复的文件夹面板
  for (const folder of folderHandles.value) {
    expandedFolderIds.value.add(folder.id)
    // 展开每个文件夹的根节点
    const tree = folderSourceStore.getFolderTree(folder.id)
    if (tree.length > 0) {
      expandedPaths.value.add(tree[0].path)
    }
  }
  expandedFolderIds.value = new Set(expandedFolderIds.value)
  expandedPaths.value = new Set(expandedPaths.value)
})

function toggleFolderExpand(folderId: string) {
  const next = new Set(expandedFolderIds.value)
  if (next.has(folderId)) {
    next.delete(folderId)
  }
  else {
    next.add(folderId)
  }
  expandedFolderIds.value = next
}

function handleToggleExpand(path: string) {
  const next = new Set(expandedPaths.value)
  if (next.has(path)) {
    next.delete(path)
  }
  else {
    next.add(path)
  }
  expandedPaths.value = next
}

async function handleSelectFolder() {
  await folderSourceStore.selectFolder()
  await nextTick()
  // 展开新打开的文件夹
  for (const folder of folderHandles.value) {
    if (!expandedFolderIds.value.has(folder.id)) {
      const next = new Set(expandedFolderIds.value)
      next.add(folder.id)
      expandedFolderIds.value = next
    }
    const tree = folderSourceStore.getFolderTree(folder.id)
    if (tree.length > 0 && !expandedPaths.value.has(tree[0].path)) {
      const next = new Set(expandedPaths.value)
      next.add(tree[0].path)
      expandedPaths.value = next
    }
  }
}

async function handleRefreshFolder(folderId: string) {
  const folder = folderHandles.value.find(f => f.id === folderId)
  if (folder) {
    await folderSourceStore.loadFileTree(folder.handle, folderId)
  }
}

function handleRemoveFolder(folderId: string) {
  folderSourceStore.removeFolder(folderId)
  const next = new Set(expandedFolderIds.value)
  next.delete(folderId)
  expandedFolderIds.value = next
}

async function handleOpenFile(node: FileSystemNode) {
  const title = node.name.replace(/\.md$/i, ``)

  // 如果已存在同名文章，直接切换过去
  const existing = postStore.posts.find(p => p.title === title)
  if (existing) {
    postStore.currentPostId = existing.id
    setCurrentFilePath(node.path)
    return
  }

  try {
    const content = await folderSourceStore.readFile(node.path)

    postStore.addPost(title)
    postStore.updatePostContent(postStore.currentPostId, content)
    setCurrentFilePath(node.path)

    toast.success(`已加载文件: ${node.name}`)
  }
  catch (error) {
    console.error(`打开文件失败:`, error)
  }
}

// 批量加载文件夹下的所有 md 文件
const isBatchLoading = ref(false)

async function handleBatchLoad(node: FileSystemNode) {
  const files = folderSourceStore.getAllMarkdownFiles(node.children ?? [])
  // 通过标题判断：过滤掉内容区已存在同名文章的文件
  const unloaded = files.filter((f) => {
    const title = f.name.replace(/\.md$/i, ``)
    return !loadedTitles.value.has(title)
  })

  if (unloaded.length === 0) {
    toast.info(`该文件夹下所有文件均已加载`)
    return
  }

  isBatchLoading.value = true
  let count = 0

  try {
    for (const file of unloaded) {
      try {
        const fileHandle = file.handle as FileSystemFileHandle
        const raw = await fileHandle.getFile()
        const content = await raw.text()
        const title = file.name.replace(/\.md$/i, ``)

        postStore.addPost(title)
        postStore.updatePostContent(postStore.currentPostId, content)
        count++
      }
      catch (err) {
        console.error(`加载文件失败: ${file.name}`, err)
      }
    }
    toast.success(`已加载 ${count} 个文件`)
  }
  finally {
    isBatchLoading.value = false
  }
}
</script>

<template>
  <div class="folder-source-panel h-full flex">
    <!-- 收拢状态：竖条 -->
    <div
      v-if="isPanelCollapsed"
      class="collapsed-bar"
      @click="isPanelCollapsed = false"
    >
      <ChevronRight class="h-3.5 w-3.5 shrink-0" />
      <span class="collapsed-label">本地文件夹</span>
    </div>

    <!-- 展开状态：完整面板 -->
    <div v-else class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- 头部工具栏 -->
      <div class="panel-header sticky top-0 z-10 bg-background border-b p-2 shrink-0">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <FolderTreeIcon class="h-4 w-4" />
            本地文件夹
          </h3>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 shrink-0"
            title="收起面板"
            @click="isPanelCollapsed = true"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 text-xs"
            :disabled="isLoading || !isFileSystemAPISupported || isBatchLoading"
            @click="handleSelectFolder"
          >
            <FolderPlus v-if="!isLoading" class="h-3 w-3 mr-1" />
            <Loader2 v-else class="h-3 w-3 mr-1 animate-spin" />
            打开文件夹
          </Button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="panel-content flex-1 overflow-y-auto p-2">
        <!-- 不支持 API 的提示 -->
        <div
          v-if="!isFileSystemAPISupported"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground"
        >
          <FolderClosed class="h-12 w-12 mb-2 opacity-50" />
          <p class="text-sm">
            您的浏览器不支持本地文件夹访问
          </p>
          <p class="text-xs mt-1">
            请使用 Chrome、Edge 或 Opera 浏览器
          </p>
        </div>

        <!-- 加载中 -->
        <div
          v-else-if="isLoading && folderHandles.length === 0"
          class="flex flex-col items-center justify-center h-full"
        >
          <Loader2 class="h-8 w-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground mt-2">
            加载中...
          </p>
        </div>

        <!-- 错误提示 -->
        <div
          v-else-if="loadError && folderHandles.length === 0"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-destructive"
        >
          <p class="text-sm">
            {{ loadError }}
          </p>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="folderHandles.length === 0"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground"
        >
          <FolderOpen class="h-12 w-12 mb-2 opacity-50" />
          <p class="text-sm">
            未打开文件夹
          </p>
          <p class="text-xs mt-1">
            点击上方按钮打开本地文件夹
          </p>
        </div>

        <!-- 文件夹列表 -->
        <div v-else class="space-y-1">
          <div v-for="folder in folderHandles" :key="folder.id" class="folder-section">
            <!-- 文件夹标题栏 -->
            <div
              class="folder-header"
              @click="toggleFolderExpand(folder.id)"
            >
              <span class="toggle-icon">
                <ChevronDown v-if="expandedFolderIds.has(folder.id)" class="h-4 w-4" />
                <ChevronRight v-else class="h-4 w-4" />
              </span>
              <FolderOpen v-if="expandedFolderIds.has(folder.id)" class="h-4 w-4 text-amber-500 shrink-0" />
              <FolderClosed v-else class="h-4 w-4 text-amber-500 shrink-0" />
              <span class="folder-name" :title="folder.name">{{ folder.name }}</span>

              <!-- 文件夹操作按钮 -->
              <div class="folder-actions" @click.stop>
                <button
                  class="folder-action-btn"
                  title="刷新"
                  @click="handleRefreshFolder(folder.id)"
                >
                  <RefreshCw class="h-3 w-3" />
                </button>
                <button
                  class="folder-action-btn"
                  title="移除"
                  @click="handleRemoveFolder(folder.id)"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- 文件树内容（展开时显示） -->
            <div v-if="expandedFolderIds.has(folder.id)" class="folder-content">
              <FolderTree
                :nodes="folderTrees.get(folder.id) ?? []"
                :selected-path="selectedFilePath"
                :expanded-paths="expandedPaths"
                :loaded-titles="loadedTitles"
                @select="handleOpenFile"
                @toggle-expand="handleToggleExpand"
                @batch-load="handleBatchLoad"
              />
            </div>
          </div>
        </div>

        <!-- 批量加载中遮罩 -->
        <div
          v-if="isBatchLoading"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        >
          <div class="bg-background rounded-lg p-4 flex items-center gap-3 shadow-lg">
            <Loader2 class="h-5 w-5 animate-spin text-primary" />
            <span class="text-sm">批量加载中...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.folder-source-panel {
  background-color: hsl(var(--background));
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

.panel-header {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.panel-content {
  min-height: 0;
}

.folder-section {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  overflow: hidden;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.folder-header:hover {
  background-color: hsl(var(--accent) / 0.1);
}

.toggle-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.folder-header:hover .folder-actions {
  opacity: 1;
}

.folder-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: hsl(var(--muted-foreground));
  transition: all 0.15s ease;
}

.folder-action-btn:hover {
  background-color: hsl(var(--accent) / 0.2);
  color: hsl(var(--foreground));
}

.folder-content {
  border-top: 1px solid hsl(var(--border));
  padding: 4px 0;
}
</style>
