import { filterProxyForStash } from './filterForStash'
import type { OutputScope, ProxyGroupConfig, RoutingConfig } from '../types/routing'
import { pruneEmptyProxyGroups } from './pruneEmptyProxyGroups'

/** 任意 Clash 节点对象；只有 name 是策略组解析的必需字段。 */
export type ProxyNode = Record<string, unknown> & { name: string }

/** 动态策略组解析所需的上下文。 */
export interface ResolveProxyGroupsContext {
  subscriptionNodes: ProxyNode[]
  selfNodes: ProxyNode[]
  output: Exclude<OutputScope, 'all'>
  client: 'normal' | 'stash'
  globalExcludePattern?: string
}

/** 单个策略组的实际节点匹配预览。 */
export interface GroupMatchPreview {
  groupId: string
  count: number
  names: string[]
}

/** 策略组和节点解析结果，可直接交给 YAML 文档合并器。 */
export interface ResolvedProxyGroups {
  proxies: ProxyNode[]
  groups: Record<string, unknown>[]
  previews: GroupMatchPreview[]
}

/**
 * 安全编译用户配置中的正则。
 * 发布前校验会拒绝非法正则；这里仍使用兜底，避免旧或手工写入的损坏 KV 导致公开订阅端点 500。
 * @param pattern 正则文本，空文本代表全部匹配。
 * @returns 可用正则；非法时返回一个永不匹配表达式。
 */
function compileRegex(pattern: string): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return /$a/
  }
}

/**
 * 按节点名称稳定去重，保留首次出现的位置。
 * @param names 按来源顺序收集的成员名称。
 * @returns 去重后的名称数组。
 */
function uniqueNames(names: string[]): string[] {
  return Array.from(new Set(names))
}

/**
 * 判断一个成员来源是否适用于当前输出类型与自建节点状态。
 * @param source 成员来源。
 * @param output 当前包月或流量包输出。
 * @param hasSelfNodes 当前是否存在自建节点。
 * @returns 是否应该参与本次解析。
 */
function sourceApplies(
  source: ProxyGroupConfig['sources'][number],
  output: Exclude<OutputScope, 'all'>,
  hasSelfNodes: boolean,
): boolean {
  const outputMatches = source.appliesTo === 'all' || source.appliesTo === output
  const condition = source.when ?? 'always'
  const conditionMatches = condition === 'always'
    || (condition === 'withSelfNodes' && hasSelfNodes)
    || (condition === 'withoutSelfNodes' && !hasSelfNodes)
  return outputMatches && conditionMatches
}

/**
 * 根据全局排除正则和客户端能力过滤节点池。
 * 全局过滤沿用旧版顺序：先排除套餐等节点，再应用 Stash 兼容过滤。
 * @param nodes 原始节点池。
 * @param excludePattern 部署级排除正则。
 * @param client 客户端类型。
 * @returns 保持原顺序的可用节点池。
 */
function filterNodePool(nodes: ProxyNode[], excludePattern: string, client: 'normal' | 'stash'): ProxyNode[] {
  const exclude = compileRegex(excludePattern)
  return nodes
    .filter((node) => !exclude || !exclude.test(String(node.name ?? '')))
    .filter((node) => client === 'normal' || filterProxyForStash(node))
}

/**
 * 将结构化策略组解析成 Clash `proxy-groups` 数组。
 * 成员来源按界面顺序合并，策略组引用在此阶段由稳定 ID 转换为最新名称。
 * @param config 已发布或待预览的路由配置。
 * @param context 节点、输出类型和客户端上下文。
 * @returns 过滤后的 proxies、生成的 proxy-groups 与真实匹配预览。
 */
export function resolveProxyGroups(config: RoutingConfig, context: ResolveProxyGroupsContext): ResolvedProxyGroups {
  const hasSelfNodes = context.selfNodes.length > 0
  const rawAll = [...context.selfNodes, ...context.subscriptionNodes]
  const allNodes = filterNodePool(rawAll, context.globalExcludePattern ?? '', context.client)
  const selfNames = new Set(context.selfNodes.map((node) => node.name))
  const subscriptionNames = new Set(context.subscriptionNodes.map((node) => node.name))
  const selfNodes = allNodes.filter((node) => selfNames.has(node.name))
  const subscriptionNodes = allNodes.filter((node) => subscriptionNames.has(node.name))

  const visibleGroups = config.groups.filter((group) => group.enabled && ((group.visibility ?? 'always') === 'always' || hasSelfNodes))
  const groupById = new Map(visibleGroups.map((group) => [group.id, group]))
  const previews: GroupMatchPreview[] = []

  const groups = visibleGroups.map((group) => {
    const members: string[] = []
    for (const source of group.sources) {
      if (!sourceApplies(source, context.output, hasSelfNodes)) continue

      if (source.kind === 'builtin') {
        members.push(source.value)
        continue
      }
      if (source.kind === 'group') {
        const referenced = groupById.get(source.groupId)
        if (referenced) members.push(referenced.name)
        continue
      }

      const pool = source.source === 'self' ? selfNodes : source.source === 'subscription' ? subscriptionNodes : allNodes
      const include = compileRegex(source.include)
      const exclude = compileRegex(source.exclude)
      pool.forEach((node) => {
        const name = String(node.name ?? '')
        if ((!include || include.test(name)) && (!exclude || !exclude.test(name))) members.push(name)
      })
    }

    const proxies = uniqueNames(members)
    previews.push({ groupId: group.id, count: proxies.length, names: proxies.slice(0, 8) })
    const resolved: Record<string, unknown> = { name: group.name, type: group.type, proxies }
    if (group.type !== 'select' && group.healthCheck) {
      resolved.url = group.healthCheck.url
      resolved.interval = group.healthCheck.interval
      if (group.type === 'url-test' && group.healthCheck.tolerance != null) resolved.tolerance = group.healthCheck.tolerance
      if (group.type === 'load-balance' && group.healthCheck.strategy) resolved.strategy = group.healthCheck.strategy
    }
    return resolved
  })

  // 必须在所有组完成匹配后递归裁剪，才能处理向后引用及父组随子组一起变空的情况。
  const pruned = pruneEmptyProxyGroups(groups, allNodes.map((node) => node.name))
  const membersByName = new Map(pruned.groups.map((group) => [group.name, group.proxies as string[]]))
  previews.forEach((preview, index) => {
    const members = membersByName.get(visibleGroups[index].name) ?? []
    preview.count = members.length
    preview.names = members.slice(0, 8)
  })
  return { proxies: allNodes, groups: pruned.groups, previews }
}
