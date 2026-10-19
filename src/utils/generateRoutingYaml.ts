import YAML, { isSeq } from 'yaml'
import type { RoutingConfig } from '../types/routing'
import { resolveProxyGroups, type GroupMatchPreview, type ProxyNode, type ResolveProxyGroupsContext } from './resolveProxyGroups'
import { getLegacyRuleTargetName } from './routingRuleTarget'
import { sanitizeProxyGroupDocument } from './pruneEmptyProxyGroups'

/** 单次动态路由 YAML 生成结果。 */
export interface GeneratedRoutingYaml {
  yaml: string
  previews: GroupMatchPreview[]
}

/**
 * 将规则目标稳定 ID 解析为最终 YAML 使用的名称。
 * 内置目标使用 `builtin:` 前缀保存；迁移保留目标还原为旧节点名称；策略组改名后读取最新名称。
 * @param targetGroupId 规则保存的稳定目标 ID。
 * @param groupNames 策略组 ID 到名称的映射。
 * @returns 最终策略名称；损坏引用返回原 ID，随后可由校验接口定位。
 */
function resolveRuleTarget(targetGroupId: string, groupNames: Map<string, string>): string {
  const legacyTargetName = getLegacyRuleTargetName(targetGroupId)
  if (legacyTargetName) return legacyTargetName
  if (targetGroupId.startsWith('builtin:')) return targetGroupId.slice('builtin:'.length)
  return groupNames.get(targetGroupId) ?? targetGroupId
}

/**
 * 将结构化规则转换为 Clash 逗号分隔语法。
 * RULE-SET 使用 providerId 获取最新提供者名称，界面分类不会写入 YAML。
 * @param config 当前路由配置。
 * @returns 启用规则的有序文本与备注记录。
 */
function generateRules(config: RoutingConfig): Array<{ text: string; remark: string }> {
  const enabledGroups = config.groups.filter((group) => group.enabled)
  const groupNames = new Map(enabledGroups.map((group) => [group.id, group.name]))
  const providerNames = new Map(config.providers.filter((provider) => provider.enabled).map((provider) => [provider.id, provider.name]))

  return config.rules.filter((rule) => rule.enabled).map((rule) => {
    const target = resolveRuleTarget(rule.targetGroupId, groupNames)
    const parts = rule.type === 'MATCH'
      ? ['MATCH', target]
      : [rule.type, rule.type === 'RULE-SET' ? (providerNames.get(rule.providerId ?? '') ?? rule.value ?? '') : (rule.value ?? ''), target]
    if (rule.noResolve) parts.push('no-resolve')
    if (Array.isArray(rule.legacyOptions)) parts.push(...rule.legacyOptions)
    return { text: parts.join(','), remark: typeof rule.remark === 'string' ? rule.remark : '' }
  })
}

/**
 * 将备注转换成 yaml 库期望的不含井号 commentBefore 文本。
 * 每行增加一个前导空格，使最终输出使用常见的 `# 备注` 形式。
 * @param remark 控制台保存的单行或多行规则备注。
 * @returns 适用于 commentBefore 的文本；空备注返回 undefined。
 */
function formatRuleRemark(remark: string): string | undefined {
  const normalized = remark.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return undefined
  return normalized.split('\n').map((line) => ` ${line}`).join('\n')
}

/**
 * 将规则文本和备注写入文档，保证备注紧邻对应规则的上一行。
 * 备注写入对应 Scalar.commentBefore；再次解析时 yaml v2 会把首条注释归到 YAMLSeq。
 * @param document 待合并完整配置的 YAML 文档。
 * @param rules 已按启用顺序生成的规则文本和备注。
 */
function setRulesWithRemarks(document: YAML.Document.Parsed, rules: Array<{ text: string; remark: string }>): void {
  document.set('rules', document.createNode(rules.map((rule) => rule.text)))
  const rulesNode = document.get('rules', true)
  if (!isSeq(rulesNode)) return
  rules.forEach((rule, index) => {
    const commentBefore = formatRuleRemark(rule.remark)
    if (!commentBefore) return
    const item = rulesNode.items[index] as { commentBefore?: string } | undefined
    if (item) item.commentBefore = commentBefore
  })
}

/**
 * 生成启用规则提供者的 Mapping。
 * 使用普通对象保持配置数组顺序，path 等导入字段会完整保留。
 * @param config 当前路由配置。
 * @returns 可写入 YAML 文档的提供者对象。
 */
function generateProviders(config: RoutingConfig): Record<string, unknown> {
  const providers: Record<string, unknown> = {}
  config.providers.filter((provider) => provider.enabled).forEach((provider) => {
    providers[provider.name] = {
      type: 'http',
      behavior: provider.behavior,
      url: provider.url,
      path: provider.path,
      interval: provider.interval,
    }
  })
  return providers
}

/**
 * 使用 YAML.Document 将基础模板与四个受管字段合并。
 * 该实现避免字符串拼接产生重复顶级键，并让未知基础字段继续保持 YAML 语义。
 * @param config 已发布或待预览的结构化路由配置。
 * @param context 节点池、输出类型、客户端和全局过滤上下文。
 * @returns 完整 YAML 文本以及每个策略组的真实匹配预览。
 * @throws 当 baseYaml 损坏时抛出错误；正常发布路径已由服务端校验阻止此情况。
 */
export function generateRoutingYaml(config: RoutingConfig, context: ResolveProxyGroupsContext): GeneratedRoutingYaml {
  const document = YAML.parseDocument(config.baseYaml.trim() || '{}', { uniqueKeys: true, prettyErrors: true })
  if (document.errors.length > 0) throw new Error(`YAML 模板无效：${document.errors[0].message}`)

  const resolved = resolveProxyGroups(config, context)
  // 显式创建 AST，保证后续容错处理读取到 YAMLSeq/Map，而非尚未转换的普通数组。
  document.set('proxies', document.createNode(resolved.proxies))
  document.set('proxy-groups', document.createNode(resolved.groups))
  document.set('rule-providers', document.createNode(generateProviders(config)))
  setRulesWithRemarks(document, generateRules(config))
  sanitizeProxyGroupDocument(document, config.groups.map((group) => group.name))
  return { yaml: document.toString({ lineWidth: 0 }), previews: resolved.previews }
}

/**
 * 为通用与 Stash 客户端一次性生成正式订阅配置。
 * @param config 已发布路由配置。
 * @param subscriptionNodes 当前订阅类型解析得到的节点。
 * @param selfNodes 当前自建节点。
 * @param output 包月或流量包输出范围。
 * @param globalExcludePattern 继续沿用的部署级全局排除正则。
 * @returns 两类客户端完整 YAML。
 */
export function generateRoutingYamlVariants(
  config: RoutingConfig,
  subscriptionNodes: ProxyNode[],
  selfNodes: ProxyNode[],
  output: 'monthly' | 'trafficPackage',
  globalExcludePattern: string,
): { normalYaml: string; stashYaml: string } {
  const baseContext = { subscriptionNodes, selfNodes, output, globalExcludePattern }
  return {
    normalYaml: generateRoutingYaml(config, { ...baseContext, client: 'normal' }).yaml,
    stashYaml: generateRoutingYaml(config, { ...baseContext, client: 'stash' }).yaml,
  }
}
