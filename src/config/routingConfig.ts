import type { RoutingConfig, RoutingConfigSnapshot } from '../types/routing'
import { SubscriptionType } from '../types/types'

/**
 * 路由配置存储所需的最小运行环境。
 * 仅声明本模块会访问的绑定，避免存储层与 Worker 的其它环境变量耦合。
 */
export interface RoutingStoreEnv {
  SUB_MERGER_KV: KVNamespace
  TABLENAME: string
  KEY_VERSION: string
}

/**
 * 返回路由草稿使用的 KV 键。
 * @param env Worker 运行环境。
 * @returns 当前部署对应的草稿键。
 */
export function getRoutingDraftKey(env: RoutingStoreEnv): string {
  return `${env.TABLENAME}:routing:draft`
}

/**
 * 返回当前已发布路由配置使用的 KV 键。
 * 删除该键即可立即回退到旧版 YAML 生成路径，草稿不会被删除。
 * @param env Worker 运行环境。
 * @returns 当前部署对应的已发布配置键。
 */
export function getRoutingPublishedKey(env: RoutingStoreEnv): string {
  return `${env.TABLENAME}:routing:published`
}

/**
 * 返回新版自建节点独立存储键。
 * @param env Worker 运行环境。
 * @returns 当前部署对应的自建节点键。
 */
export function getSelfNodesKey(env: RoutingStoreEnv): string {
  return `${env.TABLENAME}:self-nodes`
}

/**
 * 创建一份可安全写入 KV 的路由快照。
 * 这里进行 JSON 深拷贝，防止请求对象在异步写入后继续被调用方修改。
 * @param config 要保存的路由配置。
 * @param revision 当前修订号；草稿使用其基准修订，发布使用新修订号。
 * @returns 带更新时间的独立快照。
 */
export function createRoutingSnapshot(config: RoutingConfig, revision: number): RoutingConfigSnapshot {
  return {
    revision,
    updatedAt: new Date().toISOString(),
    config: JSON.parse(JSON.stringify(config)) as RoutingConfig,
  }
}

/**
 * 从 KV 读取路由草稿。
 * 未保存过草稿时返回 null，由上层决定是否生成旧配置迁移草稿。
 * @param env Worker 运行环境。
 * @returns 已保存草稿或 null。
 */
export async function getRoutingDraft(env: RoutingStoreEnv): Promise<RoutingConfigSnapshot | null> {
  return env.SUB_MERGER_KV.get<RoutingConfigSnapshot>(getRoutingDraftKey(env), 'json')
}

/**
 * 从 KV 读取当前已发布配置。
 * 未发布配置时必须返回 null，以便订阅端点保持旧版生成行为。
 * @param env Worker 运行环境。
 * @returns 已发布快照或 null。
 */
export async function getPublishedRoutingConfig(env: RoutingStoreEnv): Promise<RoutingConfigSnapshot | null> {
  return env.SUB_MERGER_KV.get<RoutingConfigSnapshot>(getRoutingPublishedKey(env), 'json')
}

/**
 * 保存路由草稿，不触碰已发布配置和正式订阅缓存。
 * @param env Worker 运行环境。
 * @param config 草稿配置。
 * @param baseRevision 草稿所基于的已发布修订号。
 * @returns 已写入 KV 的草稿快照。
 */
export async function saveRoutingDraft(
  env: RoutingStoreEnv,
  config: RoutingConfig,
  baseRevision: number,
): Promise<RoutingConfigSnapshot> {
  const snapshot = createRoutingSnapshot(config, baseRevision)
  await env.SUB_MERGER_KV.put(getRoutingDraftKey(env), JSON.stringify(snapshot))
  return snapshot
}

/**
 * 发布一份已经通过服务端校验的路由配置。
 * 调用方必须先完成修订冲突和配置合法性检查；本函数只负责写入快照。
 * @param env Worker 运行环境。
 * @param config 已验证的配置。
 * @param revision 新修订号。
 * @returns 已发布快照。
 */
export async function publishRoutingConfig(
  env: RoutingStoreEnv,
  config: RoutingConfig,
  revision: number,
): Promise<RoutingConfigSnapshot> {
  const snapshot = createRoutingSnapshot(config, revision)
  await env.SUB_MERGER_KV.put(getRoutingPublishedKey(env), JSON.stringify(snapshot))
  return snapshot
}

/**
 * 清理包年包月和流量包两类正式订阅缓存。
 * 仅应在订阅源、自建节点保存成功或路由配置发布成功后调用。
 * @param env Worker 运行环境。
 * @returns 两个删除操作全部完成后的 Promise。
 */
export async function clearSubscriptionCaches(env: RoutingStoreEnv): Promise<void> {
  const cacheKeys = [
    `${env.TABLENAME}:${env.KEY_VERSION}:cacheObj:${SubscriptionType.Monthly}`,
    `${env.TABLENAME}:${env.KEY_VERSION}:cacheObj:${SubscriptionType.TrafficPackage}`,
  ]
  await Promise.all(cacheKeys.map((key) => env.SUB_MERGER_KV.delete(key)))
}

/**
 * 读取当前已发布修订号。
 * 未发布新版配置时修订号为 0。
 * @param env Worker 运行环境。
 * @returns 当前生效修订号。
 */
export async function getCurrentRevision(env: RoutingStoreEnv): Promise<number> {
  const published = await getPublishedRoutingConfig(env)
  return published?.revision ?? 0
}
