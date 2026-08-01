/** 旧 YAML 中“直接指向节点名称”的规则目标使用的稳定前缀。 */
export const LEGACY_RULE_TARGET_PREFIX = 'legacy-target:'

/**
 * 将旧规则里的直接节点名称包装为不会与策略组 ID 混淆的目标 ID。
 *
 * @param targetName Clash 规则中原样出现的策略或节点名称。
 * @returns 带有兼容前缀、可安全写入 RoutingConfig 的目标 ID。
 */
export function createLegacyRuleTarget(targetName: string): string {
  return `${LEGACY_RULE_TARGET_PREFIX}${targetName}`
}

/**
 * 从兼容目标 ID 中取回旧 Clash 节点名称。
 *
 * @param targetId RoutingConfig 中保存的规则目标。
 * @returns 合法兼容目标的原始名称；不是兼容目标或名称为空时返回 null。
 */
export function getLegacyRuleTargetName(targetId: unknown): string | null {
  if (typeof targetId !== 'string' || !targetId.startsWith(LEGACY_RULE_TARGET_PREFIX)) return null
  const targetName = targetId.slice(LEGACY_RULE_TARGET_PREFIX.length)
  return targetName.trim() ? targetName : null
}
