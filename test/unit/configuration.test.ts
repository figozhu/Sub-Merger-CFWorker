import { describe, expect, it } from 'vitest'
import { analyzeSelfNodes, normalizeSubscriptions } from '../../src/services/configuration'

describe('订阅源与自建节点校验', () => {
  it('允许清空订阅源，但拒绝非数组输入', () => {
    expect(normalizeSubscriptions([])).toEqual({ subscriptions: [], errors: [] })
    for (const input of [null, undefined, {}, '[]']) {
      expect(normalizeSubscriptions(input).errors[0].code).toBe('SUBSCRIPTIONS_NOT_ARRAY')
    }
  })

  it('订阅源去除首尾空格并只接受 HTTP(S)', () => {
    const result = normalizeSubscriptions([{ subName: ' 主力 ', subType: '包年/包月', subUrl: ' https://example.com/sub ' }])
    expect(result.errors).toEqual([])
    expect(result.subscriptions[0]).toEqual({ subName: '主力', subType: '包年/包月', subUrl: 'https://example.com/sub' })
    expect(normalizeSubscriptions([{ subName: 'x', subType: '包年/包月', subUrl: 'ftp://example.com' }]).errors[0].code).toBe('SUBSCRIPTION_URL_INVALID')
  })

  it('接受空自建节点数组并保留未知字段', () => {
    expect(analyzeSelfNodes('[]').valid).toBe(true)
    const raw = '[{"name":"节点A","plugin-extra":{"enabled":true}}]'
    expect(analyzeSelfNodes(raw).nodes[0]['plugin-extra']).toEqual({ enabled: true })
  })

  it('拒绝缺少名称和重复名称', () => {
    const analysis = analyzeSelfNodes('[{"name":"A"},{"name":"A"},{}]')
    expect(analysis.valid).toBe(false)
    expect(analysis.errors.map((issue) => issue.code)).toEqual(['SELF_NODE_NAME_DUPLICATE', 'SELF_NODE_NAME_REQUIRED'])
  })
})
