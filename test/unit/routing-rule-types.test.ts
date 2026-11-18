import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { importRoutingConfigYaml } from '../../src/config/routingMigration'
import type { RoutingConfig } from '../../src/types/routing'
import { generateRoutingYaml } from '../../src/utils/generateRoutingYaml'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'

/**
 * 独立记录官方路由规则文档中的全部 37 种类型，避免测试随生产端白名单一起遗漏类型。
 * 样例中的规则提供者、子规则和目标策略均由下方完整 YAML 提供。
 * 参考：https://wiki.metacubex.one/config/rules/
 */
const documentedRules = [
  'DOMAIN,example.com,节点选择',
  'DOMAIN-SUFFIX,example.com,节点选择',
  'DOMAIN-KEYWORD,example,节点选择',
  'DOMAIN-WILDCARD,*.example.com,节点选择',
  'DOMAIN-REGEX,^abc.*com,节点选择',
  'GEOSITE,youtube,节点选择',
  'IP-CIDR,127.0.0.0/8,节点选择',
  'IP-CIDR6,2620:0:2d0:200::7/32,节点选择',
  'IP-SUFFIX,8.8.8.8/24,节点选择',
  'IP-ASN,13335,节点选择',
  'GEOIP,CN,节点选择',
  'SRC-GEOIP,cn,节点选择',
  'SRC-IP-ASN,9808,节点选择',
  'SRC-IP-CIDR,192.168.1.201/32,节点选择',
  'SRC-IP-SUFFIX,192.168.1.201/8,节点选择',
  'DST-PORT,80,节点选择',
  'SRC-PORT,45000-45999,节点选择',
  'IN-PORT,7890,节点选择',
  'IN-TYPE,SOCKS/HTTP,节点选择',
  'IN-USER,mihomo/guest,节点选择',
  'IN-NAME,ss,节点选择',
  'REMATCH-NAME,rematch1,节点选择',
  String.raw`PROCESS-PATH,C:\Program Files\Google\Chrome\Application\chrome.exe,节点选择`,
  'PROCESS-PATH-WILDCARD,/usr/*/wget,节点选择',
  String.raw`PROCESS-PATH-REGEX,(?i).*Application\\chrome.*,节点选择`,
  'PROCESS-NAME,chrome.exe,节点选择',
  'PROCESS-NAME-WILDCARD,*telegram*,节点选择',
  'PROCESS-NAME-REGEX,(?i)Telegram,节点选择',
  'UID,1001,节点选择',
  'NETWORK,udp,节点选择',
  'DSCP,4,节点选择',
  'RULE-SET,example-rules,节点选择',
  'AND,((DOMAIN,example.com),(NETWORK,UDP)),节点选择',
  'OR,((NETWORK,UDP),(DOMAIN,example.com)),节点选择',
  'NOT,((DOMAIN,example.com)),节点选择',
  'SUB-RULE,(NETWORK,tcp),节点选择',
  'MATCH,节点选择',
] as const

/** 正则中的逗号、字符集括号和 Go 内联标志均属于匹配内容，不是规则字段分隔符。 */
const commaRegexRules = [
  ['DOMAIN-REGEX', '^a{1,3}$'],
  ['PROCESS-NAME-REGEX', '^(alpha,beta|worker[(),]){1,3}$'],
  ['PROCESS-PATH-REGEX', String.raw`(?i)^C:\\Apps\\(alpha,beta)[(),]\\worker{1,3}\.exe$`],
] as const

/**
 * 构造可直接发布的完整配置，子规则名称故意与策略组相同，以捕获错误的名称解析。
 * @param rules 有序规则文本；调用方负责提供最终 MATCH。
 * @returns 带有有效策略组、规则提供者和子规则的 YAML 文本。
 */
function completeYaml(rules: readonly string[]): string {
  return YAML.stringify({
    'mixed-port': 7890,
    'proxy-groups': [{ name: '节点选择', type: 'select', proxies: ['DIRECT'] }],
    'rule-providers': {
      'example-rules': {
        type: 'http', behavior: 'classical', url: 'https://example.test/rules.yaml',
        path: './rules/example.yaml', interval: 86400,
      },
    },
    'sub-rules': { '节点选择': ['DOMAIN-SUFFIX,example.com,DIRECT', 'MATCH,DIRECT'] },
    rules,
  })
}

/**
 * 从完整 YAML 导入并验证，失败时保留具体问题供测试报告定位。
 * @param rules 需要导入的完整有序规则数组。
 * @returns 已通过发布级校验的路由配置。
 */
function importValidRules(rules: readonly string[]): RoutingConfig {
  const imported = importRoutingConfigYaml(completeYaml(rules))
  expect(imported.errors).toEqual([])
  if (!imported.config) throw new Error('规则导入失败，未返回配置')
  expect(validateRoutingConfig(imported.config).errors).toEqual([])
  return imported.config
}

/**
 * 使用无订阅节点、带 DIRECT 成员的策略组生成实际订阅，覆盖空组清理后的最终文本。
 * @param config 已导入或编辑后的路由配置。
 * @returns 完整订阅 YAML 文本。
 */
function generate(config: RoutingConfig): string {
  return generateRoutingYaml(config, {
    subscriptionNodes: [], selfNodes: [], output: 'monthly', client: 'normal', globalExcludePattern: '',
  }).yaml
}

describe('Mihomo 官方规则类型的导入、校验和订阅输出', () => {
  it.each(documentedRules)('完整往返保留 %s', (rule) => {
    const rules = rule.startsWith('MATCH,') ? [rule] : [rule, 'MATCH,节点选择']
    const config = importValidRules(rules)
    const generated = generate(config)
    expect(YAML.parse(generated).rules).toEqual(rules)

    const importedAgain = importRoutingConfigYaml(generated)
    expect(importedAgain.errors).toEqual([])
    expect(importedAgain.config?.rules).toEqual(config.rules)
    expect(validateRoutingConfig(importedAgain.config).errors).toEqual([])
  })

  it('所有官方类型可同时存在于一份配置且保持优先级顺序', () => {
    const config = importValidRules(documentedRules)
    expect(config.rules).toHaveLength(37)
    expect(YAML.parse(generate(config)).rules).toEqual(documentedRules)
  })

  it.each(['45000-45999', '80/443/1000-2000'])('SRC-PORT 的端口范围 %s 原样写入订阅', (value) => {
    const rules = [`SRC-PORT,${value},节点选择`, 'MATCH,节点选择']
    const config = importValidRules(rules)
    expect(config.rules[0]).toMatchObject({ type: 'SRC-PORT', value })
    expect(YAML.parse(generate(config)).rules).toEqual(rules)
  })

  it('嵌套 AND、OR、NOT 中的逗号和 no-resolve 保持在匹配表达式内', () => {
    const value = '((OR,((DOMAIN,example.com),(NETWORK,UDP))),(NOT,((IP-CIDR,10.0.0.0/8,no-resolve))))'
    const rules = [`AND,${value},节点选择`, 'MATCH,节点选择']
    const config = importValidRules(rules)
    expect(config.rules[0]).toMatchObject({ type: 'AND', value, noResolve: false, legacyOptions: [] })
    expect(YAML.parse(generate(config)).rules).toEqual(rules)
  })

  it.each(commaRegexRules)('%s 中的逗号、括号和字符集经过生成及清理后完整保留', (type, value) => {
    const rules = [`${type},${value},节点选择`, 'MATCH,节点选择']
    const config = importValidRules(rules)
    expect(config.rules[0]).toMatchObject({ type, value, targetGroupId: config.groups[0].id })
    const generated = generate(config)
    expect(YAML.parse(generated).rules).toEqual(rules)

    const importedAgain = importRoutingConfigYaml(generated)
    expect(importedAgain.errors).toEqual([])
    expect(importedAgain.config?.rules).toEqual(config.rules)
  })

  it.each([
    ...commaRegexRules,
    ['AND', '((SRC-PORT,45000-45999),(OR,((NETWORK,UDP),(DOMAIN,example.com))))'],
  ] as const)('%s 目标策略组为空时只替换最终目标，匹配表达式保持原样', (type, value) => {
    const config = importValidRules([`${type},${value},节点选择`, 'MATCH,DIRECT'])
    config.groups[0].sources = [{
      id: 'missing-nodes', kind: 'filter', source: 'all', include: '^missing$', exclude: '', appliesTo: 'all',
    }]
    expect(validateRoutingConfig(config).errors).toEqual([])
    const originalRules = structuredClone(config.rules)
    const generated = YAML.parse(generate(config))

    expect(generated['proxy-groups']).toEqual([])
    expect(generated.rules).toEqual([`${type},${value},DIRECT`, 'MATCH,DIRECT'])
    expect(config.rules).toEqual(originalRules)
  })

  it('策略组改名只更新逻辑规则目标，不修改同名的 SUB-RULE 目标', () => {
    const config = importValidRules([
      'AND,((SRC-PORT,45000-45999),(NETWORK,UDP)),节点选择',
      'SUB-RULE,(NETWORK,tcp),节点选择',
      'MATCH,节点选择',
    ])
    expect(config.rules[1]).toMatchObject({ type: 'SUB-RULE', subRuleName: '节点选择', targetGroupId: '' })
    config.groups[0].name = '新的策略组'
    expect(validateRoutingConfig(config).errors).toEqual([])

    const generated = YAML.parse(generate(config))
    expect(generated.rules).toEqual([
      'AND,((SRC-PORT,45000-45999),(NETWORK,UDP)),新的策略组',
      'SUB-RULE,(NETWORK,tcp),节点选择',
      'MATCH,新的策略组',
    ])
    expect(generated['sub-rules']).toEqual({ '节点选择': ['DOMAIN-SUFFIX,example.com,DIRECT', 'MATCH,DIRECT'] })
  })

  it('目标 IP 规则的 no-resolve 和 src 分别恢复到可编辑字段并重新输出', () => {
    const rules = ['IP-CIDR,192.168.0.0/16,节点选择,no-resolve,src', 'MATCH,节点选择']
    const config = importValidRules(rules)
    expect(config.rules[0]).toMatchObject({ noResolve: true, matchSource: true })
    expect(YAML.parse(generate(config)).rules).toEqual(rules)
  })

  it('兼容旧草稿在 legacyOptions 中保存的 src 参数', () => {
    const config = importValidRules(['IP-CIDR,192.168.0.0/16,节点选择', 'MATCH,节点选择'])
    config.rules[0].legacyOptions = ['src']
    expect(validateRoutingConfig(config).errors).toEqual([])
    expect(YAML.parse(generate(config)).rules).toEqual([
      'IP-CIDR,192.168.0.0/16,节点选择,src', 'MATCH,节点选择',
    ])
  })
})
