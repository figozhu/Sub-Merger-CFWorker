import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSubscription, getSubscribeYaml, getSubscriptionUserAgent, MAX_SUBSCRIPTION_BYTES, SUBSCRIPTION_TIMEOUT_MS } from '../../src/utils/getSubscribeYaml'
import { parseSubscriptionContent } from '../../src/utils/getProxyNodeFromyaml'
import { listErrorLogs, writeErrorLog } from '../../src/services/errorLogs'
import { SubscriptionType } from '../../src/types/types'
import { MockKV, createTestEnv } from '../helpers/mockKv'

const source = { subName: '测试源', subType: SubscriptionType.Monthly, subUrl: 'https://provider.example/sub?token=private-test-token' }
const yaml = 'proxies:\n  - name: 测试节点\n    type: anytls\n    server: example.com\n    port: 443\n    password: private-node-password\n'

describe('订阅抓取诊断与日志', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('空值使用代码默认 UA，明确填写的自定义值均被保留', () => {
    expect(getSubscriptionUserAgent()).toBe('Clash.Meta')
    expect(getSubscriptionUserAgent('   ')).toBe('Clash.Meta')
    expect(getSubscriptionUserAgent(' clash-verge/v1.7.7 ')).toBe('clash-verge/v1.7.7')
    expect(getSubscriptionUserAgent('custom-client/3')).toBe('custom-client/3')
  })

  it('错误 HTML MIME 的正常 YAML 仍可解析，保留新协议，诊断显式旧 UA 不被迁移', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(yaml, { headers: { 'content-type': 'text/html; charset=UTF-8', 'subscription-userinfo': 'upload=10; download=20; total=1000' } }))
    const env = createTestEnv()
    env.UA = 'clash-verge/v1.7.7'
    const result = await fetchSubscription(source, env, { diagnostic: true })
    expect(result.ok).toBe(true)
    expect(result.nodes[0]).toMatchObject({ name: '测试节点【测试源】', type: 'anytls' })
    expect(result.userInfo.upload).toBe(10)
    expect(result.diagnostic).toMatchObject({ code: 'FETCH_OK', nodeCount: 1, sourceHost: 'provider.example' })
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ accept: '*/*', 'User-Agent': 'Clash.Meta' })
    fetchMock.mockResolvedValueOnce(new Response(yaml))
    const old = await fetchSubscription(source, env, { diagnostic: true, userAgent: 'clash-verge/v1.7.7' })
    expect(old.diagnostic.userAgent).toBe('clash-verge/v1.7.7')
  })

  it('HTTP 200 的升级提示伪节点被识别为失败', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('proxies:\n - name: 请将 Clash Verge Rev 升级到 2.4.1 或以上版本\n   type: ss\n - name: 你现在的版本是 1.7.7，连不上线路\n   type: ss\n'))
    const result = await fetchSubscription(source, createTestEnv(), { diagnostic: true })
    expect(result).toMatchObject({ ok: false, nodes: [], diagnostic: { httpStatus: 200, code: 'CLIENT_UPGRADE_REQUIRED' } })
  })

  it.each([
    ['', 'EMPTY_RESPONSE'],
    ['<!doctype html><html>登录页</html>', 'HTML_RESPONSE'],
    ['dmxlc3M6Ly9leGFtcGxl', 'UNSUPPORTED_FORMAT'],
    ['vless://example', 'UNSUPPORTED_FORMAT'],
    ['proxies: []', 'NO_PROXIES'],
    ['rules: []', 'NO_PROXIES'],
    ['proxies: [null]', 'INVALID_PROXIES'],
  ])('明确分类异常响应 %s', (content, code) => {
    expect(parseSubscriptionContent(content).code).toBe(code)
  })

  it('YAML 语法错误仅记录分类和行号，不泄露原文、节点密码与 token', async () => {
    const content = 'proxies:\n - name: 测试\n   password: private-node-password\n   password: token=private-test-token\n'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(content))
    const kv = new MockKV()
    const result = await fetchSubscription(source, createTestEnv(kv), { diagnostic: true })
    expect(result.diagnostic).toMatchObject({ code: 'INVALID_YAML', parserCode: 'DUPLICATE_KEY', parserLine: 4 })
    const output = JSON.stringify([...kv.values.values()]) + JSON.stringify(result) + JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(output).not.toMatch(/private-test-token|private-node-password|provider\.example\/sub/)
  })

  it.each([[403, {}, 'HTTP_ERROR'], [200, { 'cf-mitigated': 'challenge', 'cf-ray': 'test-ray' }, 'CLOUDFLARE_CHALLENGE'], [429, {}, 'HTTP_ERROR']])('记录 HTTP %s 和 WAF/限速线索', async (status, headers, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>denied</html>', { status: Number(status), headers: headers as Record<string, string> }))
    const result = await fetchSubscription(source, createTestEnv(), { diagnostic: true })
    expect(result.diagnostic.code).toBe(code)
    expect(result.diagnostic.httpStatus).toBe(status)
    expect(result.ok).toBe(false)
  })

  it('原始网络异常含完整 URL 时不会进入日志或即时诊断响应', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch ' + source.subUrl))
    const kv = new MockKV()
    const result = await fetchSubscription({ ...source, subName: source.subUrl }, createTestEnv(kv), { diagnostic: true })
    expect(result.diagnostic).toMatchObject({ code: 'NETWORK_ERROR', errorName: 'TypeError', sourceName: '[链接已隐藏]' })
    expect(JSON.stringify(result) + JSON.stringify([...kv.values.values()])).not.toContain('private-test-token')
  })

  it('响应头等待超过 20 秒会中止并记录 TIMEOUT', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const pending = fetchSubscription(source, createTestEnv(), { diagnostic: true })
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_TIMEOUT_MS + 1)
    expect((await pending).diagnostic.code).toBe('TIMEOUT')
  })

  it('上游返回响应头后卡住响应体，同样受总超时约束', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ cancel })))
    const pending = fetchSubscription(source, createTestEnv(), { diagnostic: true })
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_TIMEOUT_MS + 1)
    expect((await pending).diagnostic.code).toBe('TIMEOUT')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('超大流式响应会取消读取，不进入 YAML 解析', async () => {
    const cancel = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_SUBSCRIPTION_BYTES + 1)) }, cancel })))
    const result = await fetchSubscription(source, createTestEnv(), { diagnostic: true })
    expect(result.diagnostic.code).toBe('RESPONSE_TOO_LARGE')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('底层流取消不完成时，不会延长已触发的总超时', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ cancel() { return new Promise(() => {}) } })))
    const pending = fetchSubscription(source, createTestEnv(), { diagnostic: true })
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_TIMEOUT_MS + 1)
    expect((await pending).diagnostic.code).toBe('TIMEOUT')
  })

  it('日志 KV 写入失败不使成功诊断变成抓取失败', async () => {
    const kv = new MockKV()
    vi.spyOn(kv, 'put').mockRejectedValue(new Error('quota exceeded'))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(yaml))
    const result = await fetchSubscription(source, createTestEnv(kv), { diagnostic: true })
    expect(result.ok).toBe(true)
  })

  it('聚合只累加成功源，保留失败数量供缓存层决策', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(yaml, { headers: { 'subscription-userinfo': 'total=1000' } })).mockResolvedValueOnce(new Response('denied', { status: 403 }))
    const [info, nodes, summary] = await getSubscribeYaml([source, { ...source, subName: '失败源' }], createTestEnv())
    expect(info.total).toBe(1000)
    expect(nodes).toHaveLength(1)
    expect(summary.failedCount).toBe(1)
  })

  it('日志按新到旧分页、独立写键且保留 7 天', async () => {
    vi.useFakeTimers()
    const kv = new MockKV()
    const env = createTestEnv(kv)
    for (let index = 0; index < 53; index++) {
      vi.setSystemTime(new Date(2026, 9, 19, 12, 0, index))
      await writeErrorLog(env, { level: 'error', scope: 'subscription', code: 'HTTP_ERROR', message: '请求失败', sourceName: String(index) })
    }
    const first = await listErrorLogs(env)
    const second = await listErrorLogs(env, first.cursor)
    expect(first.logs).toHaveLength(50)
    expect(first.logs[0].sourceName).toBe('52')
    expect(second.logs.map((item) => item.sourceName)).toEqual(['2', '1', '0'])
    expect(second.cursor).toBe('')
    expect([...kv.putOptions.values()].every((options) => options.expirationTtl === 604800)).toBe(true)
  })
})
