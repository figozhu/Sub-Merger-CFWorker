import { getDefaultSelfNodeData } from '../data/selfNodeData'
import { SubscriptionType } from '../types/types'
import { clearSubscriptionCaches, getSelfNodesKey, type RoutingStoreEnv } from '../config/routingConfig'

/** 管理台与订阅生成器共享的订阅源数据结构。 */
export interface SubscriptionRecord {
  subName: string
  subType: SubscriptionType
  subUrl: string
}

/** 自建节点独立 KV 文档，raw 始终保存管理员输入的原始 JSON。 */
export interface SelfNodesDocument {
  raw: string
  updatedAt: string
}

/** 字段或配置级错误，path 可直接映射到前端控件。 */
export interface ConfigurationIssue {
  code: string
  path: string
  message: string
}

/** 自建节点 JSON 的解析与校验结果。 */
export interface SelfNodesAnalysis {
  valid: boolean
  raw: string
  nodes: Record<string, unknown>[]
  errors: ConfigurationIssue[]
}

/**
 * 判断字符串是否为 HTTP 或 HTTPS 地址。
 * @param value 待检查的 URL 字符串。
 * @returns 仅在 URL 可解析且协议受支持时返回 true。
 */
function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 校验并规范化整组订阅源。
 * 允许保存空数组以支持仅自建节点；非数组仍拒绝，并保留重复名称或 URL 的原有语义。
 * @param input 请求中的未知数据。
 * @returns 规范化订阅数组以及所有字段错误。
 */
export function normalizeSubscriptions(input: unknown): {
  subscriptions: SubscriptionRecord[]
  errors: ConfigurationIssue[]
} {
  const errors: ConfigurationIssue[] = []
  if (!Array.isArray(input)) {
    return {
      subscriptions: [],
      errors: [{ code: 'SUBSCRIPTIONS_NOT_ARRAY', path: 'subscriptions', message: '订阅源必须是数组，可使用空数组' }],
    }
  }

  const subscriptions = input.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const subName = typeof record.subName === 'string' ? record.subName.trim() : ''
    const subType = typeof record.subType === 'string' ? record.subType.trim() : ''
    const subUrl = typeof record.subUrl === 'string' ? record.subUrl.trim() : ''

    if (!subName) {
      errors.push({ code: 'SUBSCRIPTION_NAME_REQUIRED', path: `subscriptions[${index}].subName`, message: '请输入订阅源名称' })
    }
    if (![SubscriptionType.Monthly, SubscriptionType.TrafficPackage].includes(subType as SubscriptionType)) {
      errors.push({ code: 'SUBSCRIPTION_TYPE_INVALID', path: `subscriptions[${index}].subType`, message: '请选择有效的订阅类型' })
    }
    if (!isHttpUrl(subUrl)) {
      errors.push({ code: 'SUBSCRIPTION_URL_INVALID', path: `subscriptions[${index}].subUrl`, message: '请输入合法的 HTTP 或 HTTPS 地址' })
    }

    return { subName, subType: subType as SubscriptionType, subUrl }
  })

  return { subscriptions, errors }
}

/**
 * 从 KV 读取已保存订阅源。
 * KV 没有数据或数据损坏时返回空数组，避免管理页直接抛出 500。
 * @param env Worker 运行环境。
 * @returns 当前已保存订阅源。
 */
export async function getSubscriptions(env: RoutingStoreEnv): Promise<SubscriptionRecord[]> {
  const value = await env.SUB_MERGER_KV.get<unknown>(env.TABLENAME, 'json')
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SubscriptionRecord => Boolean(item && typeof item === 'object'))
}

/**
 * 校验、保存订阅源并清理两类正式输出缓存。
 * @param env Worker 运行环境。
 * @param input 请求中的订阅源数组。
 * @returns 保存后的规范化数据与字段错误；有错误时不会写 KV。
 */
export async function saveSubscriptions(
  env: RoutingStoreEnv,
  input: unknown,
): Promise<{ subscriptions: SubscriptionRecord[]; errors: ConfigurationIssue[] }> {
  const result = normalizeSubscriptions(input)
  if (result.errors.length > 0) return result

  await env.SUB_MERGER_KV.put(env.TABLENAME, JSON.stringify(result.subscriptions))
  await clearSubscriptionCaches(env)
  return result
}

/**
 * 解析并校验自建节点 JSON。
 * 根节点必须为数组，每项必须为对象且包含唯一的非空 name；其它协议字段原样保留。
 * @param raw 管理员输入的 JSON 文本。
 * @returns 解析后的节点、原始文本和可定位错误。
 */
export function analyzeSelfNodes(raw: unknown): SelfNodesAnalysis {
  const text = typeof raw === 'string' ? raw : ''
  const errors: ConfigurationIssue[] = []
  let parsed: unknown

  try {
    parsed = text.trim() ? JSON.parse(text) : []
  } catch (error) {
    return {
      valid: false,
      raw: text,
      nodes: [],
      errors: [{
        code: 'SELF_NODES_JSON_INVALID',
        path: 'raw',
        message: `JSON 语法错误：${error instanceof Error ? error.message : '无法解析'}`,
      }],
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      valid: false,
      raw: text,
      nodes: [],
      errors: [{ code: 'SELF_NODES_ROOT_INVALID', path: 'raw', message: 'JSON 根节点必须是数组' }],
    }
  }

  const seenNames = new Map<string, number>()
  const nodes: Record<string, unknown>[] = []
  parsed.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({ code: 'SELF_NODE_INVALID', path: `nodes[${index}]`, message: `第 ${index + 1} 个节点必须是对象` })
      return
    }
    const node = item as Record<string, unknown>
    const name = typeof node.name === 'string' ? node.name.trim() : ''
    if (!name) {
      errors.push({ code: 'SELF_NODE_NAME_REQUIRED', path: `nodes[${index}].name`, message: `第 ${index + 1} 个节点缺少非空名称` })
    } else if (seenNames.has(name)) {
      errors.push({
        code: 'SELF_NODE_NAME_DUPLICATE',
        path: `nodes[${index}].name`,
        message: `节点名称“${name}”与第 ${(seenNames.get(name) ?? 0) + 1} 个节点重复`,
      })
    } else {
      seenNames.set(name, index)
    }
    nodes.push(node)
  })

  return { valid: errors.length === 0, raw: text, nodes, errors }
}

/**
 * 读取自建节点原始 JSON，优先使用新版独立键，再兼容旧 `${TABLENAME}:config`。
 * 空数组是合法显式配置，因此只要新版键存在就不会回退到旧数据。
 * @param env Worker 运行环境。
 * @returns 自建节点文档及其来源。
 */
export async function getSelfNodesDocument(env: RoutingStoreEnv): Promise<{
  document: SelfNodesDocument
  source: 'new' | 'legacy' | 'default'
}> {
  const next = await env.SUB_MERGER_KV.get<SelfNodesDocument>(getSelfNodesKey(env), 'json')
  if (next && typeof next.raw === 'string') return { document: next, source: 'new' }

  const legacy = await env.SUB_MERGER_KV.get<Record<string, unknown>>(`${env.TABLENAME}:config`, 'json')
  if (legacy && typeof legacy.selfNodeData === 'string') {
    return {
      document: { raw: legacy.selfNodeData, updatedAt: typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '' },
      source: 'legacy',
    }
  }

  return { document: { raw: getDefaultSelfNodeData(), updatedAt: '' }, source: 'default' }
}

/**
 * 保存合法自建节点到独立键并清理两类正式输出缓存。
 * 未知协议字段和管理员输入顺序都会原样保留。
 * @param env Worker 运行环境。
 * @param raw 原始 JSON 文本。
 * @returns 校验分析；无效时不会写 KV。
 */
export async function saveSelfNodes(env: RoutingStoreEnv, raw: unknown): Promise<SelfNodesAnalysis> {
  const analysis = analyzeSelfNodes(raw)
  if (!analysis.valid) return analysis

  const document: SelfNodesDocument = { raw: analysis.raw, updatedAt: new Date().toISOString() }
  await env.SUB_MERGER_KV.put(getSelfNodesKey(env), JSON.stringify(document))
  await clearSubscriptionCaches(env)
  return analysis
}
