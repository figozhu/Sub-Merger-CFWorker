import { COMMA_PAYLOAD_RULE_TYPES, SUPPORTED_RULE_TYPES } from '../config/routingRuleTypes'

/** 规则解析结果，同时保留目标字段区间，供输出容错时精确替换。 */
export interface ParsedRoutingRule {
  type: string
  value?: string
  target: string
  options: string[]
  targetStart: number
  targetEnd: number
}

/**
 * 按 Mihomo ParseRulePayload 的字段划分解析完整规则。
 * 普通规则读取固定字段；逻辑/子规则/正则规则使用末尾目标，保留内部所有逗号。
 * FINAL 仅供旧缓存裁剪兼容，是否接受该类型仍由导入器的支持清单决定。
 * @param text 完整逗号分隔规则。
 * @returns 字段及目标区间；缺少目标分隔符时返回 null，不猜测或修复损坏数据。
 */
export function parseRoutingRule(text: string): ParsedRoutingRule | null {
  const first = text.indexOf(',')
  if (first < 0) return null
  const type = text.slice(0, first).trim().toUpperCase()
  const isMatch = type === 'MATCH' || type === 'FINAL'
  const commaPayload = COMMA_PAYLOAD_RULE_TYPES.has(type)
  const targetSeparator = isMatch ? first : commaPayload ? text.lastIndexOf(',') : text.indexOf(',', first + 1)
  if (targetSeparator < 0 || (!isMatch && targetSeparator === first)) return null
  const next = commaPayload ? -1 : text.indexOf(',', targetSeparator + 1)
  const targetEnd = next < 0 ? text.length : next
  return {
    type,
    value: isMatch ? undefined : text.slice(first + 1, targetSeparator).trim(),
    target: text.slice(targetSeparator + 1, targetEnd).trim(),
    options: next < 0 ? [] : text.slice(next + 1).split(',').map((option) => option.trim()),
    targetStart: targetSeparator + 1,
    targetEnd,
  }
}

/**
 * 校验由 / 分隔的无符号整数或闭区间，避免端口等条件在客户端加载时才报错。
 * @param value 原始匹配内容。
 * @param maximum 此规则允许的最大整数（端口、UID 和 DSCP 的范围不同）。
 * @returns 每段均在合法范围且起点不大于终点时返回 true。
 */
function isValidNumberRange(value: string, maximum: number): boolean {
  return value.split('/').every((part) => {
    if (!/^\d+(?:-\d+)?$/.test(part)) return false
    const [start, end = start] = part.split('-').map(Number)
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && end <= maximum
  })
}

/**
 * 提取逻辑表达式最外层的条件列表；括号计数与 Mihomo 逻辑规则保持一致。
 * @param value 形如 ((DOMAIN,a),(NETWORK,tcp)) 的完整表达式。
 * @returns 去除单个条件外层括号后的文本；括号不匹配或存在游离内容时返回 null。
 */
function splitLogicConditions(value: string): string[] | null {
  if (!value.startsWith('(') || !value.endsWith(')')) return null
  const body = value.slice(1, -1)
  const conditions: string[] = []
  let depth = 0
  let start = -1
  let separatorExpected = false
  for (let index = 0; index < body.length; index++) {
    const char = body[index]
    if (depth === 0) {
      if (/\s/.test(char)) continue
      if (separatorExpected) {
        if (char !== ',') return null
        separatorExpected = false
        continue
      }
      if (char !== '(') return null
      start = index + 1
    }
    if (char === '(') depth++
    else if (char === ')') {
      if (--depth < 0) return null
      if (depth === 0) {
        conditions.push(body.slice(start, index).trim())
        separatorExpected = true
      }
    }
  }
  return depth === 0 && separatorExpected ? conditions : null
}

/**
 * 检查规则匹配内容的结构和有限数值范围，不用 JavaScript 正则引擎冒充 Mihomo 的 Go 引擎。
 * 逻辑表达式里的 RULE-SET 使用原始提供者名称，因此在此检查其是否仍启用。
 * @param type 已识别的规则类型。
 * @param value 非空匹配内容。
 * @param providerNames 启用规则提供者的名称集合。
 * @param depth 内部递归深度，限制畸形嵌套造成的栈溢出。
 * @returns 面向管理员的错误说明；未发现结构错误时返回 null。
 */
export function getRuleValueError(type: string, value: string, providerNames: ReadonlySet<string>, depth = 0): string | null {
  if (depth > 64) return '逻辑规则嵌套不能超过 64 层'
  if (/[\r\n]/.test(value)) return '匹配内容不能包含换行符'
  value = value.trim()
  if (!value.trim()) return `${type} 规则必须填写匹配内容`
  if (!COMMA_PAYLOAD_RULE_TYPES.has(type) && value.includes(',')) return `${type} 的匹配内容不能包含逗号；多个端口或用户请用 / 分隔`
  const max = ['SRC-PORT', 'DST-PORT', 'IN-PORT'].includes(type) ? 65535 : type === 'UID' ? 4294967295 : type === 'DSCP' ? 63 : undefined
  if (max !== undefined && !isValidNumberRange(value, max)) return `${type} 必须是 0–${max} 内的整数或递增范围，多个条件用 / 分隔`
  if (type === 'NETWORK' && !['tcp', 'udp'].includes(value.toLowerCase())) return 'NETWORK 仅支持 tcp 或 udp'
  if (!['AND', 'OR', 'NOT', 'SUB-RULE'].includes(type)) return null

  const conditions = splitLogicConditions(type === 'SUB-RULE' ? `(${value})` : value)
  if (!conditions || ((type === 'NOT' || type === 'SUB-RULE') && conditions.length !== 1)) {
    return type === 'SUB-RULE' ? 'SUB-RULE 必须填写一个括号条件，例如 (NETWORK,tcp)'
      : `${type} 需要括号包围的条件列表，例如 ((DOMAIN,example.com))；NOT 只能包含一个条件`
  }
  for (const condition of conditions) {
    const comma = condition.indexOf(',')
    const childType = condition.slice(0, comma).trim().toUpperCase()
    if (comma < 0 || !SUPPORTED_RULE_TYPES.has(childType) || ['MATCH', 'SUB-RULE'].includes(childType)) {
      return `逻辑条件的规则类型无效：${comma < 0 ? condition : childType}`
    }
    // 条件没有代理目标：普通类型剩余字段是附加参数，正则/逻辑类型剩余内容全部是 payload。
    const remaining = condition.slice(comma + 1).trim()
    const payload = COMMA_PAYLOAD_RULE_TYPES.has(childType) ? remaining : remaining.split(',')[0].trim()
    if (childType === 'RULE-SET' && !providerNames.has(payload)) return `逻辑条件引用的规则提供者不存在或未启用：${payload}`
    const error = getRuleValueError(childType, payload, providerNames, depth + 1)
    if (error) return error
  }
  return null
}
