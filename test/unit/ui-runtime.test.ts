import { describe, expect, it } from 'vitest'
import { consoleClientScript } from '../../src/ui/script'
import { renderDashboardPage, renderLoginPage } from '../../src/ui/pages'
import { consoleStyles } from '../../src/ui/styles'

describe('生产 UI 运行时', () => {
  it('浏览器脚本可以被 JavaScript 引擎解析', () => {
    expect(() => new Function(consoleClientScript)).not.toThrow()
  })

  it('不包含原型 CDN React/Babel，且主导航包含五项真实入口', () => {
    const html = renderDashboardPage()
    expect(html).not.toMatch(/unpkg|ReactDOM|babel/i)
    expect((html.match(/data-nav=/g) || []).length).toBe(5)
    expect(html).not.toMatch(/总览|系统设置|管理员账户|生产环境/)
    expect(renderLoginPage()).not.toMatch(/用户名|记住我|注册|找回密码/)
  })

  it('把分流规则收进策略组上下文，并提供记录级快捷操作', () => {
    expect(consoleClientScript).toContain("['groups', '策略组与分流'")
    expect(consoleClientScript).not.toContain("['rules', '路由规则'")
    expect(consoleClientScript).toContain('data-action="group-pane"')
    expect(consoleClientScript).toContain('data-action="group-rule-scope"')
    expect(consoleClientScript).toContain('data-action="insert-rule-above"')
    expect(consoleClientScript).toContain('data-action="insert-rule-below"')
    expect(consoleClientScript).toContain('data-action="duplicate-rule"')
    expect(consoleClientScript).toContain('最终 MATCH 必须保持在末尾')
  })

  it('用虚拟兜底分组展示所有未指向 proxy-group 的规则，并允许重新归组', () => {
    expect(consoleClientScript).toContain("const UNASSIGNED_RULES_GROUP_ID = '__ui_unassigned_rules__'")
    expect(consoleClientScript).toContain('return !groupIds.has(rule.targetGroupId)')
    expect(consoleClientScript).toContain('<strong>未归组规则</strong>')
    expect(consoleClientScript).toContain('DIRECT / REJECT / 直接节点')
    expect(consoleClientScript).toContain("state.groupRuleScope === 'global' || isFallbackGroup")
    expect(consoleClientScript).toContain("if (ruleField === 'targetGroupId')")
    expect(consoleClientScript).toContain("state.selectedGroupId !== UNASSIGNED_RULES_GROUP_ID")
    expect(consoleClientScript).toContain('未知目标：')
  })

  it('为节点标签和完整 YAML 预览提供独立布局与滚动样式', () => {
    expect(consoleClientScript).toContain('class="node-preview-list" role="list"')
    expect(consoleClientScript).toContain('class="yaml-preview" id="yaml-preview" tabindex="0"')
    expect(consoleClientScript).toContain('previewRequestId')
    expect(consoleStyles).toContain('.node-preview-list')
    expect(consoleStyles).toContain('.node-chip::before')
    expect(consoleStyles).toContain('.preview-controls')
    expect(consoleStyles).toContain('.yaml-preview {')
    expect(consoleStyles).toMatch(/\.yaml-preview\s*\{[\s\S]*?overflow:\s*auto;/)
  })

  it('为订阅操作列、完整节点类型和中宽规则编辑区保留安全空间', () => {
    expect(consoleStyles).toMatch(/\.subscription-table th:last-child\s*\{[\s\S]*?width:\s*72px;/)
    expect(consoleStyles).toMatch(/\.parsed-node-row\s*\{[\s\S]*?grid-template-columns:\s*92px minmax\(0, 1fr\);/)
    expect(consoleStyles).toMatch(/\.node-protocol\s*\{[\s\S]*?width:\s*100%;/)
    const protocolBlock = consoleStyles.match(/\.node-protocol\s*\{([^}]*)\}/)?.[1] || ''
    expect(protocolBlock).not.toContain('text-overflow')
    expect(consoleStyles).toMatch(/\.source-fields\s*\{[\s\S]*?flex-wrap:\s*wrap;/)
    expect(consoleStyles).toContain('@media (max-width: 1180px) and (min-width: 900px)')
    expect(consoleStyles).toContain('(min-width: 1271px) and (max-width: 1380px)')
    expect(consoleStyles).toMatch(/\.subscription-table td:last-child\s*\{[\s\S]*?position:\s*sticky;/)
    expect(consoleStyles).toMatch(/\.json-editor-panel\s*\{[\s\S]*?height:\s*min\(620px, 72dvh\);/)
    expect((consoleClientScript.match(/class="node-protocol" title=/g) || []).length).toBe(1)
    expect(consoleClientScript).toContain('analysis.nodes.map(renderParsedNodeRow)')
  })

  it('为长列表提供斑马纹、实时搜索与可追踪的路由校验状态', () => {
    expect(consoleStyles).toContain('.data-table tbody tr:nth-child(even)')
    expect(consoleStyles).toContain('.nested-rule-list > .nested-rule-record:nth-of-type(even)')
    expect(consoleStyles).toContain('.parsed-node-row:nth-child(even)')
    expect(consoleClientScript).toContain("routingValidatedSnapshot: ''")
    expect(consoleClientScript).toContain("const validationTone = !hasValidated ? 'is-idle'")
    expect(consoleClientScript).toContain("['group-search', 'rule-search', 'provider-search'].includes(target.id)")
    expect(consoleClientScript).toContain('replacement.setSelectionRange(selectionStart, selectionEnd)')
    expect(consoleClientScript).toContain("item.setAttribute('aria-current', 'page')")
    expect(consoleClientScript).toContain('sidebar.inert = shouldHide')
  })
})
