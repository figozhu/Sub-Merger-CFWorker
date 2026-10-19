import YAML from 'yaml'

/** 保留所有协议的原始字段，解析阶段只要求具备节点对象和名称。 */
export type SubscriptionNode = Record<string, unknown> & { name: string }

/** 只包含安全错误说明，不包含可能带有节点密码的 YAML 片段。 */
export interface SubscriptionContentResult {
  nodes: SubscriptionNode[]
  code?: string
  message?: string
  hint?: string
  parserCode?: string
  parserLine?: number
}

/**
 * 解析 Clash YAML，并明确区分空响应、网页、非 Clash 格式和升级提示配置。
 * MIME 不能作为判断依据：部分合法订阅的 Content-Type 实际为 text/html。
 * @param yamlString 上游返回的完整文本，调用方负责限制响应大小。
 * @param subName 可选订阅名称，成功后追加到节点名称中。
 * @returns 节点或可安全记录的错误分类；从不输出原始解析异常。
 */
export function parseSubscriptionContent(yamlString: string, subName?: string): SubscriptionContentResult {
  const text = yamlString.trim()
  if (!text) return { nodes: [], code: 'EMPTY_RESPONSE', message: '订阅源返回了空内容', hint: '检查订阅是否有效或已到期。' }
  if (/^(?:<!doctype\s+html|<html|<head|<body)/i.test(text)) {
    return { nodes: [], code: 'HTML_RESPONSE', message: '订阅源返回了网页而非 Clash YAML', hint: '检查是否跳转到登录页、验证码或站点拦截页。' }
  }
  if (/^(?:ss|ssr|vmess|vless|trojan|hysteria2?|hy2|tuic):\/\//im.test(text)
    || /^[A-Za-z0-9+/_=-]+$/.test(text.replace(/\s/g, ''))) {
    return { nodes: [], code: 'UNSUPPORTED_FORMAT', message: '返回内容是节点链接或 Base64，当前仅支持 Clash YAML', hint: '使用服务商提供的 Clash / Mihomo 订阅地址，或调整请求 User-Agent。' }
  }

  const lineCounter = new YAML.LineCounter()
  const document = YAML.parseDocument(text, { prettyErrors: false, lineCounter })
  if (document.errors.length) {
    const error = document.errors[0]
    return { nodes: [], code: 'INVALID_YAML', message: '订阅内容的 YAML 语法无效', hint: '检查上游格式；日志仅记录错误类型和行号。', parserCode: error.code, parserLine: lineCounter.linePos(error.pos[0]).line }
  }

  let parsed: unknown
  try { parsed = document.toJS({ maxAliasCount: 100 }) } catch {
    return { nodes: [], code: 'INVALID_YAML', message: '订阅 YAML 包含无法展开的引用', hint: '检查上游 YAML 的锚点和别名数量。' }
  }
  const root = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  const proxies = Array.isArray(root.proxies) ? root.proxies : root.Proxy
  if (!Array.isArray(proxies)) return { nodes: [], code: 'NO_PROXIES', message: '订阅内容缺少 proxies 节点数组', hint: '确认上游返回 Clash YAML，而不是错误信息或其他客户端配置。' }
  if (!proxies.length) return { nodes: [], code: 'NO_PROXIES', message: '订阅源返回的节点列表为空', hint: '检查套餐状态、订阅权限和请求 User-Agent。' }
  if (!proxies.every((node): node is SubscriptionNode => Boolean(node && typeof node === 'object' && !Array.isArray(node) && typeof node.name === 'string' && node.name.trim()))) {
    return { nodes: [], code: 'INVALID_PROXIES', message: '订阅中存在无效节点对象或空节点名称', hint: '请检查上游 proxies 数组。' }
  }
  // 一些服务商用 HTTP 200 和伪节点提示升级；这类内容不能计为真实节点或写入成功缓存。
  if (proxies.every((node) => /请.*(?:升级|更新.*客户端)|你现在的版本是|(?:upgrade|outdated).*client|client.*(?:upgrade|outdated)/i.test(node.name))) {
    return { nodes: [], code: 'CLIENT_UPGRADE_REQUIRED', message: '上游返回了客户端升级提示节点', hint: '请求 User-Agent 被识别为旧客户端，请使用 Clash.Meta，或与本地可用客户端一致的标识。' }
  }
  return { nodes: proxies.map((node) => ({ ...node, name: subName?.trim() ? `${node.name}【${subName}】` : node.name })) }
}

/**
 * 从YAML字符串中解析代理节点
 * @param yamlString YAML格式的字符串
 * @param subName 可选的订阅名称
 * @returns 解析出的代理节点数组
 */
export function getProxyNodesFromYaml(yamlString: string, subName?: string): SubscriptionNode[] {
  return parseSubscriptionContent(yamlString, subName).nodes
}
