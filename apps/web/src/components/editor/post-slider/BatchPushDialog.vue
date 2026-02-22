<script setup lang="ts">
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Minus,
  Square,
  XCircle,
} from 'lucide-vue-next'
import { CheckboxIndicator, CheckboxRoot } from 'radix-vue'
import DuplicatePushConfirmDialog from './DuplicatePushConfirmDialog.vue'
import { useBatchPush } from '@/composables/useBatchPush'
import { useCoseAccounts } from '@/composables/useCoseAccounts'
import { type DuplicatePushInfo, usePostStore } from '@/stores/post'

const props = defineProps<{
  open: boolean
  postIds: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.open,
  set: value => emit(`update:open`, value),
})

const postStore = usePostStore()

// COSE 账号管理
const {
  extensionInstalled,
  allAccounts,
  accountsByCategory,
  hasCheckedAccounts,
  checkExtension,
  isCategoryAllSelected,
  isCategoryIndeterminate,
  toggleCategorySelectAll,
} = useCoseAccounts()

// 分类折叠状态
const collapsedCategories = ref<Set<string>>(new Set([`云平台及开发者社区`]))
function toggleCategory(name: string) {
  if (collapsedCategories.value.has(name)) {
    collapsedCategories.value.delete(name)
  }
  else {
    collapsedCategories.value.add(name)
  }
}

// 批量推送逻辑
const {
  isRunning,
  items,
  totalCount,
  progressPercent,
  executeBatchPush,
  cancelBatchPush,
  resetState,
} = useBatchPush()

// 当前步骤：select（选平台）| pushing（推送中）
const step = ref<'select' | 'pushing'>(`select`)

// 文章展开状态（查看平台详情）
const expandedArticles = ref<Set<number>>(new Set())
function toggleArticleExpand(index: number) {
  if (expandedArticles.value.has(index)) {
    expandedArticles.value.delete(index)
  }
  else {
    expandedArticles.value.add(index)
  }
}

// 对话框打开时检测 COSE 扩展
watch(() => props.open, (val) => {
  if (val) {
    step.value = `select`
    expandedArticles.value = new Set()
    checkExtension()
  }
})

// 获取平台登录链接（与 PostInfo 一致）
function getPlatformUrl(type: string): string {
  const urls: Record<string, string> = {
    csdn: `https://blog.csdn.net`,
    juejin: `https://juejin.cn`,
    wechat: `https://mp.weixin.qq.com`,
    zhihu: `https://www.zhihu.com/signin`,
    toutiao: `https://mp.toutiao.com`,
    segmentfault: `https://segmentfault.com/user/login`,
    cnblogs: `https://account.cnblogs.com/signin`,
    oschina: `https://www.oschina.net/home/login`,
    cto51: `https://home.51cto.com/index`,
    infoq: `https://account.geekbang.org/infoq/login/sms`,
    jianshu: `https://www.jianshu.com/sign_in`,
    baijiahao: `https://baijiahao.baidu.com`,
    wangyihao: `https://mp.163.com/login.html`,
    tencentcloud: `https://cloud.tencent.com/developer`,
    medium: `https://medium.com/m/signin`,
    sspai: `https://sspai.com/login`,
    sohu: `https://mp.sohu.com/mpfe/v4/login`,
    bilibili: `https://passport.bilibili.com/login`,
    weibo: `https://passport.weibo.com/sso/signin`,
    aliyun: `https://account.aliyun.com/login/login.htm`,
    huaweicloud: `https://auth.huaweicloud.com/authui/login.html`,
    huaweidev: `https://developer.huawei.com/consumer/cn/blog/create`,
    twitter: `https://x.com/i/flow/login`,
    qianfan: `https://qianfan.cloud.baidu.com/qianfandev/topic/create`,
    alipayopen: `https://open.alipay.com/portal/forum/post/add#article`,
    modelscope: `https://modelscope.cn/learn/create`,
    volcengine: `https://developer.volcengine.com/articles/draft`,
    douyin: `https://creator.douyin.com/creator-micro/content/post/article`,
    xiaohongshu: `https://creator.xiaohongshu.com/publish/publish`,
    elecfans: `https://www.elecfans.com/d/article/md/`,
  }
  return urls[type] || `#`
}

// 重复推送检测
const isOpenDuplicateDialog = ref(false)
const duplicateInfos = ref<DuplicatePushInfo[]>([])
const pendingAccounts = ref<typeof allAccounts.value>([])

// 开始批量推送（先检测重复）
async function startPush() {
  const selectedAccounts = allAccounts.value.filter(a => a.checked && a.loggedIn)
  if (selectedAccounts.length === 0)
    return

  // 检测重复推送
  const accountsForCheck = selectedAccounts.map(a => ({
    platform: a.type,
    accountId: a.uid || a.displayName || `default`,
    accountName: a.displayName || a.title || a.type,
  }))
  const duplicates = postStore.findDuplicatePushes(props.postIds, accountsForCheck)

  if (duplicates.length > 0) {
    duplicateInfos.value = duplicates
    pendingAccounts.value = selectedAccounts
    isOpenDuplicateDialog.value = true
    return
  }

  // 无重复，直接推送
  step.value = `pushing`
  await executeBatchPush(props.postIds, selectedAccounts)
}

// 全部推送（包含重复）
async function handleDuplicatePushAll() {
  step.value = `pushing`
  await executeBatchPush(props.postIds, pendingAccounts.value)
}

// 跳过已推送的文章
async function handleDuplicateSkip() {
  const duplicatePostIds = new Set(duplicateInfos.value.map(d => d.postId))
  const filteredPostIds = props.postIds.filter(id => !duplicatePostIds.has(id))
  if (filteredPostIds.length === 0) {
    toast.info(`所有文章均已推送过，无需重复推送`)
    return
  }
  step.value = `pushing`
  await executeBatchPush(filteredPostIds, pendingAccounts.value)
}

function handleClose() {
  if (isRunning.value) {
    cancelBatchPush()
  }
  resetState()
  postStore.clearSelection()
  postStore.toggleSelectMode()
  dialogVisible.value = false
}

function getStatusIcon(status: string) {
  switch (status) {
    case `success`: return CheckCircle2
    case `failed`: return XCircle
    case `processing`: return Loader2
    case `partial`: return Info
    default: return Square
  }
}

function getStatusText(status: string) {
  switch (status) {
    case `success`: return `全部成功`
    case `failed`: return `失败`
    case `partial`: return `部分成功`
    case `processing`: return `发布中`
    default: return `等待中`
  }
}
</script>

<template>
  <Dialog v-model:open="dialogVisible">
    <DialogContent
      class="sm:max-w-[650px] max-h-[85vh] flex flex-col overflow-hidden"
      @pointer-down-outside.prevent
      @escape-key-down.prevent
    >
      <DialogHeader>
        <DialogTitle>批量发布</DialogTitle>
        <DialogDescription>
          <template v-if="step === 'select'">
            已选 {{ postIds.length }} 篇文章，请选择发布平台
          </template>
          <template v-else>
            共 {{ totalCount }} 篇文章，正在依次发布到选中的平台
          </template>
        </DialogDescription>
      </DialogHeader>

      <!-- 步骤一：选择平台 -->
      <template v-if="step === 'select'">
        <div class="flex-1 overflow-y-auto space-y-3 p-1">
          <Alert>
            <Info class="h-4 w-4" />
            <AlertDescription>
              此功能由 <a href="https://github.com/doocs/cose" target="_blank" class="underline">GitHub 开源插件 COSE</a> 支持，完全本地运行。
            </AlertDescription>
          </Alert>

          <Alert v-if="!extensionInstalled">
            <Info class="h-4 w-4" />
            <AlertTitle>未检测到插件</AlertTitle>
            <AlertDescription>
              请安装 <a href="https://chromewebstore.google.com/detail/ilhikcdphhpjofhlnbojifbihhfmmhfk" target="_blank" class="underline text-primary">cose 文章同步助手</a> 浏览器扩展
            </AlertDescription>
          </Alert>

          <!-- 平台选择（与 PostInfo 一致） -->
          <div v-if="extensionInstalled" class="space-y-3">
            <div v-for="category in accountsByCategory" :key="category.name">
              <div class="flex items-center gap-2 mb-2">
                <div
                  class="flex items-center gap-1 cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground"
                  @click="toggleCategory(category.name)"
                >
                  <ChevronDown v-if="!collapsedCategories.has(category.name)" class="h-4 w-4" />
                  <ChevronRight v-else class="h-4 w-4" />
                  <span>{{ category.name }}</span>
                  <span class="text-xs">({{ category.accounts.length }})</span>
                </div>
                <div class="flex items-center gap-1 ml-2">
                  <CheckboxRoot
                    :checked="isCategoryAllSelected(category.accounts) ? true : isCategoryIndeterminate(category.accounts) ? 'indeterminate' : false"
                    class="bg-background hover:bg-muted h-[18px] w-[18px] flex shrink-0 appearance-none items-center justify-center border border-gray-300 rounded-[3px] outline-hidden"
                    @click.stop="toggleCategorySelectAll(category.accounts)"
                  >
                    <CheckboxIndicator>
                      <Check v-if="isCategoryAllSelected(category.accounts)" class="h-3 w-3" />
                      <Minus v-else-if="isCategoryIndeterminate(category.accounts)" class="h-3 w-3" />
                    </CheckboxIndicator>
                  </CheckboxRoot>
                  <span class="text-xs text-muted-foreground">全选</span>
                </div>
              </div>
              <div v-show="!collapsedCategories.has(category.name)" class="grid grid-cols-2 gap-x-8 gap-y-2 pl-5">
                <div
                  v-for="account in category.accounts"
                  :key="account.uid"
                  class="flex items-center gap-2 whitespace-nowrap"
                >
                  <CheckboxRoot
                    v-model:checked="account.checked"
                    :disabled="!account.loggedIn"
                    class="bg-background hover:bg-muted h-[18px] w-[18px] flex shrink-0 appearance-none items-center justify-center border border-gray-300 rounded-[3px] outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckboxIndicator>
                      <Check v-if="account.checked" class="h-3 w-3" />
                    </CheckboxIndicator>
                  </CheckboxRoot>
                  <img
                    :src="account.icon"
                    alt=""
                    class="inline-block h-[16px] w-[16px] shrink-0"
                  >
                  <span class="text-sm font-medium">{{ account.title }}</span>
                  <template v-if="account.isChecking">
                    <Loader2 class="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span class="text-xs text-muted-foreground">检测中</span>
                  </template>
                  <template v-else-if="account.loggedIn">
                    <img
                      v-if="account.avatar"
                      :src="account.avatar"
                      alt=""
                      class="ml-1 h-4 w-4 rounded-full object-cover"
                      referrerpolicy="no-referrer"
                      @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
                    >
                    <span class="text-sm text-muted-foreground">@{{ account.displayName }}</span>
                  </template>
                  <a
                    v-else
                    :href="getPlatformUrl(account.type)"
                    target="_blank"
                    class="ml-1 text-sm text-muted-foreground hover:underline"
                  >
                    登录
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="dialogVisible = false">
            取消
          </Button>
          <Button :disabled="!hasCheckedAccounts" @click="startPush">
            开始发布
          </Button>
        </DialogFooter>
      </template>

      <!-- 步骤二：发布进度 -->
      <template v-else>
        <!-- 进度条 -->
        <div class="space-y-2">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>发布进度</span>
            <span>{{ progressPercent }}%</span>
          </div>
          <Progress :model-value="progressPercent" />
        </div>

        <!-- 文章状态列表 -->
        <div class="flex-1 max-h-[400px] overflow-y-auto space-y-1">
          <div
            v-for="(item, index) in items"
            :key="item.postId"
            class="rounded border"
          >
            <!-- 文章标题行 -->
            <div
              class="flex items-center gap-2 p-2 text-sm cursor-pointer"
              :class="{
                'bg-green-50 dark:bg-green-950/30': item.status === 'success',
                'bg-red-50 dark:bg-red-950/30': item.status === 'failed',
                'bg-blue-50 dark:bg-blue-950/30': item.status === 'processing',
                'bg-yellow-50 dark:bg-yellow-950/30': item.status === 'partial',
              }"
              @click="toggleArticleExpand(index)"
            >
              <component
                :is="getStatusIcon(item.status)"
                class="size-4 shrink-0"
                :class="{
                  'text-green-600': item.status === 'success',
                  'text-red-600': item.status === 'failed',
                  'text-blue-600 animate-spin': item.status === 'processing',
                  'text-yellow-600': item.status === 'partial',
                  'text-muted-foreground': item.status === 'pending',
                }"
              />
              <span class="flex-1 truncate">{{ item.title }}</span>
              <span class="text-xs text-muted-foreground">{{ getStatusText(item.status) }}</span>
              <ChevronDown
                v-if="item.platformStatuses?.length"
                class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                :class="{ '-rotate-90': !expandedArticles.has(index) }"
              />
            </div>

            <!-- 平台详情（展开时显示） -->
            <div
              v-if="item.platformStatuses?.length && expandedArticles.has(index)"
              class="border-t px-3 py-2 space-y-1.5"
            >
              <div
                v-for="ps in item.platformStatuses"
                :key="ps.type"
                class="flex items-center gap-2 text-sm"
              >
                <img
                  :src="ps.icon"
                  alt=""
                  class="h-4 w-4 shrink-0"
                >
                <span>{{ ps.title }}</span>
                <span class="text-xs text-muted-foreground">{{ ps.displayName }}</span>
                <span class="ml-auto text-xs" :class="{
                  'text-yellow-600': ps.status === 'uploading',
                  'text-green-600': ps.status === 'done',
                  'text-red-600': ps.status === 'failed',
                  'text-muted-foreground': ps.status === 'pending',
                }">
                  {{ ps.status === 'done' ? '成功' : ps.status === 'failed' ? '失败' : ps.status === 'uploading' ? '发布中' : '等待' }}
                </span>
                <a
                  v-if="ps.status === 'done' && ps.draftLink"
                  :href="ps.draftLink"
                  target="_blank"
                  class="text-xs text-blue-500 hover:underline"
                >
                  查看
                </a>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            v-if="isRunning"
            variant="destructive"
            @click="cancelBatchPush"
          >
            取消发布
          </Button>
          <Button
            v-else
            @click="handleClose"
          >
            完成
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- 重复推送确认对话框 -->
  <DuplicatePushConfirmDialog
    v-model:open="isOpenDuplicateDialog"
    :duplicates="duplicateInfos"
    @push-all="handleDuplicatePushAll"
    @skip-duplicates="handleDuplicateSkip"
  />
</template>
