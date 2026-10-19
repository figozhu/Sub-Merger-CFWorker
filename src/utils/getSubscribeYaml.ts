import { sendBarkNotification } from '../notify/bark'
import { parseSubscriptionContent, type SubscriptionNode } from './getProxyNodeFromyaml'
import type { SubUserInfo } from '../types/types'
import type { SubscriptionRecord } from '../services/configuration'
import { sanitizeErrorLog, writeErrorLog, type ErrorLogInput, type LogStoreEnv } from '../services/errorLogs'
import { getSubscriptionSettings } from '../services/subscriptionSettings'

/** 抓取复用已有绑定；全局 UA 从 KV 读取，不需要新增部署变量或密钥。 */
export interface SubscriptionFetchEnv extends LogStoreEnv {
  NOTIFICATION?: { BARK_OPENID?: string }
}

/** 单次抓取结果；diagnostic 可直接返回页面，不含订阅正文和完整地址。 */
export interface SubscriptionFetchResult {
  ok: boolean
  nodes: SubscriptionNode[]
  userInfo: SubUserInfo
  diagnostic: ErrorLogInput
}

export const SUBSCRIPTION_TIMEOUT_MS = 20000
export const MAX_SUBSCRIPTION_BYTES = 5 * 1024 * 1024
export const DEFAULT_SUBSCRIPTION_UA = 'Clash.Meta'

/**
 * 选择请求 UA，明确填写的值原样使用，空值回退到代码默认值。
 * @param configured 已保存的全局配置或本次诊断的临时 UA。
 * @returns 管理员的自定义标识，或默认 Clash.Meta。
 */
export function getSubscriptionUserAgent(configured?: string): string {
  const value = configured?.trim()
  return value || DEFAULT_SUBSCRIPTION_UA
}

/** 只携带固定说明的内部错误，避免上游异常消息泄露订阅 token。 */
class SubscriptionFetchError extends Error {
  /** @param code 日志分类。@param message 安全说明。@param hint 处理建议。 */
  constructor(readonly code: string, message: string, readonly hint: string) {
    super(message)
  }
}

/**
 * 流式读取有限大小的订阅，并让超时覆盖响应体读取阶段。
 * @param response 已取得的上游响应。
 * @param signal 本次请求的总超时信号。
 * @returns 解码后的 UTF-8 文本和实际读取字节数。
 * @throws 超时、网络错误或超过 5 MiB 时抛出异常。
 */
async function readSubscriptionBody(response: Response, signal: AbortSignal): Promise<{ text: string; bytes: number }> {
  if (!response.body) return { text: '', bytes: 0 }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let bytes = 0
  let finished = false
  let onAbort: () => void = () => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new SubscriptionFetchError('TIMEOUT', '订阅请求超过 20 秒', '检查上游响应速度、网络连通性和 Cloudflare 出口限制。'))
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    if (signal.aborted) throw new SubscriptionFetchError('TIMEOUT', '订阅请求超过 20 秒', '稍后重试并检查上游网络。')
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted])
      if (done) { finished = true; break }
      bytes += value.byteLength
      if (bytes > MAX_SUBSCRIPTION_BYTES) throw new SubscriptionFetchError('RESPONSE_TOO_LARGE', '订阅响应超过 5 MiB 限制', '减少源节点数量或拆分订阅。')
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return { text: chunks.join(''), bytes }
  } finally {
    signal.removeEventListener('abort', onAbort)
    // 底层取消操作可能永远不完成，清理不能延长本次请求的总超时。
    if (!finished) void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/**
 * 真实请求一个订阅源；诊断和正式生成共用同一抓取与解析流程。
 * @param subscription 已保存的订阅源。
 * @param env KV、通知和 UA 配置。
 * @param options 诊断可显式比较不同 UA；不写正式缓存，不发送通知。
 * @returns 节点、流量信息和脱敏诊断元数据；失败通过 ok=false 表示。
 */
export async function fetchSubscription(
  subscription: SubscriptionRecord,
  env: SubscriptionFetchEnv,
  options: { diagnostic?: boolean; userAgent?: string } = {},
): Promise<SubscriptionFetchResult> {
  const configuredUserAgent = options.userAgent?.trim() || (await getSubscriptionSettings(env)).userAgent
  const userAgent = getSubscriptionUserAgent(configuredUserAgent)
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUBSCRIPTION_TIMEOUT_MS)
  const diagnostic: ErrorLogInput = {
    level: 'error', scope: 'subscription', code: 'NETWORK_ERROR', message: '订阅源请求失败',
    sourceName: subscription.subName, subscriptionType: subscription.subType, userAgent,
  }
  let nodes: SubscriptionNode[] = []
  let userInfo = parseSubscriptionUserInfo(null)
  try {
    const url = new URL(subscription.subUrl)
    if (!['https:', 'http:'].includes(url.protocol)) throw new SubscriptionFetchError('INVALID_URL', '订阅地址协议无效', '仅支持 HTTP 或 HTTPS 订阅。')
    diagnostic.sourceHost = url.hostname
    // 让运行时协商压缩，避免手工编码声明与不同运行时的解码能力发生偏差。
    const response = await fetch(subscription.subUrl, {
      method: 'GET', headers: { accept: '*/*', 'User-Agent': userAgent }, redirect: 'follow', signal: controller.signal,
    })
    diagnostic.httpStatus = response.status
    diagnostic.contentType = response.headers.get('content-type') || ''
    diagnostic.contentEncoding = response.headers.get('content-encoding') || ''
    diagnostic.cfRay = response.headers.get('cf-ray') || ''
    diagnostic.challenge = response.headers.get('cf-mitigated') === 'challenge'
    diagnostic.redirected = response.redirected
    diagnostic.finalHost = response.url ? new URL(response.url).hostname : url.hostname
    if (!response.ok || diagnostic.challenge) {
      void response.body?.cancel().catch(() => {})
      const hint = diagnostic.challenge || response.status === 403
        ? '上游可能拦截 Cloudflare 出口 IP、地区或触发 WAF/验证码；需要服务商放行或提供可访问地址。'
        : response.status === 429 ? '上游请求频率受限，请减少刷新并稍后重试。'
          : [401, 404].includes(response.status) ? '检查订阅链接、token 和套餐是否仍有效。' : '检查上游服务状态和订阅权限。'
      throw new SubscriptionFetchError(diagnostic.challenge ? 'CLOUDFLARE_CHALLENGE' : 'HTTP_ERROR', `订阅源返回 HTTP ${response.status}${diagnostic.challenge ? '，需要人机验证' : ''}`, hint)
    }
    const body = await readSubscriptionBody(response, controller.signal)
    diagnostic.responseBytes = body.bytes
    const parsed = parseSubscriptionContent(body.text, subscription.subName)
    if (parsed.code) {
      diagnostic.parserCode = parsed.parserCode
      diagnostic.parserLine = parsed.parserLine
      throw new SubscriptionFetchError(parsed.code, parsed.message || '订阅解析失败', parsed.hint || '检查上游订阅内容。')
    }
    nodes = parsed.nodes
    userInfo = parseSubscriptionUserInfo(response.headers.get('subscription-userinfo'))
    Object.assign(diagnostic, { level: 'info', code: 'FETCH_OK', message: '订阅抓取和解析成功', nodeCount: nodes.length })
  } catch (error) {
    if (error instanceof SubscriptionFetchError) {
      Object.assign(diagnostic, { code: error.code, message: error.message, hint: error.hint })
    } else if (controller.signal.aborted) {
      Object.assign(diagnostic, { code: 'TIMEOUT', message: '订阅请求超过 20 秒', hint: '检查上游响应速度、网络连通性和 Cloudflare 出口限制。' })
    } else {
      // 原始异常消息和堆栈可能包含完整地址，只记录固定分类与安全的异常类型。
      diagnostic.errorName = error instanceof TypeError ? 'TypeError' : 'Error'
      diagnostic.hint = '检查 DNS、TLS 证书、重定向及上游对 Cloudflare 出口的限制；本地成功不能证明 CF 出口可访问。'
    }
  } finally {
    clearTimeout(timer)
    diagnostic.durationMs = Date.now() - started
  }
  const ok = diagnostic.code === 'FETCH_OK'
  if (!ok || options.diagnostic) await writeErrorLog(env, diagnostic)
  if (!ok && !options.diagnostic) {
    await sendBarkNotification(env.NOTIFICATION?.BARK_OPENID, 'CF-Sub-Merger: 订阅源更新失败', `订阅源名称：${subscription.subName}，错误类型：${diagnostic.code}`)
  }
  return { ok, nodes, userInfo, diagnostic: sanitizeErrorLog(diagnostic) }
}

/**
 * 解析订阅响应中的流量信息头。
 * @param header `subscription-userinfo` 响应头；缺失时使用安全默认值。
 * @returns 规范化的上传、下载、总量和到期时间。
 */
function parseSubscriptionUserInfo(header: string | null): SubUserInfo {
    const defaultInfo = {
        upload: 0,
        download: 0,
        total: 0,
        expire: 9999999999
    };

    if (!header) {
        return defaultInfo;
    }

    const pairs = header.split(';').map(pair => pair.trim());
    const result = { ...defaultInfo };

    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
        switch (key) {
            case 'upload':
            case 'download':
            case 'total':
            case 'expire':
            result[key] = parseInt(value, 10) || defaultInfo[key];
            break;
        }
        }
    });

    return result;
}

/** @param userInfo 流量汇总对象。@returns Clash 订阅流量响应头字符串。 */
function generateSubscriptionUserInfoString(userInfo: SubUserInfo): string {
  const parts = [
    `upload=${userInfo.upload}`,
    `download=${userInfo.download}`,
    `total=${userInfo.total}`,
    `expire=${userInfo.expire}`
  ];
  return parts.join('; ');
}

/**
 * 将一个订阅源的流量信息累加到汇总对象。
 * @param totalUserInfo 可变的汇总对象。
 * @param newUserInfo 新订阅源的流量信息。
 * @returns 无返回值；函数直接更新汇总对象。
 */
function updateTotalUserInfo(totalUserInfo: SubUserInfo, newUserInfo: SubUserInfo) {
    totalUserInfo.upload += newUserInfo.upload
    totalUserInfo.download += newUserInfo.download
    totalUserInfo.total += newUserInfo.total
    totalUserInfo.expire = Math.min(totalUserInfo.expire, newUserInfo.expire)
}

/**
 * 并发拉取并解析同一类型的全部订阅源。
 * 日志仅记录订阅名称与状态，不输出完整订阅 URL、节点密钥或 Bark OpenID。
 * @param subArr 已保存的订阅源数组。
 * @param envConfig Worker 运行环境与请求 User-Agent 配置。
 * @returns 流量汇总与扁平化节点数组。
 */
async function getSubscribeYaml(subArr: SubscriptionRecord[], envConfig: SubscriptionFetchEnv): Promise<[SubUserInfo, SubscriptionNode[], { failedCount: number }]> {
    const subUserInfo = {
        upload: 0,
        download: 0,
        total: 0,
        expire: 9999999999,
    }

    // 每批只读取一次全局设置，确保所有源使用同一份配置并减少 KV 访问。
    const settings = await getSubscriptionSettings(envConfig)
    const userAgent = getSubscriptionUserAgent(settings.userAgent)
    const results = await Promise.all(subArr.map((subscription) => fetchSubscription(subscription, envConfig, { userAgent })))
    results.filter((result) => result.ok).forEach((result) => updateTotalUserInfo(subUserInfo, result.userInfo))
    return [subUserInfo, results.flatMap((result) => result.nodes), { failedCount: results.filter((result) => !result.ok).length }]
}

export {getSubscribeYaml, generateSubscriptionUserInfoString};
