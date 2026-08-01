/**
 * 策略成员来源所适用的订阅输出范围。
 *
 * - `all`：同时用于包年/包月与流量包输出。
 * - `monthly`：仅用于包年/包月输出。
 * - `trafficPackage`：仅用于流量包输出。
 */
export type OutputScope = 'all' | 'monthly' | 'trafficPackage'

/** 路由配置首期支持的 Clash 策略组类型。 */
export type ProxyGroupType = 'select' | 'url-test' | 'fallback' | 'load-balance'

/** 节点筛选器可以读取的节点池。 */
export type ProxyNodeSource = 'all' | 'subscription' | 'self'

/** 策略组根据自建节点是否存在而决定是否输出的条件。 */
export type ProxyGroupVisibility = 'always' | 'withSelfNodes'

/** 单个成员来源根据自建节点是否存在而决定是否参与解析的条件。 */
export type ProxyMemberCondition = 'always' | 'withSelfNodes' | 'withoutSelfNodes'

/**
 * 根据节点名称筛选策略组成员。
 * include 为空时表示全部匹配，exclude 在 include 之后执行。
 */
export interface ProxyFilterMemberSource {
  /** 不随排序变化的成员来源 ID。 */
  id: string
  kind: 'filter'
  /** 筛选全部节点、订阅节点或自建节点。 */
  source: ProxyNodeSource
  /** 节点名称包含正则，空字符串表示不过滤。 */
  include: string
  /** 节点名称排除正则，空字符串表示不排除。 */
  exclude: string
  /** 此来源参与生成的订阅输出范围。 */
  appliesTo: OutputScope
  /** 迁移旧配置时保留“有/无自建节点”分支；省略等价于 always。 */
  when?: ProxyMemberCondition
}

/** 使用稳定 ID 引用另一个策略组。 */
export interface ProxyGroupMemberSource {
  /** 不随排序变化的成员来源 ID。 */
  id: string
  kind: 'group'
  /** 被引用策略组的稳定 ID，生成 YAML 时再解析为最新名称。 */
  groupId: string
  /** 此来源参与生成的订阅输出范围。 */
  appliesTo: OutputScope
  /** 迁移旧配置时保留“有/无自建节点”分支；省略等价于 always。 */
  when?: ProxyMemberCondition
}

/** 直接加入 Clash 内置策略。首期仅支持 DIRECT。 */
export interface ProxyBuiltinMemberSource {
  /** 不随排序变化的成员来源 ID。 */
  id: string
  kind: 'builtin'
  value: 'DIRECT'
  /** 此来源参与生成的订阅输出范围。 */
  appliesTo: OutputScope
  /** 迁移旧配置时保留“有/无自建节点”分支；省略等价于 always。 */
  when?: ProxyMemberCondition
}

/** 策略组成员的三种来源。数组顺序就是最终合并顺序。 */
export type ProxyMemberSource =
  | ProxyFilterMemberSource
  | ProxyGroupMemberSource
  | ProxyBuiltinMemberSource

/** 测速、故障转移和负载均衡策略组使用的健康检查参数。 */
export interface ProxyGroupHealthCheck {
  /** Clash 用于探测可用性的 HTTP/HTTPS 地址。 */
  url: string
  /** 探测间隔，单位为秒，必须是正整数。 */
  interval: number
  /** url-test 的延迟容差，单位为毫秒，必须是非负整数。 */
  tolerance?: number
  /** load-balance 的负载策略，例如 consistent-hashing。 */
  strategy?: string
}

/** 可保存、排序和启停的策略组配置。 */
export interface ProxyGroupConfig {
  /** 不随名称修改变化的稳定 ID。 */
  id: string
  name: string
  type: ProxyGroupType
  enabled: boolean
  /** 迁移旧配置时控制该组是否仅在存在自建节点时输出；省略等价于 always。 */
  visibility?: ProxyGroupVisibility
  /** 数组顺序就是最终策略组成员的解析顺序。 */
  sources: ProxyMemberSource[]
  /** select 不需要；其它三种类型在启用时必须提供。 */
  healthCheck?: ProxyGroupHealthCheck
}

/** 规则提供者支持的 behavior。 */
export type RuleProviderBehavior = 'classical' | 'domain' | 'ipcidr'

/** 可保存、排序和启停的 Clash 规则提供者。 */
export interface RuleProviderConfig {
  /** 不随名称修改变化的稳定 ID。 */
  id: string
  name: string
  enabled: boolean
  /** 首期仅支持从 HTTP(S) 下载规则。 */
  type: 'http'
  behavior: RuleProviderBehavior
  url: string
  /** 生成到 Clash YAML 的本地规则集路径。 */
  path: string
  /** 更新间隔，单位为秒，必须是正整数。 */
  interval: number
}

/** 首期可视化编辑器支持的路由规则类型。 */
export type RoutingRuleType =
  | 'DOMAIN'
  | 'DOMAIN-SUFFIX'
  | 'DOMAIN-KEYWORD'
  | 'IP-CIDR'
  | 'RULE-SET'
  | 'PROCESS-NAME'
  | 'PROCESS-NAME-WILDCARD'
  | 'GEOIP'
  | 'MATCH'

/** 兼容旧配置中直接作为规则目标使用的 Clash 内置策略。 */
export type BuiltinRuleTarget = 'builtin:DIRECT' | 'builtin:REJECT'

/** 迁移旧 YAML 时保留的直接节点目标；前缀用于和策略组稳定 ID 明确区分。 */
export type LegacyRuleTarget = `legacy-target:${string}`

/** 按数组顺序生成的结构化路由规则。 */
export interface RoutingRuleConfig {
  /** 不随排序变化的稳定 ID。 */
  id: string
  enabled: boolean
  /** 仅供控制台筛选与管理，不写入最终 YAML。 */
  category: string
  /**
   * 面向管理员的规则备注。
   * 生成完整 YAML 时写在该规则上一行的注释中；导入时从同一位置恢复。
   */
  remark?: string
  type: RoutingRuleType
  /** MATCH 不需要；RULE-SET 由 providerId 提供稳定引用。 */
  value?: string
  /** RULE-SET 对应规则提供者的稳定 ID。 */
  providerId?: string
  /** 策略组稳定 ID、内置目标，或迁移时原样保留的直接节点目标。 */
  targetGroupId: string | BuiltinRuleTarget | LegacyRuleTarget
  noResolve: boolean
  /** 迁移旧配置时保留无法归一化但必须语义兼容的尾部选项。 */
  legacyOptions?: string[]
}

/** 路由控制台保存和发布的版本 1 配置。 */
export interface RoutingConfig {
  /** 配置结构版本；未知版本不得发布。 */
  schemaVersion: 1
  /** 除四个受管字段外的 Clash 顶级 YAML 原文。 */
  baseYaml: string
  /** 数组顺序就是最终 proxy-groups 顺序。 */
  groups: ProxyGroupConfig[]
  /** 数组顺序就是最终 rule-providers 顺序。 */
  providers: RuleProviderConfig[]
  /** 数组顺序就是最终 rules 顺序。 */
  rules: RoutingRuleConfig[]
}

/** KV 中草稿或已发布配置使用的带修订号快照。 */
export interface RoutingConfigSnapshot {
  /** 单调递增的修订号，用于避免并发覆盖。 */
  revision: number
  /** ISO 8601 更新时间。 */
  updatedAt: string
  config: RoutingConfig
}

/** 服务端校验返回的单个、可精确定位的问题。 */
export interface RoutingValidationIssue {
  /** 供前端稳定识别的问题代码。 */
  code: string
  /** 指向配置字段或数组元素的路径。 */
  path: string
  /** 面向管理员展示的中文说明。 */
  message: string
}

/** 路由配置服务端校验结果。 */
export interface RoutingValidationResult {
  /** 没有错误时为 true；警告不会令其变为 false。 */
  valid: boolean
  errors: RoutingValidationIssue[]
  warnings: RoutingValidationIssue[]
}
