<script setup lang="ts">
import { throttle } from 'es-toolkit'
import { ArrowDownFromLine } from 'lucide-vue-next'

type Target = HTMLElement | Window | null

const props = defineProps<{
  left?: number
  top?: number
  right?: number
  bottom?: number
  visibilityHeight?: number
  target?: string
  onClick?: (e: MouseEvent) => void
}>()

const visibilityHeight = ref(props.visibilityHeight ?? 400)
const visible = ref(false)

const target = ref<Target>(null)

function scrollToBottom(e: MouseEvent) {
  if (target.value instanceof HTMLElement) {
    target.value.scrollTo({ top: target.value.scrollHeight, left: 0, behavior: `smooth` })
  }
  else {
    window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: `smooth` })
  }
  props.onClick?.(e)
}

const throttledScroll = throttle((el: Target) => {
  if (el instanceof HTMLElement) {
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    visible.value = distanceToBottom > visibilityHeight.value
  }
  else {
    const distanceToBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight
    visible.value = distanceToBottom > visibilityHeight.value
  }
}, 200, { edges: [`leading`, `trailing`] })

onMounted(() => {
  if (props.target) {
    target.value = document.getElementById(props.target)
  }
  else {
    target.value = window
  }

  target.value!.addEventListener(`scroll`, () => {
    throttledScroll(target.value)
  })
})

onUnmounted(() => {
  target.value!.removeEventListener(`scroll`, () => {
    throttledScroll(target.value)
  })
})
</script>

<template>
  <Button v-if="visible" variant="outline" size="icon" class="absolute z-50 rounded-full" :style="{ left: `${left}px`, top: `${top}px`, right: `${right}px`, bottom: `${bottom}px` }" @click="scrollToBottom">
    <ArrowDownFromLine />
  </Button>
</template>
