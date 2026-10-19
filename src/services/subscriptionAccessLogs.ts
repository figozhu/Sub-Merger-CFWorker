import { SubscriptionType } from '../types/types'
import type { ErrorLogInput } from './errorLogs'

/**
 * 校验并规范化单个 IPv4 或 IPv6，拒绝地址列表、端口和任意文本。
 * @param header Cloudflare 提供的地址请求头值。
 * @returns 合法 IP；缺失或无效时返回 undefined。
 */
function normalizeClientIp(header: string | null): string | undefined {
  const value = header?.trim()
  if (!value) return undefined
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255)) return value
  if (!value.includes(':') || !/^[a-f\d:.]+$/i.test(value)) return undefined
  try {
    // 标准 URL 解析器会校验 IPv6 压缩、分组数量和内嵌 IPv4，并规范化地址。
    return new URL(`http://[${value}]/`).hostname.slice(1, -1)
  } catch {
    return undefined
  }
}

/**
 * 生成客户端拉取订阅的日志，只记录请求元数据，不读取 URL、Cookie 或认证头。
 * Cloudflare 开启 Pseudo IPv4 时优先保留原始 IPv6；不信任客户端自填的 X-Forwarded-For。
 * @param request 当前进入 Worker 的请求。
 * @param subType 访问的订阅类型。
 * @param httpStatus 最终返回客户端的 HTTP 状态。
 * @param startedAt 请求进入处理链时的毫秒时间戳。
 * @returns 可供现有日志存储层脱敏并保存的访问记录。
 */
export function createSubscriptionAccessLog(request: Request, subType: SubscriptionType, httpStatus: number, startedAt: number): ErrorLogInput {
  const ipv6 = normalizeClientIp(request.headers.get('cf-connecting-ipv6'))
  const connectingIp = normalizeClientIp(request.headers.get('cf-connecting-ip'))
  const hasOriginalIpv6 = Boolean(ipv6?.includes(':'))
  return {
    scope: 'access',
    level: httpStatus >= 500 ? 'error' : httpStatus >= 400 ? 'warning' : 'info',
    code: 'SUBSCRIPTION_ACCESS',
    message: httpStatus >= 400 ? '客户端拉取订阅失败' : '客户端拉取订阅成功',
    subscriptionType: subType,
    clientIp: (hasOriginalIpv6 ? ipv6 : connectingIp) || '未知',
    clientIpSource: hasOriginalIpv6 ? 'CF-Connecting-IPv6' : connectingIp ? 'CF-Connecting-IP' : '未提供有效 Cloudflare 地址头',
    clientUserAgent: request.headers.get('user-agent') || '未提供',
    requestMethod: request.method,
    requestPath: subType === SubscriptionType.Monthly ? '/subscribe/:magic' : '/onetime/:magic',
    requestStartedAt: new Date(startedAt).toISOString(),
    httpStatus,
    durationMs: Math.max(0, Date.now() - startedAt),
    cfRay: request.headers.get('cf-ray') || '',
  }
}
