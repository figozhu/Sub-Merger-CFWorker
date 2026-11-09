import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import { app, getSubYamlWithCache } from '../../src/index'
import { createDefaultRoutingConfig } from '../../src/config/defaultRouting'
import { getDefaultYamlString } from '../../src/data/defaultYmal'
import { generateRoutingYamlVariants } from '../../src/utils/generateRoutingYaml'
import * as stashCompatibility from '../../src/utils/filterForStash'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { SubscriptionType } from '../../src/types/types'
import { createTestEnv, MockKV } from '../helpers/mockKv'
import { legacyDefaultYaml } from '../fixtures/legacyRouting'

/** 新安装只需四项直连规则及一个代理兜底，顺序也是实际匹配顺序。 */
const expectedRules = [
  'RULE-SET,private,直连', 'RULE-SET,lancidr,直连,no-resolve',
  'RULE-SET,direct,直连', 'RULE-SET,cncidr,直连,no-resolve', 'MATCH,代理',
]

/** @param env 独立测试环境。@returns 已认证的 JSON API 请求头。 */
function headers(env: ReturnType<typeof createTestEnv>): Record<string, string> {
  return { 'Content-Type': 'application/json', Cookie: `auth=${generatePasswordHash(env.PASSWORD, env.SALT)}` }
}

/**
 * 调用真实管理接口并断言成功，避免失败响应被误当成正常配置。
 * @param env 独立环境。@param path API 路径。@param body 可选 JSON 请求体。
 * @returns 业务响应中的 data。
 */
async function api(env: ReturnType<typeof createTestEnv>, path: string, body?: unknown): Promise<any> {
  const response = await app.request(path, {
    method: body === undefined ? 'GET' : 'POST', headers: headers(env),
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env)
  expect(response.status).toBe(200)
  return ((await response.json()) as any).data
}

describe('通用初始路由与旧配置隔离', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('空 KV 初始化为两组、四个公开规则集和五条规则；读取不写 KV', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    const data = await api(env, '/api/routing-config')
    expect(data).toMatchObject({ revision: 0, migrated: false, initialized: true })
    expect(data.config.groups.map((group: any) => group.name)).toEqual(['直连', '代理'])
    expect(data.config.providers.map((provider: any) => provider.name)).toEqual(['private', 'lancidr', 'direct', 'cncidr'])
    expect(validateRoutingConfig(data.config)).toMatchObject({ valid: true, errors: [] })
    expect(YAML.parse(data.config.baseYaml).hosts).toBeUndefined()
    expect(data.config.rules).toHaveLength(5)
    expect(data.config.rules.every((rule: any) => ['RULE-SET', 'MATCH'].includes(rule.type))).toBe(true)
    expect(data.config.rules.every((rule: any) => Boolean(rule.remark))).toBe(true)
    expect(data.config.providers.every((provider: any) => data.config.rules.some((rule: any) => rule.providerId === provider.id))).toBe(true)
    expect(await api(env, '/api/routing-config/validate', { config: data.config })).toMatchObject({ valid: true, errors: [] })
    expect(kv.values.size).toBe(0)
    expect(kv.deleted).toEqual([])
  })

  it('每次初始化配置相互独立，编辑不会污染下一位用户', () => {
    const first = createDefaultRoutingConfig()
    const next = createDefaultRoutingConfig()
    expect(first).toEqual(next)
    first.groups[0].name = '改名'
    first.rules.splice(0)
    expect(createDefaultRoutingConfig()).toEqual(next)
  })

  for (const defaultYaml of ['', '  \n', 42, null, getDefaultYamlString()]) {
    it(`旧配置没有自定义模板时仍使用两组默认：${JSON.stringify(defaultYaml)?.slice(0, 30)}`, async () => {
      const env = createTestEnv()
      env.SUB_MERGER_KV.values.set('test-sub:config', JSON.stringify({ defaultYaml, selfNodeData: '[]' }))
      const data = await api(env, '/api/routing-config')
      expect(data.initialized).toBe(true)
      expect(data.config.groups).toHaveLength(2)
      const generated = await getSubYamlWithCache(SubscriptionType.Monthly, env)
      expect(YAML.parse(generated.normalYaml)['proxy-groups'].map((group: any) => group.name)).toEqual(['直连'])
      expect(YAML.parse(generated.normalYaml).rules.at(-1)).toBe('MATCH,REJECT')
    })
  }

  for (const output of ['monthly', 'trafficPackage'] as const) {
    for (const client of ['normal', 'stash'] as const) {
      it(`${output}/${client}：未发布、完整预览与发布后输出一致`, async () => {
        const env = createTestEnv()
        const subType = output === 'monthly' ? SubscriptionType.Monthly : SubscriptionType.TrafficPackage
        env.SUB_MERGER_KV.values.set('test-sub', JSON.stringify([
          { subName: '测试源', subType, subUrl: 'https://example.com/sub' },
          { subName: '另一类型', subType: output === 'monthly' ? SubscriptionType.TrafficPackage : SubscriptionType.Monthly, subUrl: 'https://example.com/unused' },
        ]))
        env.SUB_MERGER_KV.values.set('test-sub:self-nodes', JSON.stringify({ raw: '[{"name":"自建示例","type":"ss"}]' }))
        // 验证旧专组正则不会筛掉新默认代理组成员，全局过滤仍有效。
        env.SUBSCRIBE_PATTERN.OTHER_MATCH_PATTERN = '^不存在$'
        env.ONETIME_PATTERN.OTHER_MATCH_PATTERN = '^不存在$'
        env.SUBSCRIBE_PATTERN.EXCLUDE_PATTERN = env.ONETIME_PATTERN.EXCLUDE_PATTERN = '排除'
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(YAML.stringify({ proxies: [
          { name: '普通节点', type: 'ss' }, { name: '备用节点', type: 'ss' }, { name: '排除节点', type: 'ss' },
        ] })))
        const { config } = await api(env, '/api/routing-config')
        const beforePreview = new Map(env.SUB_MERGER_KV.values)
        const preview = await api(env, '/api/routing-config/preview', { config, output, client })
        expect(env.SUB_MERGER_KV.values).toEqual(beforePreview)
        const beforePublish = await getSubYamlWithCache(subType, env, true)
        const variant = client === 'normal' ? 'normalYaml' : 'stashYaml'
        const parsed = YAML.parse(beforePublish[variant])
        expect(YAML.parse(preview.yaml)).toEqual(parsed)
        expect(parsed['proxy-groups'].map((group: any) => group.name)).toEqual(['直连', '代理'])
        expect(parsed['proxy-groups'][0].proxies).toEqual(['DIRECT'])
        expect(parsed['proxy-groups'][1].proxies).toEqual(parsed.proxies.map((node: any) => node.name))
        expect(parsed.proxies).toHaveLength(3)
        expect(parsed.rules).toEqual(expectedRules)
        expect(parsed.hosts).toBeUndefined()
        expect(parsed['proxy-groups'][1].proxies).not.toContain('DIRECT')
        await api(env, '/api/routing-config/publish', { config, baseRevision: 0 })
        expect(env.SUB_MERGER_KV.deleted).toEqual(expect.arrayContaining(['test-sub:1:cacheObj:包年/包月', 'test-sub:1:cacheObj:流量包']))
        const published = await getSubYamlWithCache(subType, env, true)
        expect(YAML.parse(published[variant])).toEqual(parsed)
        expect(fetchMock.mock.calls.every((call) => call[0] === 'https://example.com/sub')).toBe(true)
        const endpoint = output === 'monthly' ? '/subscribe/magic-key' : '/onetime/magic-key'
        const response = await app.request(endpoint, { headers: { 'User-Agent': client === 'stash' ? 'Stash/2' : 'Clash.Meta' } }, env)
        expect(response.status).toBe(200)
        expect(YAML.parse(await response.text())).toEqual(parsed)
      })
    }
  }

  it('无节点、全局排空和 Stash 过滤后为空时代理流量不会降级直连', () => {
    // 当前生产 Stash 过滤器放行全部协议；仅此边界测试模拟未来的协议排除。
    vi.spyOn(stashCompatibility, 'filterProxyForStash').mockImplementation((node) => node.stashCompatible !== false)
    const config = createDefaultRoutingConfig()
    for (const nodes of [[], [{ name: '排除', stashCompatible: false }]]) {
      const variants = generateRoutingYamlVariants(config, nodes, [], 'monthly', '排除')
      for (const yaml of [variants.normalYaml, variants.stashYaml]) {
        const parsed = YAML.parse(yaml)
        expect(parsed['proxy-groups']).toEqual([{ name: '直连', type: 'select', proxies: ['DIRECT'] }])
        expect(parsed.rules).toEqual([...expectedRules.slice(0, -1), 'MATCH,REJECT'])
      }
    }
    const stash = generateRoutingYamlVariants(config, [{ name: '仅通用', stashCompatible: false }], [], 'monthly', '')
    expect(YAML.parse(stash.normalYaml)['proxy-groups']).toHaveLength(2)
    expect(YAML.parse(stash.stashYaml).rules.at(-1)).toBe('MATCH,REJECT')
  })

  it('只有自建节点时无需订阅源也能输出两个分组', async () => {
    const env = createTestEnv()
    env.SUB_MERGER_KV.values.set('test-sub:self-nodes', JSON.stringify({ raw: '[{"name":"家庭","type":"ss"}]' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const output = YAML.parse((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml)
    expect(output['proxy-groups'][1]).toEqual({ name: '代理', type: 'select', proxies: ['家庭【自建】'] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('旧接口修改默认 DNS 和格式后仍保留两组及直连规则，并持久化模板模式', async () => {
    const env = createTestEnv()
    const original = await api(env, '/api/config')
    const edited = YAML.parse(original.defaultYaml)
    edited.dns.nameserver = ['https://dns.example/dns-query']
    const selfNodeData = '[{"name":"测试出口","type":"ss"}]'
    await api(env, '/api/config', { selfNodeData, defaultYaml: '# 修改 DNS 的通用配置\n' + YAML.stringify(edited) })
    const stored = JSON.parse(env.SUB_MERGER_KV.values.get('test-sub:config'))
    expect(stored.routingMode).toBe('default')
    const data = await api(env, '/api/routing-config')
    expect(data.config.groups.map((group: any) => group.name)).toEqual(['直连', '代理'])
    expect(YAML.parse(data.config.baseYaml).dns.nameserver).toEqual(['https://dns.example/dns-query'])
    const generated = YAML.parse((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml)
    expect(generated.rules).toEqual(expectedRules)
    expect(generated.dns.nameserver).toEqual(edited.dns.nameserver)
    // 后续把所有目标改为内置 DIRECT 后，仍通过已保存模式维持两组，不再猜测模板来源。
    edited.rules = ['MATCH,DIRECT']
    await api(env, '/api/config', { selfNodeData, defaultYaml: YAML.stringify(edited) })
    expect((await api(env, '/api/routing-config')).config.groups).toHaveLength(2)
    expect(YAML.parse((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml).rules).toEqual(['MATCH,DIRECT'])
  })

  it('旧接口首次和通用模板之后导入历史模板都能正确切换来源模式', async () => {
    const env = createTestEnv()
    for (const mode of ['legacy', 'default', 'legacy', 'default']) {
      await api(env, '/api/config', {
        selfNodeData: '[{"name":"SELF-JP","type":"ss"}]',
        defaultYaml: mode === 'legacy' ? legacyDefaultYaml : getDefaultYamlString(),
      })
      expect(JSON.parse(env.SUB_MERGER_KV.values.get('test-sub:config')).routingMode).toBe(mode)
      expect((await api(env, '/api/routing-config')).config.groups).toHaveLength(mode === 'legacy' ? 15 : 2)
      const generated = YAML.parse((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml)
      expect(generated.rules.at(-1)).toBe(mode === 'legacy' ? 'MATCH,其它流量' : 'MATCH,代理')
      if (mode === 'legacy') expect(generated.rules).toContain('RULE-SET,legacy-service,海外AI')
      else expect(generated.rules).toEqual(expectedRules)
    }
  })

  it('旧 KV 模板保留 hosts、专用分组与规则，读取不重写旧数据', async () => {
    const env = createTestEnv()
    env.SUB_MERGER_KV.values.set('test-sub:config', JSON.stringify({ defaultYaml: legacyDefaultYaml, selfNodeData: '[{"name":"SELF-JP","type":"ss"}]' }))
    const before = new Map(env.SUB_MERGER_KV.values)
    const data = await api(env, '/api/routing-config')
    expect(data).toMatchObject({ migrated: true, initialized: false })
    expect(data.config.groups).toHaveLength(15)
    expect(env.SUB_MERGER_KV.values).toEqual(before)
    const generated = YAML.parse((await getSubYamlWithCache(SubscriptionType.Monthly, env)).normalYaml)
    expect(generated.hosts).toEqual({ 'internal.example': '192.0.2.1' })
    expect(generated.rules).toContain('RULE-SET,legacy-service,海外AI')
    expect(generated.rules.at(-1)).toBe('MATCH,其它流量')
    expect(env.SUB_MERGER_KV.values.get('test-sub:config')).toBe(before.get('test-sub:config'))
  })

  it('已发布配置优先于默认值，保存草稿又优先于发布；损坏旧模板不影响两者', async () => {
    const env = createTestEnv()
    const published = createDefaultRoutingConfig()
    published.groups[1].name = '用户出口'
    env.SUB_MERGER_KV.values.set('test-sub:config', JSON.stringify({ defaultYaml: 'rules: [' }))
    env.SUB_MERGER_KV.values.set('test-sub:routing:published', JSON.stringify({ config: published, revision: 8, updatedAt: 'saved' }))
    expect(await api(env, '/api/routing-config')).toMatchObject({ config: JSON.parse(JSON.stringify(published)), revision: 8, migrated: false, initialized: false })
    const draft = structuredClone(published)
    draft.groups[1].name = '未发布出口'
    env.SUB_MERGER_KV.values.set('test-sub:routing:draft', JSON.stringify({ config: draft, revision: 8, updatedAt: 'draft' }))
    expect((await api(env, '/api/routing-config')).config).toEqual(draft)
  })

  it('旧 KV 读取失败会明确返回错误，不悄悄把用户配置视为新默认', async () => {
    const env = createTestEnv()
    const originalGet = env.SUB_MERGER_KV.get.bind(env.SUB_MERGER_KV)
    vi.spyOn(env.SUB_MERGER_KV, 'get').mockImplementation(async (...args: any[]) => {
      if (args[0] === 'test-sub:config') throw new Error('测试读取失败')
      return originalGet(...args)
    })
    const response = await app.request('/api/routing-config', { headers: headers(env) }, env)
    expect(response.status).toBe(500)
    expect([...env.SUB_MERGER_KV.values.keys()].every((key: any) => key.startsWith('test-sub:logs:'))).toBe(true)
  })
})
