import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import worker, { app, getSubYamlWithCache } from '../../src/index'
import { createDefaultRoutingConfig } from '../../src/config/defaultRouting'
import { clearSubscriptionCaches } from '../../src/config/routingConfig'
import { saveSelfNodes, saveSubscriptions, type SubscriptionRecord } from '../../src/services/configuration'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { getSubscribeYaml } from '../../src/utils/getSubscribeYaml'
import { SubscriptionType, type FinalObj } from '../../src/types/types'
import { createTestEnv, MockKV } from '../helpers/mockKv'

/** @param subType 套餐类型。@returns 仅含虚构凭据的独立测试环境与机场配置。 */
function setup(subType = SubscriptionType.Monthly) {
  const kv = new MockKV()
  const env = createTestEnv(kv)
  const source: SubscriptionRecord = { subName: '机场甲', subType, subUrl: 'https://a.example/sub?token=test-only' }
  kv.values.set(env.TABLENAME, JSON.stringify([source]))
  return { kv, env, source, outputKey: `${env.TABLENAME}:1:cacheObj:${subType}` }
}

/** @param name 节点名称。@param total 总流量。@returns 可供解析器消费一次的真实 YAML 响应。 */
function upstream(name: string, total = 1000): Response {
  return new Response(YAML.stringify({ proxies: [{ name, type: 'ss', server: 'example.com', port: 443, cipher: 'aes-128-gcm', password: 'test-only' }] }), {
    headers: { 'subscription-userinfo': `upload=10; download=20; total=${total}; expire=2000000000` },
  })
}

/** @param output 最终订阅对象。@returns 同时验证通用与 Stash 输出后的节点名称列表。 */
function nodeNames(output: FinalObj): string[] {
  const names = YAML.parse(output.normalYaml).proxies.map((node: { name: string }) => node.name)
  expect(YAML.parse(output.stashYaml).proxies.map((node: { name: string }) => node.name)).toEqual(names)
  return names
}

/** @param kv 内存存储。@returns 仅机场快照的键值，用来确认失败不会改写成功数据。 */
function snapshots(kv: MockKV): [string, string][] {
  return [...kv.values.entries()].filter(([key]) => key.includes(':source-cache:'))
}

describe('机场最后成功数据', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it.each([SubscriptionType.Monthly, SubscriptionType.TrafficPackage])('%s 定时更新连续失败保留节点和流量，恢复后替换', async (subType) => {
    const { kv, env, source, outputKey } = setup(subType)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream('旧节点'))
    const initial = await getSubYamlWithCache(subType, env, true)
    const saved = snapshots(kv)
    expect(saved).toHaveLength(1)
    expect(saved[0][0]).not.toContain('test-only')
    expect(kv.putOptions.has(saved[0][0])).toBe(false)
    // HTTP、网络、空响应、非法 YAML 都不得覆盖最后一次成功快照。
    const failures = [
      async () => new Response('denied', { status: 503 }),
      async () => { throw new TypeError('network failed') },
      async () => new Response(''),
      async () => new Response('proxies: ['),
    ]
    for (const fail of failures) {
      fetchMock.mockImplementation(fail)
      await expect(worker.scheduled({} as ScheduledController, env)).resolves.toBeUndefined()
      const result = await getSubYamlWithCache(subType, env)
      expect(nodeNames(result)).toEqual([`旧节点【${source.subName}】`])
      expect(result.subUserInfo).toEqual(initial.subUserInfo)
      expect(snapshots(kv)).toEqual(saved)
      expect(nodeNames(JSON.parse(kv.values.get(outputKey)!))).toEqual(nodeNames(initial))
    }
    fetchMock.mockImplementation(async () => upstream('恢复后的节点', 2000))
    await worker.scheduled({} as ScheduledController, env)
    const restored = await getSubYamlWithCache(subType, env)
    expect(nodeNames(restored)).toEqual([`恢复后的节点【${source.subName}】`])
    expect(restored.subUserInfo.total).toBe(2000)
    expect(snapshots(kv)).not.toEqual(saved)
  })

  it('部分机场失败时正常机场继续更新，整份缓存清除后仍保留历史节点', async () => {
    const { kv, env, source, outputKey } = setup()
    const other = { ...source, subName: '机场乙', subUrl: 'https://b.example/sub' }
    kv.values.set(env.TABLENAME, JSON.stringify([source, other]))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => upstream(String(url) === source.subUrl ? '甲旧' : '乙旧'))
    await getSubYamlWithCache(source.subType, env, true)
    fetchMock.mockImplementation(async (url) => String(url) === source.subUrl ? new Response('denied', { status: 403 }) : upstream('乙新', 2000))
    const partial = await getSubYamlWithCache(source.subType, env, true)
    expect(nodeNames(partial)).toEqual(['甲旧【机场甲】', '乙新【机场乙】'])
    expect(partial.subUserInfo.total).toBe(3000)
    await saveSelfNodes(env, '[{"name":"家庭新节点","type":"ss"}]')
    expect(kv.values.has(outputKey)).toBe(false)
    const updated = await getSubYamlWithCache(source.subType, env)
    expect(nodeNames(updated)).toEqual(expect.arrayContaining(['甲旧【机场甲】', '乙新【机场乙】', '家庭新节点【自建】']))
    expect(updated.subUserInfo.total).toBe(3000)
  })

  it('首次部分成功也保留单机场快照，后续失败可与另一个恢复的机场合并', async () => {
    const { kv, env, source, outputKey } = setup()
    const other = { ...source, subName: '机场乙', subUrl: 'https://b.example/sub' }
    kv.values.set(env.TABLENAME, JSON.stringify([source, other]))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url) === source.subUrl ? upstream('甲节点') : new Response('denied', { status: 403 }))
    expect(nodeNames(await getSubYamlWithCache(source.subType, env, true))).toEqual(['甲节点【机场甲】'])
    expect(kv.values.has(outputKey)).toBe(false)
    expect(snapshots(kv)).toHaveLength(1)
    fetchMock.mockImplementation(async (url) => String(url) === source.subUrl ? new Response('denied', { status: 403 }) : upstream('乙节点'))
    const result = await getSubYamlWithCache(source.subType, env, true)
    expect(nodeNames(result)).toEqual(['甲节点【机场甲】', '乙节点【机场乙】'])
    expect(result.subUserInfo.total).toBe(2000)
    expect(kv.values.has(outputKey)).toBe(true)
  })

  it('机场改名复用原始节点，换地址或删除机场不会带回旧节点', async () => {
    const { kv, env, source } = setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream('原名【机场甲】'))
    await getSubYamlWithCache(source.subType, env, true)
    fetchMock.mockImplementation(async () => new Response('denied', { status: 403 }))
    await saveSubscriptions(env, [{ ...source, subName: '新机场名' }])
    expect(nodeNames(await getSubYamlWithCache(source.subType, env))).toEqual(['原名【机场甲】【新机场名】'])
    await saveSubscriptions(env, [{ ...source, subUrl: 'https://new.example/sub' }])
    expect(nodeNames(await getSubYamlWithCache(source.subType, env))).toEqual([])
    await saveSubscriptions(env, [])
    expect(nodeNames(await getSubYamlWithCache(source.subType, env))).toEqual([])
    expect(snapshots(kv)).toHaveLength(1)
  })

  it('预览可读取历史数据但不写快照，诊断仍报告真实失败', async () => {
    const { kv, env, source } = setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream('旧节点'))
    await getSubYamlWithCache(source.subType, env, true)
    const saved = snapshots(kv)
    const headers = { 'Content-Type': 'application/json', Cookie: 'auth=' + generatePasswordHash(env.PASSWORD, env.SALT) }
    fetchMock.mockImplementation(async () => upstream('预览专用节点'))
    const preview = await app.request('/api/routing-config/preview', {
      method: 'POST', headers, body: JSON.stringify({ config: createDefaultRoutingConfig(), client: 'normal', output: 'monthly' }),
    }, env)
    expect(preview.status).toBe(200)
    expect((await preview.json() as any).data.yaml).toContain('预览专用节点')
    expect(snapshots(kv)).toEqual(saved)
    fetchMock.mockImplementation(async () => new Response('denied', { status: 403 }))
    const diagnostic = await app.request('/api/subscriptions/diagnose', { method: 'POST', headers, body: '{"index":0}' }, env)
    expect((await diagnostic.json() as any).data.ok).toBe(false)
    await clearSubscriptionCaches(env)
    const [info, nodes, summary] = await getSubscribeYaml([source], env, { persistCache: false })
    expect(nodes.map((node) => node.name)).toEqual(['旧节点【机场甲】'])
    expect(info.total).toBe(1000)
    expect(summary).toEqual({ failedCount: 1, unavailableCount: 0 })
    expect(snapshots(kv)).toEqual(saved)
  })

  it('成功快照写入失败不丢弃本次可用节点，损坏快照不会伪装成成功数据', async () => {
    const { kv, env, source } = setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream('可用节点'))
    const put = kv.put.bind(kv)
    vi.spyOn(kv, 'put').mockImplementation(async (key, value, options) => {
      if (key.includes(':source-cache:')) throw new Error('quota exceeded')
      await put(key, value, options)
    })
    expect(nodeNames(await getSubYamlWithCache(source.subType, env, true))).toEqual(['可用节点【机场甲】'])
    expect(snapshots(kv)).toEqual([])
    vi.mocked(kv.put).mockRestore()
    await getSubYamlWithCache(source.subType, env, true)
    const [key] = snapshots(kv)[0]
    kv.values.set(key, '{bad JSON')
    await clearSubscriptionCaches(env)
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response('denied', { status: 403 }))
    expect(nodeNames(await getSubYamlWithCache(source.subType, env, true))).toEqual([])
    expect(kv.values.get(key)).toBe('{bad JSON')
  })
})
