import { describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import type { ProxyGroupConfig, ProxyMemberSource, RoutingConfig, RoutingRuleConfig } from '../../src/types/routing'
import { pruneEmptyProxyGroups, sanitizeProxyGroupYaml } from '../../src/utils/pruneEmptyProxyGroups'
import { resolveProxyGroups, type ResolveProxyGroupsContext } from '../../src/utils/resolveProxyGroups'
import { generateRoutingYaml, generateRoutingYamlVariants } from '../../src/utils/generateRoutingYaml'
import generateLegacyProxyConfigYaml from '../../src/utils/generateProxyConfigYaml'
import { createTestEnv } from '../helpers/mockKv'

// 模拟将来恢复协议兼容过滤，验证两个客户端不会共用未经裁剪的成员集合。
vi.mock('../../src/utils/filterForStash', () => ({
  filterProxyForStash: vi.fn((node: Record<string, unknown>) => node.stashCompatible !== false),
}))

/** @param id 来源 ID。@param groupId 被引用组 ID。@returns 所有输出适用的策略组引用。 */
function reference(id: string, groupId: string): ProxyMemberSource {
  return { id, kind: 'group', groupId, appliesTo: 'all' }
}

/** @param id 来源 ID。@param overrides 筛选条件覆盖。@returns 默认读取订阅节点的筛选来源。 */
function filter(id: string, overrides: Partial<Extract<ProxyMemberSource, { kind: 'filter' }>> = {}): ProxyMemberSource {
  return { id, kind: 'filter', source: 'subscription', include: '', exclude: '', appliesTo: 'all', ...overrides }
}

/** @param id 组 ID。@param sources 有序成员来源。@returns 名称与 ID 一致的启用手选组。 */
function group(id: string, sources: ProxyMemberSource[]): ProxyGroupConfig {
  return { id, name: id, type: 'select', enabled: true, sources }
}

/** @param groups 有序策略组。@param rules 有序规则。@returns 可直接生成输出的独立配置。 */
function configuration(groups: ProxyGroupConfig[], rules: RoutingRuleConfig[] = []): RoutingConfig {
  return { schemaVersion: 1, baseYaml: 'mode: rule\n', groups, providers: [], rules }
}

/** @param overrides 当前输出、客户端或节点的覆盖值。@returns 默认无节点的包月通用上下文。 */
function context(overrides: Partial<ResolveProxyGroupsContext> = {}): ResolveProxyGroupsContext {
  return { subscriptionNodes: [], selfNodes: [], output: 'monthly', client: 'normal', ...overrides }
}

/** @param id 规则 ID。@param targetGroupId 策略组、内置或兼容节点目标。@returns 最终匹配规则。 */
function matchRule(id: string, targetGroupId: string): RoutingRuleConfig {
  return { id, type: 'MATCH', enabled: true, category: 'test', targetGroupId, noResolve: false }
}

describe('空策略组裁剪与完整 YAML 容错', () => {
  it('递归裁剪向后引用和多层空组，并保持剩余组与成员顺序', () => {
    const groups = [
      { name: '入口', type: 'select', proxies: ['空父组', 'JP-1', '有效后组', 'DIRECT', '不存在'] },
      { name: '空父组', type: 'select', proxies: ['空子组'] },
      { name: '空子组', type: 'fallback', proxies: ['空叶组'], url: 'https://example.com', interval: 60 },
      { name: '空叶组', type: 'select', proxies: [] },
      { name: '有效后组', type: 'select', proxies: ['US-1', 'JP-1'] },
      { name: '仅直连', type: 'select', proxies: ['DIRECT'] },
    ]

    const resolved = pruneEmptyProxyGroups(groups, ['JP-1', 'US-1'])
    expect(resolved.changed).toBe(true)
    expect(resolved.groups.map((item) => item.name)).toEqual(['入口', '有效后组', '仅直连'])
    expect(resolved.groups.map((item) => item.proxies)).toEqual([
      ['JP-1', '有效后组', 'DIRECT'], ['US-1', 'JP-1'], ['DIRECT'],
    ])
  })

  it('保留 DIRECT、有效节点和有效组组成的混合来源，不修改输入且结果幂等', () => {
    const groups = [
      { name: '空组', type: 'select', proxies: [] },
      { name: '混合', type: 'select', proxies: ['空组', '节点', '直连', 'DIRECT'], icon: 'custom-icon' },
      { name: '直连', type: 'select', proxies: ['DIRECT'] },
    ]
    const original = structuredClone(groups)
    const resolved = pruneEmptyProxyGroups(groups, ['节点'])

    expect(groups).toEqual(original)
    expect(resolved.groups).toEqual([
      { name: '混合', type: 'select', proxies: ['节点', '直连', 'DIRECT'], icon: 'custom-icon' },
      { name: '直连', type: 'select', proxies: ['DIRECT'] },
    ])
    expect(pruneEmptyProxyGroups(resolved.groups, ['节点'])).toEqual({ groups: resolved.groups, changed: false })
  })

  it('分别按包月和流量包来源裁剪，并让预览数量与实际成员一致', () => {
    const config = configuration([
      group('入口', [reference('r1', '包月组'), reference('r2', '流量包组')]),
      group('包月组', [filter('monthly', { appliesTo: 'monthly' })]),
      group('流量包组', [filter('traffic', { appliesTo: 'trafficPackage' })]),
    ])
    const original = structuredClone(config)

    for (const output of ['monthly', 'trafficPackage'] as const) {
      const active = output === 'monthly' ? '包月组' : '流量包组'
      const inactive = output === 'monthly' ? '流量包组' : '包月组'
      const resolved = resolveProxyGroups(config, context({ output, subscriptionNodes: [{ name: 'JP-1' }] }))
      expect(resolved.groups.map((item) => item.name)).toEqual(['入口', active])
      expect(resolved.groups[0].proxies).toEqual([active])
      expect(resolved.previews.find((item) => item.groupId === inactive)).toMatchObject({ count: 0, names: [] })
      expect(resolved.previews.find((item) => item.groupId === '入口')).toMatchObject({ count: 1, names: [active] })
    }
    expect(config).toEqual(original)
  })

  it('在全局排除清空自建和订阅节点后删除关联组，保留显式 DIRECT 来源', () => {
    const config = configuration([
      group('入口', [reference('r1', '机场'), reference('r2', '自建'), { id: 'direct', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }]),
      group('机场', [filter('subscription')]),
      group('自建', [filter('self', { source: 'self' })]),
    ])
    const resolved = resolveProxyGroups(config, context({
      subscriptionNodes: [{ name: '排除机场' }], selfNodes: [{ name: '排除自建【自建】' }], globalExcludePattern: '排除',
    }))

    expect(resolved.proxies).toEqual([])
    expect(resolved.groups).toEqual([{ name: '入口', type: 'select', proxies: ['DIRECT'] }])
    expect(resolved.previews.map((item) => item.count)).toEqual([1, 0, 0])
  })

  it('无订阅节点时仍保留用户明确从 all 和 self 池匹配到的自建成员', () => {
    const config = configuration([
      group('用户机场名称', [filter('all', { source: 'all' })]),
      group('自建选择', [filter('self', { source: 'self' })]),
      group('真正订阅池', [filter('subscription')]),
      group('入口', [reference('r1', '真正订阅池'), reference('r2', '用户机场名称'), reference('r3', '自建选择')]),
    ])
    const resolved = resolveProxyGroups(config, context({ selfNodes: [{ name: 'JP-SELF【自建】' }] }))

    expect(resolved.groups.map((item) => item.name)).toEqual(['用户机场名称', '自建选择', '入口'])
    expect(resolved.groups.map((item) => item.proxies)).toEqual([
      ['JP-SELF【自建】'], ['JP-SELF【自建】'], ['用户机场名称', '自建选择'],
    ])
  })

  it('隐藏不可见组并修复引用该组的其它组和规则，保留动态规则备注与选项', () => {
    const hidden = { ...group('自建组', [{ id: 'd1', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }]), visibility: 'withSelfNodes' as const }
    const config = configuration([
      hidden,
      group('入口', [reference('r1', '自建组'), { id: 'd2', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }]),
    ], [
      { id: 'rule', type: 'DOMAIN-SUFFIX', enabled: true, category: 'test', value: 'example.com', targetGroupId: hidden.id, noResolve: true, legacyOptions: ['src'], remark: '自建暂不可用\n保留规则说明' },
      matchRule('match', '入口'),
    ])
    const generated = generateRoutingYaml(config, context())
    const parsed = YAML.parse(generated.yaml)

    expect(parsed['proxy-groups']).toEqual([{ name: '入口', type: 'select', proxies: ['DIRECT'] }])
    expect(parsed.rules).toEqual(['DOMAIN-SUFFIX,example.com,入口,no-resolve,src', 'MATCH,入口'])
    expect(generated.yaml).toMatch(/# 自建暂不可用\n\s*# 保留规则说明\n\s*- DOMAIN-SUFFIX,example.com,入口,no-resolve,src/)
  })

  it('失效规则优先使用有效最终 MATCH，保留已有有效规则目标', () => {
    const yaml = YAML.stringify({
      proxies: [{ name: '首个节点' }, { name: '次个节点' }],
      'proxy-groups': [{ name: '机场', type: 'select', proxies: [] }, { name: '最终选择', type: 'select', proxies: ['次个节点'] }],
      rules: ['DOMAIN,missing.example,机场,no-resolve', 'DOMAIN,valid.example,首个节点', 'MATCH,最终选择'],
    })
    expect(YAML.parse(sanitizeProxyGroupYaml(yaml)).rules).toEqual([
      'DOMAIN,missing.example,最终选择,no-resolve', 'DOMAIN,valid.example,首个节点', 'MATCH,最终选择',
    ])
  })

  it('最终 MATCH 也失效时使用首个实际节点，无实际节点时使用 REJECT', () => {
    for (const nodes of [[{ name: '第一个' }, { name: '第二个' }], []]) {
      const fallback = nodes.length ? '第一个' : 'REJECT'
      const yaml = YAML.stringify({
        proxies: nodes,
        'proxy-groups': [{ name: '失效组', type: 'select', proxies: [] }],
        rules: ['DOMAIN,a.example,失效组,no-resolve', 'DOMAIN,direct.example,DIRECT', 'DOMAIN,reject.example,REJECT', 'MATCH,失效组'],
      })
      const parsed = YAML.parse(sanitizeProxyGroupYaml(yaml))
      expect(parsed['proxy-groups']).toEqual([])
      expect(parsed.rules).toEqual([
        `DOMAIN,a.example,${fallback},no-resolve`, 'DOMAIN,direct.example,DIRECT', 'DOMAIN,reject.example,REJECT', `MATCH,${fallback}`,
      ])
    }
  })

  it('兼容迁移规则直接指向本次缺失节点的目标', () => {
    const config = configuration([], [
      { id: 'old', type: 'DOMAIN', enabled: true, category: 'test', value: 'example.com', targetGroupId: 'legacy-target:已消失节点', noResolve: true },
      matchRule('match', 'builtin:DIRECT'),
    ])
    expect(YAML.parse(generateRoutingYaml(config, context()).yaml).rules).toEqual([
      'DOMAIN,example.com,DIRECT,no-resolve', 'MATCH,DIRECT',
    ])
  })

  it('只替换嵌套逻辑规则最外层策略，保留备注、尾部选项和 SUB-RULE 子规则名称', () => {
    const source = `# 自定义基础说明\nproxies: []\nproxy-groups:\n  - name: 空组\n    type: select\n    proxies: []\nrules:\n  # 复杂规则说明\n  - AND,((DOMAIN,example.com),(OR,((NETWORK,TCP),(DST-PORT,443)))),空组,no-resolve\n  - NOT,((DOMAIN-SUFFIX,example.org)),空组,no-resolve\n  - SUB-RULE,(NETWORK,TCP),自定义子规则\n  # 最终兜底\n  - MATCH,DIRECT\n`
    const result = sanitizeProxyGroupYaml(source)
    expect(YAML.parse(result).rules).toEqual([
      'AND,((DOMAIN,example.com),(OR,((NETWORK,TCP),(DST-PORT,443)))),DIRECT,no-resolve',
      'NOT,((DOMAIN-SUFFIX,example.org)),DIRECT,no-resolve',
      'SUB-RULE,(NETWORK,TCP),自定义子规则', 'MATCH,DIRECT',
    ])
    expect(result).toContain('# 自定义基础说明')
    expect(result).toMatch(/# 复杂规则说明\n\s*- AND,/)
    expect(result).toMatch(/# 最终兜底\n\s*- MATCH,DIRECT/)
    expect(sanitizeProxyGroupYaml(result)).toBe(result)
  })

  it('同步修复 sub-rules 中失效的策略引用，保留子规则名称、备注和规则选项', () => {
    const source = `proxies: []\nproxy-groups:\n  - name: 空机场\n    type: select\n    proxies: []\n  - name: 有效选择\n    type: select\n    proxies: [DIRECT]\nsub-rules:\n  自定义子规则:\n    # 子规则代理说明\n    - DOMAIN,example.com,空机场,no-resolve\n    - AND,((NETWORK,TCP),(DST-PORT,443)),空机场,no-resolve\n    - SUB-RULE,(NETWORK,UDP),更深子规则\n    - MATCH,空机场\n  更深子规则:\n    - DOMAIN,keep.example,DIRECT,no-resolve\nrules:\n  - SUB-RULE,(NETWORK,TCP),自定义子规则\n  - MATCH,有效选择\n`
    const result = sanitizeProxyGroupYaml(source)
    const parsed = YAML.parse(result)

    expect(parsed['sub-rules']).toEqual({
      自定义子规则: [
        'DOMAIN,example.com,有效选择,no-resolve',
        'AND,((NETWORK,TCP),(DST-PORT,443)),有效选择,no-resolve',
        'SUB-RULE,(NETWORK,UDP),更深子规则',
        'MATCH,有效选择',
      ],
      更深子规则: ['DOMAIN,keep.example,DIRECT,no-resolve'],
    })
    expect(parsed.rules).toEqual(['SUB-RULE,(NETWORK,TCP),自定义子规则', 'MATCH,有效选择'])
    expect(result).toMatch(/# 子规则代理说明\n\s*- DOMAIN,example.com,有效选择,no-resolve/)
    expect(sanitizeProxyGroupYaml(result)).toBe(result)
  })

  it('旧 YAML 中 provider 动态组、内置策略、未知基础及组字段保持完整', () => {
    const original = {
      proxies: [],
      'proxy-providers': { airport: { type: 'http', url: 'https://example.com/provider', path: './providers.yaml', interval: 3600 } },
      'proxy-groups': [
        { name: '空组', type: 'select', proxies: [] },
        { name: 'Provider组', type: 'url-test', use: ['airport'], url: 'https://example.com/ping', interval: 300, filter: 'HK', lazy: true },
        { name: '所有提供者', type: 'select', 'include-all-providers': true },
        { name: '所有来源', type: 'select', 'include-all': true },
        { name: '内置策略', type: 'select', proxies: ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL'] },
      ],
      dns: { enable: true, nameserver: ['https://dns.example/dns-query'] },
      profile: { 'store-selected': true },
      'x-custom': { nested: ['保留内容', { value: 123 }] },
      rules: ['DOMAIN,a.example,空组', 'MATCH,Provider组'],
    }
    const source = YAML.stringify(original)
    const parsed = YAML.parse(sanitizeProxyGroupYaml(source))

    expect(parsed['proxy-groups']).toEqual(original['proxy-groups'].slice(1))
    expect(parsed['proxy-providers']).toEqual(original['proxy-providers'])
    expect(parsed.dns).toEqual(original.dns)
    expect(parsed.profile).toEqual(original.profile)
    expect(parsed['x-custom']).toEqual(original['x-custom'])
    expect(parsed.rules).toEqual(['DOMAIN,a.example,Provider组', 'MATCH,Provider组'])
  })

  it('定向修复已删除组的下载与链式引用，保留有效引用、外部节点和同名未知字段', () => {
    const original = {
      proxies: [
        { name: '落地节点', 'dialer-proxy': '空机场' },
        { name: '有效中转', 'dialer-proxy': '有效选择' },
        { name: '外部中转', 'dialer-proxy': 'provider内动态节点' },
      ],
      'proxy-groups': [
        { name: '空机场', type: 'select', proxies: [] },
        { name: '有效选择', type: 'select', proxies: ['DIRECT'] },
      ],
      'rule-providers': {
        proxy: { type: 'http', url: 'https://example.com/rules', proxy: '空机场', behavior: 'domain' },
        valid: { type: 'http', url: 'https://example.com/valid', proxy: '有效选择', behavior: 'domain' },
      },
      'proxy-providers': {
        download: {
          type: 'http', url: 'https://example.com/nodes', proxy: '空机场',
          override: { 'dialer-proxy': '空机场', udp: true },
          payload: [{ name: '备用落地', 'dialer-proxy': '空机场' }, { name: '备用外部', 'dialer-proxy': 'provider内动态节点' }],
        },
        untouched: { type: 'http', url: 'https://example.com/external', proxy: 'provider内动态节点' },
      },
      'x-custom': { proxy: '空机场', 'dialer-proxy': '空机场' },
      rules: ['MATCH,有效选择'],
    }
    const parsed = YAML.parse(sanitizeProxyGroupYaml(YAML.stringify(original)))

    expect(parsed.proxies).toEqual([
      { name: '落地节点', 'dialer-proxy': 'REJECT' },
      original.proxies[1], original.proxies[2],
    ])
    expect(parsed['rule-providers']).toEqual({
      proxy: { ...original['rule-providers'].proxy, proxy: 'REJECT' },
      valid: original['rule-providers'].valid,
    })
    expect(parsed['proxy-providers']).toEqual({
      download: {
        ...original['proxy-providers'].download,
        proxy: 'REJECT',
        override: { 'dialer-proxy': 'REJECT', udp: true },
        payload: [{ name: '备用落地', 'dialer-proxy': 'REJECT' }, original['proxy-providers'].download.payload[1]],
      },
      untouched: original['proxy-providers'].untouched,
    })
    expect(parsed['x-custom']).toEqual(original['x-custom'])
    expect(parsed.rules).toEqual(['MATCH,有效选择'])
  })

  it('提前裁剪的组通过元数据识别，未提供元数据时保留未知的外部中转名称', () => {
    const source = YAML.stringify({
      proxies: [{ name: '落地', 'dialer-proxy': '已提前删除' }],
      'proxy-groups': [{ name: '有效', type: 'select', proxies: ['落地'] }],
      'proxy-providers': { external: { type: 'http', url: 'https://example.com', proxy: '已提前删除' } },
      rules: ['MATCH,有效'],
    })
    const names = ['已提前删除', '有效']
    expect(sanitizeProxyGroupYaml(source)).toBe(source)
    const sanitized = sanitizeProxyGroupYaml(source, names)
    const parsed = YAML.parse(sanitized)

    expect(parsed.proxies[0]['dialer-proxy']).toBe('REJECT')
    expect(parsed['proxy-providers'].external.proxy).toBe('REJECT')
    expect(parsed['proxy-groups']).toEqual([{ name: '有效', type: 'select', proxies: ['落地'] }])
    expect(names).toEqual(['已提前删除', '有效'])
    expect(sanitizeProxyGroupYaml(sanitized, names)).toBe(sanitized)
  })

  it('动态生成自动传入已被过滤和隐藏的组名，修复节点及基础模板下载引用', () => {
    const hidden = { ...group('隐藏组', []), visibility: 'withSelfNodes' as const }
    const config = configuration([
      group('空机场', [filter('empty', { include: '^不存在$' })]),
      hidden,
      group('入口', [filter('all')]),
    ], [matchRule('match', '入口')])
    config.baseYaml += 'proxy-providers:\n  custom:\n    type: http\n    url: https://example.com/nodes\n    proxy: 隐藏组\n'
    const nodes = [{ name: '落地', 'dialer-proxy': '空机场' }]
    const original = structuredClone({ config, nodes })
    const parsed = YAML.parse(generateRoutingYaml(config, context({ subscriptionNodes: nodes })).yaml)

    expect(parsed['proxy-groups']).toEqual([{ name: '入口', type: 'select', proxies: ['落地'] }])
    expect(parsed.proxies[0]['dialer-proxy']).toBe('REJECT')
    expect(parsed['proxy-providers'].custom.proxy).toBe('REJECT')
    expect({ config, nodes }).toEqual(original)
  })

  it('旧生成器保留裁剪前组名，合并旧模板后可以修复链式节点和规则下载代理', async () => {
    const env = createTestEnv()
    env.SUBSCRIBE_PATTERN.PROXY_MATCH_PATTERN = '^不匹配任何节点$'
    const variants = await generateLegacyProxyConfigYaml([{ name: '自定义落地', 'dialer-proxy': '中转代理' }], env.SUBSCRIBE_PATTERN, env)
    const raw = YAML.parse(variants.normalYaml)
    expect(raw['proxy-groups'].some((item: { name: string }) => item.name === '中转代理')).toBe(false)
    expect(variants.groupNames).toContain('中转代理')

    const suffix = '\nrule-providers:\n  custom:\n    type: http\n    behavior: domain\n    url: https://example.com/rules\n    proxy: 中转代理\nrules:\n  - MATCH,其它流量\n'
    const parsed = YAML.parse(sanitizeProxyGroupYaml(variants.normalYaml + suffix, variants.groupNames))
    expect(parsed.proxies[0]['dialer-proxy']).toBe('REJECT')
    expect(parsed['rule-providers'].custom.proxy).toBe('REJECT')
    expect(parsed.rules).toEqual(['MATCH,其它流量'])
  })

  it('include-all-proxies 按本次实际节点是否存在决定保留', () => {
    const groups = [{ name: '动态节点', type: 'select', 'include-all-proxies': true }]
    expect(pruneEmptyProxyGroups(groups, ['节点']).groups).toEqual(groups)
    expect(pruneEmptyProxyGroups(groups, []).groups).toEqual([])
  })

  it('无需修复时保留旧 YAML 原文格式，损坏或非 Mapping 文本明确拒绝', () => {
    const source = '# 自定义格式\nproxies: []\nproxy-groups: []\nrules: [ "MATCH,DIRECT" ]\n'
    expect(sanitizeProxyGroupYaml(source)).toBe(source)
    for (const broken of ['# 只有说明', 'rules: [', '- 不是配置对象', 'rules: []\nrules: []\n']) {
      expect(() => sanitizeProxyGroupYaml(broken)).toThrow('订阅 YAML 格式无效，需要重新生成')
    }
  })

  it('通用与 Stash 分别裁剪客户端不支持节点导致的空组和规则', () => {
    const config = configuration([
      group('机场', [filter('subscription')]),
      group('入口', [reference('r1', '机场')]),
    ], [matchRule('match', '入口')])
    const nodes = [{ name: '仅通用节点', stashCompatible: false }]
    const input = structuredClone({ config, nodes })
    const variants = generateRoutingYamlVariants(config, nodes, [], 'monthly', '')
    const normal = YAML.parse(variants.normalYaml)
    const stash = YAML.parse(variants.stashYaml)

    expect(normal.proxies).toEqual(nodes)
    expect(normal['proxy-groups'].map((item: { name: string }) => item.name)).toEqual(['机场', '入口'])
    expect(normal.rules).toEqual(['MATCH,入口'])
    expect(stash.proxies).toEqual([])
    expect(stash['proxy-groups']).toEqual([])
    expect(stash.rules).toEqual(['MATCH,REJECT'])
    expect({ config, nodes }).toEqual(input)
  })

  it('旧生成器在全局排除为空时仍按 Stash 兼容性过滤节点和组', async () => {
    const env = createTestEnv()
    const variants = await generateLegacyProxyConfigYaml([{ name: '仅通用节点', stashCompatible: false }], env.SUBSCRIBE_PATTERN, env)
    const normal = YAML.parse(variants.normalYaml)
    const stash = YAML.parse(variants.stashYaml)

    expect(normal.proxies).toHaveLength(1)
    expect(stash.proxies).toEqual([])
    expect(stash['proxy-groups'].every((item: { proxies: string[] }) => item.proxies.every((name) => name !== '仅通用节点'))).toBe(true)
  })
})
