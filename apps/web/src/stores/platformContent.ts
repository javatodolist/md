import { addPrefix } from '@/utils'
import { store } from '@/utils/storage'

/**
 * 平台内容配置接口
 */
export interface PlatformContentConfig {
  /** 文章开头 Markdown */
  prefix: string
  /** 文章结尾 Markdown */
  suffix: string
}

/**
 * 平台内容配置 Store
 * 为不同平台配置文章开头/结尾的 Markdown 内容
 * 预览时自动合并，推送时按平台合并
 */
export const usePlatformContentStore = defineStore(`platformContent`, () => {
  // 持久化的平台内容配置（key = 平台标识符，'default' 为通用配置）
  const configs = store.reactive<Record<string, PlatformContentConfig>>(
    addPrefix(`platform_content_configs`),
    {},
  )

  // 当前预览使用的平台（控制预览区显示哪个平台的合并效果）
  const previewPlatform = ref<string>(`wechat`)

  /**
   * 获取指定平台的有效配置
   * 优先使用平台专属配置，fallback 到 default
   */
  function getEffectiveConfig(platform?: string): PlatformContentConfig | null {
    const key = platform || `default`
    if (configs.value[key]) {
      return configs.value[key]
    }
    if (key !== `default` && configs.value.default) {
      return configs.value.default
    }
    return null
  }

  /**
   * 合并 Markdown 内容
   * 在原始 Markdown 前后拼接平台配置的开头/结尾
   */
  function mergeContent(markdown: string, platform?: string): string {
    const config = getEffectiveConfig(platform)
    if (!config) {
      return markdown
    }

    let result = ``
    if (config.prefix && config.prefix.trim()) {
      result += `${config.prefix}\n\n`
    }
    result += markdown
    if (config.suffix && config.suffix.trim()) {
      result += `\n\n${config.suffix}`
    }
    return result
  }

  /**
   * 设置指定平台的配置
   */
  function setConfig(platform: string, config: PlatformContentConfig) {
    configs.value[platform] = { ...config }
  }

  /**
   * 删除指定平台的配置
   */
  function removeConfig(platform: string) {
    delete configs.value[platform]
  }

  /**
   * 判断指定平台是否有直接配置（不含 fallback）
   */
  function hasConfig(platform: string): boolean {
    return !!configs.value[platform]
  }

  /**
   * 判断是否有任何有效配置
   */
  function hasAnyConfig(): boolean {
    return Object.keys(configs.value).length > 0
  }

  return {
    configs,
    previewPlatform,
    getEffectiveConfig,
    mergeContent,
    setConfig,
    removeConfig,
    hasConfig,
    hasAnyConfig,
  }
})
