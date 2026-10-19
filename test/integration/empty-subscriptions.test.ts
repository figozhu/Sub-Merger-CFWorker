import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import { app, getSubYamlWithCache } from '../../src/index'
import { createLegacyRoutingConfig } from '../../src/config/routingMigration'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { SubscriptionType } from '../../src/types/types'
import { MockKV, createTestEnv } from '../helpers/mockKv'

/** 旧界面可编辑的模板包含备注、未知字段和直接节点目标，不能因容错丢失。 */
const template = `
mixed-port: 7890
custom-settings: { keep: true }
rules:
  # 机场专用规则
  - DOMAIN-SUFFIX,airport.example,机场节点,no-resolve
  - DOMAIN-SUFFIX,self.example,自建节点,no-resolve
  - DOMAIN-SUFFIX,missing.example,已下线节点,no-resolve
  - DOMAIN-SUFFIX,direct.example,DIRECT
  - MATCH,其它流量
`

/**
 * 建立代码默认分组或界面已发布分组，并覆盖新旧两种自建节点 KV 数据。
 * @param published 是否启用界面已发布路由。
 * @param selfStorage 自建节点存储位置；none 表示没有自建节点。
 * @returns 独立测试环境、KV 和本次机场组的真实名称。
 */
function setup(published: boolean, selfStorage: 'legacy' | 'independent' | 'none' = 'independent') {
  const kv = new MockKV()
  const env = createTestEnv(kv)
  const nodes = selfStorage === 'none' ? [] : [{ name: '家庭', type: 'ss', server: 'self.example', port: 443 }]
  kv.values.set(`${env.TABLENAME}:config`, JSON.stringify({ defaultYaml: template, selfNodeData: JSON.stringify(selfStorage === 'legacy' ? nodes : []) }))
  if (selfStorage !== 'legacy') kv.values.set(`${env.TABLENAME}:self-nodes`, JSON.stringify({ raw: JSON.stringify(nodes) }))
  for (const patterns of [env.SUBSCRIBE_PATTERN, env.ONETIME_PATTERN]) patterns.OTHER_MATCH_PATTERN = '机场'
  const airportName = published ? '界面改名后的机场组' : '机场节点'
  if (published) {
    const migrated = createLegacyRoutingConfig(template, env)
    if (!migrated.config) throw new Error('测试路由迁移失败')
    migrated.config.groups.find((group) => group.name === '机场节点')!.name = airportName
    kv.values.set(`${env.TABLENAME}:routing:published`, JSON.stringify({ revision: 1, config: migrated.config }))
  }
  return { kv, env, airportName }
}

/** @param context 测试上下文。@param subType 测试源类型。@returns 写入一条已保存订阅源。 */
function saveSource(context: ReturnType<typeof setup>, subType = SubscriptionType.Monthly): void {
  context.kv.values.set(context.env.TABLENAME, JSON.stringify([{ subName: '机场A', subType, subUrl: 'https://airport.example/sub' }]))
}

/**
 * 检查最终完整输出，确保静态策略组及规则中的名称在本次配置中真实存在。
 * @param yaml 公开响应或预览的完整 YAML。
 * @returns 已解析配置，供用例继续断言节点、组名与模板保留情况。
 */
function expectValidReferences(yaml: string): any {
  const config = YAML.parse(yaml)
  const available = new Set(['DIRECT', 'REJECT', ...config.proxies.map((node: { name: string }) => node.name), ...config['proxy-groups'].map((group: { name: string }) => group.name)])
  for (const group of config['proxy-groups']) {
    expect(group.proxies.length).toBeGreaterThan(0)
    for (const member of group.proxies) expect(available.has(member), `失效组成员：${member}`).toBe(true)
  }
  for (const rule of config.rules) {
    const fields = rule.split(',')
    expect(available.has(fields[fields[0] === 'MATCH' ? 1 : 2]), `失效规则：${rule}`).toBe(true)
  }
  expect(config['custom-settings']).toEqual({ keep: true })
  expect(yaml).toContain('# 机场专用规则')
  return config
}

describe('无订阅节点的完整输出容错', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  for (const published of [false, true]) {
    const mode = published ? '界面已发布路由' : '旧版代码与 KV 模板'
    for (const selfStorage of ['legacy', 'independent'] as const) {
      it(`${mode} / ${selfStorage} 自建数据：无源时两类输出和客户端均返回完整 YAML`, async () => {
        const context = setup(published, selfStorage)
        const fetchMock = vi.spyOn(globalThis, 'fetch')
        for (const endpoint of ['/subscribe/magic-key', '/onetime/magic-key']) {
          for (const userAgent of ['Clash.Meta', 'Stash/2']) {
            const response = await app.request(endpoint, { headers: { 'User-Agent': userAgent } }, context.env)
            expect(response.status).toBe(200)
            const config = expectValidReferences(await response.text())
            expect(config.proxies.map((node: { name: string }) => node.name)).toEqual(['家庭【自建】'])
            expect(config['proxy-groups'].some((group: { name: string }) => group.name === context.airportName)).toBe(false)
            expect(config.rules[0]).toBe('DOMAIN-SUFFIX,airport.example,其它流量,no-resolve')
          }
        }
        expect(fetchMock).not.toHaveBeenCalled()
      })
    }

    it(`${mode}：另一类型有源时不跨类型抓取或混入节点`, async () => {
      const context = setup(published)
      saveSource(context, SubscriptionType.TrafficPackage)
      const fetchMock = vi.spyOn(globalThis, 'fetch')
      const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      expectValidReferences(result.normalYaml)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it(`${mode}：全部拉取失败时保留自建节点，不写成功缓存；恢复后机场组重新出现`, async () => {
      const context = setup(published)
      saveSource(context)
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403 }))
      const before = new Map(context.kv.values)
      const failed = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      for (const yaml of [failed.normalYaml, failed.stashYaml]) {
        const config = expectValidReferences(yaml)
        expect(config['proxy-groups'].some((group: { name: string }) => group.name === context.airportName)).toBe(false)
      }
      const key = `${context.env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`
      expect(context.kv.values.has(key)).toBe(false)
      for (const [storedKey, value] of before) expect(context.kv.values.get(storedKey)).toBe(value)

      fetchMock.mockResolvedValue(new Response('proxies:\n  - name: 机场可用节点\n    type: ss\n'))
      const restored = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      const config = expectValidReferences(restored.normalYaml)
      expect(config['proxy-groups'].some((group: { name: string }) => group.name === context.airportName)).toBe(true)
      expect(context.kv.values.has(key)).toBe(true)
    })

    it(`${mode}：没有任何节点时仍无空组或悬空规则，并保留显式直连规则`, async () => {
      const context = setup(published, 'none')
      const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      const config = expectValidReferences(result.normalYaml)
      expect(config.proxies).toEqual([])
      expect(config.rules).toContain('MATCH,REJECT')
      expect(config.rules).toContain('DOMAIN-SUFFIX,direct.example,DIRECT')
    })

    it(`${mode}：订阅抓取成功但被全局排除后，同样删除空机场组`, async () => {
      const context = setup(published)
      saveSource(context)
      context.env.SUBSCRIBE_PATTERN.EXCLUDE_PATTERN = '机场'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('proxies:\n  - name: 机场节点\n    type: ss\n'))
      const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      const config = expectValidReferences(result.normalYaml)
      expect(config.proxies).toHaveLength(1)
      expect(config['proxy-groups'].some((group: { name: string }) => group.name === context.airportName)).toBe(false)
    })

    it(`${mode}：自建节点经空机场组中转时定向兜底，并保留原始 KV 配置`, async () => {
      const context = setup(published)
      const stored = JSON.stringify({ raw: JSON.stringify([{ name: '家庭', type: 'ss', 'dialer-proxy': context.airportName }]) })
      context.kv.values.set(`${context.env.TABLENAME}:self-nodes`, stored)
      const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
      for (const yaml of [result.normalYaml, result.stashYaml]) {
        const config = expectValidReferences(yaml)
        expect(config.proxies[0]['dialer-proxy']).toBe('REJECT')
      }
      expect(context.kv.values.get(`${context.env.TABLENAME}:self-nodes`)).toBe(stored)
    })
  }

  it('缓存命中和失败回退也清理旧空组，不修改成功缓存原文', async () => {
    const context = setup(false)
    saveSource(context)
    const key = `${context.env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`
    const yaml = `proxies: [{ name: 保留节点 }]
proxy-groups:
  - { name: 空机场, type: select, proxies: [] }
  - { name: 上层组, type: select, proxies: [空机场, 保留节点] }
rules:
  - DOMAIN-SUFFIX,test.example,空机场,no-resolve
  - MATCH,上层组
`
    const cached = { normalYaml: yaml, stashYaml: yaml, subUserInfo: { upload: 1, download: 2, total: 3, expire: 9999999999 } }
    context.kv.values.set(key, JSON.stringify(cached))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }))
    for (const noCache of [false, true]) {
      const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env, noCache)
      const config = YAML.parse(result.normalYaml)
      expect(config['proxy-groups']).toEqual([{ name: '上层组', type: 'select', proxies: ['保留节点'] }])
      expect(config.rules[0]).toBe('DOMAIN-SUFFIX,test.example,上层组,no-resolve')
      expect(result.subUserInfo).toEqual(cached.subUserInfo)
      expect(context.kv.values.get(key)).toBe(JSON.stringify(cached))
    }
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('旧版仅注释缓存不再拦截自建节点生成', async () => {
    const context = setup(false)
    context.kv.values.set(`${context.env.TABLENAME}:1:cacheObj:${SubscriptionType.Monthly}`, JSON.stringify({ normalYaml: '# 没有配置订阅源（通用）', stashYaml: '# 没有配置订阅源（Stash）', subUserInfo: {} }))
    const result = await getSubYamlWithCache(SubscriptionType.Monthly, context.env)
    expect(expectValidReferences(result.normalYaml).proxies).toHaveLength(1)
  })

  it('界面 API 允许清空全部订阅，并清理两类旧缓存', async () => {
    const context = setup(true)
    saveSource(context)
    const headers = { 'Content-Type': 'application/json', Cookie: `auth=${generatePasswordHash(context.env.PASSWORD, context.env.SALT)}` }
    const response = await app.request('/api/subscriptions', { method: 'PUT', headers, body: JSON.stringify({ subscriptions: [] }) }, context.env)
    expect(response.status).toBe(200)
    expect(context.kv.values.get(context.env.TABLENAME)).toBe('[]')
    expect(context.kv.deleted).toEqual(expect.arrayContaining(['test-sub:1:cacheObj:包年/包月', 'test-sub:1:cacheObj:流量包']))
  })

  it('界面真实预览与正式动态输出采用一致容错，且不覆盖已发布配置', async () => {
    const context = setup(true)
    const snapshot = context.kv.values.get(`${context.env.TABLENAME}:routing:published`)!
    const { config } = JSON.parse(snapshot)
    const headers = { 'Content-Type': 'application/json', Cookie: `auth=${generatePasswordHash(context.env.PASSWORD, context.env.SALT)}` }
    for (const output of ['monthly', 'trafficPackage']) {
      for (const client of ['normal', 'stash']) {
        const response = await app.request('/api/routing-config/preview', { method: 'POST', headers, body: JSON.stringify({ config, output, client }) }, context.env)
        expect(response.status).toBe(200)
        const { data } = await response.json() as any
        expectValidReferences(data.yaml)
        const airport = config.groups.find((group: { name: string }) => group.name === context.airportName)
        expect(data.previews.find((preview: { groupId: string }) => preview.groupId === airport.id).count).toBe(0)
      }
    }
    expect(context.kv.values.get(`${context.env.TABLENAME}:routing:published`)).toBe(snapshot)
    expect([...context.kv.values.keys()].some((key) => key.includes(':cacheObj:'))).toBe(false)
  })
})
