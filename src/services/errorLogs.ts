/** 错误日志复用已有 KV，不需要新增 Cloudflare 绑定。 */
export interface LogStoreEnv {
  SUB_MERGER_KV: KVNamespace
  TABLENAME: string
}

/** 日志只保存可定位故障的元数据，禁止传入响应正文、完整 URL 或节点密钥。 */
export interface ErrorLogInput {
  level: 'error' | 'warning' | 'info'
  scope: 'subscription' | 'request' | 'scheduled' | 'access'
  code: string
  message: string
  hint?: string
  sourceName?: string
  sourceHost?: string
  subscriptionType?: string
  userAgent?: string
  httpStatus?: number
  contentType?: string
  contentEncoding?: string
  cfRay?: string
  challenge?: boolean
  redirected?: boolean
  finalHost?: string
  durationMs?: number
  responseBytes?: number
  nodeCount?: number
  errorName?: string
  parserCode?: string
  parserLine?: number
  clientIp?: string
  clientIpSource?: string
  clientUserAgent?: string
  requestMethod?: string
  requestPath?: string
  requestStartedAt?: string
}

/** 访问记录与运行诊断分别分页，避免大量客户端请求淹没故障记录。 */
export type LogCategory = 'diagnostic' | 'access'

/** KV 中持久化的单条日志；时间使用 UTC，页面按管理员本地时区显示。 */
export interface ErrorLogRecord extends ErrorLogInput {
  id: string
  timestamp: string
}

export const LOG_RETENTION_DAYS = 7

/**
 * 脱敏并截断可变文本，避免管理员填写的名称或上游响应头夹带链接和 token。
 * @param value 待记录文本。
 * @returns 不含完整链接及常见凭据字段的短文本。
 */
function redactLogText(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"']+/gi, '[链接已隐藏]')
    .replace(/((?:token|password|authorization|secret|key)\s*[=:]\s*)[^\s;,]+/gi, '$1[已隐藏]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500)
}

/**
 * 为存储和即时诊断响应使用同一脱敏规则。
 * @param input 受控的结构化诊断字段。
 * @returns 脱敏后的新对象；不修改调用方对象。
 */
export function sanitizeErrorLog(input: ErrorLogInput): ErrorLogInput {
  const result = { ...input }
  for (const key of ['message', 'hint', 'sourceName', 'sourceHost', 'subscriptionType', 'userAgent', 'contentType', 'contentEncoding', 'cfRay', 'finalHost', 'parserCode', 'clientIp', 'clientIpSource', 'clientUserAgent', 'requestMethod', 'requestPath', 'requestStartedAt'] as const) {
    const value = result[key]
    if (typeof value === 'string') result[key] = redactLogText(value)
  }
  return result
}

/**
 * 写入一条独立、有过期时间的日志，避免并发请求覆盖同一个 KV 数组。
 * 日志存储异常只写固定控制台提示，不中断订阅生成，也不递归记录日志。
 * @param env 已有 KV 绑定和业务键前缀。
 * @param input 已脱离原始异常/正文的结构化字段。
 * @returns 无返回值；持久化失败时仍可在 Workers 控制台查看安全日志。
 */
export async function writeErrorLog(env: LogStoreEnv, input: ErrorLogInput): Promise<void> {
  const safeInput = sanitizeErrorLog(input)
  const timestamp = Date.now()
  const record = { ...safeInput, id: crypto.randomUUID(), timestamp: new Date(timestamp).toISOString() }
  const output = JSON.stringify(record)
  if (input.level === 'error') console.error(output)
  else if (input.level === 'warning') console.warn(output)
  else console.info(output)
  try {
    // KV 按键名升序列举，反转时间戳可直接分页读取最新日志，无需扫描全部历史。
    const reverseTime = String(9999999999999 - timestamp).padStart(13, '0')
    const prefix = input.scope === 'access' ? 'access-logs' : 'logs'
    await env.SUB_MERGER_KV.put(`${env.TABLENAME}:${prefix}:${reverseTime}:${record.id}`, output, {
      expirationTtl: LOG_RETENTION_DAYS * 24 * 60 * 60,
    })
  } catch {
    console.error('错误日志写入 KV 失败，请检查 KV 绑定、配额和服务状态')
  }
}

/**
 * 分页读取最近日志，最多读取 50 条并跳过已过期的键。
 * KV 跨区域同步存在延迟，刚写入的日志可能需稍后刷新才能出现。
 * @param env 日志存储环境。
 * @param cursor 上一页返回的不透明游标；首次读取不传。
 * @param category 运行诊断或客户端订阅访问；两类使用独立前缀。
 * @returns 日志及下一页游标；空游标表示没有更多数据。
 */
export async function listErrorLogs(env: LogStoreEnv, cursor?: string, category: LogCategory = 'diagnostic'): Promise<{ logs: ErrorLogRecord[]; cursor: string; retentionDays: number }> {
  const prefix = category === 'access' ? 'access-logs' : 'logs'
  const page = await env.SUB_MERGER_KV.list({ prefix: `${env.TABLENAME}:${prefix}:`, limit: 50, ...(cursor ? { cursor } : {}) })
  const records = await Promise.all(page.keys.map((key) => env.SUB_MERGER_KV.get<ErrorLogRecord>(key.name, 'json')))
  return {
    logs: records.filter((record): record is ErrorLogRecord => record !== null),
    cursor: page.list_complete ? '' : page.cursor,
    retentionDays: LOG_RETENTION_DAYS,
  }
}
