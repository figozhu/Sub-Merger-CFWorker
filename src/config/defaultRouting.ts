import YAML from 'yaml'
import { getDefaultYamlString, type StoredYamlDocument } from '../data/defaultYmal'
import type { RoutingConfig } from '../types/routing'
import { createLegacyProxyGroups, importRoutingConfigYaml } from './routingMigration'

/** 已知历史组名仅用于识别旧接口导入的模板，绝不加入新安装的默认分组。 */
const legacyGroupNames = new Set([...createLegacyProxyGroups({}).map((group) => group.name), '泰国节点'])

/**
 * 为新安装创建独立、可编辑的通用路由配置。
 * 复用 YAML 导入器保留规则备注和稳定引用；代理来源动态涵盖订阅及自建节点。
 * 不添加 DIRECT 作为代理组兜底：无可用节点时沿用现有裁剪与 REJECT 容错行为。
 * @param yaml 通用模板原文；旧配置接口修改 DNS 或规则后仍沿用这两个策略组。
 * @returns 仅有“直连”和“代理”的新配置对象；不会读写 KV 或自动发布。
 * @throws 内置 YAML 无法导入时明确报错，防止生成不完整的默认配置。
 */
export function createDefaultRoutingConfig(yaml = getDefaultYamlString()): RoutingConfig {
  const imported = importRoutingConfigYaml(`proxy-groups:
  - name: 直连
    type: select
    proxies: [DIRECT]
  - name: 代理
    type: select
    proxies: []
${yaml}`)
  if (!imported.config || imported.errors.length > 0) {
    throw new Error(`通用默认路由配置无效：${imported.errors.map((issue) => issue.message).join('；')}`)
  }
  imported.config.groups[1].sources = [{
    id: 'default-all-proxies', kind: 'filter', source: 'all',
    include: '', exclude: '', appliesTo: 'all', when: 'always',
  }]
  return imported.config
}

/**
 * 判断未发布配置是否应使用通用默认值。
 * 显式模式优先；未带模式的新两组模板通过规则目标识别，兼容旧接口首次保存及格式化。
 * 历史模板中引用旧分组或直接节点的记录仍保留旧生成路径，不修改已有配置。
 * @param stored 旧 KV 模板及模式，null 表示未保存。
 * @returns 是否使用通用两组生成器；无效 YAML 返回 false，由原迁移流程报告错误。
 */
export function usesDefaultRouting(stored: StoredYamlDocument | null): boolean {
  if (stored === null) return true
  if (stored.routingMode) return stored.routingMode === 'default'
  return detectRoutingTemplateMode(stored.yaml) === 'default'
}

/**
 * 从本次提交的规则目标判断用户是否切换了模板类型。
 * 明确引用历史组时使用旧生成器；引用新两组时使用通用生成器。
 * 仅含 DIRECT、REJECT、直接节点等无法确定来源的模板交由调用方沿用已保存模式。
 * @param yaml 待保存或尚未标记来源的模板文本。
 * @returns 可确定的生成模式；损坏或没有明确组目标的 YAML 返回 null。
 */
export function detectRoutingTemplateMode(yaml: string): 'default' | 'legacy' | null {
  try {
    const root = YAML.parse(yaml)
    if (!Array.isArray(root?.rules)) return null
    const targets = root.rules.map((rule: unknown) => {
      if (typeof rule !== 'string') return ''
      const fields = rule.split(',').map((field) => field.trim())
      return fields[fields[0] === 'MATCH' ? 1 : 2]
    })
    if (targets.some((target: string) => legacyGroupNames.has(target))) return 'legacy'
    return targets.some((target: string) => target === '直连' || target === '代理') ? 'default' : null
  } catch {
    return null
  }
}
