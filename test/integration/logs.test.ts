import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { app, getSubYamlWithCache } from '../../src/index'
import YAML from 'yaml'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { SubscriptionType } from '../../src/types/types'
import { MockKV, createCachedYaml, createTestEnv } from '../helpers/mockKv'

/** @param env 测试环境。@returns 带认证的 JSON 请求头。 */
function headers(env: ReturnType<typeof createTestEnv>): Record<string, string> {
  return { 'Content-Type': 'application/json', Cookie: 'auth=' + generatePasswordHash(env.PASSWORD, env.SALT) }
}

/** 创建已保存的月付订阅，仅使用测试凭据。 */
function setup() {
  const kv = new MockKV()
  const env = createTestEnv(kv)
  kv.values.set(env.TABLENAME, JSON.stringify([{ subName: '测试源', subType: SubscriptionType.Monthly, subUrl: 'https://provider.example/sub?token=test-secret' }]))
  return { kv, env }
}

describe('错误日志与诊断接口', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('日志页面、列表和诊断接口均要求登录', async () => {
    const { env } = setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    expect((await app.request('/logs', {}, env)).status).toBe(302)
    expect((await app.request('/api/logs', {}, env)).status).toBe(401)
    expect((await app.request('/api/subscriptions/diagnose', { method: 'POST', body: '{}' }, env)).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await app.request('/logs', { headers: headers(env) }, env)).headers.get('location')).toBe('/dashboard#logs')
  })

  it('诊断绕过缓存，只写日志并返回请求元数据', async () => {
    const { kv, env } = setup()
    const cacheKey = `${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`
    kv.values.set(cacheKey, 'unchanged-cache')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('proxies:\n - name: 真实节点\n   type: vless\n   password: node-secret\n'))
    const response = await app.request('/api/subscriptions/diagnose', { method: 'POST', headers: headers(env), body: JSON.stringify({ index: 0, userAgent: 'Clash.Meta' }) }, env)
    const result = await response.json() as any
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(result.data).toMatchObject({ ok: true, diagnostic: { nodeCount: 1, userAgent: 'Clash.Meta' } })
    expect(JSON.stringify(result)).not.toMatch(/test-secret|node-secret|真实节点/)
    expect(kv.values.get(cacheKey)).toBe('unchanged-cache')
    expect(kv.deleted).toEqual([])
    expect(fetchMock).toHaveBeenCalledOnce()
    const logs = await app.request('/api/logs', { headers: headers(env) }, env)
    expect(logs.headers.get('cache-control')).toBe('no-store')
    expect((await logs.json() as any).data.logs).toHaveLength(1)
  })

  it('只允许已保存源和合法 UA，无效输入不会触发外部请求', async () => {
    const { env } = setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    for (const input of [{ index: -1 }, { index: 1 }, { subUrl: 'https://arbitrary.example' }, { index: 0, userAgent: 'a\r\nb' }, { index: 0, userAgent: 123 }, { index: 0, userAgent: 'x'.repeat(257) }]) {
      const result = await app.request('/api/subscriptions/diagnose', { method: 'POST', headers: headers(env), body: JSON.stringify(input) }, env)
      expect(result.status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('强制刷新全部失败时保留上次成功缓存，仍有具体失败日志', async () => {
    const { kv, env } = setup()
    const key = `${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`
    const cache = { normalYaml: createCachedYaml('last-good-normal'), stashYaml: createCachedYaml('last-good-stash'), subUserInfo: { upload: 1, download: 2, total: 100, expire: 9999999999 } }
    kv.values.set(key, JSON.stringify(cache))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403 }))
    expect(await getSubYamlWithCache(SubscriptionType.Monthly, env, true)).toEqual(cache)
    expect(kv.values.get(key)).toBe(JSON.stringify(cache))
    const codes = [...kv.values.entries()].filter(([name]) => name.includes(':logs:')).map(([, value]) => JSON.parse(value).code)
    expect(codes).toEqual(expect.arrayContaining(['HTTP_ERROR', 'CACHE_FALLBACK']))
  })

  it('无成功缓存且全部失败时返回完整容错 YAML，不缓存失败结果', async () => {
    const { kv, env } = setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403 }))
    const response = await app.request('/subscribe/magic-key', {}, env)
    expect(response.status).toBe(200)
    const config = YAML.parse(await response.text())
    expect(config.proxies).toEqual([])
    expect(config.rules).toContain('MATCH,REJECT')
    expect(config['proxy-groups'].every((group: { proxies: string[] }) => group.proxies.length > 0)).toBe(true)
    expect(kv.values.has(`${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`)).toBe(false)
  })

  it('部分源失败时返回可用节点，但不写入不完整缓存', async () => {
    const { kv, env } = setup()
    const subscriptions = JSON.parse(kv.values.get(env.TABLENAME) || '[]')
    kv.values.set(env.TABLENAME, JSON.stringify([...subscriptions, { ...subscriptions[0], subName: '失败源', subUrl: 'https://failed.example/sub' }]))
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('proxies:\n - name: 正常节点\n   type: ss\n')).mockResolvedValueOnce(new Response('denied', { status: 403 }))
    const result = await getSubYamlWithCache(SubscriptionType.Monthly, env, true)
    expect(result.normalYaml).toContain('正常节点')
    expect(kv.values.has(`${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`)).toBe(false)
  })

  it('旧升级提示缓存会重新抓取，避免升级后继续返回提示节点', async () => {
    const { kv, env } = setup()
    const key = `${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`
    kv.values.set(key, JSON.stringify({ normalYaml: 'proxies:\n - name: 请将 Clash Verge Rev 升级到 2.4.1 或以上版本', stashYaml: '', subUserInfo: {} }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('proxies:\n - name: 已恢复节点\n   type: vless\n'))
    expect((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml).toContain('已恢复节点')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('一个类型的定时刷新失败不会阻止另一个类型刷新', async () => {
    const { kv, env } = setup()
    const monthly = JSON.parse(kv.values.get(env.TABLENAME) || '[]')[0]
    kv.values.set(env.TABLENAME, JSON.stringify([monthly, { ...monthly, subType: SubscriptionType.TrafficPackage }]))
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('denied', { status: 403 })).mockResolvedValueOnce(new Response('proxies:\n - name: 已刷新\n   type: ss\n'))
    await expect(worker.scheduled({} as ScheduledController, env)).rejects.toThrow('定时订阅刷新失败')
    expect(kv.values.has(`${env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`)).toBe(true)
    const logs = [...kv.values.entries()].filter(([key]) => key.includes(':logs:')).map(([, value]) => JSON.parse(value))
    expect(logs.some((log) => log.code === 'SCHEDULED_REFRESH_FAILED')).toBe(true)
  })
})
