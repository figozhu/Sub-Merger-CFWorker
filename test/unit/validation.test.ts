import { describe, expect, it } from 'vitest'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
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
