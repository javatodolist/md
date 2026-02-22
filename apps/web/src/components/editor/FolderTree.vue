<script setup lang="ts">
import type { FileSystemNode } from '@/stores/folderSource'
import { Check, ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-vue-next'

interface Props {
  nodes: FileSystemNode[]
  selectedPath?: string
  expandedPaths?: Set<string>
  /** 已加载的文章标题集合（用于判断文件是否已导入） */
  loadedTitles?: Set<string>
  level?: number
}

interface Emits {
  (e: 'select', node: FileSystemNode): void
  (e: 'toggleExpand', path: string): void
  (e: 'batchLoad', node: FileSystemNode): void
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  expandedPaths: () => new Set<string>(),
  loadedTitles: () => new Set<string>(),
})

const emit = defineEmits<Emits>()

const isSelected = (path: string) => props.selectedPath === path

const isExpanded = (path: string) => props.expandedPaths.has(path)

/**
 * 通过文件名（去掉 .md 后缀）匹配 posts 标题来判断是否已加载
 */
function isLoaded(node: FileSystemNode): boolean {
  if (node.type !== `file`)
    return false
  const title = node.name.replace(/\.md$/i, ``)
  return props.loadedTitles.has(title)
}

function handleNodeClick(node: FileSystemNode, event: MouseEvent) {
  event.stopPropagation()
  if (node.type === `file`) {
    emit(`select`, node)
  }
  else {
    emit(`toggleExpand`, node.path)
  }
}

function handleToggleClick(node: FileSystemNode, event: MouseEvent) {
  event.stopPropagation()
  if (node.type === `directory`) {
    emit(`toggleExpand`, node.path)
  }
}

function handleBatchLoad(node: FileSystemNode, event: MouseEvent) {
  event.stopPropagation()
  emit(`batchLoad`, node)
}

/**
 * 统计文件夹下已加载/总文件数
 */
function getLoadStats(node: FileSystemNode): { loaded: number, total: number } {
  let loaded = 0
  let total = 0
  if (!node.children)
    return { loaded, total }
  for (const child of node.children) {
    if (child.type === `file`) {
      total++
      if (isLoaded(child))
        loaded++
    }
    else if (child.children) {
      const sub = getLoadStats(child)
      loaded += sub.loaded
      total += sub.total
    }
  }
  return { loaded, total }
}
</script>

<template>
  <div class="folder-tree">
    <template v-for="node in nodes" :key="node.path">
      <!-- 节点本身 -->
      <div
        class="tree-node"
        :class="{
          selected: isSelected(node.path),
          directory: node.type === 'directory',
          file: node.type === 'file',
          loaded: isLoaded(node),
        }"
        :style="{ paddingLeft: `${level * 16 + 8}px` }"
        @click="handleNodeClick(node, $event)"
      >
        <!-- 展开/折叠图标 -->
        <span
          v-if="node.type === 'directory'"
          class="toggle-icon"
          @click="handleToggleClick(node, $event)"
        >
          <ChevronRight v-if="!isExpanded(node.path)" class="h-4 w-4" />
          <ChevronDown v-else class="h-4 w-4" />
        </span>
        <span v-else class="toggle-icon-placeholder" />

        <!-- 文件/文件夹图标 -->
        <span class="node-icon">
          <Folder v-if="node.type === 'directory' && !isExpanded(node.path)" class="h-4 w-4" />
          <FolderOpen v-else-if="node.type === 'directory' && isExpanded(node.path)" class="h-4 w-4" />
          <File v-else class="h-4 w-4" />
        </span>

        <!-- 节点名称 -->
        <span class="node-name" :title="node.name">
          {{ node.name }}
        </span>

        <!-- 文件：已加载标记 -->
        <span v-if="isLoaded(node)" class="loaded-badge" title="已加载">
          <Check class="h-3 w-3" />
        </span>

        <!-- 文件夹：加载统计 + 批量加载按钮 -->
        <template v-if="node.type === 'directory'">
          <span class="dir-stats">
            {{ getLoadStats(node).loaded }}/{{ getLoadStats(node).total }}
          </span>
          <span
            class="batch-load-btn"
            title="批量加载"
            @click="handleBatchLoad(node, $event)"
          >
            加载
          </span>
        </template>
      </div>

      <!-- 递归渲染子节点（紧接在父节点之后） -->
      <FolderTree
        v-if="node.type === 'directory' && isExpanded(node.path) && node.children"
        :nodes="node.children"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        :loaded-titles="loadedTitles"
        :level="level + 1"
        @select="emit('select', $event)"
        @toggle-expand="emit('toggleExpand', $event)"
        @batch-load="emit('batchLoad', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.folder-tree {
  user-select: none;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node:hover {
  background-color: hsl(var(--accent) / 0.1);
}

.tree-node.selected {
  background-color: hsl(var(--accent) / 0.2);
  font-weight: 500;
}

.tree-node.file:not(.loaded) {
  opacity: 0.6;
}

.tree-node.file.loaded {
  opacity: 1;
}

.toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.toggle-icon-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.node-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.tree-node.selected .node-icon {
  color: hsl(var(--primary));
}

.tree-node.loaded .node-icon {
  color: hsl(var(--primary));
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node.directory .node-name {
  font-weight: 500;
}

.loaded-badge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.dir-stats {
  flex-shrink: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  margin-left: auto;
}

.batch-load-btn {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  color: hsl(var(--primary));
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tree-node:hover .batch-load-btn {
  opacity: 1;
}

.batch-load-btn:hover {
  background-color: hsl(var(--accent) / 0.2);
}
</style>
