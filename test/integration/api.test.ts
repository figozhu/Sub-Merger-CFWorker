import { afterEach, describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import { app } from '../../src/index'
import type { RoutingConfig } from '../../src/types/routing'
import { generatePasswordHash } from '../../src/utils/passwordMgr'
import { MockKV, createTestEnv } from '../helpers/mockKv'

/** 创建带有效认证 Cookie 的 JSON 请求头。 */
function authHeaders(env: any): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Cookie: 'auth=' + generatePasswordHash(env.PASSWORD, env.SALT),
  }
}

/** 最小合法路由配置，用于草稿/发布 API 回归。 */
function validRoutingConfig(): any {
  return {
    schemaVersion: 1,
    baseYaml: 'mixed-port: 7890\n',
    groups: [{ id: 'main', name: '节点选择', type: 'select', enabled: true, sources: [{ id: 'direct', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }] }],
    providers: [],
    rules: [{ id: 'match', enabled: true, category: 'general', type: 'MATCH', targetGroupId: 'main', noResolve: false }],
  }
}

describe('管理 API 与 KV 行为', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未登录 API 返回 JSON 401，HTML 页面重定向', async () => {
    const env = createTestEnv()
    const apiResponse = await app.request('/api/subscriptions', {}, env)
    expect(apiResponse.status).toBe(401)
    expect(((await apiResponse.json()) as any).code).toBe(1)
    const pageResponse = await app.request('/dashboard', {}, env)
    expect(pageResponse.status).toBe(302)
  })

  it('登录 Cookie 保持安全属性且错误密码不能进入', async () => {
    const env = createTestEnv()
    const failed = await app.request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) }, env)
    expect(failed.status).toBe(401)
    const success = await app.request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: env.PASSWORD }) }, env)
    const cookie = success.headers.get('set-cookie') || ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
  })

  it('保存订阅源写 KV 并清理两类缓存', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    const response = await app.request('/api/subscriptions', {
      method: 'PUT', headers: authHeaders(env),
      body: JSON.stringify({ subscriptions: [{ subName: ' 主力 ', subType: '包年/包月', subUrl: 'https://example.com/sub' }] }),
    }, env)
    expect(response.status).toBe(200)
    expect(JSON.parse(kv.values.get(env.TABLENAME) || '[]')[0].subName).toBe('主力')
    expect(kv.deleted).toEqual(expect.arrayContaining([
      'test-sub:1:cacheObj:包年/包月', 'test-sub:1:cacheObj:流量包',
    ]))
  })

  it('保存合法空自建节点走独立键，无效 JSON 不覆盖', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    const valid = await app.request('/api/self-nodes', { method: 'PUT', headers: authHeaders(env), body: JSON.stringify({ raw: '[]' }) }, env)
    expect(valid.status).toBe(200)
    const before = kv.values.get('test-sub:self-nodes')
    const invalid = await app.request('/api/self-nodes', { method: 'PUT', headers: authHeaders(env), body: JSON.stringify({ raw: '{bad' }) }, env)
    expect(invalid.status).toBe(422)
    expect(kv.values.get('test-sub:self-nodes')).toBe(before)
  })

  it('保存草稿不清缓存，发布递增修订并清缓存，过期修订返回 409', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    const config = validRoutingConfig()
    const draft = await app.request('/api/routing-config/draft', { method: 'PUT', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }) }, env)
    expect(draft.status).toBe(200)
    expect(kv.deleted).toEqual([])
    expect(kv.values.has('test-sub:routing:published')).toBe(false)

    const published = await app.request('/api/routing-config/publish', { method: 'POST', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }) }, env)
    expect(published.status).toBe(200)
    expect(((await published.json()) as any).data.revision).toBe(1)
    expect(kv.deleted.length).toBe(2)

    const stale = await app.request('/api/routing-config/publish', { method: 'POST', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }) }, env)
    expect(stale.status).toBe(409)
    expect(JSON.parse(kv.values.get('test-sub:routing:published') || '{}').revision).toBe(1)
  })

  it('新增 SRC-PORT、正则、逻辑和子规则经草稿与发布后出现在真实订阅端点', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    // 显式设置空节点池，只验证管理 API 到最终规则输出的链路，不抓取任何外部订阅。
    kv.values.set(env.TABLENAME, '[]')
    kv.values.set('test-sub:self-nodes', JSON.stringify({ raw: '[]' }))
    const config: RoutingConfig = validRoutingConfig()
    config.baseYaml += 'sub-rules:\n  local:\n    - SRC-PORT,53,DIRECT\n    - MATCH,DIRECT\n'
    config.rules.unshift(
      { id: 'port', enabled: true, category: 'general', type: 'SRC-PORT', value: '45000-45999', targetGroupId: 'main', noResolve: false },
      { id: 'regex', enabled: true, category: 'general', type: 'DOMAIN-REGEX', value: '^a{1,3}\\.example$', targetGroupId: 'main', noResolve: false },
      { id: 'logic', enabled: true, category: 'general', type: 'AND', value: '((SRC-PORT,80/443),(NETWORK,UDP))', targetGroupId: 'main', noResolve: false },
      { id: 'sub', enabled: true, category: 'general', type: 'SUB-RULE', value: '(NETWORK,tcp)', subRuleName: 'local', targetGroupId: '', noResolve: false },
    )

    const draft = await app.request('/api/routing-config/draft', {
      method: 'PUT', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }),
    }, env)
    expect(draft.status).toBe(200)
    expect(JSON.parse(kv.values.get('test-sub:routing:draft') || '{}').config.rules).toEqual(config.rules)
    expect(kv.values.has('test-sub:routing:published')).toBe(false)
    expect(kv.deleted).toEqual([])

    const loaded = await app.request('/api/routing-config', { headers: authHeaders(env) }, env)
    expect(loaded.status).toBe(200)
    expect(((await loaded.json()) as { data: { config: RoutingConfig } }).data.config).toEqual(config)

    const published = await app.request('/api/routing-config/publish', {
      method: 'POST', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }),
    }, env)
    expect(published.status).toBe(200)
    expect(JSON.parse(kv.values.get('test-sub:routing:published') || '{}')).toMatchObject({ revision: 1, config })
    expect(kv.deleted).toEqual(expect.arrayContaining(['test-sub:1:cacheObj:包年/包月', 'test-sub:1:cacheObj:流量包']))

    for (const endpoint of ['/subscribe/magic-key', '/onetime/magic-key']) {
      for (const userAgent of ['Clash.Meta', 'Stash/2.6']) {
        const response = await app.request(endpoint, { headers: { 'User-Agent': userAgent } }, env)
        expect(response.status).toBe(200)
        const document = YAML.parse(await response.text())
        expect(document.rules).toEqual([
          'SRC-PORT,45000-45999,节点选择',
          'DOMAIN-REGEX,^a{1,3}\\.example$,节点选择',
          'AND,((SRC-PORT,80/443),(NETWORK,UDP)),节点选择',
          'SUB-RULE,(NETWORK,tcp),local',
          'MATCH,节点选择',
        ])
        expect(document['sub-rules']).toEqual({ local: ['SRC-PORT,53,DIRECT', 'MATCH,DIRECT'] })
      }
    }
  })

  it('非法 SRC-PORT 可以暂存草稿，但发布被阻止且上一版订阅继续生效', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    kv.values.set(env.TABLENAME, '[]')
    kv.values.set('test-sub:self-nodes', JSON.stringify({ raw: '[]' }))
    const config: RoutingConfig = validRoutingConfig()
    const firstPublish = await app.request('/api/routing-config/publish', {
      method: 'POST', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 0 }),
    }, env)
    expect(firstPublish.status).toBe(200)
    const previousPublished = kv.values.get('test-sub:routing:published')
    const clearedBefore = [...kv.deleted]
    config.rules.unshift({
      id: 'invalid-port', enabled: true, category: 'general', type: 'SRC-PORT', value: '70000', targetGroupId: 'main', noResolve: false,
    })
    const draft = await app.request('/api/routing-config/draft', {
      method: 'PUT', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 1 }),
    }, env)
    expect(draft.status).toBe(200)

    const rejected = await app.request('/api/routing-config/publish', {
      method: 'POST', headers: authHeaders(env), body: JSON.stringify({ config, baseRevision: 1 }),
    }, env)
    expect(rejected.status).toBe(422)
    expect(await rejected.json()).toMatchObject({ errors: [{ code: 'RULE_VALUE_INVALID', path: 'rules[0].value' }] })
    expect(kv.values.get('test-sub:routing:published')).toBe(previousPublished)
    expect(kv.deleted).toEqual(clearedBefore)
    const subscription = await app.request('/subscribe/magic-key', { headers: { 'User-Agent': 'Clash.Meta' } }, env)
    expect(subscription.status).toBe(200)
    expect(YAML.parse(await subscription.text()).rules).toEqual(['MATCH,节点选择'])
  })

  it('输出信息使用当前域名、MAGIC 和真实订阅源数量', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    kv.values.set(env.TABLENAME, JSON.stringify([
      { subName: '月付', subType: '包年/包月', subUrl: 'https://example.com/a' },
      { subName: '流量', subType: '流量包', subUrl: 'https://example.com/b' },
    ]))
    const response = await app.request('https://worker.example/api/outputs', { headers: authHeaders(env) }, env)
    const data = ((await response.json()) as any).data.outputs
    expect(data[0]).toMatchObject({ sourceCount: 1, url: 'https://worker.example/subscribe/magic-key' })
    expect(data[1]).toMatchObject({ sourceCount: 1, url: 'https://worker.example/onetime/magic-key' })
  })

  it('完整 YAML 导入会拆分四类数据、返回汇总并保留规则备注', async () => {
    const env = createTestEnv()
    const response = await app.request('/api/routing-config/import', {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({ yaml: `
mixed-port: 7890
proxy-groups:
  - name: 节点选择
    type: select
    proxies: [DIRECT]
rule-providers: {}
rules:
  # 最终兜底
  - MATCH,节点选择
` }),
    }, env)
    expect(response.status).toBe(200)
    const data = ((await response.json()) as any).data
    expect(data.summary).toEqual({ groups: 1, providers: 0, rules: 1, baseFields: 1 })
    expect(data.config.rules[0].remark).toBe('最终兜底')
    expect(YAML.parse(data.config.baseYaml)).toEqual({ 'mixed-port': 7890 })
  })

  it('完整 YAML 导入对所有不支持字段一次性报错，不静默删配置', async () => {
    const env = createTestEnv()
    const response = await app.request('/api/routing-config/import', {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify({ yaml: `
proxy-groups:
  - name: Auto
    type: url-test
    use: [airport]
    filter: HK
    proxies: [REJECT]
    url: https://www.gstatic.com/generate_204
    interval: 300
rules:
  - MATCH,Auto
` }),
    }, env)
    expect(response.status).toBe(422)
    const result = (await response.json()) as any
    expect(result.errors).toHaveLength(3)
    expect(result.errors.map((issue: any) => issue.code)).toEqual(expect.arrayContaining([
      'GROUP_FIELD_UNSUPPORTED', 'GROUP_BUILTIN_UNSUPPORTED',
    ]))
  })

  it('公开订阅端点保留鉴权、流量头、缓存与客户端分流', async () => {
    const kv = new MockKV()
    const env = createTestEnv(kv)
    kv.values.set(env.TABLENAME, JSON.stringify([
      { subName: '主力', subType: '包年/包月', subUrl: 'https://provider.example/subscription' },
    ]))
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response([
        'proxies:',
        '  - name: 香港 01',
        '    type: ss',
        '    server: 192.0.2.1',
        '    port: 443',
        '    cipher: aes-128-gcm',
        '    password: test-only',
      ].join('\n'), {
        status: 200,
        headers: { 'subscription-userinfo': 'upload=10; download=20; total=1000; expire=9999999999' },
      }))

    const forbidden = await app.request('/subscribe/wrong', {}, env)
    expect(forbidden.status).toBe(403)

    const normal = await app.request('/subscribe/magic-key', { headers: { 'User-Agent': 'Clash Verge' } }, env)
    expect(normal.status).toBe(200)
    expect(normal.headers.get('subscription-userinfo')).toContain('upload=10')
    expect(normal.headers.get('content-disposition')).toContain('filename*=UTF-8')
    expect(await normal.text()).toContain('# 最后更新时间（通用）')
    expect(kv.values.has('test-sub:1:cacheObj:包年/包月')).toBe(true)

    const stash = await app.request('/subscribe/magic-key', { headers: { 'User-Agent': 'Stash/2.6' } }, env)
    expect(stash.status).toBe(200)
    expect(await stash.text()).toContain('# 最后更新时间（Stash）')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
