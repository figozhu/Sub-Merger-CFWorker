import type { SubscriptionRecord } from './configuration'
import type { SubUserInfo } from '../types/types'
import type { SubscriptionNode } from '../utils/getProxyNodeFromyaml'
import { writeErrorLog, type LogStoreEnv } from './errorLogs'

/** 单机场最后一次成功快照；节点名称不含管理台追加的机场后缀。 */
interface SubscriptionSourceSnapshot {
  nodes: SubscriptionNode[]
  userInfo: SubUserInfo
}

/**
 * 生成独立于最终 YAML 的机场快照键，避免保存配置时一并清除成功数据。
 * @param env 当前部署的 KV 前缀。
 * @param subscription 当前机场地址与套餐类型；改名可复用，换地址不会误用旧节点。
 * @returns 包含 SHA-256 摘要的版本化键；不在 KV 键中暴露订阅地址或 token。
 */
async function getSourceCacheKey(env: LogStoreEnv, subscription: SubscriptionRecord): Promise<string> {
  const identity = JSON.stringify([subscription.subType, subscription.subUrl])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${env.TABLENAME}:source-cache:v1:${hash}`
}

/**
 * 读取机场的最后成功节点和流量，损坏或不可读的快照视为不可用。
 * @param env 当前部署的 KV 与日志环境。
 * @param subscription 当前机场；返回节点会使用当前名称追加后缀。
 * @returns 可用的历史数据，或 null；不删除或覆盖历史快照。
 */
export async function readSubscriptionSourceCache(
  env: LogStoreEnv,
  subscription: SubscriptionRecord,
): Promise<SubscriptionSourceSnapshot | null> {
  try {
    const key = await getSourceCacheKey(env, subscription)
    const snapshot = await env.SUB_MERGER_KV.get<SubscriptionSourceSnapshot>(key, 'json')
    if (!snapshot) return null
    if (!Array.isArray(snapshot.nodes) || !snapshot.nodes.length
      || !snapshot.nodes.every((node) => node && typeof node === 'object' && !Array.isArray(node) && typeof node.name === 'string' && node.name.trim())
      || !snapshot.userInfo || !['upload', 'download', 'total', 'expire'].every((field) => Number.isFinite(snapshot.userInfo[field as keyof SubUserInfo]))) {
      throw new Error('机场快照格式无效')
    }
    const suffix = subscription.subName.trim() ? `【${subscription.subName}】` : ''
    return { nodes: snapshot.nodes.map((node) => ({ ...node, name: node.name + suffix })), userInfo: snapshot.userInfo }
  } catch {
    await writeErrorLog(env, { level: 'warning', scope: 'subscription', code: 'SOURCE_CACHE_READ_FAILED', sourceName: subscription.subName, subscriptionType: subscription.subType, message: '无法读取机场的上次成功数据', hint: '检查 KV 状态；该机场下次拉取成功后会重建快照。' })
    return null
  }
}

/**
 * 仅在抓取与解析成功后持久化机场快照；失败刷新不得调用本函数。
 * @param env 当前部署的 KV 与日志环境。
 * @param subscription 本次成功抓取的机场。
 * @param snapshot 成功节点与流量信息；节点名称已追加机场后缀。
 * @returns 无返回值；KV 写入失败只记录日志，不阻断本次可用数据的返回。
 */
export async function saveSubscriptionSourceCache(
  env: LogStoreEnv,
  subscription: SubscriptionRecord,
  snapshot: SubscriptionSourceSnapshot,
): Promise<void> {
  try {
    const suffix = subscription.subName.trim() ? `【${subscription.subName}】` : ''
    // 只移除解析器追加的最后一个后缀，保留上游原名中的相同字符。
    const nodes = snapshot.nodes.map((node) => ({
      ...node, name: suffix && node.name.endsWith(suffix) ? node.name.slice(0, -suffix.length) : node.name,
    }))
    await env.SUB_MERGER_KV.put(await getSourceCacheKey(env, subscription), JSON.stringify({ nodes, userInfo: snapshot.userInfo }))
  } catch {
    await writeErrorLog(env, { level: 'warning', scope: 'subscription', code: 'SOURCE_CACHE_WRITE_FAILED', sourceName: subscription.subName, subscriptionType: subscription.subType, message: '机场抓取成功，但成功数据保存失败', hint: '检查 KV 配额和写入状态；本次仍使用已拉取的节点。' })
  }
}
