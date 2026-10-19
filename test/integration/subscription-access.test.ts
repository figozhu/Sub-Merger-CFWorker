import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../../src/index'
import type { ErrorLogRecord } from '../../src/services/errorLogs'
import { createSubscriptionAccessLog } from '../../src/services/subscriptionAccessLogs'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { SubscriptionType } from '../../src/types/types'
import { MockKV, createCachedYaml, createTestEnv } from '../helpers/mockKv'

/** 创建带两类成功缓存的环境，验证日志不会为缓存请求额外抓取上游。 */
function setup() {
  const kv = new MockKV()
  const env = createTestEnv(kv)
  env.INSTANT_REFRESH_INTERVAL = '0'
  kv.values.set(env.TABLENAME, JSON.stringify([{ subName: '测试源', subType: SubscriptionType.Monthly, subUrl: 'https://provider.example/sub' }]))
  for (const subType of [SubscriptionType.Monthly, SubscriptionType.TrafficPackage]) {
    kv.values.set(`${env.TABLENAME}:1:cacheObj:${subType}`, JSON.stringify({ normalYaml: createCachedYaml('cached-normal'), stashYaml: createCachedYaml('cached-stash'), subUserInfo: { upload: 1, download: 2, total: 100, expire: 9999999999 } }))
  }
  const headers = { Cookie: 'auth=' + generatePasswordHash(env.PASSWORD, env.SALT) }
  return { kv, env, headers }
}

/** @param context 测试上下文。@returns 经受认证 API 读取的一页访问记录。 */
async function readAccessLogs(context: ReturnType<typeof setup>): Promise<{ logs: ErrorLogRecord[]; cursor: string }> {
  const response = await app.request('/api/logs?category=access', { headers: context.headers }, context.env)
  expect(response.status).toBe(200)
  return (await response.json() as { data: { logs: ErrorLogRecord[]; cursor: string } }).data
}

describe('客户端订阅访问日志', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('缓存请求也记录来源 IP、客户端 UA、请求时间、状态和耗时，不改变订阅响应', async () => {
    const context = setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const response = await app.request('https://worker.example/subscribe/magic-key?token=private-query', { headers: { 'CF-Connecting-IP': '198.51.100.10', 'X-Forwarded-For': '203.0.113.99', 'User-Agent': 'mihomo/1.19.0', 'CF-Ray': 'test-request-ray' } }, context.env)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(createCachedYaml('cached-normal'))
    expect(response.headers.get('subscription-userinfo')).toContain('upload=1')
    expect(fetchMock).not.toHaveBeenCalled()
    const { logs } = await readAccessLogs(context)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ scope: 'access', code: 'SUBSCRIPTION_ACCESS', clientIp: '198.51.100.10', clientIpSource: 'CF-Connecting-IP', clientUserAgent: 'mihomo/1.19.0', requestMethod: 'GET', requestPath: '/subscribe/:magic', subscriptionType: SubscriptionType.Monthly, httpStatus: 200, cfRay: 'test-request-ray' })
    expect(logs[0].requestStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(logs[0].durationMs).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(logs)).not.toMatch(/magic-key|private-query|cookie/i)
  })

  it('Pseudo IPv4 场景优先记录原始 IPv6', async () => {
    const context = setup()
    await app.request('/subscribe/magic-key', { headers: { 'CF-Connecting-IP': '240.0.0.1', 'CF-Connecting-IPv6': '2001:0db8:0:0:0:0:0:123' } }, context.env)
    expect((await readAccessLogs(context)).logs[0]).toMatchObject({ clientIp: '2001:db8::123', clientIpSource: 'CF-Connecting-IPv6' })
  })

  it('缺少 Cloudflare 地址头时显示未知，不把自填 X-Forwarded-For 当作真实来源', async () => {
    const context = setup()
    await app.request('/subscribe/magic-key', { headers: { 'X-Forwarded-For': '203.0.113.99' } }, context.env)
    expect((await readAccessLogs(context)).logs[0]).toMatchObject({ clientIp: '未知', clientUserAgent: '未提供' })
  })

  it('流量包及 HEAD 请求同样记录，保持 Stash 分流和 HEAD 无正文语义', async () => {
    const context = setup()
    const traffic = await app.request('/onetime/magic-key', { headers: { 'User-Agent': 'Stash/2.6' } }, context.env)
    expect(await traffic.text()).toBe(createCachedYaml('cached-stash'))
    const head = await app.request('/subscribe/magic-key', { method: 'HEAD' }, context.env)
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const { logs } = await readAccessLogs(context)
    expect(logs).toHaveLength(2)
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ requestPath: '/onetime/:magic', subscriptionType: SubscriptionType.TrafficPackage, clientUserAgent: 'Stash/2.6', httpStatus: 200 }),
      expect.objectContaining({ requestMethod: 'HEAD', httpStatus: 200 }),
    ]))
  })

  it('错误订阅凭据记录 403，完整 magic 和查询参数不会进入日志', async () => {
    const context = setup()
    const response = await app.request('/subscribe/private-wrong-magic?secret=private-secret', {}, context.env)
    expect(response.status).toBe(403)
    const { logs } = await readAccessLogs(context)
    expect(logs[0]).toMatchObject({ level: 'warning', httpStatus: 403, requestPath: '/subscribe/:magic' })
    expect(JSON.stringify(logs)).not.toMatch(/private-wrong-magic|private-secret/)
  })

  it('上游失败时记录容错 YAML 的实际 200，并单独保留抓取失败诊断', async () => {
    const context = setup()
    context.kv.values.delete(`${context.env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403 }))
    const response = await app.request('/subscribe/magic-key', { headers: { 'User-Agent': 'client/1' } }, context.env)
    expect(response.status).toBe(200)
    const { logs } = await readAccessLogs(context)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ level: 'info', httpStatus: 200, clientUserAgent: 'client/1' })
    const diagnostics = await app.request('/api/logs', { headers: context.headers }, context.env)
    const diagnosticLogs = (await diagnostics.json() as { data: { logs: ErrorLogRecord[] } }).data.logs
    expect(diagnosticLogs.some((log) => log.code === 'HTTP_ERROR')).toBe(true)
    expect(diagnosticLogs.some((log) => log.scope === 'access')).toBe(false)
  })

  it('日志写入故障不改变已成功生成的订阅响应', async () => {
    const context = setup()
    const originalPut = context.kv.put.bind(context.kv)
    vi.spyOn(context.kv, 'put').mockImplementation((key, value, options) => key.includes(':access-logs:') ? Promise.reject(new Error('quota exceeded')) : originalPut(key, value, options))
    const response = await app.request('/subscribe/magic-key', {}, context.env)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(createCachedYaml('cached-normal'))
  })

  it('有 Worker 上下文时后台持久化，不阻塞客户端等待日志写入', async () => {
    const context = setup()
    const originalPut = context.kv.put.bind(context.kv)
    let finishWrite = async () => {}
    const backgroundTasks: Promise<unknown>[] = []
    vi.spyOn(context.kv, 'put').mockImplementation((key, value, options) => {
      if (!key.includes(':access-logs:')) return originalPut(key, value, options)
      return new Promise<void>((resolve) => { finishWrite = async () => { await originalPut(key, value, options); resolve() } })
    })
    const executionCtx = { waitUntil(task: Promise<unknown>) { backgroundTasks.push(task) }, passThroughOnException() {} }
    const response = await app.request('/subscribe/magic-key', {}, context.env, executionCtx)
    expect(response.status).toBe(200)
    expect(backgroundTasks).toHaveLength(1)
    expect([...context.kv.values.keys()].some((key) => key.includes(':access-logs:'))).toBe(false)
    await finishWrite()
    await Promise.all(backgroundTasks)
    expect((await readAccessLogs(context)).logs).toHaveLength(1)
  })

  it('访问日志单独分页、保留七天，API 继续要求认证并校验分类', async () => {
    const context = setup()
    for (let index = 0; index < 51; index++) await app.request('/subscribe/magic-key', {}, context.env)
    const first = await readAccessLogs(context)
    expect(first.logs).toHaveLength(50)
    const next = await app.request('/api/logs?category=access&cursor=' + encodeURIComponent(first.cursor), { headers: context.headers }, context.env)
    expect((await next.json() as { data: { logs: ErrorLogRecord[] } }).data.logs).toHaveLength(1)
    expect([...context.kv.putOptions.entries()].filter(([key]) => key.includes(':access-logs:')).every(([, options]) => options.expirationTtl === 604800)).toBe(true)
    expect((await app.request('/api/logs?category=access', {}, context.env)).status).toBe(401)
    expect((await app.request('/api/logs?category=other', { headers: context.headers }, context.env)).status).toBe(400)
  })

  it('客户端 UA 中的完整链接和凭据字段使用同一脱敏规则', async () => {
    const context = setup()
    await app.request('/subscribe/magic-key', { headers: { 'User-Agent': 'Client/2 token=private-token https://private.example/private-path' } }, context.env)
    const { logs } = await readAccessLogs(context)
    expect(logs[0].clientUserAgent).toContain('Client/2')
    expect(JSON.stringify(logs)).not.toMatch(/private-token|private-path|private\.example/)
  })

  it.each(['999.1.1.1', '198.51.100.1, 203.0.113.1', 'example.com', '2001:::123', '198.51.100.1:443'])('无效地址头 %s 不进入来源 IP 字段', (value) => {
    const entry = createSubscriptionAccessLog(new Request('https://worker.example/', { headers: { 'CF-Connecting-IP': value } }), SubscriptionType.Monthly, 200, Date.now())
    expect(entry.clientIp).toBe('未知')
  })
})
