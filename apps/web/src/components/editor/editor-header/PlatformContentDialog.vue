<script setup lang="ts">
import { PLATFORM_LABELS } from '@/stores/post'
import { usePlatformContentStore } from '@/stores/platformContent'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits([`close`])

const platformContentStore = usePlatformContentStore()

// 当前选中的平台
const selectedPlatform = ref(`default`)

// 编辑区绑定的 prefix / suffix
const prefix = ref(``)
const suffix = ref(``)

// 平台选项列表
const platformOptions = computed(() => {
  const options = [{ value: `default`, label: `通用（所有平台）` }]
  for (const [key, label] of Object.entries(PLATFORM_LABELS)) {
    const hasConfig = platformContentStore.hasConfig(key)
    options.push({
      value: key,
      label: hasConfig ? `${label} ✦` : label,
    })
  }
  return options
})

// 切换平台时加载该平台的配置
watch(selectedPlatform, (platform) => {
  loadPlatformConfig(platform)
})

// 对话框打开时加载当前选中平台的配置
watch(() => props.visible, (visible) => {
  if (visible) {
    loadPlatformConfig(selectedPlatform.value)
  }
})

function loadPlatformConfig(platform: string) {
  const config = platformContentStore.configs[platform]
  prefix.value = config?.prefix ?? ``
  suffix.value = config?.suffix ?? ``
}

function handleSave() {
  const trimmedPrefix = prefix.value.trim()
  const trimmedSuffix = suffix.value.trim()

  if (!trimmedPrefix && !trimmedSuffix) {
    // 如果都为空，移除该平台的配置
    platformContentStore.removeConfig(selectedPlatform.value)
    toast.success(`已清除该平台的配置`)
  }
  else {
    platformContentStore.setConfig(selectedPlatform.value, {
      prefix: prefix.value,
      suffix: suffix.value,
    })
    toast.success(`配置已保存`)
  }
}

function handleClear() {
  platformContentStore.removeConfig(selectedPlatform.value)
  prefix.value = ``
  suffix.value = ``
  toast.success(`已清除该平台的配置`)
}

function onUpdate(val: boolean) {
  if (!val) {
    emit(`close`)
  }
}
</script>

<template>
  <Dialog :open="props.visible" @update:open="onUpdate">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>平台内容配置</DialogTitle>
        <DialogDescription>
          为不同平台配置文章开头和结尾内容，预览和推送时自动合并
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 mt-2">
        <!-- 平台选择 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">平台</label>
          <Select v-model="selectedPlatform">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in platformOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 文章开头 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">文章开头</label>
          <Textarea
            v-model="prefix"
            placeholder="输入 Markdown 内容，将自动添加到文章开头..."
            class="min-h-[80px] font-mono text-sm"
          />
        </div>

        <!-- 文章结尾 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">文章结尾</label>
          <Textarea
            v-model="suffix"
            placeholder="输入 Markdown 内容，将自动添加到文章结尾..."
            class="min-h-[80px] font-mono text-sm"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="!platformContentStore.hasConfig(selectedPlatform)"
            @click="handleClear"
          >
            清除当前平台配置
          </Button>
          <Button size="sm" @click="handleSave">
            保存
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
