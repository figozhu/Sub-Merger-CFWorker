import { describe, expect, it } from 'vitest'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
import { getRuleValueError } from '../../src/utils/routingRuleSyntax'
import type { RoutingConfig, RoutingRuleType, RuleProviderBehavior } from '../../src/types/routing'

/** 创建最小合法路由配置，供不同错误场景独立修改。 */
function validConfig(): RoutingConfig {
  return {
    schemaVersion: 1,
    baseYaml: 'mixed-port: 7890\ndns:\n  enable: true\n',
    groups: [{ id: 'group-main', name: '节点选择', type: 'select', enabled: true, sources: [{ id: 'source-direct', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }] }],
    providers: [],
    rules: [{ id: 'rule-match', enabled: true, category: 'general', type: 'MATCH', targetGroupId: 'group-main', noResolve: false }],
  }
}

/**
 * 在合法配置的最终 MATCH 前插入待验证规则，子规则默认具有真实定义。
 * @param type 待验证规则类型。
 * @param value 管理员输入的匹配表达式。
 * @returns 独立配置；测试只修改目标字段，避免其它校验错误掩盖问题。
 */
function configWithRule(type: RoutingRuleType, value: string): RoutingConfig {
  const config = validConfig()
  config.baseYaml += 'sub-rules:\n  child:\n    - MATCH,DIRECT\n'
  config.rules.unshift({
    id: 'rule-test', enabled: true, category: 'general', type, value, noResolve: false,
    targetGroupId: type === 'SUB-RULE' ? '' : 'group-main',
    ...(type === 'SUB-RULE' ? { subRuleName: 'child' } : {}),
  })
  return config
}

describe('validateRoutingConfig', () => {
  it('接受合法 Mapping、策略组与最终 MATCH', () => {
    expect(validateRoutingConfig(validConfig())).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('拒绝 YAML 受管字段和重复顶级键', () => {
    const config = validConfig()
    config.baseYaml = 'dns: {}\ndns: {}\nproxy-groups: []\n'
    const codes = validateRoutingConfig(config).errors.map((issue) => issue.code)
    expect(codes).toContain('BASE_YAML_DUPLICATE_KEY')
    expect(codes).toContain('BASE_YAML_MANAGED_FIELD')
  })

  it('拒绝策略组循环引用', () => {
    const config = validConfig()
    config.groups.push({ id: 'group-b', name: '备用', type: 'select', enabled: true, sources: [{ id: 'source-b', kind: 'group', groupId: 'group-main', appliesTo: 'all' }] })
    config.groups[0].sources = [{ id: 'source-a', kind: 'group', groupId: 'group-b', appliesTo: 'all' }]
    expect(validateRoutingConfig(config).errors.some((issue) => issue.code === 'GROUP_REFERENCE_CYCLE')).toBe(true)
  })

  it('拒绝 MATCH 非末尾和失效 RULE-SET 引用', () => {
    const config = validConfig()
    config.rules.push({ id: 'rule-provider', enabled: true, category: 'proxy', type: 'RULE-SET', providerId: 'missing', targetGroupId: 'group-main', noResolve: false })
    const codes = validateRoutingConfig(config).errors.map((issue) => issue.code)
    expect(codes).toContain('RULE_PROVIDER_NOT_ENABLED')
    expect(codes).toContain('RULE_MATCH_NOT_LAST')
  })

  it.each<RoutingRuleType>(['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'PROCESS-NAME', 'PROCESS-NAME-WILDCARD'])(
    '%s 的 no-resolve 仅提醒无效，保持原配置并允许发布', (type) => {
      const config = validConfig()
      config.rules.unshift({ id: 'rule-no-resolve', enabled: true, category: 'general', type, value: 'example', targetGroupId: 'group-main', noResolve: true })
      const before = structuredClone(config)
      expect(validateRoutingConfig(config)).toEqual({
        valid: true, errors: [], warnings: [{
          code: 'RULE_NO_RESOLVE_INEFFECTIVE', path: 'rules[0].noResolve',
          message: expect.stringContaining('no-resolve 对其匹配条件没有作用'),
        }],
      })
      expect(config).toEqual(before)
    },
  )

  it.each<RuleProviderBehavior>(['domain', 'ipcidr', 'classical'])(
    '按 %s 提供者类型判断，不将 IP 或混合规则集误报为参数无效', (behavior) => {
      const config = validConfig()
      config.providers.push({ id: 'provider-test', name: '规则集', enabled: true, type: 'http', behavior, url: 'https://example.com/rules.yaml', path: './rules.yaml', interval: 86400 })
      config.rules.unshift({ id: 'rule-provider', enabled: true, category: 'general', type: 'RULE-SET', providerId: 'provider-test', targetGroupId: 'group-main', noResolve: true })
      const result = validateRoutingConfig(config)
      expect(result).toMatchObject({ valid: true, errors: [] })
      expect(result.warnings.map((issue) => issue.code)).toEqual(behavior === 'domain' ? ['RULE_NO_RESOLVE_INEFFECTIVE'] : [])
    },
  )

  it.each(['CN', 'LAN'])('GEOIP,%s 提醒解析行为，不推断目标是否直连或阻断发布', (value) => {
    const config = validConfig()
    config.rules.unshift({ id: 'rule-geoip', enabled: true, category: 'general', type: 'GEOIP', value, targetGroupId: 'builtin:REJECT', noResolve: true })
    const result = validateRoutingConfig(config)
    expect(result).toMatchObject({ valid: true, errors: [], warnings: [{ code: 'RULE_GEOIP_NO_RESOLVE', path: 'rules[0].noResolve' }] })
    expect(result.warnings[0].message).toContain('尚无真实目标 IP')
  })

  it('保留前置 IP 规则及其它 GEOIP 的 no-resolve，关闭或停用的规则不提醒', () => {
    const config = validConfig()
    config.rules.unshift(
      { id: 'rule-ip', enabled: true, category: 'general', type: 'IP-CIDR', value: '192.0.2.0/24', targetGroupId: 'group-main', noResolve: true },
      { id: 'rule-geoip', enabled: true, category: 'general', type: 'GEOIP', value: 'US', targetGroupId: 'group-main', noResolve: true },
      { id: 'rule-disabled', enabled: false, category: 'general', type: 'DOMAIN', value: 'example.com', targetGroupId: 'group-main', noResolve: true },
      { id: 'rule-resolve', enabled: true, category: 'general', type: 'DOMAIN', value: 'example.org', targetGroupId: 'group-main', noResolve: false },
    )
    expect(validateRoutingConfig(config)).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('MATCH 携带 no-resolve 仍是阻断错误，不降级成提醒', () => {
    const config = validConfig()
    config.rules[0].noResolve = true
    expect(validateRoutingConfig(config)).toMatchObject({
      valid: false,
      errors: [{ code: 'RULE_MATCH_NO_RESOLVE_FORBIDDEN', path: 'rules[0].noResolve' }],
      warnings: [],
    })
  })
})

describe('Mihomo 新规则的发布前校验', () => {
  describe.each(['SRC-PORT', 'DST-PORT', 'IN-PORT'] as const)('%s 的端口格式', (type) => {
    it.each(['65536', '-1', '45999-45000', '80,443', '80//443', '1.5'])('拒绝非法端口值 %s', (value) => {
      const config = configWithRule(type, value)
      const original = structuredClone(config)
      expect(validateRoutingConfig(config)).toMatchObject({
        valid: false,
        errors: [{ code: 'RULE_VALUE_INVALID', path: 'rules[0].value' }],
      })
      expect(config).toEqual(original)
    })

    it('接受端口上下界与多个合法范围', () => {
      expect(validateRoutingConfig(configWithRule(type, '0/80/443/45000-45999/65535')).errors).toEqual([])
    })
  })

  it.each([
    ['UID', '-1'], ['UID', '4294967296'], ['UID', '1002-1001'],
    ['DSCP', '64'], ['DSCP', '-1'], ['DSCP', '4-2'],
    ['NETWORK', 'icmp'], ['NETWORK', 'tcp/udp'],
  ] as const)('拒绝 %s 的非法范围或协议 %s', (type, value) => {
    expect(validateRoutingConfig(configWithRule(type, value))).toMatchObject({
      valid: false, errors: [{ code: 'RULE_VALUE_INVALID', path: 'rules[0].value' }],
    })
  })

  it.each([
    ['UID', '0/1001-1002/4294967295'], ['DSCP', '0/4-8/63'], ['NETWORK', 'TCP'], ['NETWORK', 'udp'],
  ] as const)('接受 %s 的合法边界与协议 %s', (type, value) => {
    expect(getRuleValueError(type, value, new Set())).toBeNull()
    expect(validateRoutingConfig(configWithRule(type, value)).errors).toEqual([])
  })

  it.each([
    ['NOT', '((NETWORK,tcp),(DOMAIN,example.com))'],
    ['AND', '(NETWORK,tcp)'],
    ['OR', '((NETWORK,tcp)'],
    ['AND', '((MATCH,DIRECT))'],
    ['AND', '((SUB-RULE,(NETWORK,tcp),child))'],
    ['NOT', '((OR,((MATCH,DIRECT),(NETWORK,tcp))))'],
    ['SUB-RULE', 'NETWORK,tcp'],
    ['SUB-RULE', '(NETWORK,tcp),(DOMAIN,example.com)'],
  ] as const)('拒绝 %s 的无效逻辑表达式 %s', (type, value) => {
    expect(validateRoutingConfig(configWithRule(type, value))).toMatchObject({
      valid: false, errors: [{ code: 'RULE_VALUE_INVALID', path: 'rules[0].value' }],
    })
  })

  it('逻辑条件的规则提供者必须真实存在且启用', () => {
    const config = configWithRule('AND', '((RULE-SET,internal-rules),(NETWORK,tcp))')
    expect(validateRoutingConfig(config).errors).toEqual([
      expect.objectContaining({ code: 'RULE_VALUE_INVALID', path: 'rules[0].value', message: expect.stringContaining('internal-rules') }),
    ])
    config.providers.push({
      id: 'provider-internal', name: 'internal-rules', enabled: true, type: 'http', behavior: 'classical',
      url: 'https://example.test/internal.yaml', path: './internal.yaml', interval: 3600,
    })
    expect(validateRoutingConfig(config).errors).toEqual([])
    config.providers[0].enabled = false
    expect(validateRoutingConfig(config).errors).toEqual([
      expect.objectContaining({ code: 'RULE_VALUE_INVALID', path: 'rules[0].value', message: expect.stringContaining('internal-rules') }),
    ])
  })

  describe.each([
    ['AND', '((NETWORK,tcp),(DOMAIN,example.com))'],
    ['OR', '((NETWORK,tcp),(DOMAIN,example.com))'],
    ['NOT', '((NETWORK,tcp))'],
    ['SUB-RULE', '(NETWORK,tcp)'],
    ['DOMAIN-REGEX', '^a{1,3}$'],
    ['PROCESS-NAME-REGEX', '(?i)chrome'],
    ['PROCESS-PATH-REGEX', '/usr/(bin|sbin)/wget'],
  ] as const)('%s 不允许外层尾部选项', (type, value) => {
    it.each(['noResolve', 'matchSource', 'legacyOptions'] as const)('拒绝通过 %s 追加外层参数', (field) => {
      const config = configWithRule(type, value)
      if (field === 'legacyOptions') config.rules[0].legacyOptions = ['src']
      else config.rules[0][field] = true
      const validation = validateRoutingConfig(config)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'RULE_OPTIONS_FORBIDDEN', path: 'rules[0]' }),
      ]))
    })
  })

  it.each([
    'mixed-port: 7890\n',
    'sub-rules:\n  child: []\n',
    'sub-rules:\n  child: MATCH,DIRECT\n',
    'sub-rules:\n  child: [null]\n',
  ])('SUB-RULE 拒绝缺失或非有效规则数组的定义 %#', (baseYaml) => {
    const config = configWithRule('SUB-RULE', '(NETWORK,tcp)')
    config.baseYaml = baseYaml
    expect(validateRoutingConfig(config)).toMatchObject({
      valid: false, errors: [{ code: 'RULE_SUB_RULE_NOT_FOUND', path: 'rules[0].subRuleName' }],
    })
  })

  it('SUB-RULE 未选择名称时返回可定位错误', () => {
    const config = configWithRule('SUB-RULE', '(NETWORK,tcp)')
    delete config.rules[0].subRuleName
    expect(validateRoutingConfig(config)).toMatchObject({
      valid: false, errors: [{ code: 'RULE_SUB_RULE_REQUIRED', path: 'rules[0].subRuleName' }],
    })
  })

  it('深度过大的逻辑条件返回明确错误而非栈溢出', () => {
    let value = '((NETWORK,tcp))'
    for (let depth = 0; depth < 70; depth++) value = `((NOT,${value}))`
    expect(getRuleValueError('NOT', value, new Set())).toContain('嵌套不能超过')
    expect(validateRoutingConfig(configWithRule('NOT', value))).toMatchObject({
      valid: false, errors: [{ code: 'RULE_VALUE_INVALID', path: 'rules[0].value' }],
    })
  })
})
