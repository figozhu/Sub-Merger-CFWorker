import YAML, { isMap, isScalar, isSeq } from 'yaml'

/** Clash 内置策略不依赖订阅节点，裁剪时必须保留。 */
const BUILTIN_TARGETS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL'])

/** 策略组裁剪结果；changed 用于避免无变化时重新序列化用户 YAML。 */
interface PrunedProxyGroups {
  groups: Record<string, unknown>[]
  changed: boolean
}

/**
 * 删除空策略组及其它组中失效的成员引用，直到多层引用全部稳定。
 * 只处理本次输出，不修改界面配置；有节点恢复后，原策略组会自动重新出现。
 * @param groups 本次客户端过滤后生成的策略组，顺序保持不变。
 * @param nodeNames 本次 YAML 实际包含的节点名称。
 * @returns 独立的有效策略组数组和是否发生变化。
 */
export function pruneEmptyProxyGroups(groups: Record<string, unknown>[], nodeNames: string[]): PrunedProxyGroups {
  let remaining = groups.map((group) => ({ ...group }))
  let changed = false
  while (true) {
    const available = new Set([...BUILTIN_TARGETS, ...nodeNames, ...remaining.map((group) => String(group.name))])
    let passChanged = false
    remaining = remaining.flatMap((group) => {
      const members = Array.isArray(group.proxies) ? group.proxies : []
      const proxies = members.filter((name) => typeof name === 'string' && available.has(name))
      // 兼容旧 YAML/缓存中的 provider 动态组，不能因静态 proxies 为空而误删。
      const hasDynamicMembers = (Array.isArray(group.use) && group.use.length > 0)
        || group['include-all'] === true || group['include-all-providers'] === true
        || (group['include-all-proxies'] === true && nodeNames.length > 0)
      if (proxies.length === 0 && !hasDynamicMembers) {
        passChanged = true
        return []
      }
      if (proxies.length !== members.length) {
        passChanged = true
        return [{ ...group, proxies }]
      }
      return [group]
    })
    changed ||= passChanged
    if (!passChanged) return { groups: remaining, changed }
  }
}

/**
 * 找到规则最外层的策略字段，兼容逻辑规则中的嵌套括号及尾部选项。
 * SUB-RULE 的目标属于子规则名称，不能当作代理策略改写。
 * @param text 完整 Clash 规则文本。
 * @returns 策略字段在原文本中的区间；无法识别或无需处理时返回 null。
 */
function findRuleTarget(text: string): { start: number; end: number; name: string; isMatch: boolean } | null {
  const separators: number[] = []
  let depth = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') depth++
    else if (text[index] === ')') depth--
    else if (text[index] === ',' && depth === 0) separators.push(index)
  }
  const type = text.slice(0, separators[0]).trim().toUpperCase()
  if (type === 'SUB-RULE') return null
  const isMatch = type === 'MATCH' || type === 'FINAL'
  const field = isMatch ? 0 : 1
  if (separators[field] === undefined) return null
  const start = separators[field] + 1
  const end = separators[field + 1] ?? text.length
  return { start, end, name: text.slice(start, end).trim(), isMatch }
}

/**
 * 从 YAML 规则数组提取可修改的标量与策略字段，忽略空项及非规则数据。
 * @param node 顶级 rules 或某个 sub-rules 规则数组。
 * @returns 保留 AST 标量引用的规则信息，修改 value 不会丢失注释。
 */
function collectRules(node: unknown) {
  return isSeq(node) ? node.items.flatMap((item) => {
    if (!isScalar(item) || typeof item.value !== 'string') return []
    const target = findRuleTarget(item.value)
    return target ? [{ item, text: item.value, target }] : []
  }) : []
}

/**
 * 修复明确的下载代理与链式代理字段，避免删除组后留下悬空引用或制造自身循环。
 * 这些字段不使用 MATCH 兜底，因为该策略可能包含当前节点；中转已丢失时使用 REJECT。
 * @param document 完整 YAML AST。
 * @param removedNames 本次确实被移除或隐藏的组名，外部 provider 节点名称不受影响。
 * @returns 是否替换了至少一个失效引用；未知字段及仍有效的引用保持原样。
 */
function sanitizeDeletedGroupReferences(document: YAML.Document.Parsed, removedNames: Set<string>): boolean {
  const fields: Array<{ node: unknown; key: string }> = []
  const proxies = document.get('proxies')
  if (isSeq(proxies)) proxies.items.forEach((node) => fields.push({ node, key: 'dialer-proxy' }))
  for (const key of ['rule-providers', 'proxy-providers']) {
    const providers = document.get(key)
    if (!isMap(providers)) continue
    for (const pair of providers.items) {
      const provider = pair.value
      if (!isMap(provider)) continue
      fields.push({ node: provider, key: 'proxy' })
      if (key !== 'proxy-providers') continue
      fields.push({ node: provider.get('override'), key: 'dialer-proxy' })
      const payload = provider.get('payload')
      if (isSeq(payload)) payload.items.forEach((node) => fields.push({ node, key: 'dialer-proxy' }))
    }
  }
  let changed = false
  for (const { node, key } of fields) {
    if (!isMap(node)) continue
    const target = node.get(key, true)
    if (!isScalar(target) || typeof target.value !== 'string' || !removedNames.has(target.value)) continue
    target.value = 'REJECT'
    changed = true
  }
  return changed
}

/**
 * 统一修复完整 YAML 的空组、组成员与规则目标，保留备注及未知基础字段。
 * 失效规则优先使用仍有效的最终 MATCH 策略，否则使用首个实际节点；无节点时使用 REJECT，
 * 避免订阅故障把原本要求代理的流量意外改成直连。显式 DIRECT 规则保持不变。
 * @param document 旧模板合并后或动态生成后的完整 YAML AST。
 * @param configuredGroupNames 上游解析器裁剪前的组名，用于识别已提前移除的组引用。
 * @returns 是否修改了 AST；函数不会回写管理员保存的模板或路由配置。
 */
export function sanitizeProxyGroupDocument(document: YAML.Document.Parsed, configuredGroupNames: string[] = []): boolean {
  const nodes = document.get('proxies')
  const nodeNames = isSeq(nodes)
    ? nodes.items.map((node) => isMap(node) ? node.get('name') : undefined).filter((name): name is string => typeof name === 'string')
    : []
  const groupsNode = document.get('proxy-groups')
  const groups = isSeq(groupsNode) ? groupsNode.toJSON() as Record<string, unknown>[] : []
  const pruned = pruneEmptyProxyGroups(groups, nodeNames)
  let changed = pruned.changed
  if (pruned.changed) document.set('proxy-groups', document.createNode(pruned.groups))

  const available = new Set([...BUILTIN_TARGETS, ...nodeNames, ...pruned.groups.map((group) => String(group.name))])
  const removedNames = new Set([...configuredGroupNames, ...groups.map((group) => String(group.name))].filter((name) => !available.has(name)))
  changed = sanitizeDeletedGroupReferences(document, removedNames) || changed
  const rules = collectRules(document.get('rules'))
  const match = rules.findLast((rule) => rule.target.isMatch && available.has(rule.target.name))
  const fallback = match?.target.name ?? nodeNames[0] ?? 'REJECT'
  // 子规则属于基础模板的可编辑数据，使用同一最终策略修复；SUB-RULE 跳转名称保持原样。
  const subRules = document.get('sub-rules')
  if (isMap(subRules)) subRules.items.forEach((pair) => rules.push(...collectRules(pair.value)))
  for (const { item, text, target } of rules) {
    if (available.has(target.name)) continue
    // 仅替换策略字段，尾部 no-resolve 等选项和 Scalar 上的注释原样保留。
    item.value = text.slice(0, target.start) + fallback + text.slice(target.end)
    changed = true
  }
  return changed
}

/**
 * 为旧版完整输出和历史缓存执行与动态生成器相同的容错处理。
 * @param yaml 完整 YAML 文本；无变化时原样返回，保留原有格式。
 * @param configuredGroupNames 旧生成器提前裁剪前的组名；读取历史完整缓存时不需要提供。
 * @returns 不含空静态策略组及失效规则引用的 YAML。
 * @throws YAML 语法损坏或根节点不是 Mapping 时抛出固定错误，供缓存调用方重新生成。
 */
export function sanitizeProxyGroupYaml(yaml: string, configuredGroupNames: string[] = []): string {
  const document = YAML.parseDocument(yaml, { uniqueKeys: true })
  if (document.errors.length > 0 || !isMap(document.contents)) throw new Error('订阅 YAML 格式无效，需要重新生成')
  return sanitizeProxyGroupDocument(document, configuredGroupNames) ? document.toString({ lineWidth: 0 }) : yaml
}
