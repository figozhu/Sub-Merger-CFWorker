import { clearSubscriptionCaches, type RoutingStoreEnv } from '../config/routingConfig'
import type { ConfigurationIssue } from './configuration'

/** 全部订阅源共用一份抓取配置；空 UA 表示使用代码中的默认值。 */
export interface SubscriptionSettings {
  userAgent: string
}

/**
 * 校验自定义 UA，避免非法请求头在实际抓取时才报错。
 * @param value 管理员提交的未知值，空字符串允许恢复默认。
 * @returns 合法时返回空字符串，否则返回可显示的字段错误。
 */
export function validateSubscriptionUserAgent(value: unknown): string {
  if (typeof value !== 'string') return 'User-Agent 必须是字符串，留空可使用默认值'
  if (value.length > 256 || /[^\x20-\x7e]/.test(value)) return 'User-Agent 最多 256 个字符，且只能包含可打印的 ASCII 字符'
  return ''
}

/**
 * 读取唯一的全局抓取配置，兼容尚未保存配置的旧部署。
 * @param env 现有 KV 绑定和业务键前缀。
 * @returns 已保存 UA；未配置或字段无效时返回空字符串，由抓取层使用代码默认值。
 */
export async function getSubscriptionSettings(env: Pick<RoutingStoreEnv, 'SUB_MERGER_KV' | 'TABLENAME'>): Promise<SubscriptionSettings> {
  const stored = await env.SUB_MERGER_KV.get<unknown>(`${env.TABLENAME}:subscription-settings`, 'json')
  const userAgent = stored && typeof stored === 'object' ? (stored as Record<string, unknown>).userAgent : ''
  return { userAgent: typeof userAgent === 'string' && !validateSubscriptionUserAgent(userAgent) ? userAgent.trim() : '' }
}

/**
 * 保存全局 UA 并清理两类订阅缓存，使后续生成使用新请求头。
 * @param env 已有 KV、表名和缓存版本。
 * @param input 请求体，必须提供 userAgent 字符串。
 * @returns 保存后的配置和字段错误；校验失败时不写入任何数据。
 */
export async function saveSubscriptionSettings(env: RoutingStoreEnv, input: unknown): Promise<{ settings: SubscriptionSettings; errors: ConfigurationIssue[] }> {
  const userAgent = input && typeof input === 'object' ? (input as Record<string, unknown>).userAgent : undefined
  const message = validateSubscriptionUserAgent(userAgent)
  if (message) return { settings: { userAgent: '' }, errors: [{ code: 'USER_AGENT_INVALID', path: 'userAgent', message }] }
  const settings = { userAgent: (userAgent as string).trim() }
  await env.SUB_MERGER_KV.put(`${env.TABLENAME}:subscription-settings`, JSON.stringify(settings))
  await clearSubscriptionCaches(env)
  return { settings, errors: [] }
}
