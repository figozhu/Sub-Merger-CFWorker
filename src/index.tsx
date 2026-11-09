import { Hono, type MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import YAML, { isMap } from 'yaml'

import { SubscriptionType, type FinalObj } from './types/types'
import type { RoutingConfig } from './types/routing'
import { generatePasswordHash } from './utils/passwordMgr'
import { DEFAULT_SUBSCRIPTION_UA, fetchSubscription, generateSubscriptionUserInfoString, getSubscribeYaml } from './utils/getSubscribeYaml'
import { listErrorLogs, writeErrorLog } from './services/errorLogs'
import { createSubscriptionAccessLog } from './services/subscriptionAccessLogs'
import { getSubscriptionSettings, saveSubscriptionSettings, validateSubscriptionUserAgent } from './services/subscriptionSettings'
import generateLegacyProxyConfigYaml from './utils/generateProxyConfigYaml'
import { generateRoutingYaml, generateRoutingYamlVariants } from './utils/generateRoutingYaml'
import { sanitizeProxyGroupYaml } from './utils/pruneEmptyProxyGroups'
import { validateRoutingConfig } from './utils/validateRoutingConfig'
import { getStoredDefaultYaml, getDefaultYamlString } from './data/defaultYmal'
import { createDefaultRoutingConfig, detectRoutingTemplateMode, usesDefaultRouting } from './config/defaultRouting'
import { getDefaultSelfNodeData, getSelfNodeData } from './data/selfNodeData'
import {
  clearSubscriptionCaches,
  getCurrentRevision,
  getPublishedRoutingConfig,
  getRoutingDraft,
  publishRoutingConfig,
  saveRoutingDraft,
} from './config/routingConfig'
import { createLegacyRoutingConfig, importRoutingConfigYaml } from './config/routingMigration'
import {
  analyzeSelfNodes,
  getSelfNodesDocument,
  getSubscriptions,
  saveSelfNodes,
  saveSubscriptions,
} from './services/configuration'
import { renderDashboardPage, renderLoginPage } from './ui/pages'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Worker 所需的部署绑定。正则表允许后续添加新组字段而无需修改入口类型。 */
export interface Bindings {
  SUB_MERGER_KV: KVNamespace
  PASSWORD: string
  SALT: string
  TABLENAME: string
  KEY_VERSION: string
  MAGIC: string
  INSTANT_REFRESH_INTERVAL: string
  NOTIFICATION?: { BARK_OPENID?: string }
  ONETIME_PATTERN: Record<string, string>
  SUBSCRIBE_PATTERN: Record<string, string>
}

type AppEnv = { Bindings: Bindings }

/** API 请求体最大为 1 MiB，足以容纳配置，同时避免超大 JSON/YAML 消耗 Worker 资源。 */
const MAX_JSON_BODY_BYTES = 1024 * 1024

/** YAML 输出容错格式版本；新缓存无需在每次请求时重复解析两份完整 YAML。 */
const YAML_FORMAT_VERSION = 1

/** 创建 Hono 应用；单独导出便于接口测试直接调用 app.request。 */
export const app = new Hono<AppEnv>()

/**
 * 返回统一成功响应。
 * @param c Hono 上下文。
 * @param data 响应数据。
 * @param status HTTP 状态码。
 * @returns JSON Response。
 */
function success(c: any, data: unknown = {}, status = 200): Response {
  return c.json({ code: 0, data, msg: 'success' }, status)
}

/**
 * 返回统一错误响应，不包含密码、订阅 URL 或节点密钥。
 * @param c Hono 上下文。
 * @param status HTTP 状态码。
 * @param msg 面向前端的错误说明。
 * @param errors 可定位字段错误。
 * @returns JSON Response。
 */
function failure(c: any, status: number, msg: string, errors: unknown[] = []): Response {
  return c.json({ code: 1, msg, errors }, status)
}

/**
 * 安全解析 JSON 请求体并限制 Content-Type 与大小。
 * @param c Hono 上下文。
 * @returns 解析后的未知对象。
 * @throws 请求格式不合法时抛出可读错误。
 */
async function readJsonBody(c: any): Promise<unknown> {
  const contentType = c.req.header('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) throw new Error('请求必须使用 application/json')
  const contentLength = Number(c.req.header('content-length') || 0)
  if (contentLength > MAX_JSON_BODY_BYTES) throw new Error('请求体超过 1 MiB 限制')
  const raw = await c.req.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) throw new Error('请求体超过 1 MiB 限制')
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error('JSON 请求体无法解析')
  }
}

/**
 * 检查认证 Cookie 是否与当前密码和盐值匹配。
 * @param c Hono 上下文。
 * @returns 已登录时为 true。
 */
function isAuthenticated(c: any): boolean {
  const expected = generatePasswordHash(c.env.PASSWORD, c.env.SALT)
  return getCookie(c, 'auth') === expected
}

/**
 * HTML 页面认证中间件；未登录时重定向独立登录页。
 * @param c Hono 上下文。
 * @param next 后续中间件。
 */
async function htmlAuthMiddleware(c: any, next: () => Promise<void>): Promise<Response | void> {
  if (!isAuthenticated(c)) {
    deleteCookie(c, 'auth')
    return c.redirect('/')
  }
  await next()
}

/**
 * API 认证中间件；未登录返回 JSON 401，便于新版 UI 统一处理会话过期。
 * @param c Hono 上下文。
 * @param next 后续中间件。
 */
async function apiAuthMiddleware(c: any, next: () => Promise<void>): Promise<Response | void> {
  if (!isAuthenticated(c)) {
    deleteCookie(c, 'auth')
    return failure(c, 401, '登录状态已过期')
  }
  await next()
}

/**
 * 记录公开订阅端点的客户端访问，包含缓存返回、鉴权拒绝和生成失败。
 * @param subType 当前路由对应的订阅类型。
 * @returns 等待响应确定后记录一次最终状态的 Hono 中间件。
 */
function subscriptionAccessMiddleware(subType: SubscriptionType): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const startedAt = Date.now()
    await next()
    const task = writeErrorLog(c.env, createSubscriptionAccessLog(c.req.raw, subType, c.res.status, startedAt))
    try {
      // 生产环境后台持久化，客户端无需等待日志 KV 写入完成。
      c.executionCtx.waitUntil(task)
    } catch {
      // app.request 等没有 ExecutionContext 的运行方式仍需等待，避免丢失记录。
      await task
    }
  }
}

app.use('/dashboard', htmlAuthMiddleware)
app.use('/logs', htmlAuthMiddleware)
app.use('/api/*', apiAuthMiddleware)
app.use('/subscribe/:magic', subscriptionAccessMiddleware(SubscriptionType.Monthly))
app.use('/onetime/:magic', subscriptionAccessMiddleware(SubscriptionType.TrafficPackage))

/** 捕获未处理运行异常，日志使用固定说明，避免密码、MAGIC 和订阅地址进入堆栈。 */
app.onError(async (_error, c) => {
  await writeErrorLog(c.env, { level: 'error', scope: 'request', code: 'UNHANDLED_ERROR', message: '请求处理发生未捕获异常', hint: '检查 KV 绑定、配额和已保存配置；可结合 Workers 运行状态进一步排查。' })
  return c.req.path.startsWith('/api/') ? failure(c, 500, '服务处理失败，请查看错误日志和 KV 状态') : c.text('订阅处理失败，请登录管理页面查看错误日志', 500)
})

/** 登录接口仅比较内存中的部署密码，任何日志都不会输出密码值。 */
app.post('/login', async (c) => {
  let body: unknown
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const password = body && typeof body === 'object' ? (body as Record<string, unknown>).password : undefined
  if (typeof password !== 'string' || password !== c.env.PASSWORD) return failure(c, 401, '密码不正确')

  setCookie(c, 'auth', generatePasswordHash(c.env.PASSWORD, c.env.SALT), {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
  return success(c)
})

/** 未登录显示登录页；已登录直接进入新版控制台。 */
app.get('/', (c) => isAuthenticated(c) ? c.redirect('/dashboard#subscriptions') : c.html(renderLoginPage()))

/** 登录后的控制台只返回轻量 Shell，真实数据全部通过受认证 API 获取。 */
app.get('/dashboard', (c) => c.html(renderDashboardPage()))

/** 错误日志的独立可访问入口，复用控制台导航与认证。 */
app.get('/logs', (c) => c.redirect('/dashboard#logs'))

/** 登录后分页读取日志；禁止浏览器缓存运维数据。 */
app.get('/api/logs', async (c) => {
  const cursor = c.req.query('cursor')
  const category = c.req.query('category') || 'diagnostic'
  if (category !== 'diagnostic' && category !== 'access') return failure(c, 400, '日志分类无效')
  if (cursor && cursor.length > 4096) return failure(c, 400, '日志分页游标无效')
  c.header('Cache-Control', 'no-store')
  return success(c, await listErrorLogs(c.env, cursor, category))
})

/**
 * 从当前 Worker 出口诊断一个已保存源，可指定 UA 进行比较。
 * 始终绕过正式缓存，只返回脱敏元数据，不发送通知、不修改订阅和缓存。
 */
app.post('/api/subscriptions/diagnose', async (c) => {
  let body: unknown
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const subscriptions = await getSubscriptions(c.env)
  if (!Number.isInteger(input.index) || Number(input.index) < 0 || Number(input.index) >= subscriptions.length) return failure(c, 400, '请选择已保存的订阅源')
  if (input.userAgent !== undefined && validateSubscriptionUserAgent(input.userAgent)) return failure(c, 400, validateSubscriptionUserAgent(input.userAgent))
  const result = await fetchSubscription(subscriptions[Number(input.index)], c.env, { diagnostic: true, userAgent: typeof input.userAgent === 'string' ? input.userAgent.trim() : undefined })
  c.header('Cache-Control', 'no-store')
  return success(c, { ok: result.ok, diagnostic: result.diagnostic })
})

/**
 * 根据当前订阅类型解析真实节点，不写缓存或访问时间键。
 * 预览使用此函数，避免污染正式订阅缓存。
 * @param subType 包月或流量包。
 * @param env Worker 运行环境。
 * @returns 流量信息和订阅节点数组。
 */
async function loadSubscriptionNodesForPreview(subType: SubscriptionType, env: Bindings): Promise<{ userInfo: any; nodes: any[] }> {
  const subscriptions = await getSubscriptions(env)
  const targets = subscriptions.filter((subscription) => subscription.subType === subType)
  if (targets.length === 0) {
    return { userInfo: { upload: 0, download: 0, total: 0, expire: 9999999999 }, nodes: [] }
  }
  const [userInfo, nodes] = await getSubscribeYaml(targets, env, { persistCache: false })
  return { userInfo, nodes }
}

/**
 * 获取订阅完整 YAML，保留旧缓存键和即时刷新语义；无源时仍生成自建节点与有效规则。
 * 新安装直接使用通用默认；已保存旧模板的部署继续走旧生成器，保留个人配置。
 * @param subType 订阅类型。
 * @param env Worker 环境。
 * @param noCache 是否强制重新拉取订阅源。
 * @param failOnUnavailableSources 定时任务使用 true，让全部源失败且无历史数据时记录任务失败。
 * @returns 两类客户端 YAML 与流量信息。
 */
export async function getSubYamlWithCache(
  subType: SubscriptionType,
  env: Bindings,
  noCache = false,
  failOnUnavailableSources = false,
): Promise<FinalObj> {
  const cacheKey = `${env.TABLENAME}:${env.KEY_VERSION}:cacheObj:${subType}`
  const stored = await env.SUB_MERGER_KV.get<FinalObj>(cacheKey, 'json')
  // 旧 UA 产生的升级提示配置也可能已被缓存；升级后应立即重新拉取真实节点。
  let cached: FinalObj | null = null
  if (stored && !/请将 Clash Verge Rev 升级到|你现在的版本是/.test(stored.normalYaml)) {
    try {
      // 历史缓存也执行同一容错逻辑；不能在命中缓存或抓取失败回退时重新暴露空组。
      cached = stored.yamlFormatVersion === YAML_FORMAT_VERSION ? stored : {
        ...stored, normalYaml: sanitizeProxyGroupYaml(stored.normalYaml), stashYaml: sanitizeProxyGroupYaml(stored.stashYaml),
      }
    } catch {
      // 旧版“没有订阅源”注释及损坏 YAML 不能作为成功缓存，继续读取当前配置重新生成。
    }
  }
  if (!noCache && cached) return cached

  const finalObj: FinalObj = {
    subUserInfo: { upload: 0, download: 0, total: 0, expire: 9999999999 },
    normalYaml: '',
    stashYaml: '',
    yamlFormatVersion: YAML_FORMAT_VERSION,
  }
  const subscriptions = await getSubscriptions(env)
  const targets = subscriptions.filter((subscription) => subscription.subType === subType)

  const [subUserInfo, subscriptionNodes, fetchSummary] = await getSubscribeYaml(targets, env)
  if (fetchSummary.unavailableCount > 0 && cached) {
    await writeErrorLog(env, { level: 'warning', scope: 'subscription', code: 'CACHE_FALLBACK', subscriptionType: subType, message: '上游抓取不完整，继续使用上次成功缓存', hint: '查看同一时段的订阅源错误，并在日志页诊断；恢复后定时刷新会更新缓存。' })
    return cached
  }
  if (targets.length > 0 && fetchSummary.unavailableCount === targets.length && failOnUnavailableSources) {
    throw new Error('所有订阅源读取失败')
  }
  const patterns = subType === SubscriptionType.Monthly ? env.SUBSCRIBE_PATTERN : env.ONETIME_PATTERN
  const published = await getPublishedRoutingConfig(env)
  const storedYaml = published?.config?.schemaVersion === 1 ? null : await getStoredDefaultYaml(env)
  const routingConfig = published?.config?.schemaVersion === 1
    ? published.config
    : usesDefaultRouting(storedYaml) ? createDefaultRoutingConfig(storedYaml?.yaml) : null
  let generated: { normalYaml: string; stashYaml: string }
  if (routingConfig) {
    const selfNodes = await getSelfNodeData(env)
    generated = generateRoutingYamlVariants(
      routingConfig,
      subscriptionNodes,
      selfNodes,
      subType === SubscriptionType.Monthly ? 'monthly' : 'trafficPackage',
      patterns?.EXCLUDE_PATTERN || '',
    )
  } else {
    const legacy = await generateLegacyProxyConfigYaml(subscriptionNodes, patterns, env)
    generated = {
      normalYaml: sanitizeProxyGroupYaml(legacy.normalYaml + storedYaml!.yaml, legacy.groupNames),
      stashYaml: sanitizeProxyGroupYaml(legacy.stashYaml + storedYaml!.yaml, legacy.groupNames),
    }
  }

  const updatedAt = dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')
  finalObj.normalYaml = `# 最后更新时间（通用）：${updatedAt}\n\n${generated.normalYaml}`
  finalObj.stashYaml = `# 最后更新时间（Stash）：${updatedAt}\n\n${generated.stashYaml}`
  finalObj.subUserInfo = subUserInfo
  // 各机场都有本次或历史成功数据时才更新完整输出，避免缺失节点的结果覆盖成功缓存。
  if (fetchSummary.unavailableCount === 0) await env.SUB_MERGER_KV.put(cacheKey, JSON.stringify(finalObj))
  return finalObj
}

/**
 * 为公开订阅端点执行缓存判断、响应头设置与 User-Agent 分流。
 * @param c Hono 上下文。
 * @param subType 端点对应的订阅类型。
 * @returns YAML 文本响应。
 */
async function serveSubscription(c: any, subType: SubscriptionType): Promise<Response> {
  if (c.req.param('magic') !== c.env.MAGIC) return c.text('magic not match', 403)
  const interval = Number.parseInt(c.env.INSTANT_REFRESH_INTERVAL || '300', 10)
  const currentTimestamp = dayjs().unix()
  const accessKey = `${c.env.TABLENAME}:${c.env.KEY_VERSION}:access:${subType}`
  const lastAccess = await c.env.SUB_MERGER_KV.get(accessKey, 'json') as { lastAccessTimeStamp?: number } | null
  const noCache = currentTimestamp - (lastAccess?.lastAccessTimeStamp ?? 0) < interval
  const finalObj = await getSubYamlWithCache(subType, c.env, noCache)
  await c.env.SUB_MERGER_KV.put(accessKey, JSON.stringify({ lastAccessTimeStamp: currentTimestamp }))

  c.header('subscription-userinfo', generateSubscriptionUserInfoString(finalObj.subUserInfo))
  const filename = subType === SubscriptionType.Monthly ? '包年包月（订阅合并)' : '流量包（订阅合并）'
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  const stash = (c.req.header('user-agent') || '').toLowerCase().includes('stash')
  return c.text(stash ? finalObj.stashYaml : finalObj.normalYaml)
}

app.get('/subscribe/:magic', (c) => serveSubscription(c, SubscriptionType.Monthly))
app.get('/onetime/:magic', (c) => serveSubscription(c, SubscriptionType.TrafficPackage))

/** 获取当前订阅源。 */
app.get('/api/subscriptions', async (c) => success(c, { subscriptions: await getSubscriptions(c.env) }))

/** 获取全局 UA 和代码默认值，页面不会把默认值误保存成自定义设置。 */
app.get('/api/subscriptions/settings', async (c) => {
  c.header('Cache-Control', 'no-store')
  return success(c, { ...await getSubscriptionSettings(c.env), defaultUserAgent: DEFAULT_SUBSCRIPTION_UA })
})

/** 保存唯一的全局 UA；空字符串明确恢复代码默认值，保存后清理正式缓存。 */
app.put('/api/subscriptions/settings', async (c) => {
  let body: unknown
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const result = await saveSubscriptionSettings(c.env, body)
  if (result.errors.length) return failure(c, 422, '全局 User-Agent 配置无效', result.errors)
  c.header('Cache-Control', 'no-store')
  return success(c, { ...result.settings, defaultUserAgent: DEFAULT_SUBSCRIPTION_UA })
})

/** 校验并保存订阅源，成功后清理两类正式缓存。 */
app.put('/api/subscriptions', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const result = await saveSubscriptions(c.env, body?.subscriptions)
  if (result.errors.length) return failure(c, 422, '订阅源配置无效', result.errors)
  return success(c, { subscriptions: result.subscriptions })
})

/** 旧页面兼容接口，内部复用新版订阅源保存服务。 */
app.post('/api/save', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const result = await saveSubscriptions(c.env, body?.subscriptions)
  if (result.errors.length) return failure(c, 400, '订阅源配置无效', result.errors)
  return success(c, { subscriptions: result.subscriptions })
})

/** 获取独立自建节点 JSON 及解析摘要。 */
app.get('/api/self-nodes', async (c) => {
  const { document, source } = await getSelfNodesDocument(c.env)
  const analysis = analyzeSelfNodes(document.raw)
  return success(c, { raw: document.raw, updatedAt: document.updatedAt, source, nodes: analysis.nodes, errors: analysis.errors })
})

/** 校验并保存自建节点；合法空数组会被明确保存。 */
app.put('/api/self-nodes', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const analysis = await saveSelfNodes(c.env, body?.raw)
  if (!analysis.valid) return failure(c, 422, '自建节点配置无效', analysis.errors)
  return success(c, { raw: analysis.raw, nodes: analysis.nodes })
})

/**
 * 优先返回草稿、已发布配置，其次迁移旧模板；新安装使用通用默认。
 * 初始化和迁移只发生在内存中，绝不自动写入或发布。
 */
app.get('/api/routing-config', async (c) => {
  const [draft, published] = await Promise.all([
    getRoutingDraft(c.env),
    getPublishedRoutingConfig(c.env),
  ])
  const defaults = createDefaultRoutingConfig()
  let config = draft?.config ?? published?.config
  let migrated = false
  let initialized = false
  if (!config) {
    const storedYaml = await getStoredDefaultYaml(c.env)
    if (usesDefaultRouting(storedYaml)) {
      config = storedYaml ? createDefaultRoutingConfig(storedYaml.yaml) : defaults
      initialized = true
    } else {
      const migration = createLegacyRoutingConfig(storedYaml!.yaml, c.env)
      if (!migration.config) return failure(c, 500, '旧配置无法迁移', migration.errors)
      config = migration.config
      migrated = true
    }
  }
  return success(c, {
    config,
    revision: published?.revision ?? 0,
    updatedAt: draft?.updatedAt ?? published?.updatedAt ?? '',
    publishedUpdatedAt: published?.updatedAt ?? '',
    migrated,
    initialized,
    defaultBaseYaml: defaults.baseYaml,
  })
})

/**
 * 仅检查草稿的基本可保存结构。
 * 允许管理员保存尚未通过发布校验的中间状态，但拒绝未知 schema 或不可编辑形状。
 * @param value 待检查值。
 * @returns 可作为 RoutingConfig 保存时为 true。
 */
function isDraftShape(value: unknown): value is RoutingConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  return config.schemaVersion === 1 && typeof config.baseYaml === 'string'
    && Array.isArray(config.groups) && Array.isArray(config.providers) && Array.isArray(config.rules)
}

/** 保存草稿，不清缓存、不修改已发布配置。 */
app.put('/api/routing-config/draft', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  if (!isDraftShape(body?.config)) return failure(c, 400, '路由草稿结构无效')
  const currentRevision = await getCurrentRevision(c.env)
  if (Number(body.baseRevision ?? 0) !== currentRevision) return failure(c, 409, '草稿基于过期修订，请刷新后重试')
  const snapshot = await saveRoutingDraft(c.env, body.config, currentRevision)
  return success(c, { config: snapshot.config, revision: currentRevision, updatedAt: snapshot.updatedAt })
})

/** 执行与发布相同的服务端配置校验，不写 KV。 */
app.post('/api/routing-config/validate', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const validation = validateRoutingConfig(body?.config)
  if (!validation.valid) return failure(c, 422, 'routing config is invalid', validation.errors)
  return success(c, validation)
})

/** 从完整 Clash YAML 拆分出当前草稿，不保存、不发布。 */
app.post('/api/routing-config/import', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  if (typeof body?.yaml !== 'string') return failure(c, 400, 'yaml 必须是字符串')
  const imported = importRoutingConfigYaml(body.yaml)
  if (!imported.config) return failure(c, 422, 'YAML 无法导入', imported.errors)
  return success(c, { config: imported.config, summary: imported.summary })
})

/** 格式化基础 YAML；重复键或非 Mapping 会被明确拒绝。 */
app.post('/api/routing-config/format', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  if (typeof body?.baseYaml !== 'string') return failure(c, 400, 'baseYaml 必须是字符串')
  const document = YAML.parseDocument(body.baseYaml.trim() || '{}', { uniqueKeys: true, prettyErrors: true })
  if (document.errors.length) return failure(c, 422, 'YAML 模板无法格式化', document.errors.map((error) => ({ code: 'BASE_YAML_INVALID', path: 'baseYaml', message: error.message })))
  if (!isMap(document.contents)) return failure(c, 422, 'YAML 模板根节点必须是 Mapping')
  return success(c, { baseYaml: document.toString({ lineWidth: 0 }) })
})

/**
 * 使用当前草稿和真实节点生成完整输出预览。
 * 此接口不修改配置、修订或正式缓存；抓取错误会单独记录诊断日志。
 */
app.post('/api/routing-config/preview', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const validation = validateRoutingConfig(body?.config)
  if (!validation.valid) return failure(c, 422, '预览前需要修复配置错误', validation.errors)
  if (!['normal', 'stash'].includes(body?.client) || !['monthly', 'trafficPackage'].includes(body?.output)) return failure(c, 400, '预览客户端或订阅类型无效')

  const subType = body.output === 'monthly' ? SubscriptionType.Monthly : SubscriptionType.TrafficPackage
  const [{ nodes }, selfNodes] = await Promise.all([loadSubscriptionNodesForPreview(subType, c.env), getSelfNodeData(c.env)])
  const patterns = subType === SubscriptionType.Monthly ? c.env.SUBSCRIBE_PATTERN : c.env.ONETIME_PATTERN
  const generated = generateRoutingYaml(body.config, {
    subscriptionNodes: nodes,
    selfNodes,
    output: body.output,
    client: body.client,
    globalExcludePattern: patterns?.EXCLUDE_PATTERN || '',
  })
  return success(c, { yaml: generated.yaml, previews: generated.previews })
})

/** 校验并发布新修订；失败时上一版生效配置保持不变。 */
app.post('/api/routing-config/publish', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  const currentRevision = await getCurrentRevision(c.env)
  if (Number(body?.baseRevision ?? 0) !== currentRevision) return failure(c, 409, '提交的基础修订号已过期')
  const validation = validateRoutingConfig(body?.config)
  if (!validation.valid) return failure(c, 422, 'routing config is invalid', validation.errors)

  const snapshot = await publishRoutingConfig(c.env, body.config, currentRevision + 1)
  await saveRoutingDraft(c.env, body.config, snapshot.revision)
  await clearSubscriptionCaches(c.env)
  return success(c, { revision: snapshot.revision, updatedAt: snapshot.updatedAt, validation })
})

/** 返回两类真实输出 URL 及当前已保存订阅源数量。 */
app.get('/api/outputs', async (c) => {
  const subscriptions = await getSubscriptions(c.env)
  const origin = new URL(c.req.url).origin
  const outputs = [
    { id: 'monthly', name: '包年/包月', sourceCount: subscriptions.filter((item) => item.subType === SubscriptionType.Monthly).length, url: `${origin}/subscribe/${c.env.MAGIC}` },
    { id: 'trafficPackage', name: '流量包', sourceCount: subscriptions.filter((item) => item.subType === SubscriptionType.TrafficPackage).length, url: `${origin}/onetime/${c.env.MAGIC}` },
  ]
  return success(c, { outputs })
})

/** 旧配置读取接口，组合新版自建节点与旧 YAML，供升级期旧客户端使用。 */
app.get('/api/config', async (c) => {
  const [{ document }, legacy] = await Promise.all([
    getSelfNodesDocument(c.env),
    c.env.SUB_MERGER_KV.get<Record<string, unknown>>(`${c.env.TABLENAME}:config`, 'json'),
  ])
  return success(c, {
    selfNodeData: document.raw || getDefaultSelfNodeData(),
    defaultYaml: typeof legacy?.defaultYaml === 'string' ? legacy.defaultYaml : getDefaultYamlString(),
  })
})

/** 旧配置保存接口仅作过渡，仍要求两个字段同时提交并执行节点校验。 */
app.post('/api/config', async (c) => {
  let body: any
  try { body = await readJsonBody(c) } catch (error) { return failure(c, 400, error instanceof Error ? error.message : '请求无效') }
  if (typeof body?.selfNodeData !== 'string' || typeof body?.defaultYaml !== 'string') return failure(c, 400, 'selfNodeData and defaultYaml are required')
  const nodeAnalysis = analyzeSelfNodes(body.selfNodeData)
  if (!nodeAnalysis.valid) return failure(c, 422, '自建节点配置无效', nodeAnalysis.errors)
  const previous = await getStoredDefaultYaml(c.env)
  // 保存来源模式，确保以后调整 DNS、注释或规则目标不会意外切回历史的十五组。
  const routingMode = (detectRoutingTemplateMode(body.defaultYaml) ?? previous?.routingMode
    ?? (usesDefaultRouting(previous ?? { yaml: body.defaultYaml }) ? 'default' : 'legacy'))
  await c.env.SUB_MERGER_KV.put(`${c.env.TABLENAME}:config`, JSON.stringify({ selfNodeData: body.selfNodeData, defaultYaml: body.defaultYaml, routingMode, updatedAt: new Date().toISOString() }))
  await clearSubscriptionCaches(c.env)
  return success(c)
})

/** 定时任务继续强制刷新包月与流量包两类正式缓存。 */
async function scheduled(_controller: ScheduledController, env: Bindings): Promise<void> {
  const results = await Promise.allSettled([SubscriptionType.TrafficPackage, SubscriptionType.Monthly].map(async (subType) => {
    try { await getSubYamlWithCache(subType, env, true, true) } catch {
      await writeErrorLog(env, { level: 'error', scope: 'scheduled', code: 'SCHEDULED_REFRESH_FAILED', subscriptionType: subType, message: '定时订阅刷新失败', hint: '检查对应订阅源的错误日志和 KV 状态。' })
      throw new Error('定时订阅刷新失败')
    }
  }))
  if (results.some((result) => result.status === 'rejected')) throw new Error('定时订阅刷新失败，请查看错误日志')
}

export default { fetch: app.fetch, scheduled }
