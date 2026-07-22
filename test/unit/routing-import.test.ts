import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { importRoutingConfigYaml } from '../../src/config/routingMigration'
import { generateRoutingYaml } from '../../src/utils/generateRoutingYaml'

/**
 * 生成覆盖四类拆分数据、稳定引用和规则前置注释的完整 Clash YAML。
 * @returns 可直接交给导入器的测试文本。
 */
function completeYamlFixture(): string {
  return `# 基础配置注释
mixed-port: 7890
mode: rule
proxies:
  - name: HK-01
    type: ss
    server: hk.example.com
    port: 443
    cipher: aes-128-gcm
    password: test-only
proxy-groups:
  - name: 节点选择
    type: select
    proxies:
      - HK-01
      - DIRECT
rule-providers:
  google:
    type: http
    behavior: classical
    url: https://example.com/google.yaml
    path: ./RuleSet/google.yaml
    interval: 86400
rules:
  # Google 服务
  - RULE-SET,google,节点选择
  # 最终兜底
  - MATCH,DIRECT
`
}

describe('完整 YAML 导入与规则备注往返', () => {
  it('把完整 YAML 拆成四类草稿，并保留基础注释和规则备注', () => {
    const imported = importRoutingConfigYaml(completeYamlFixture())
    expect(imported.errors).toEqual([])
    expect(imported.summary).toEqual({ groups: 1, providers: 1, rules: 2, baseFields: 2 })
    expect(imported.config?.groups).toHaveLength(1)
    expect(imported.config?.providers).toHaveLength(1)
    expect(imported.config?.rules.map((rule) => rule.remark)).toEqual(['Google 服务', '最终兜底'])
    expect(imported.config?.rules[0].providerId).toBe(imported.config?.providers[0].id)
    expect(imported.config?.rules[0].targetGroupId).toBe(imported.config?.groups[0].id)
    expect(imported.config?.baseYaml).toContain('# 基础配置注释')
    const base = YAML.parse(imported.config?.baseYaml || '')
    expect(base).toMatchObject({ 'mixed-port': 7890, mode: 'rule' })
    expect(base).not.toHaveProperty('proxies')
    expect(base).not.toHaveProperty('proxy-groups')
    expect(base).not.toHaveProperty('rule-providers')
    expect(base).not.toHaveProperty('rules')
  })

  it('生成时把备注写在对应规则上一行，再导入后保持一致', () => {
    const imported = importRoutingConfigYaml(completeYamlFixture())
    expect(imported.config).not.toBeNull()
    const generated = generateRoutingYaml(imported.config!, {
      subscriptionNodes: [{ name: 'HK-01', type: 'ss', server: 'hk.example.com', port: 443 }],
      selfNodes: [],
      output: 'monthly',
      client: 'normal',
      globalExcludePattern: '',
    }).yaml
    expect(generated).toMatch(/# Google 服务\n\s*- RULE-SET,google,节点选择/)
    expect(generated).toMatch(/# 最终兜底\n\s*- MATCH,DIRECT/)

    const roundTrip = importRoutingConfigYaml(generated)
    expect(roundTrip.errors).toEqual([])
    expect(roundTrip.config?.rules.map((rule) => rule.remark)).toEqual(['Google 服务', '最终兜底'])
  })

  it('不支持的组字段、提供者字段和内置策略会一次性完整报错', () => {
    const imported = importRoutingConfigYaml(`
proxy-groups:
  - name: Auto
    type: url-test
    use: [airport]
    filter: HK|SG
    proxies: [REJECT]
    url: https://www.gstatic.com/generate_204
    interval: 300
rule-providers:
  google:
    type: http
    behavior: classical
    url: https://example.com/google.yaml
    path: ./RuleSet/google.yaml
    interval: 86400
    format: mrs
rules:
  - MATCH,Auto
`)
    expect(imported.config).toBeNull()
    expect(imported.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'GROUP_FIELD_UNSUPPORTED',
      'GROUP_BUILTIN_UNSUPPORTED',
      'PROVIDER_FIELD_UNSUPPORTED',
    ]))
    expect(imported.errors.filter((issue) => issue.code === 'GROUP_FIELD_UNSUPPORTED')).toHaveLength(2)
  })

  it('旧 KV 中缺少备注字段的规则仍可正常生成', () => {
    const imported = importRoutingConfigYaml(completeYamlFixture())
    expect(imported.config).not.toBeNull()
    delete imported.config!.rules[0].remark
    const generated = generateRoutingYaml(imported.config!, {
      subscriptionNodes: [{ name: 'HK-01' }],
      selfNodes: [],
      output: 'trafficPackage',
      client: 'stash',
      globalExcludePattern: '',
    }).yaml
    expect(generated).not.toContain('# Google 服务')
    expect(YAML.parse(generated).rules).toHaveLength(2)
  })
})
