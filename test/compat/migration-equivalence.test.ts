import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import generateLegacyProxyConfigYaml from '../../src/utils/generateProxyConfigYaml'
import { generateRoutingYamlVariants } from '../../src/utils/generateRoutingYaml'
import { createLegacyProxyGroups, createLegacyRoutingConfig } from '../../src/config/routingMigration'
import { legacyDefaultYaml } from '../fixtures/legacyRouting'
import { getSelfNodeData } from '../../src/data/selfNodeData'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
import { sanitizeProxyGroupYaml } from '../../src/utils/pruneEmptyProxyGroups'
import { MockKV, createTestEnv } from '../helpers/mockKv'

/** 创建能覆盖全局排除、各主要组、同名节点和自建节点的固定输入。 */
function fixtureNodes(): any[] {
  return [
    { name: 'JP-普通', type: 'ss', server: 'jp.example', port: 1 },
    { name: 'US-AI', type: 'vmess', server: 'ai.example', port: 2 },
    { name: 'SG-TG', type: 'trojan', server: 'tg.example', port: 3 },
    { name: '套餐剩余流量', type: 'ss', server: 'meta.example', port: 4 },
    { name: 'JP-普通', type: 'ss', server: 'duplicate.example', port: 5 },
  ]
}

/** 设置与旧生成器字段完全对应的正则，包月和流量包可独立传入。 */
function configurePatterns(env: any): void {
  ;[env.SUBSCRIBE_PATTERN, env.ONETIME_PATTERN].forEach((patterns) => {
    Object.assign(patterns, {
      EXCLUDE_PATTERN: '套餐|剩余流量', OTHER_MATCH_PATTERN: 'JP', AI_MATCH_PATTERN: 'AI',
      TELEGRAM_MATCH_PATTERN: 'TG', PROXY_MATCH_PATTERN: 'JP|US', FALLBACK_MATCH_PATTERN: 'JP',
    })
  })
}

/** 去掉对象属性顺序和 YAML 格式差异后比较完整语义。 */
function parsed(yaml: string): unknown {
  return YAML.parse(yaml)
}

describe('旧配置迁移语义兼容', () => {
  it('兼容旧模板中的 EXIT 和 TAIGUO 正则变量名', () => {
    const env = createTestEnv()
    ;[env.SUBSCRIBE_PATTERN, env.ONETIME_PATTERN].forEach((patterns) => {
      delete patterns.AI_MATCH_PATTERN
      delete patterns.AI_EXCLUDE_PATTERN
      delete patterns.ETHERFI_MATCH_PATTERN
      delete patterns.ETHERFI_EXCLUDE_PATTERN
      patterns.EXIT_MATCH_PATTERN = 'OLD-AI'
      patterns.EXIT_EXCLUDE_PATTERN = 'SKIP-AI'
      patterns.TAIGUO_MATCH_PATTERN = 'OLD-TH'
      patterns.TAIGUO_EXCLUDE_PATTERN = 'SKIP-TH'
    })

    const groups = createLegacyProxyGroups(env)
    const aiSource = groups.find((group) => group.name === '海外AI')?.sources[0]
    const etherFiSource = groups.find((group) => group.name === 'EtherFi')?.sources[0]
    expect(aiSource).toMatchObject({ kind: 'filter', include: 'OLD-AI', exclude: 'SKIP-AI' })
    expect(etherFiSource).toMatchObject({ kind: 'filter', include: 'OLD-TH', exclude: 'SKIP-TH' })
  })

  it('把历史“泰国节点”策略组目标迁移到重命名后的 EtherFi', () => {
    const env = createTestEnv()
    configurePatterns(env)
    const migration = createLegacyRoutingConfig(`
rules:
  - DOMAIN-SUFFIX,ether.fi,泰国节点,no-resolve
  - MATCH,其它流量
`, env)

    expect(migration.errors).toEqual([])
    const etherFiGroup = migration.config?.groups.find((group) => group.name === 'EtherFi')
    expect(migration.config?.rules[0].targetGroupId).toBe(etherFiGroup?.id)
    expect(validateRoutingConfig(migration.config).errors).toEqual([])

    const generated = generateRoutingYamlVariants(migration.config!, fixtureNodes(), [], 'monthly', '').normalYaml
    expect(YAML.parse(generated).rules).toEqual([
      'DOMAIN-SUFFIX,ether.fi,EtherFi,no-resolve',
      'MATCH,其它流量',
    ])
  })

  it('默认旧配置可以生成可发布的 schemaVersion=1 草稿', () => {
    const env = createTestEnv()
    configurePatterns(env)
    const migration = createLegacyRoutingConfig(legacyDefaultYaml, env)
    expect(migration.errors).toEqual([])
    expect(validateRoutingConfig(migration.config).errors).toEqual([])
  })

  for (const withSelfNodes of [false, true]) {
    for (const output of ['monthly', 'trafficPackage'] as const) {
      it((withSelfNodes ? '有' : '无') + '自建节点 · ' + output + ' · 通用/Stash 与旧生成器等价', async () => {
        const kv = new MockKV()
        const env = createTestEnv(kv)
        configurePatterns(env)
        if (withSelfNodes) {
          kv.values.set('test-sub:config', JSON.stringify({
            selfNodeData: JSON.stringify([{ name: 'SELF-JP', type: 'ss', server: 'self.example', port: 9 }]),
            defaultYaml: legacyDefaultYaml,
          }))
        }
        const patterns = output === 'monthly' ? env.SUBSCRIBE_PATTERN : env.ONETIME_PATTERN
        const legacy = await generateLegacyProxyConfigYaml(fixtureNodes(), patterns, env)
        const migration = createLegacyRoutingConfig(legacyDefaultYaml, env)
        expect(migration.errors).toEqual([])
        const selfNodes = await getSelfNodeData(env)
        const dynamic = generateRoutingYamlVariants(migration.config!, fixtureNodes(), selfNodes, output, patterns.EXCLUDE_PATTERN)
        expect(parsed(dynamic.normalYaml)).toEqual(parsed(sanitizeProxyGroupYaml(legacy.normalYaml + legacyDefaultYaml)))
        expect(parsed(dynamic.stashYaml)).toEqual(parsed(sanitizeProxyGroupYaml(legacy.stashYaml + legacyDefaultYaml)))
      })
    }
  }
})
