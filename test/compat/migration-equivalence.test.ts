import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import generateLegacyProxyConfigYaml from '../../src/utils/generateProxyConfigYaml'
import { generateRoutingYamlVariants } from '../../src/utils/generateRoutingYaml'
import { createLegacyRoutingConfig } from '../../src/config/routingMigration'
import { getDefaultYamlString } from '../../src/data/defaultYmal'
import { getSelfNodeData } from '../../src/data/selfNodeData'
import { validateRoutingConfig } from '../../src/utils/validateRoutingConfig'
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
  it('默认旧配置可以生成可发布的 schemaVersion=1 草稿', () => {
    const env = createTestEnv()
    configurePatterns(env)
    const migration = createLegacyRoutingConfig(getDefaultYamlString(), env)
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
            defaultYaml: getDefaultYamlString(),
          }))
        }
        const patterns = output === 'monthly' ? env.SUBSCRIBE_PATTERN : env.ONETIME_PATTERN
        const legacy = await generateLegacyProxyConfigYaml(fixtureNodes(), patterns, env)
        const migration = createLegacyRoutingConfig(getDefaultYamlString(), env)
        expect(migration.errors).toEqual([])
        const selfNodes = await getSelfNodeData(env)
        const dynamic = generateRoutingYamlVariants(migration.config!, fixtureNodes(), selfNodes, output, patterns.EXCLUDE_PATTERN)
        expect(parsed(dynamic.normalYaml)).toEqual(parsed(legacy.normalYaml + getDefaultYamlString()))
        expect(parsed(dynamic.stashYaml)).toEqual(parsed(legacy.stashYaml + getDefaultYamlString()))
      })
    }
  }
})
