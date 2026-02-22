<script setup lang="ts">
import type { Post } from '@md/shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePlatformContentStore } from '@/stores/platformContent'
import { usePostStore } from '@/stores/post'
import { useRenderStore } from '@/stores/render'
import { sanitizeForPublish } from '@/utils'

declare global {
  interface Window {
    $cose: any
  }
}

const props = defineProps<{
  post: Post
  open: boolean
}>()

const emit = defineEmits([`update:open`])

const postStore = usePostStore()
const platformContentStore = usePlatformContentStore()
const renderStore = useRenderStore()

const dialogVisible = computed({
  get: () => props.open,
  set: value => emit(`update:open`, value),
})

const taskStatus = ref<any>(null)
const submitting = ref(false)
// 已记录推送的账号集合，避免 onProgress 多次回调时重复记录
const recordedAccounts = ref<Set<string>>(new Set())

async function startPost() {
  if (!props.post)
    return

  recordedAccounts.value = new Set()

  // 按目标平台合并开头/结尾内容
  const checkedAccounts = props.post.accounts.filter(a => a.checked)
  const platformType = checkedAccounts[0]?.type ?? `default`
  const mergedMarkdown = platformContentStore.mergeContent(
    props.post.markdown || ``,
    platformType,
  )

  // 使用合并后的内容重新渲染
  renderStore.render(mergedMarkdown, { skipMerge: true })
  await nextTick()

  const taskData = {
    post: {
      title: props.post.title,
      content: sanitizeForPublish(renderStore.output),
      markdown: mergedMarkdown,
      thumb: props.post.thumb,
      desc: props.post.desc,
    },
    accounts: checkedAccounts,
  }

  const onProgress = (newStatus: any) => {
    taskStatus.value = newStatus

    // 对每个完成的平台记录推送状态
    if (postStore.currentPostId && newStatus?.accounts) {
      for (const account of newStatus.accounts) {
        const accountKey = `${account.type}_${account.uid || account.displayName}`
        if (account.status === `done` && !recordedAccounts.value.has(accountKey)) {
          recordedAccounts.value.add(accountKey)
          postStore.addPushRecord(postStore.currentPostId, {
            platform: account.type,
            accountId: account.uid || account.displayName || `default`,
            accountName: account.displayName || account.title || account.type,
            pushedAt: new Date().toISOString(),
            status: `draft`,
          })
        }
      }
    }
  }

  const onComplete = () => {
    submitting.value = false
  }

  try {
    window.$cose?.addTask(taskData, onProgress, onComplete)
  }
  catch (error) {
    console.error(`发布失败:`, error)
  }
}

watch(() => props.open, (newVal) => {
  if (newVal) {
    startPost()
  }
})
</script>

<template>
  <Dialog v-model:open="dialogVisible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>提交发布任务</DialogTitle>
      </DialogHeader>

      <div class="mt-4">
        <div v-if="!taskStatus" class="py-4 text-center">
          等待发布..
        </div>
        <div v-else class="max-h-[400px] flex flex-col overflow-y-auto">
          <div
            v-for="account in taskStatus?.accounts"
            :key="account.uid + account.displayName"
            class="border-b py-4 last:border-b-0"
          >
            <div class="mb-2 flex items-center gap-2">
              <img
                v-if="account.icon"
                :src="account.icon"
                class="object-cover h-5 w-5"
                alt=""
              >
              <span>{{ account.title }} - {{ account.displayName || account.home }}</span>
            </div>
            <div
              class="w-full flex-1 gap-2 overflow-auto pl-7 text-sm" :class="{
                'text-yellow-600': account.status === 'uploading',
                'text-red-600': account.status === 'failed',
                'text-green-600': account.status === 'done',
              }"
            >
              <template v-if="account.status === 'uploading'">
                {{ account.msg || '发布中' }}
              </template>

              <template v-if="account.status === 'failed'">
                同步失败, 错误内容：{{ account.error }}
              </template>

              <template v-if="account.status === 'done' && account.editResp">
                同步成功
                <a
                  v-if="account.type !== 'wordpress' && account.editResp"
                  :href="account.editResp.draftLink"
                  class="ml-2 text-blue-500 hover:underline"
                  referrerPolicy="no-referrer"
                  target="_blank"
                >查看草稿</a>
              </template>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.account-item {
  margin-bottom: 1rem;
}
</style>
