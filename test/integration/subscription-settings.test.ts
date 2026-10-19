import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app, getSubYamlWithCache } from '../../src/index'
import { fetchSubscription } from '../../src/utils/getSubscribeYaml'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { SubscriptionType } from '../../src/types/types'
import { MockKV, createTestEnv } from '../helpers/mockKv'

/** 创建不含真实凭据的环境，包含两个类型的订阅源。 */
function setup() {
  const kv = new MockKV()
  const env = createTestEnv(kv)
  const subscriptions = [
    { subName: '包月源', subType: SubscriptionType.Monthly, subUrl: 'https://monthly.example/sub' },
    { subName: '流量源', subType: SubscriptionType.TrafficPackage, subUrl: 'https://traffic.example/sub' },
  ]
  kv.values.set(env.TABLENAME, JSON.stringify(subscriptions))
  const headers = { 'Content-Type': 'application/json', Cookie: 'auth=' + generatePasswordHash(env.PASSWORD, env.SALT) }
  return { kv, env, subscriptions, headers }
}

describe('全局订阅 UA 设置', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('proxies:\n - name: 测试节点\n   type: ss\n'))
  })
  afterEach(() => vi.restoreAllMocks())

  it('全局设置的读写接口均要求登录', async () => {
    const { env, kv } = setup()
    expect((await app.request('/api/subscriptions/settings', {}, env)).status).toBe(401)
    expect((await app.request('/api/subscriptions/settings', { method: 'PUT', body: '{"userAgent":"custom/1"}' }, env)).status).toBe(401)
    expect(kv.values.has(`${env.TABLENAME}:subscription-settings`)).toBe(false)
  })

  it('没有设置时输入值为空，抓取使用代码默认值，不受旧环境变量影响', async () => {
    const { env, headers, subscriptions } = setup()
    env.UA = 'legacy-environment-client/1'
    const response = await app.request('/api/subscriptions/settings', { headers }, env)
    expect((await response.json() as any).data).toEqual({ userAgent: '', defaultUserAgent: 'Clash.Meta' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    const result = await fetchSubscription(subscriptions[0], env)
    expect(result.diagnostic.userAgent).toBe('Clash.Meta')
  })

  it('保存全局 UA 后可回读，清理两类缓存且不修改订阅源记录', async () => {
    const { kv, env, headers, subscriptions } = setup()
    const response = await app.request('/api/subscriptions/settings', { method: 'PUT', headers, body: JSON.stringify({ userAgent: ' custom-client/3 ' }) }, env)
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.userAgent).toBe('custom-client/3')
    const read = await app.request('/api/subscriptions/settings', { headers }, env)
    expect((await read.json() as any).data.userAgent).toBe('custom-client/3')
    expect(JSON.parse(kv.values.get(env.TABLENAME) || '[]')).toEqual(subscriptions)
    expect(kv.deleted).toEqual(expect.arrayContaining(['test-sub:1:cacheObj:包年/包月', 'test-sub:1:cacheObj:流量包']))
  })

  it('两类正式订阅共用已保存的全局 UA', async () => {
    const { env, headers } = setup()
    await app.request('/api/subscriptions/settings', { method: 'PUT', headers, body: JSON.stringify({ userAgent: 'unified-client/2' }) }, env)
    await getSubYamlWithCache(SubscriptionType.Monthly, env, true)
    await getSubYamlWithCache(SubscriptionType.TrafficPackage, env, true)
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2)
    for (const [, init] of vi.mocked(fetch).mock.calls) expect(new Headers(init?.headers).get('User-Agent')).toBe('unified-client/2')
  })

  it('清空并保存后恢复代码默认值', async () => {
    const { env, headers, subscriptions } = setup()
    for (const userAgent of ['custom-client/3', '   ']) {
      const response = await app.request('/api/subscriptions/settings', { method: 'PUT', headers, body: JSON.stringify({ userAgent }) }, env)
      expect(response.status).toBe(200)
    }
    const read = await app.request('/api/subscriptions/settings', { headers }, env)
    expect((await read.json() as any).data.userAgent).toBe('')
    expect((await fetchSubscription(subscriptions[0], env)).diagnostic.userAgent).toBe('Clash.Meta')
  })

  it('诊断默认读取全局 UA，临时比较值只影响本次请求', async () => {
    const { env, headers } = setup()
    await app.request('/api/subscriptions/settings', { method: 'PUT', headers, body: JSON.stringify({ userAgent: 'global-client/3' }) }, env)
    for (const [temporary, expected] of [['', 'global-client/3'], ['diagnostic-client/4', 'diagnostic-client/4'], ['', 'global-client/3']]) {
      const response = await app.request('/api/subscriptions/diagnose', { method: 'POST', headers, body: JSON.stringify({ index: 0, userAgent: temporary }) }, env)
      expect((await response.json() as any).data.diagnostic.userAgent).toBe(expected)
    }
  })

  it('无效请求头或字段类型不覆盖设置，也不清理缓存', async () => {
    const { kv, env, headers } = setup()
    const key = `${env.TABLENAME}:subscription-settings`
    kv.values.set(key, '{"userAgent":"valid-client/3"}')
    for (const userAgent of [undefined, null, 123, 'x'.repeat(257), 'abc\r\nInjected: value', '中文客户端']) {
      const response = await app.request('/api/subscriptions/settings', { method: 'PUT', headers, body: JSON.stringify({ userAgent }) }, env)
      expect(response.status).toBe(422)
      expect((await response.json() as any).errors[0].path).toBe('userAgent')
    }
    expect(kv.values.get(key)).toBe('{"userAgent":"valid-client/3"}')
    expect(kv.deleted).toEqual([])
  })
})
