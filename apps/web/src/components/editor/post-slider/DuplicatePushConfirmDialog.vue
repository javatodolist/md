<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import type { DuplicatePushInfo } from '@/stores/post'
import { getPlatformLabel } from '@/stores/post'

const props = defineProps<{
  open: boolean
  duplicates: DuplicatePushInfo[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 全部推送（包含重复项） */
  'pushAll': []
  /** 跳过已推送的 */
  'skipDuplicates': []
}>()

const dialogVisible = computed({
  get: () => props.open,
  set: value => emit(`update:open`, value),
})

function handlePushAll() {
  emit(`pushAll`)
  dialogVisible.value = false
}

function handleSkip() {
  emit(`skipDuplicates`)
  dialogVisible.value = false
}

function handleCancel() {
  dialogVisible.value = false
}
</script>

<template>
  <Dialog v-model:open="dialogVisible">
    <DialogContent class="sm:max-w-[550px] max-h-[80vh] flex flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <AlertTriangle class="size-5 text-yellow-500" />
          检测到重复推送
        </DialogTitle>
        <DialogDescription>
          以下文章已推送过相同平台，请选择处理方式
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto space-y-3 p-1">
        <div
          v-for="info in props.duplicates"
          :key="info.postId"
          class="rounded border p-3 space-y-2"
        >
          <div class="text-sm font-medium truncate">
            {{ info.postTitle }}
          </div>
          <div class="space-y-1">
            <div
              v-for="dup in info.duplicates"
              :key="`${dup.platform}_${dup.accountId}`"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span class="inline-flex size-1.5 rounded-full bg-yellow-500 shrink-0" />
              <span>{{ getPlatformLabel(dup.platform) }}</span>
              <span>{{ dup.accountName }}</span>
              <span class="ml-auto text-xs whitespace-nowrap">
                {{ new Date(dup.lastPushedAt).toLocaleString('zh-CN') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="flex-col sm:flex-row gap-2">
        <Button variant="outline" @click="handleCancel">
          取消
        </Button>
        <Button variant="secondary" @click="handleSkip">
          跳过已推送
        </Button>
        <Button @click="handlePushAll">
          全部推送
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
