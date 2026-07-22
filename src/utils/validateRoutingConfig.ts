import YAML, { isMap } from 'yaml'

import type {
  ProxyGroupType,
  RoutingConfig,
  RoutingValidationIssue,
  RoutingValidationResult,
} from '../types/routing'

/** YAML 模板中由订阅合并器或路由配置独占管理的顶级字段。 */
const MANAGED_YAML_FIELDS = new Set(['proxies', 'proxy-groups', 'rule-providers', 'rules'])

/** 服务端支持的策略组类型。 */
const SUPPORTED_GROUP_TYPES = new Set<ProxyGroupType>([
  'select',
  'url-test',
  'fallback',
  'load-balance',
])

/** 服务端支持的节点来源、输出范围、规则提供者行为和规则类型。 */
const SUPPORTED_NODE_SOURCES = new Set(['all', 'subscription', 'self'])
const SUPPORTED_OUTPUT_SCOPES = new Set(['all', 'monthly', 'trafficPackage'])
const SUPPORTED_GROUP_VISIBILITIES = new Set(['always', 'withSelfNodes'])
const SUPPORTED_MEMBER_CONDITIONS = new Set(['always', 'withSelfNodes', 'withoutSelfNodes'])
const SUPPORTED_PROVIDER_BEHAVIORS = new Set(['classical', 'domain', 'ipcidr'])
const SUPPORTED_RULE_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'RULE-SET',
  'PROCESS-NAME',
  'GEOIP',
  'MATCH',
])
const SUPPORTED_BUILTIN_TARGETS = new Set(['builtin:DIRECT', 'builtin:REJECT'])

type UnknownRecord = Record<string, unknown>

/**
 * 判断运行时值是否为普通对象。
 *
 * 数组和 null 不属于配置对象；该守卫可避免对不可信 JSON 直接读取属性时抛出异常。
 *
 * @param value 需要检查的任意运行时值。
 * @returns 值可以作为字符串键对象读取时返回 true。
 */
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 判断值是否为去除首尾空格后仍非空的字符串。
 *
 * @param value 需要检查的字段值。
 * @returns 字段可作为 ID、名称、路径或规则内容使用时返回 true。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 判断值是否为正整数。
 *
 * @param value 需要检查的数字。
 * @returns 值为大于零的有限整数时返回 true。
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * 判断值是否为非负整数。
 *
 * @param value 需要检查的数字。
 * @returns 值为大于或等于零的有限整数时返回 true。
 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * 将校验问题追加到指定集合，统一保证错误结构稳定。
 *
 * @param issues 错误或警告数组。
 * @param code 稳定机器错误码。
 * @param path 配置字段路径。
 * @param message 面向管理员的中文说明。
 */
function addIssue(
  issues: RoutingValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message })
}

/**
 * 校验字符串是否为 HTTP 或 HTTPS URL。
 *
 * @param value 待检查的 URL 字段。
 * @returns URL 可解析且协议受支持时返回 true。
 */
function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 将 YAML 节点键转换为用于重复检测和受管字段检测的字符串。
 *
 * 顶级配置键正常应为标量字符串；对于其它节点类型仍返回可读字符串，后续由 YAML
 * 解析器保留原始语义，不在此处做破坏性转换。
 *
 * @param key YAML Pair 的键节点。
 * @returns 可用于 Set 比较的键文本。
 */
function yamlKeyToString(key: unknown): string {
  if (isRecord(key) && 'value' in key) return String(key.value)
  return String(key)
}

/**
 * 校验基础 YAML 的语法、根节点、重复顶级键和受管字段边界。
 *
 * 空文本或仅包含空白的文本按空 Mapping 处理。解析时暂时允许重复键，再手工检查顶级
 * Pair，这样可以给重复顶级键提供稳定错误码，而不会把它混入普通语法错误。
 *
 * @param baseYaml YAML 模板原文。
 * @param errors 收集阻断发布的问题。
 */
function validateBaseYaml(baseYaml: unknown, errors: RoutingValidationIssue[]): void {
  if (typeof baseYaml !== 'string') {
    addIssue(errors, 'BASE_YAML_TYPE_INVALID', 'baseYaml', 'YAML 模板必须是字符串')
    return
  }

  if (baseYaml.trim().length === 0) return

  let document: ReturnType<typeof YAML.parseDocument>
  try {
    document = YAML.parseDocument(baseYaml, { uniqueKeys: false })
  } catch (error) {
    addIssue(
      errors,
      'BASE_YAML_SYNTAX_INVALID',
      'baseYaml',
      `YAML 模板无法解析：${error instanceof Error ? error.message : String(error)}`,
    )
    return
  }

  if (document.errors.length > 0) {
    for (const error of document.errors) {
      addIssue(errors, 'BASE_YAML_SYNTAX_INVALID', 'baseYaml', `YAML 模板无法解析：${error.message}`)
    }
    return
  }

  if (!isMap(document.contents)) {
    addIssue(errors, 'BASE_YAML_ROOT_NOT_MAPPING', 'baseYaml', 'YAML 模板根节点必须是 Mapping')
    return
  }

  const seenKeys = new Set<string>()
  document.contents.items.forEach((pair, index) => {
    const key = yamlKeyToString(pair.key)
    const path = `baseYaml.${key || `[${index}]`}`

    if (seenKeys.has(key)) {
      addIssue(errors, 'BASE_YAML_DUPLICATE_KEY', path, `YAML 模板存在重复顶级字段：${key}`)
    } else {
      seenKeys.add(key)
    }

    if (MANAGED_YAML_FIELDS.has(key)) {
      addIssue(errors, 'BASE_YAML_MANAGED_FIELD', path, `YAML 模板不能包含受管字段：${key}`)
    }
  })
}

/**
 * 校验正则表达式是否可以由 JavaScript RegExp 编译。
 *
 * 空字符串表示不过滤，因此是合法值；非字符串或语法错误会被定位到具体来源字段。
 *
 * @param value include 或 exclude 字段值。
 * @param path 字段路径。
 * @param errors 收集阻断发布的问题。
 */
function validateRegex(value: unknown, path: string, errors: RoutingValidationIssue[]): void {
  if (typeof value !== 'string') {
    addIssue(errors, 'GROUP_FILTER_REGEX_TYPE_INVALID', path, '节点筛选正则必须是字符串')
    return
  }

  if (value.length === 0) return

  try {
    new RegExp(value)
  } catch (error) {
    addIssue(
      errors,
      'GROUP_FILTER_REGEX_INVALID',
      path,
      `节点筛选正则无法编译：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** 图中的一条策略组引用边，并保留其原始配置路径。 */
interface GroupReferenceEdge {
  to: string
  path: string
}

/**
 * 校验策略组结构、成员来源、健康检查与引用关系，并构造循环检查所需的有向图。
 *
 * 禁用组不会输出，因此发布语义校验（成员、正则和健康检查）只针对启用组；但所有条目的
 * ID、基础字段和来源结构仍必须合法，避免 KV 中出现无法再次编辑的数据。
 *
 * @param groups 原始 groups 值。
 * @param errors 收集阻断发布的问题。
 * @returns 启用组映射及其引用图，供规则校验和循环检测复用。
 */
function validateGroups(
  groups: unknown,
  errors: RoutingValidationIssue[],
): {
  enabledGroupsById: Map<string, UnknownRecord>
  groupNamesById: Map<string, string>
  graph: Map<string, GroupReferenceEdge[]>
} {
  const enabledGroupsById = new Map<string, UnknownRecord>()
  const groupNamesById = new Map<string, string>()
  const graph = new Map<string, GroupReferenceEdge[]>()

  if (!Array.isArray(groups)) {
    addIssue(errors, 'GROUPS_NOT_ARRAY', 'groups', '策略组必须是数组')
    return { enabledGroupsById, groupNamesById, graph }
  }

  const allGroupIds = new Set<string>()
  const enabledNames = new Map<string, string>()

  groups.forEach((group, groupIndex) => {
    const groupPath = `groups[${groupIndex}]`
    if (!isRecord(group)) {
      addIssue(errors, 'GROUP_NOT_OBJECT', groupPath, '策略组条目必须是对象')
      return
    }

    const id = group.id
    if (!isNonEmptyString(id)) {
      addIssue(errors, 'GROUP_ID_REQUIRED', `${groupPath}.id`, '策略组 ID 不能为空')
    } else if (allGroupIds.has(id)) {
      addIssue(errors, 'GROUP_ID_DUPLICATE', `${groupPath}.id`, `策略组 ID 重复：${id}`)
    } else {
      allGroupIds.add(id)
    }

    if (typeof group.enabled !== 'boolean') {
      addIssue(errors, 'GROUP_ENABLED_INVALID', `${groupPath}.enabled`, '策略组 enabled 必须是布尔值')
    }

    if (typeof group.name !== 'string') {
      addIssue(errors, 'GROUP_NAME_TYPE_INVALID', `${groupPath}.name`, '策略组名称必须是字符串')
    }

    if (typeof group.type !== 'string' || !SUPPORTED_GROUP_TYPES.has(group.type as ProxyGroupType)) {
      addIssue(errors, 'GROUP_TYPE_UNSUPPORTED', `${groupPath}.type`, `不支持的策略组类型：${String(group.type)}`)
    }
    if (
      group.visibility !== undefined
      && (typeof group.visibility !== 'string' || !SUPPORTED_GROUP_VISIBILITIES.has(group.visibility))
    ) {
      addIssue(errors, 'GROUP_VISIBILITY_UNSUPPORTED', `${groupPath}.visibility`, `不支持的策略组可见条件：${String(group.visibility)}`)
    }

    if (!Array.isArray(group.sources)) {
      addIssue(errors, 'GROUP_SOURCES_NOT_ARRAY', `${groupPath}.sources`, '策略组成员来源必须是数组')
    }

    if (isNonEmptyString(id) && typeof group.name === 'string') {
      groupNamesById.set(id, group.name.trim() || id)
    }

    if (group.enabled !== true) return

    if (!isNonEmptyString(id)) return
    enabledGroupsById.set(id, group)
    graph.set(id, [])

    if (!isNonEmptyString(group.name)) {
      addIssue(errors, 'GROUP_NAME_REQUIRED', `${groupPath}.name`, '启用的策略组名称不能为空')
    } else {
      const normalizedName = group.name.trim()
      const previousPath = enabledNames.get(normalizedName)
      if (previousPath) {
        addIssue(
          errors,
          'GROUP_NAME_DUPLICATE',
          `${groupPath}.name`,
          `启用的策略组名称重复：${normalizedName}（首次出现于 ${previousPath}）`,
        )
      } else {
        enabledNames.set(normalizedName, `${groupPath}.name`)
      }
    }

    if (!Array.isArray(group.sources)) return
    if (group.sources.length === 0) {
      addIssue(errors, 'GROUP_SOURCES_REQUIRED', `${groupPath}.sources`, '启用的策略组至少需要一个成员来源')
    }

    const sourceIds = new Set<string>()
    group.sources.forEach((source, sourceIndex) => {
      const sourcePath = `${groupPath}.sources[${sourceIndex}]`
      if (!isRecord(source)) {
        addIssue(errors, 'GROUP_SOURCE_NOT_OBJECT', sourcePath, '策略组成员来源必须是对象')
        return
      }

      if (!isNonEmptyString(source.id)) {
        addIssue(errors, 'GROUP_SOURCE_ID_REQUIRED', `${sourcePath}.id`, '成员来源 ID 不能为空')
      } else if (sourceIds.has(source.id)) {
        addIssue(errors, 'GROUP_SOURCE_ID_DUPLICATE', `${sourcePath}.id`, `成员来源 ID 重复：${source.id}`)
      } else {
        sourceIds.add(source.id)
      }

      if (typeof source.appliesTo !== 'string' || !SUPPORTED_OUTPUT_SCOPES.has(source.appliesTo)) {
        addIssue(errors, 'GROUP_SOURCE_SCOPE_UNSUPPORTED', `${sourcePath}.appliesTo`, `不支持的输出范围：${String(source.appliesTo)}`)
      }
      if (
        source.when !== undefined
        && (typeof source.when !== 'string' || !SUPPORTED_MEMBER_CONDITIONS.has(source.when))
      ) {
        addIssue(errors, 'GROUP_SOURCE_CONDITION_UNSUPPORTED', `${sourcePath}.when`, `不支持的成员生效条件：${String(source.when)}`)
      }

      if (source.kind === 'filter') {
        if (typeof source.source !== 'string' || !SUPPORTED_NODE_SOURCES.has(source.source)) {
          addIssue(errors, 'GROUP_FILTER_SOURCE_UNSUPPORTED', `${sourcePath}.source`, `不支持的节点范围：${String(source.source)}`)
        }
        validateRegex(source.include, `${sourcePath}.include`, errors)
        validateRegex(source.exclude, `${sourcePath}.exclude`, errors)
        return
      }

      if (source.kind === 'group') {
        if (!isNonEmptyString(source.groupId)) {
          addIssue(errors, 'GROUP_REFERENCE_REQUIRED', `${sourcePath}.groupId`, '被引用策略组 ID 不能为空')
          return
        }
        if (source.groupId === id) {
          addIssue(errors, 'GROUP_REFERENCE_SELF', `${sourcePath}.groupId`, `策略组“${String(group.name)}”不能引用自身`)
        }
        graph.get(id)?.push({ to: source.groupId, path: `${sourcePath}.groupId` })
        return
      }

      if (source.kind === 'builtin') {
        if (source.value !== 'DIRECT') {
          addIssue(errors, 'GROUP_BUILTIN_UNSUPPORTED', `${sourcePath}.value`, `不支持的内置策略：${String(source.value)}`)
        }
        return
      }

      addIssue(errors, 'GROUP_SOURCE_KIND_UNSUPPORTED', `${sourcePath}.kind`, `不支持的成员来源类型：${String(source.kind)}`)
    })

    const groupType = group.type
    if (groupType === 'select') return
    if (!SUPPORTED_GROUP_TYPES.has(groupType as ProxyGroupType)) return

    const healthPath = `${groupPath}.healthCheck`
    if (!isRecord(group.healthCheck)) {
      addIssue(errors, 'GROUP_HEALTH_CHECK_REQUIRED', healthPath, `${String(groupType)} 策略组必须配置健康检查`)
      return
    }

    if (!isHttpUrl(group.healthCheck.url)) {
      addIssue(errors, 'GROUP_HEALTH_CHECK_URL_INVALID', `${healthPath}.url`, '测试地址必须是合法的 HTTP/HTTPS URL')
    }
    if (!isPositiveInteger(group.healthCheck.interval)) {
      addIssue(errors, 'GROUP_HEALTH_CHECK_INTERVAL_INVALID', `${healthPath}.interval`, '健康检查间隔必须是正整数')
    }
    if (groupType === 'url-test' && !isNonNegativeInteger(group.healthCheck.tolerance)) {
      addIssue(errors, 'GROUP_HEALTH_CHECK_TOLERANCE_INVALID', `${healthPath}.tolerance`, 'url-test 延迟容差必须是非负整数')
    }
    if (groupType === 'load-balance' && !isNonEmptyString(group.healthCheck.strategy)) {
      addIssue(errors, 'GROUP_HEALTH_CHECK_STRATEGY_REQUIRED', `${healthPath}.strategy`, 'load-balance 必须明确选择负载策略')
    }
  })

  // 第二遍检查可以避免“向后引用”被误判：此时全部启用组 ID 已经收集完成。
  graph.forEach((edges) => {
    for (const edge of edges) {
      if (!enabledGroupsById.has(edge.to)) {
        addIssue(errors, 'GROUP_REFERENCE_NOT_ENABLED', edge.path, `引用的策略组不存在或未启用：${edge.to}`)
      }
    }
  })

  validateGroupCycles(graph, groupNamesById, errors)
  return { enabledGroupsById, groupNamesById, graph }
}

/**
 * 使用深度优先搜索检测启用策略组之间的循环引用。
 *
 * 遇到回边时根据当前递归栈还原完整循环链，并通过规范化的 ID 集合避免同一个循环被
 * 重复报告。指向不存在或禁用组的边已由引用校验报告，这里不会继续进入该节点。
 *
 * @param graph 启用策略组引用图。
 * @param groupNamesById 用于生成可读循环链的 ID 到名称映射。
 * @param errors 收集阻断发布的问题。
 */
function validateGroupCycles(
  graph: Map<string, GroupReferenceEdge[]>,
  groupNamesById: Map<string, string>,
  errors: RoutingValidationIssue[],
): void {
  const states = new Map<string, 0 | 1 | 2>()
  const stack: string[] = []
  const reportedCycles = new Set<string>()

  /**
   * 访问一个策略组并递归检查其引用边。
   *
   * @param groupId 当前访问的策略组 ID。
   */
  function visit(groupId: string): void {
    states.set(groupId, 1)
    stack.push(groupId)

    for (const edge of graph.get(groupId) ?? []) {
      if (!graph.has(edge.to)) continue
      const nextState = states.get(edge.to) ?? 0
      if (nextState === 0) {
        visit(edge.to)
        continue
      }
      if (nextState !== 1) continue

      const cycleStart = stack.lastIndexOf(edge.to)
      const cycleIds = stack.slice(cycleStart).concat(edge.to)
      const cycleKey = Array.from(new Set(cycleIds)).sort().join('|')
      if (reportedCycles.has(cycleKey)) continue
      reportedCycles.add(cycleKey)

      const readableCycle = cycleIds.map((id) => groupNamesById.get(id) ?? id).join(' → ')
      addIssue(errors, 'GROUP_REFERENCE_CYCLE', edge.path, `策略组存在循环引用：${readableCycle}`)
    }

    stack.pop()
    states.set(groupId, 2)
  }

  for (const groupId of graph.keys()) {
    if ((states.get(groupId) ?? 0) === 0) visit(groupId)
  }
}

/**
 * 校验规则提供者结构、下载参数及启用项的名称和路径唯一性。
 *
 * @param providers 原始 providers 值。
 * @param errors 收集阻断发布的问题。
 * @returns 供 RULE-SET 规则解析使用的启用提供者 ID 映射。
 */
function validateProviders(
  providers: unknown,
  errors: RoutingValidationIssue[],
): Map<string, UnknownRecord> {
  const enabledProvidersById = new Map<string, UnknownRecord>()
  if (!Array.isArray(providers)) {
    addIssue(errors, 'PROVIDERS_NOT_ARRAY', 'providers', '规则提供者必须是数组')
    return enabledProvidersById
  }

  const allIds = new Set<string>()
  const enabledNames = new Map<string, string>()
  const enabledPaths = new Map<string, string>()

  providers.forEach((provider, providerIndex) => {
    const providerPath = `providers[${providerIndex}]`
    if (!isRecord(provider)) {
      addIssue(errors, 'PROVIDER_NOT_OBJECT', providerPath, '规则提供者条目必须是对象')
      return
    }

    if (!isNonEmptyString(provider.id)) {
      addIssue(errors, 'PROVIDER_ID_REQUIRED', `${providerPath}.id`, '规则提供者 ID 不能为空')
    } else if (allIds.has(provider.id)) {
      addIssue(errors, 'PROVIDER_ID_DUPLICATE', `${providerPath}.id`, `规则提供者 ID 重复：${provider.id}`)
    } else {
      allIds.add(provider.id)
    }

    if (typeof provider.enabled !== 'boolean') {
      addIssue(errors, 'PROVIDER_ENABLED_INVALID', `${providerPath}.enabled`, '规则提供者 enabled 必须是布尔值')
    }
    if (typeof provider.name !== 'string') {
      addIssue(errors, 'PROVIDER_NAME_TYPE_INVALID', `${providerPath}.name`, '规则提供者名称必须是字符串')
    }
    if (provider.type !== 'http') {
      addIssue(errors, 'PROVIDER_TYPE_UNSUPPORTED', `${providerPath}.type`, `不支持的规则提供者类型：${String(provider.type)}`)
    }
    if (typeof provider.behavior !== 'string' || !SUPPORTED_PROVIDER_BEHAVIORS.has(provider.behavior)) {
      addIssue(errors, 'PROVIDER_BEHAVIOR_UNSUPPORTED', `${providerPath}.behavior`, `不支持的行为模式：${String(provider.behavior)}`)
    }
    if (typeof provider.url !== 'string') {
      addIssue(errors, 'PROVIDER_URL_TYPE_INVALID', `${providerPath}.url`, '规则提供者下载地址必须是字符串')
    }
    if (typeof provider.path !== 'string') {
      addIssue(errors, 'PROVIDER_PATH_TYPE_INVALID', `${providerPath}.path`, '规则提供者路径必须是字符串')
    }
    if (typeof provider.interval !== 'number') {
      addIssue(errors, 'PROVIDER_INTERVAL_TYPE_INVALID', `${providerPath}.interval`, '规则提供者更新间隔必须是数字')
    }

    if (provider.enabled !== true) return
    if (isNonEmptyString(provider.id)) enabledProvidersById.set(provider.id, provider)

    if (!isNonEmptyString(provider.name)) {
      addIssue(errors, 'PROVIDER_NAME_REQUIRED', `${providerPath}.name`, '启用的规则提供者名称不能为空')
    } else {
      const name = provider.name.trim()
      const previousPath = enabledNames.get(name)
      if (previousPath) {
        addIssue(errors, 'PROVIDER_NAME_DUPLICATE', `${providerPath}.name`, `启用的规则提供者名称重复：${name}（首次出现于 ${previousPath}）`)
      } else {
        enabledNames.set(name, `${providerPath}.name`)
      }
    }

    if (!isHttpUrl(provider.url)) {
      addIssue(errors, 'PROVIDER_URL_INVALID', `${providerPath}.url`, '规则提供者下载地址必须是合法的 HTTP/HTTPS URL')
    }
    if (!isNonEmptyString(provider.path)) {
      addIssue(errors, 'PROVIDER_PATH_REQUIRED', `${providerPath}.path`, '启用的规则提供者必须配置生成路径')
    } else {
      const path = provider.path.trim()
      const previousPath = enabledPaths.get(path)
      if (previousPath) {
        addIssue(errors, 'PROVIDER_PATH_DUPLICATE', `${providerPath}.path`, `启用的规则提供者路径重复：${path}（首次出现于 ${previousPath}）`)
      } else {
        enabledPaths.set(path, `${providerPath}.path`)
      }
    }
    if (!isPositiveInteger(provider.interval)) {
      addIssue(errors, 'PROVIDER_INTERVAL_INVALID', `${providerPath}.interval`, '规则提供者更新间隔必须是正整数')
    }
  })

  return enabledProvidersById
}

/**
 * 校验结构化路由规则、稳定引用、MATCH 位置及 no-resolve 组合。
 *
 * 为兼容旧配置，规则目标除启用策略组 ID 外还允许 `builtin:DIRECT` 和
 * `builtin:REJECT`。no-resolve 在旧配置的多种非 MATCH 规则上均有使用，因此服务端保留
 * 这些组合，仅禁止 MATCH 携带 no-resolve。
 *
 * @param rules 原始 rules 值。
 * @param enabledGroupsById 启用策略组 ID 映射。
 * @param enabledProvidersById 启用规则提供者 ID 映射。
 * @param errors 收集阻断发布的问题。
 */
function validateRules(
  rules: unknown,
  enabledGroupsById: Map<string, UnknownRecord>,
  enabledProvidersById: Map<string, UnknownRecord>,
  errors: RoutingValidationIssue[],
): void {
  if (!Array.isArray(rules)) {
    addIssue(errors, 'RULES_NOT_ARRAY', 'rules', '路由规则必须是数组')
    return
  }

  const allIds = new Set<string>()
  const enabledRuleIndexes: number[] = []
  const enabledMatchIndexes: number[] = []

  rules.forEach((rule, ruleIndex) => {
    const rulePath = `rules[${ruleIndex}]`
    if (!isRecord(rule)) {
      addIssue(errors, 'RULE_NOT_OBJECT', rulePath, '路由规则条目必须是对象')
      return
    }

    if (!isNonEmptyString(rule.id)) {
      addIssue(errors, 'RULE_ID_REQUIRED', `${rulePath}.id`, '路由规则 ID 不能为空')
    } else if (allIds.has(rule.id)) {
      addIssue(errors, 'RULE_ID_DUPLICATE', `${rulePath}.id`, `路由规则 ID 重复：${rule.id}`)
    } else {
      allIds.add(rule.id)
    }

    if (typeof rule.enabled !== 'boolean') {
      addIssue(errors, 'RULE_ENABLED_INVALID', `${rulePath}.enabled`, '路由规则 enabled 必须是布尔值')
    }
    if (typeof rule.category !== 'string') {
      addIssue(errors, 'RULE_CATEGORY_INVALID', `${rulePath}.category`, '路由规则分类必须是字符串')
    }
    if (rule.remark !== undefined && typeof rule.remark !== 'string') {
      addIssue(errors, 'RULE_REMARK_INVALID', `${rulePath}.remark`, '路由规则备注必须是字符串')
    }
    if (rule.value !== undefined && typeof rule.value !== 'string') {
      addIssue(errors, 'RULE_VALUE_TYPE_INVALID', `${rulePath}.value`, '路由规则匹配内容必须是字符串')
    }
    if (rule.providerId !== undefined && typeof rule.providerId !== 'string') {
      addIssue(errors, 'RULE_PROVIDER_TYPE_INVALID', `${rulePath}.providerId`, '规则提供者引用必须是字符串 ID')
    }
    if (typeof rule.type !== 'string' || !SUPPORTED_RULE_TYPES.has(rule.type)) {
      addIssue(errors, 'RULE_TYPE_UNSUPPORTED', `${rulePath}.type`, `不支持的路由规则类型：${String(rule.type)}`)
    }
    if (typeof rule.targetGroupId !== 'string') {
      addIssue(errors, 'RULE_TARGET_TYPE_INVALID', `${rulePath}.targetGroupId`, '规则目标必须是策略组 ID 或内置目标')
    }
    if (typeof rule.noResolve !== 'boolean') {
      addIssue(errors, 'RULE_NO_RESOLVE_INVALID', `${rulePath}.noResolve`, 'noResolve 必须是布尔值')
    }
    if (rule.legacyOptions !== undefined && (!Array.isArray(rule.legacyOptions) || rule.legacyOptions.some((option) => typeof option !== 'string'))) {
      addIssue(errors, 'RULE_LEGACY_OPTIONS_INVALID', `${rulePath}.legacyOptions`, '迁移保留选项必须是字符串数组')
    }

    if (rule.enabled !== true) return
    enabledRuleIndexes.push(ruleIndex)

    if (rule.type === 'MATCH') enabledMatchIndexes.push(ruleIndex)
    if (!SUPPORTED_RULE_TYPES.has(String(rule.type))) return

    if (rule.type === 'MATCH') {
      if (isNonEmptyString(rule.value)) {
        addIssue(errors, 'RULE_MATCH_VALUE_FORBIDDEN', `${rulePath}.value`, 'MATCH 规则不应包含匹配内容')
      }
      if (isNonEmptyString(rule.providerId)) {
        addIssue(errors, 'RULE_MATCH_PROVIDER_FORBIDDEN', `${rulePath}.providerId`, 'MATCH 规则不能引用规则提供者')
      }
      if (rule.noResolve === true) {
        addIssue(errors, 'RULE_MATCH_NO_RESOLVE_FORBIDDEN', `${rulePath}.noResolve`, 'MATCH 规则不能启用 no-resolve')
      }
    } else if (rule.type === 'RULE-SET') {
      if (!isNonEmptyString(rule.providerId)) {
        addIssue(errors, 'RULE_PROVIDER_REQUIRED', `${rulePath}.providerId`, 'RULE-SET 规则必须引用规则提供者')
      } else if (!enabledProvidersById.has(rule.providerId)) {
        addIssue(errors, 'RULE_PROVIDER_NOT_ENABLED', `${rulePath}.providerId`, `引用的规则提供者不存在或未启用：${rule.providerId}`)
      }
    } else {
      if (!isNonEmptyString(rule.value)) {
        addIssue(errors, 'RULE_VALUE_REQUIRED', `${rulePath}.value`, `${String(rule.type)} 规则必须填写匹配内容`)
      }
      if (isNonEmptyString(rule.providerId)) {
        addIssue(errors, 'RULE_PROVIDER_FORBIDDEN', `${rulePath}.providerId`, '只有 RULE-SET 规则可以引用规则提供者')
      }
    }

    if (!isNonEmptyString(rule.targetGroupId)) {
      addIssue(errors, 'RULE_TARGET_REQUIRED', `${rulePath}.targetGroupId`, '启用的路由规则必须指定目标策略组或内置目标')
    } else {
      const target = rule.targetGroupId
      if (!SUPPORTED_BUILTIN_TARGETS.has(target) && !enabledGroupsById.has(target)) {
        addIssue(errors, 'RULE_TARGET_NOT_ENABLED', `${rulePath}.targetGroupId`, `目标策略组不存在或未启用：${target}`)
      }
    }
  })

  if (enabledMatchIndexes.length === 0) {
    addIssue(errors, 'RULE_MATCH_MISSING', 'rules', '启用规则中必须存在一条最终 MATCH 规则')
    return
  }
  if (enabledMatchIndexes.length > 1) {
    addIssue(errors, 'RULE_MATCH_MULTIPLE', 'rules', '启用规则中只能存在一条 MATCH 规则')
  }

  const lastEnabledIndex = enabledRuleIndexes[enabledRuleIndexes.length - 1]
  if (lastEnabledIndex !== undefined && rules[lastEnabledIndex]?.type !== 'MATCH') {
    addIssue(errors, 'RULE_MATCH_NOT_LAST', `rules[${lastEnabledIndex}]`, 'MATCH 必须是最后一条启用规则')
  }
}

/**
 * 对路由配置执行发布级服务端校验。
 *
 * 此函数只读取传入值，不写 KV、不清缓存，也不修改配置对象。即使调用方通过 JSON 绕过
 * TypeScript 类型，函数也会以结构化错误返回，而不是因字段类型异常而抛出未处理错误。
 *
 * @param input 从 API、KV 或迁移流程取得的待校验配置。
 * @returns 包含 valid、errors 和 warnings 的稳定校验结果。
 */
export function validateRoutingConfig(input: unknown): RoutingValidationResult {
  const errors: RoutingValidationIssue[] = []
  const warnings: RoutingValidationIssue[] = []

  if (!isRecord(input)) {
    addIssue(errors, 'ROUTING_CONFIG_NOT_OBJECT', '', '路由配置必须是对象')
    return { valid: false, errors, warnings }
  }

  if (input.schemaVersion !== 1) {
    addIssue(
      errors,
      'SCHEMA_VERSION_UNSUPPORTED',
      'schemaVersion',
      `不支持的路由配置版本：${String(input.schemaVersion)}，当前仅支持版本 1`,
    )
  }

  validateBaseYaml(input.baseYaml, errors)
  const { enabledGroupsById } = validateGroups(input.groups, errors)
  const enabledProvidersById = validateProviders(input.providers, errors)
  validateRules(input.rules, enabledGroupsById, enabledProvidersById, errors)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// 在类型层明确建立校验器与 RoutingConfig 的兼容关系，便于调用方发现模型漂移。
const _routingConfigTypeCompatibilityCheck: (config: RoutingConfig) => RoutingValidationResult = validateRoutingConfig
void _routingConfigTypeCompatibilityCheck
