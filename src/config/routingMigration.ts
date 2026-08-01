import YAML, { isSeq } from 'yaml'
import type {
  OutputScope,
  ProxyGroupConfig,
  ProxyMemberSource,
  RoutingConfig,
  RoutingRuleConfig,
  RuleProviderConfig,
} from '../types/routing'
import { createLegacyRuleTarget } from '../utils/routingRuleTarget'

/** 旧版两套环境正则中迁移会读取的字段。 */
export type LegacyPatternConfig = Record<string, string | undefined>

/** 生成迁移草稿所需的最小环境变量集合。 */
export interface LegacyMigrationEnv {
  SUBSCRIBE_PATTERN?: LegacyPatternConfig
  ONETIME_PATTERN?: LegacyPatternConfig
}

/** YAML 导入或迁移过程中可定位的问题。 */
export interface RoutingImportIssue {
  code: string
  path: string
  message: string
}

/** 完整 Clash YAML 拆分结果。 */
export interface RoutingImportResult {
  config: RoutingConfig | null
  errors: RoutingImportIssue[]
  summary?: { groups: number; providers: number; rules: number; baseFields: number }
}

const SUPPORTED_GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance'])
const SUPPORTED_RULE_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'RULE-SET',
  'PROCESS-NAME',
  'PROCESS-NAME-WILDCARD',
  'GEOIP',
  'MATCH',
])
const SUPPORTED_GROUP_FIELDS = new Set(['name', 'type', 'proxies', 'url', 'interval', 'tolerance', 'strategy'])
const SUPPORTED_PROVIDER_FIELDS = new Set(['type', 'behavior', 'url', 'path', 'interval'])
const UNSUPPORTED_GROUP_BUILTINS = new Set(['REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE'])

/**
 * 已知的旧策略组名称映射。
 *
 * `泰国节点` 在历史版本中与 TAIGUO_PATTERN 配套使用，后续整体重命名为
 * `EtherFi`/ETHERFI_PATTERN；旧 KV 里的 defaultYaml 可能仍保留原名称。
 */
const LEGACY_GROUP_TARGET_ALIASES = new Map<string, string>([
  ['泰国节点', 'EtherFi'],
])

/**
 * 将 YAML AST 中不含井号的注释文本规范化为备注字段。
 * 解析器会为每一行保留一个可选前导空格，这里仅移除该格式空格，不破坏正文。
 * @param value YAML 节点上的 commentBefore。
 * @returns 可供界面编辑的多行备注；空注释返回空字符串。
 */
function normalizeRuleRemark(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .split('\n')
    .map((line) => line.startsWith(' ') ? line.slice(1) : line)
    .join('\n')
    .trim()
}

/**
 * 从 `rules` 序列 AST 读取每条规则上方的注释。
 * yaml v2 会把第一条规则的前置注释放在 YAMLSeq.commentBefore，后续放在 Scalar.commentBefore。
 * @param document 已解析且仍保留节点注释的 YAML 文档。
 * @param count 规则条目数量。
 * @returns 与规则数组索引对齐的备注数组。
 */
function importRuleRemarks(document: YAML.Document.Parsed, count: number): string[] {
  const rulesNode = document.get('rules', true)
  if (!isSeq(rulesNode)) return Array.from({ length: count }, () => '')
  return Array.from({ length: count }, (_, index) => {
    const item = rulesNode.items[index] as { commentBefore?: unknown } | undefined
    const raw = index === 0
      ? [rulesNode.commentBefore, item?.commentBefore].filter((part) => typeof part === 'string' && part.length > 0).join('\n')
      : item?.commentBefore
    return normalizeRuleRemark(raw)
  })
}

/**
 * 删除四个受管字段并直接序列化剩余 AST，尽可能保留基础 YAML 的注释、锚点和引号风格。
 * @param yamlText 用户导入的完整 YAML。
 * @returns 基础 YAML 文本与顶级字段数量。
 */
function extractBaseYaml(yamlText: string): { text: string; fieldCount: number } {
  const baseDocument = YAML.parseDocument(yamlText, { uniqueKeys: true, prettyErrors: true })
  ;['proxies', 'proxy-groups', 'rule-providers', 'rules'].forEach((key) => baseDocument.delete(key))
  const value = baseDocument.toJS() as Record<string, unknown> | null
  return {
    text: baseDocument.toString({ lineWidth: 0 }),
    fieldCount: value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0,
  }
}

/**
 * 为迁移对象生成可重复的稳定 ID。
 * 同一份旧配置重复打开时会得到相同引用，避免草稿无意义地持续变脏。
 * @param prefix 实体类型前缀。
 * @param value 用于生成 ID 的可读名称。
 * @param index 同名或空名称时的顺序兜底。
 * @returns 只包含安全字符的稳定 ID。
 */
function stableId(prefix: string, value: string, index = 0): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 42)
  let hash = 2166136261
  for (const char of `${prefix}:${value}:${index}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `${prefix}-${normalized || index + 1}-${(hash >>> 0).toString(36)}`
}

/**
 * 将正则文本安全地转成普通节点名的精确匹配表达式。
 * @param value 原始节点名称。
 * @returns 可用于 RegExp 的精确匹配字符串。
 */
function escapeRegex(value: string): string {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
}

/**
 * 按包月和流量包环境变量生成节点筛选来源。
 * 两套正则完全相同时合并为 all，否则保留两个独立适用范围，防止迁移改变节点成员。
 * @param env 旧版环境变量。
 * @param keyPrefix 例如 OTHER、AI 或 FALLBACK。
 * @param source 节点范围。
 * @param when 旧版有无自建节点条件。
 * @returns 一到两个筛选来源。
 */
function createPatternSources(
  env: LegacyMigrationEnv,
  keyPrefix: string,
  source: 'all' | 'subscription' | 'self' = 'all',
  when: 'always' | 'withSelfNodes' | 'withoutSelfNodes' = 'always',
): ProxyMemberSource[] {
  const monthly = env.SUBSCRIBE_PATTERN ?? {}
  const traffic = env.ONETIME_PATTERN ?? {}
  const legacyKeyPrefix = keyPrefix === 'AI' ? 'EXIT' : keyPrefix === 'ETHERFI' ? 'TAIGUO' : keyPrefix

  /** 优先读取新变量名；字段不存在时才回退到旧模板中的历史名称。 */
  const readPattern = (patterns: LegacyPatternConfig, suffix: 'MATCH_PATTERN' | 'EXCLUDE_PATTERN'): string => (
    patterns[`${keyPrefix}_${suffix}`] ?? patterns[`${legacyKeyPrefix}_${suffix}`] ?? ''
  )
  const monthlyInclude = readPattern(monthly, 'MATCH_PATTERN')
  const monthlyExclude = readPattern(monthly, 'EXCLUDE_PATTERN')
  const trafficInclude = readPattern(traffic, 'MATCH_PATTERN')
  const trafficExclude = readPattern(traffic, 'EXCLUDE_PATTERN')

  /** 创建单个筛选来源并显式保存适用输出，顺序就是最终成员合并顺序。 */
  const build = (appliesTo: OutputScope, include: string, exclude: string, order: number): ProxyMemberSource => ({
    id: stableId('source', `${keyPrefix}-${source}-${appliesTo}-${when}`, order),
    kind: 'filter',
    source,
    include,
    exclude,
    appliesTo,
    when,
  })

  if (monthlyInclude === trafficInclude && monthlyExclude === trafficExclude) {
    return [build('all', monthlyInclude, monthlyExclude, 0)]
  }
  return [
    build('monthly', monthlyInclude, monthlyExclude, 0),
    build('trafficPackage', trafficInclude, trafficExclude, 1),
  ]
}

/**
 * 创建策略组引用来源。
 * @param groupId 被引用策略组稳定 ID。
 * @param order 来源顺序。
 * @param when 旧版条件。
 * @returns 策略组引用来源。
 */
function groupSource(
  groupId: string,
  order: number,
  when: 'always' | 'withSelfNodes' | 'withoutSelfNodes' = 'always',
): ProxyMemberSource {
  return {
    id: stableId('source', `group-${groupId}-${when}`, order),
    kind: 'group',
    groupId,
    appliesTo: 'all',
    when,
  }
}

/**
 * 创建内置 DIRECT 成员来源。
 * @param order 来源顺序。
 * @returns 内置策略来源。
 */
function directSource(order = 0): ProxyMemberSource {
  return {
    id: stableId('source', 'builtin-direct', order),
    kind: 'builtin',
    value: 'DIRECT',
    appliesTo: 'all',
    when: 'always',
  }
}

/**
 * 将旧版硬编码策略组映射成可视化模型。
 * 条件字段仅用于忠实保留“存在自建节点时插入两个组”的历史行为。
 * @param env 包月和流量包的旧正则配置。
 * @returns 与旧生成器顺序一致的策略组数组。
 */
export function createLegacyProxyGroups(env: LegacyMigrationEnv): ProxyGroupConfig[] {
  const ids = {
    other: stableId('group', '其它流量'), self: stableId('group', '自建节点'), airport: stableId('group', '机场节点'),
    proxy: stableId('group', '中转代理'), ai: stableId('group', '海外AI'), telegram: stableId('group', 'IM-Telegram'),
    whatsapp: stableId('group', 'IM-WhatsApp'), media: stableId('group', '海外媒体'), poker: stableId('group', 'PokerClient'),
    binance: stableId('group', '币安'), etherfi: stableId('group', 'EtherFi'), steam: stableId('group', 'GameSteam'),
    emby: stableId('group', 'EMBY'), fallback: stableId('group', '故障转移'), direct: stableId('group', '直接连接'),
  }

  /** 创建标准手动选择组，减少迁移表中的重复字段。 */
  const select = (id: string, name: string, sources: ProxyMemberSource[], visibility: 'always' | 'withSelfNodes' = 'always'): ProxyGroupConfig => ({
    id, name, type: 'select', enabled: true, sources, visibility,
  })

  return [
    select(ids.other, '其它流量', [
      groupSource(ids.self, 0, 'withSelfNodes'),
      groupSource(ids.proxy, 1, 'withSelfNodes'),
      groupSource(ids.ai, 2, 'withSelfNodes'),
      ...createPatternSources(env, 'OTHER', 'all', 'withoutSelfNodes'),
    ]),
    select(ids.self, '自建节点', [{
      id: stableId('source', 'self-all'), kind: 'filter', source: 'self', include: '', exclude: '', appliesTo: 'all', when: 'always',
    }], 'withSelfNodes'),
    // 旧生成器实际从合并节点池筛选“机场节点”，自建节点同样可能进入该组。
    select(ids.airport, '机场节点', createPatternSources(env, 'OTHER', 'all'), 'withSelfNodes'),
    select(ids.proxy, '中转代理', createPatternSources(env, 'PROXY')),
    select(ids.ai, '海外AI', createPatternSources(env, 'AI')),
    select(ids.telegram, 'IM-Telegram', [groupSource(ids.other, 0), ...createPatternSources(env, 'TELEGRAM')]),
    select(ids.whatsapp, 'IM-WhatsApp', [groupSource(ids.other, 0), ...createPatternSources(env, 'WHATSAPP')]),
    select(ids.media, '海外媒体', [groupSource(ids.other, 0), ...createPatternSources(env, 'MEDIA')]),
    select(ids.poker, 'PokerClient', [groupSource(ids.direct, 0), ...createPatternSources(env, 'POKER')]),
    select(ids.binance, '币安', createPatternSources(env, 'BINANCE')),
    select(ids.etherfi, 'EtherFi', createPatternSources(env, 'ETHERFI')),
    select(ids.steam, 'GameSteam', createPatternSources(env, 'STEAM')),
    select(ids.emby, 'EMBY', createPatternSources(env, 'EMBY')),
    {
      id: ids.fallback,
      name: '故障转移',
      type: 'fallback',
      enabled: true,
      sources: createPatternSources(env, 'FALLBACK'),
      healthCheck: { url: 'http://www.google.com/generate_204', interval: 1800 },
      visibility: 'always',
    },
    select(ids.direct, '直接连接', [directSource()]),
  ]
}

/**
 * 将 YAML 中的规则提供者对象转换成稳定 ID 列表。
 * @param value `rule-providers` 顶级字段。
 * @param errors 导入错误收集器。
 * @returns 结构化提供者列表。
 */
function importProviders(value: unknown, errors: RoutingImportIssue[]): RuleProviderConfig[] {
  if (value == null) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ code: 'PROVIDERS_INVALID', path: 'rule-providers', message: 'rule-providers 必须是 Mapping' })
    return []
  }

  return Object.entries(value as Record<string, unknown>).map(([name, raw], index) => {
    const provider = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ code: 'PROVIDER_INVALID', path: `rule-providers.${name}`, message: `规则提供者“${name}”必须是对象` })
    }
    if (provider.type != null && provider.type !== 'http') {
      errors.push({ code: 'PROVIDER_TYPE_UNSUPPORTED', path: `rule-providers.${name}.type`, message: `规则提供者“${name}”仅支持 http 类型` })
    }
    Object.keys(provider).filter((field) => !SUPPORTED_PROVIDER_FIELDS.has(field)).forEach((field) => {
      errors.push({
        code: 'PROVIDER_FIELD_UNSUPPORTED',
        path: `rule-providers.${name}.${field}`,
        message: `规则提供者“${name}”包含当前编辑器不支持的字段：${field}`,
      })
    })
    if (provider.behavior != null && !['classical', 'domain', 'ipcidr'].includes(String(provider.behavior))) {
      errors.push({
        code: 'PROVIDER_BEHAVIOR_UNSUPPORTED',
        path: `rule-providers.${name}.behavior`,
        message: `规则提供者“${name}”使用不支持的 behavior：${String(provider.behavior)}`,
      })
    }
    return {
      id: stableId('provider', name, index),
      name,
      enabled: true,
      type: 'http',
      behavior: String(provider.behavior ?? 'classical') as RuleProviderConfig['behavior'],
      url: String(provider.url ?? ''),
      path: String(provider.path ?? `./RuleSet/${name}.yaml`),
      interval: Number(provider.interval ?? 86400),
    }
  })
}

/**
 * 解析单条 Clash 规则文本。
 * 规则目标使用稳定策略组 ID；DIRECT 和 REJECT 使用兼容内置 ID。
 * @param raw 原始规则字符串。
 * @param index 规则顺序。
 * @param groupIds 策略组名称到 ID 的映射。
 * @param providerIds 提供者名称到 ID 的映射。
 * @param errors 错误收集器。
 * @returns 可视化规则；不支持时返回 null。
 */
function importRule(
  raw: unknown,
  index: number,
  groupIds: Map<string, string>,
  providerIds: Map<string, string>,
  errors: RoutingImportIssue[],
  remark = '',
): RoutingRuleConfig | null {
  if (typeof raw !== 'string') {
    errors.push({ code: 'RULE_INVALID', path: `rules[${index}]`, message: '规则必须是逗号分隔的字符串' })
    return null
  }
  const parts = raw.split(',').map((part) => part.trim())
  const type = parts[0]
  if (!SUPPORTED_RULE_TYPES.has(type)) {
    errors.push({ code: 'RULE_TYPE_UNSUPPORTED', path: `rules[${index}]`, message: `不支持的规则类型：${type || '空'}` })
    return null
  }

  const isMatch = type === 'MATCH'
  const value = isMatch ? undefined : parts[1]
  const targetName = isMatch ? parts[1] : parts[2]
  // Clash 允许规则直接指向代理节点。旧版没有单独的数据模型表示这种目标，
  // 因此用兼容前缀原样保留名称，生成 YAML 时再还原，避免迁移擅自改变路由语义。
  const targetGroupId = (groupIds.get(targetName)
    ?? (['DIRECT', 'REJECT'].includes(targetName) ? `builtin:${targetName}` : ''))
    || (targetName ? createLegacyRuleTarget(targetName) : '')
  if (!targetGroupId) {
    errors.push({ code: 'RULE_TARGET_REQUIRED', path: `rules[${index}]`, message: '规则缺少目标策略、策略组或节点名称' })
  }

  const providerId = type === 'RULE-SET' ? providerIds.get(value ?? '') : undefined
  if (type === 'RULE-SET' && !providerId) {
    errors.push({ code: 'RULE_PROVIDER_UNRESOLVED', path: `rules[${index}]`, message: `RULE-SET“${value || '空'}”没有对应规则提供者` })
  }

  return {
    id: stableId('rule', raw, index),
    enabled: true,
    category: inferRuleCategory(type, value),
    remark,
    type: type as RoutingRuleConfig['type'],
    value,
    providerId,
    targetGroupId,
    noResolve: parts.slice(isMatch ? 2 : 3).includes('no-resolve'),
    legacyOptions: parts.slice(isMatch ? 2 : 3).filter((option) => option !== 'no-resolve'),
  }
}

/**
 * 为导入规则推断一个仅用于界面筛选的分类。
 * 分类不会写入最终 YAML，因此无法识别时使用 general 不会改变路由语义。
 * @param type 规则类型。
 * @param value 匹配内容。
 * @returns 界面分类 ID。
 */
function inferRuleCategory(type: string, value?: string): string {
  const text = `${type}:${value ?? ''}`.toLowerCase()
  if (/openai|google|github|proxy|telegram|whatsapp/.test(text)) return 'proxy'
  if (/cn|direct|lan|private/.test(text)) return 'direct'
  if (/reject|adblock|malware/.test(text)) return 'block'
  return 'general'
}

/**
 * 从完整 Clash YAML 导入可视化路由配置。
 * proxies 属于运行时节点，会被明确忽略；其它顶级字段保留到 baseYaml。
 * @param yamlText 完整 Clash YAML 文本。
 * @returns 拆分后的配置、具体错误和变更数量。
 */
export function importRoutingConfigYaml(yamlText: string): RoutingImportResult {
  const errors: RoutingImportIssue[] = []
  let document: YAML.Document.Parsed
  try {
    document = YAML.parseDocument(yamlText, { uniqueKeys: true, prettyErrors: true })
  } catch (error) {
    return { config: null, errors: [{ code: 'YAML_INVALID', path: 'yaml', message: error instanceof Error ? error.message : 'YAML 无法解析' }] }
  }
  if (document.errors.length > 0) {
    return { config: null, errors: document.errors.map((error, index) => ({ code: 'YAML_INVALID', path: `yaml.errors[${index}]`, message: error.message })) }
  }

  const root = document.toJS() as unknown
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return { config: null, errors: [{ code: 'YAML_ROOT_INVALID', path: 'yaml', message: '完整 YAML 根节点必须是 Mapping' }] }
  }
  const object = root as Record<string, unknown>
  const rawGroups = Array.isArray(object['proxy-groups']) ? object['proxy-groups'] : []
  if (object['proxy-groups'] != null && !Array.isArray(object['proxy-groups'])) {
    errors.push({ code: 'GROUPS_INVALID', path: 'proxy-groups', message: 'proxy-groups 必须是数组' })
  }

  const groupIds = new Map<string, string>()
  rawGroups.forEach((raw, index) => {
    const group = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const name = String(group.name ?? '')
    if (name) groupIds.set(name, stableId('group', name, index))
  })

  const groups: ProxyGroupConfig[] = rawGroups.map((raw, index) => {
    const group = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const name = String(group.name ?? '')
    const type = String(group.type ?? '')
    Object.keys(group).filter((field) => !SUPPORTED_GROUP_FIELDS.has(field)).forEach((field) => {
      errors.push({
        code: 'GROUP_FIELD_UNSUPPORTED',
        path: `proxy-groups[${index}].${field}`,
        message: `策略组“${name || index + 1}”包含当前编辑器不支持的字段：${field}`,
      })
    })
    if (!SUPPORTED_GROUP_TYPES.has(type)) {
      errors.push({ code: 'GROUP_TYPE_UNSUPPORTED', path: `proxy-groups[${index}].type`, message: `策略组“${name || index + 1}”使用不支持的类型：${type || '空'}` })
    }
    const members = Array.isArray(group.proxies) ? group.proxies.map(String) : []
    const sources = members.map((member, memberIndex): ProxyMemberSource => {
      const referencedGroupId = groupIds.get(member)
      if (referencedGroupId) return groupSource(referencedGroupId, memberIndex)
      if (member === 'DIRECT') return directSource(memberIndex)
      if (UNSUPPORTED_GROUP_BUILTINS.has(member)) {
        errors.push({
          code: 'GROUP_BUILTIN_UNSUPPORTED',
          path: `proxy-groups[${index}].proxies[${memberIndex}]`,
          message: `策略组“${name || index + 1}”使用当前编辑器不支持的内置策略：${member}`,
        })
      }
      return {
        id: stableId('source', `${name}-${member}`, memberIndex),
        kind: 'filter',
        source: 'all',
        include: escapeRegex(member),
        exclude: '',
        appliesTo: 'all',
        when: 'always',
      }
    })
    const healthCheck = type === 'select' ? undefined : {
      url: String(group.url ?? ''),
      interval: Number(group.interval ?? 0),
      tolerance: group.tolerance == null ? undefined : Number(group.tolerance),
      strategy: group.strategy == null ? undefined : String(group.strategy),
    }
    return {
      id: groupIds.get(name) ?? stableId('group', name, index),
      name,
      type: type as ProxyGroupConfig['type'],
      enabled: true,
      sources,
      healthCheck,
      visibility: 'always',
    }
  })

  const providers = importProviders(object['rule-providers'], errors)
  const providerIds = new Map(providers.map((provider) => [provider.name, provider.id]))
  const rawRules = Array.isArray(object.rules) ? object.rules : []
  if (object.rules != null && !Array.isArray(object.rules)) {
    errors.push({ code: 'RULES_INVALID', path: 'rules', message: 'rules 必须是数组' })
  }
  const remarks = importRuleRemarks(document, rawRules.length)
  const rules = rawRules.map((rule, index) => importRule(rule, index, groupIds, providerIds, errors, remarks[index])).filter((rule): rule is RoutingRuleConfig => Boolean(rule))
  const base = extractBaseYaml(yamlText)

  const config: RoutingConfig = {
    schemaVersion: 1,
    baseYaml: base.text,
    groups,
    providers,
    rules,
  }
  return {
    config: errors.length > 0 ? null : config,
    errors,
    summary: { groups: groups.length, providers: providers.length, rules: rules.length, baseFields: base.fieldCount },
  }
}

/**
 * 从旧 defaultYaml 与硬编码策略组生成首次打开页面使用的迁移草稿。
 * 该函数只构造内存配置，不写 KV、不发布，也不会清理缓存。
 * @param defaultYaml 当前旧版默认 YAML。
 * @param env 旧版包月与流量包正则。
 * @returns 可供管理员检查的 schemaVersion=1 草稿。
 */
export function createLegacyRoutingConfig(defaultYaml: string, env: LegacyMigrationEnv): RoutingImportResult {
  const document = YAML.parseDocument(defaultYaml, { uniqueKeys: true, prettyErrors: true })
  if (document.errors.length > 0) {
    return { config: null, errors: document.errors.map((error, index) => ({ code: 'LEGACY_YAML_INVALID', path: `defaultYaml.errors[${index}]`, message: error.message })) }
  }
  const root = document.toJS() as Record<string, unknown>
  const errors: RoutingImportIssue[] = []
  const groups = createLegacyProxyGroups(env)
  const groupIds = new Map(groups.map((group) => [group.name, group.id]))
  // 历史别名只在旧 KV 迁移中生效，普通完整 YAML 导入仍严格尊重原始节点/组名称。
  LEGACY_GROUP_TARGET_ALIASES.forEach((currentName, legacyName) => {
    const currentGroupId = groupIds.get(currentName)
    if (currentGroupId) groupIds.set(legacyName, currentGroupId)
  })
  const providers = importProviders(root['rule-providers'], errors)
  const providerIds = new Map(providers.map((provider) => [provider.name, provider.id]))
  const rawRules = Array.isArray(root.rules) ? root.rules : []
  const remarks = importRuleRemarks(document, rawRules.length)
  const rules = rawRules.map((rule, index) => importRule(rule, index, groupIds, providerIds, errors, remarks[index])).filter((rule): rule is RoutingRuleConfig => Boolean(rule))
  const base = extractBaseYaml(defaultYaml)

  const config: RoutingConfig = { schemaVersion: 1, baseYaml: base.text, groups, providers, rules }
  return {
    config: errors.length > 0 ? null : config,
    errors,
    summary: { groups: groups.length, providers: providers.length, rules: rules.length, baseFields: base.fieldCount },
  }
}
