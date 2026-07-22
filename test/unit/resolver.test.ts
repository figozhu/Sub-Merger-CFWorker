import { describe, expect, it } from 'vitest'
import { resolveProxyGroups } from '../../src/utils/resolveProxyGroups'
import type { RoutingConfig } from '../../src/types/routing'

describe('resolveProxyGroups', () => {
  it('按范围、适用输出、包含/排除正则和来源顺序稳定去重', () => {
    const config: RoutingConfig = {
      schemaVersion: 1, baseYaml: '', providers: [], rules: [],
      groups: [{
        id: 'g', name: '节点选择', type: 'select', enabled: true,
        sources: [
          { id: 's1', kind: 'filter', source: 'subscription', include: 'JP|US', exclude: '实验', appliesTo: 'monthly' },
          { id: 's2', kind: 'filter', source: 'all', include: 'JP', exclude: '', appliesTo: 'all' },
          { id: 's3', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' },
        ],
      }],
    }
    const resolved = resolveProxyGroups(config, {
      subscriptionNodes: [{ name: 'JP-1' }, { name: 'US-实验' }, { name: 'US-1' }],
      selfNodes: [{ name: 'JP-SELF【自建】' }], output: 'monthly', client: 'normal', globalExcludePattern: '',
    })
    expect(resolved.groups[0].proxies).toEqual(['JP-1', 'US-1', 'JP-SELF【自建】', 'DIRECT'])
  })

  it('把稳定 groupId 解析成最新组名并应用自建节点条件', () => {
    const config: RoutingConfig = {
      schemaVersion: 1, baseYaml: '', providers: [], rules: [],
      groups: [
        { id: 'a', name: '新名称', type: 'select', enabled: true, sources: [{ id: 'a1', kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }] },
        { id: 'b', name: '条件组', type: 'select', enabled: true, visibility: 'withSelfNodes', sources: [{ id: 'b1', kind: 'group', groupId: 'a', appliesTo: 'all' }] },
      ],
    }
    expect(resolveProxyGroups(config, { subscriptionNodes: [], selfNodes: [], output: 'monthly', client: 'normal' }).groups.map((group) => group.name)).toEqual(['新名称'])
    expect(resolveProxyGroups(config, { subscriptionNodes: [], selfNodes: [{ name: '自建【自建】' }], output: 'monthly', client: 'normal' }).groups[1].proxies).toEqual(['新名称'])
  })
})
