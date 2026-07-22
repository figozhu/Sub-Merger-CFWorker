import { describe, expect, it } from 'vitest'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
import type { RoutingConfig } from '../../src/types/routing'

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
})
