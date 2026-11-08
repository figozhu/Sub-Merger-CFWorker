import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoutingConfig, RoutingRuleConfig } from '../../src/types/routing'
import { renderDashboardPage } from '../../src/ui/pages'
import { consoleClientScript } from '../../src/ui/script'

const sessions: JSDOM[] = []

/**
 * 创建具有稳定 ID 的域名规则，供真实 DOM 操作使用。
 * @param id 规则 ID，同时用于构造可搜索的示例域名。
 * @param targetGroupId 目标策略组 ID，默认属于主组。
 * @param overrides 需要覆盖的类型、启用状态等规则属性。
 * @returns 独立的规则对象，避免不同测试共享修改。
 */
function makeRule(id: string, targetGroupId = 'main', overrides: Partial<RoutingRuleConfig> = {}): RoutingRuleConfig {
  return { id, enabled: true, category: 'general', type: 'DOMAIN-SUFFIX', value: `${id}.example.test`, remark: `备注 ${id}`, targetGroupId, noResolve: false, ...overrides }
}

/**
 * 创建交错包含两个策略组的长规则列表。
 * @param rules 可选的完整规则数组，用于 MATCH、未归组等边界场景。
 * @returns 具有真实提供者和最终 MATCH 的路由配置。
 */
function makeConfig(rules?: RoutingRuleConfig[]): RoutingConfig {
  return {
    schemaVersion: 1,
    baseYaml: 'mixed-port: 7890\n',
    groups: ['main', 'other'].map((id) => ({ id, name: id === 'main' ? '主策略组' : '其他策略组', type: 'select', enabled: true, sources: [{ id: `source-${id}`, kind: 'builtin', value: 'DIRECT', appliesTo: 'all' }] })),
    providers: [{ id: 'provider', name: '示例规则集', enabled: true, type: 'http', behavior: 'classical', url: 'https://example.test/rules.yaml', path: './rules.yaml', interval: 86400 }],
    rules: rules || [
      ...Array.from({ length: 24 }, (_, index) => makeRule(`rule-${index}`, index % 4 === 1 ? 'other' : 'main')),
      makeRule('match', 'main', { type: 'MATCH', value: undefined, remark: '' }),
    ],
  }
}

/**
 * 在独立 JSDOM 中启动完整生产脚本，通过受控 API 响应加载配置。
 * @param config 启动时 API 返回的路由配置；脚本获得深拷贝，不接触测试对象。
 * @returns DOM 会话及基于实际控件事件的操作方法。
 * 注意：JSDOM 不实现布局，本测试仅验证滚动数值、焦点和数据顺序；遮挡与实际可见性由浏览器验收。
 */
async function openRouting(config = makeConfig()) {
  const dom = new JSDOM(renderDashboardPage(), { url: 'https://console.example.test/dashboard#routing', runScripts: 'outside-only', pretendToBeVisual: true })
  sessions.push(dom)
  const { document } = dom.window
  const responses: Record<string, unknown> = {
    '/api/subscriptions': { subscriptions: [] },
    '/api/self-nodes': { raw: '[]' },
    '/api/routing-config': { config, revision: 1, migrated: false },
    '/api/outputs': { outputs: [] },
    '/api/subscriptions/settings': { userAgent: '', defaultUserAgent: 'Clash.Meta' },
  }
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({ matches: false }) })
  dom.window.fetch = vi.fn(async (url: string | URL | Request) => {
    const path = String(url)
    if (!(path in responses)) throw new Error(`测试未声明的 API 请求：${path}`)
    return new Response(JSON.stringify({ code: 0, data: responses[path] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof dom.window.fetch
  dom.window.eval(consoleClientScript)
  await vi.waitFor(() => expect(document.querySelector('#group-pane-panel')).not.toBeNull())

  /**
   * 查找当前渲染树中的必需控件；找不到时直接报告选择器，避免空引用掩盖回归。
   * @param selector 目标 CSS 选择器。
   * @returns 当前实际 DOM 元素，不复用重绘前的失效引用。
   */
  function element<T = HTMLElement>(selector: string): T {
    const result = document.querySelector(selector)
    if (!result) throw new Error(`找不到测试控件：${selector}`)
    return result as T
  }

  /**
   * 模拟用户聚焦并激活按钮，覆盖键盘用户依赖的重绘后焦点恢复。
   * @param selector 当前按钮的 CSS 选择器。
   * @returns 无返回值；业务变化通过生产脚本的委托事件发生。
   */
  function click(selector: string): void {
    const button = element<HTMLButtonElement>(selector)
    button.focus()
    button.click()
  }

  /**
   * 通过输入或变更事件编辑真实字段，不直接修改运行时状态。
   * @param selector 字段 CSS 选择器。
   * @param value 新输入值。
   * @param eventName 生产监听的事件类型，文本默认 input，下拉框使用 change。
   */
  function edit(selector: string, value: string, eventName = 'input'): void {
    const input = element<HTMLInputElement | HTMLSelectElement>(selector)
    input.focus()
    input.value = value
    input.dispatchEvent(new dom.window.Event(eventName, { bubbles: true }))
  }

  /** @returns 当前可见规则的稳定 ID，顺序来自实际 DOM。 */
  function ids(): string[] {
    return Array.from(document.querySelectorAll('.nested-rule-record')).map((row) => row.getAttribute('data-rule-id') || '')
  }

  /** @returns 当前高亮规则；不存在或重复选中均应让测试失败。 */
  function selected(): HTMLElement {
    expect(document.querySelectorAll('.nested-rule-record.selected')).toHaveLength(1)
    return element('.nested-rule-record.selected')
  }

  return { dom, document, element, click, edit, ids, selected }
}

/** 每个测试关闭窗口及 Toast 定时器，避免会话和异步任务泄漏到后续用例。 */
afterEach(() => {
  sessions.splice(0).forEach((session) => session.window.close())
})

describe('路由规则真实 DOM 交互回归', () => {
  it('选择长列表中部规则时保留三个滚动区域和规则按钮焦点', async () => {
    const ui = await openRouting()
    const positions = [['#group-pane-panel', 960], ['.unified-group-list .entity-list', 170], ['#routing-tab-panel', 320]] as const
    positions.forEach(([selector, top]) => { ui.element<HTMLElement>(selector).scrollTop = top })

    ui.click('[data-action="select-rule"][data-id="rule-12"]')

    positions.forEach(([selector, top]) => { expect(ui.element<HTMLElement>(selector).scrollTop).toBe(top) })
    expect(ui.selected().getAttribute('data-rule-id')).toBe('rule-12')
    expect(ui.document.activeElement).toBe(ui.element('[data-action="select-rule"][data-id="rule-12"]'))
  })

  it('添加规则后选中新记录并选中默认匹配内容，最终 MATCH 保持末尾', async () => {
    const ui = await openRouting()
    const before = ui.ids()
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 960
    ui.click('[data-action="add-rule"]')

    const added = ui.selected()
    expect(before).not.toContain(added.getAttribute('data-rule-id'))
    expect(ui.ids()).toHaveLength(before.length + 1)
    expect(ui.ids().at(-1)).toBe('match')
    const input = added.querySelector<HTMLInputElement>('[data-rule-field="value"]')!
    expect(ui.document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
  })

  it.each(['above', 'below'])('在选中规则 %s 位置插入并聚焦新记录，不改变其它规则顺序', async (position) => {
    const ui = await openRouting()
    ui.click('[data-action="select-rule"][data-id="rule-12"]')
    const before = ui.ids()
    ui.click(`[data-action="insert-rule-${position}"]`)

    const addedId = ui.selected().getAttribute('data-rule-id')!
    const expected = [...before]
    expected.splice(before.indexOf('rule-12') + (position === 'below' ? 1 : 0), 0, addedId)
    expect(ui.ids()).toEqual(expected)
    expect(ui.document.activeElement).toBe(ui.selected().querySelector('[data-rule-field="value"]'))
  })

  it.each(['DOMAIN-SUFFIX', 'RULE-SET'] as const)('复制 %s 规则保留内容并聚焦副本的对应编辑控件', async (type) => {
    const ui = await openRouting(makeConfig([
      makeRule('source', 'main', { type, providerId: type === 'RULE-SET' ? 'provider' : undefined }),
      makeRule('match', 'main', { type: 'MATCH', value: undefined }),
    ]))
    ui.click('.nested-rule-record[data-rule-id="source"] [data-action="duplicate-rule"]')

    const copy = ui.selected()
    expect(copy.getAttribute('data-rule-id')).not.toBe('source')
    expect(ui.ids()).toEqual(['source', copy.getAttribute('data-rule-id'), 'match'])
    const field = type === 'RULE-SET' ? 'providerId' : 'value'
    const input = copy.querySelector(`[data-rule-field="${field}"]`) as HTMLInputElement | HTMLSelectElement
    expect(ui.document.activeElement).toBe(input)
    expect(input.value).toBe(type === 'RULE-SET' ? 'provider' : 'source.example.test')
    expect(copy.querySelector<HTMLInputElement>('[data-rule-field="remark"]')!.value).toContain('备注 source')
    expect(ui.element<HTMLInputElement>('[data-rule-id="source"] [data-rule-field="remark"]').value).toBe('备注 source')
  })

  it('连续组内下移保留位置、操作焦点和其它策略组的全局顺序槽位', async () => {
    const config = makeConfig()
    const ui = await openRouting(config)
    ui.click('[data-action="select-rule"][data-id="rule-12"]')
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 840
    const before = ui.ids()
    const start = before.indexOf('rule-12')

    for (let step = 0; step < 2; step++) {
      ui.click('[data-action="move-selected-rule-down"]')
      expect(ui.selected().getAttribute('data-rule-id')).toBe('rule-12')
      expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(840)
      expect(ui.document.activeElement).toBe(ui.element('[data-action="move-selected-rule-down"]'))
    }
    expect(ui.ids()[start + 2]).toBe('rule-12')
    ui.click('[data-action="group-rule-scope"][data-scope="global"]')
    const globalOrder = ui.ids()
    config.rules.forEach((rule, index) => {
      if (rule.targetGroupId === 'other') expect(globalOrder[index]).toBe(rule.id)
    })
  })

  it('搜索隐藏旧选中项时不显示它的操作栏，复制保留搜索而插入揭示新记录', async () => {
    const ui = await openRouting()
    ui.edit('#rule-search', 'rule-12.example.test')
    expect(ui.ids()).toEqual(['rule-12'])
    expect(ui.document.querySelector('.selected-rule-toolbar')).toBeNull()

    ui.click('[data-action="select-rule"][data-id="rule-12"]')
    ui.click('.selected-rule-toolbar [data-action="duplicate-rule"]')
    expect(ui.element<HTMLInputElement>('#rule-search').value).toBe('rule-12.example.test')
    expect(ui.ids()).toHaveLength(2)

    ui.click('[data-action="insert-rule-below"]')
    expect(ui.element<HTMLInputElement>('#rule-search').value).toBe('')
    expect(ui.selected().querySelector<HTMLInputElement>('[data-rule-field="value"]')!.value).toBe('example.com')
    expect(ui.document.activeElement).toBe(ui.selected().querySelector('[data-rule-field="value"]'))
  })

  it('切换规则类型后保留滚动及同一规则字段焦点，不跳至相同索引的其它记录', async () => {
    const ui = await openRouting()
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 600
    ui.edit('[data-rule-id="rule-12"] [data-rule-field="type"]', 'RULE-SET', 'change')

    expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(600)
    expect(ui.document.activeElement).toBe(ui.element('[data-rule-id="rule-12"] [data-rule-field="type"]'))
    expect(ui.element<HTMLSelectElement>('[data-rule-id="rule-12"] [data-rule-field="providerId"]').value).toBe('provider')
  })

  it('类型变更导致规则被搜索隐藏时，将焦点交还搜索框并保留搜索条件', async () => {
    const ui = await openRouting()
    ui.edit('#rule-search', 'DOMAIN-SUFFIX')
    ui.click('[data-action="select-rule"][data-id="rule-12"]')
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 600
    ui.edit('[data-rule-id="rule-12"] [data-rule-field="type"]', 'RULE-SET', 'change')

    expect(ui.document.querySelector('[data-rule-id="rule-12"]')).toBeNull()
    expect(ui.document.querySelector('.selected-rule-toolbar')).toBeNull()
    expect(ui.ids().length).toBeGreaterThan(0)
    expect(ui.element<HTMLInputElement>('#rule-search').value).toBe('DOMAIN-SUFFIX')
    expect(ui.document.activeElement).toBe(ui.element('#rule-search'))
    expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(600)
  })

  it('启停规则即时刷新样式与移动限制，同时保留复选框焦点和滚动', async () => {
    const ui = await openRouting(makeConfig([
      makeRule('first'),
      makeRule('match', 'other', { type: 'MATCH', value: undefined }),
      makeRule('disabled', 'main', { enabled: false }),
    ]))
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 240
    expect(ui.element<HTMLButtonElement>('[data-action="move-selected-rule-down"]').disabled).toBe(true)

    for (const expectedEnabled of [false, true]) {
      const checkbox = ui.element<HTMLInputElement>('[data-rule-id="first"] [data-rule-field="enabled"]')
      checkbox.focus()
      checkbox.click()

      const replacement = ui.element<HTMLInputElement>('[data-rule-id="first"] [data-rule-field="enabled"]')
      expect(replacement.checked).toBe(expectedEnabled)
      expect(ui.element('[data-rule-id="first"]').classList.contains('disabled')).toBe(!expectedEnabled)
      expect(ui.element<HTMLButtonElement>('[data-action="move-selected-rule-down"]').disabled).toBe(expectedEnabled)
      expect(ui.document.activeElement).toBe(replacement)
      expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(240)
    }
  })

  it('主动切换策略组或规则范围时重置规则滚动，仍保留左栏和外层位置', async () => {
    const ui = await openRouting()
    ui.element<HTMLElement>('.unified-group-list .entity-list').scrollTop = 170
    ui.element<HTMLElement>('#routing-tab-panel').scrollTop = 320

    for (const selector of [
      '[data-action="select-group"][data-id="other"]',
      '[data-action="group-rule-scope"][data-scope="global"]',
      '[data-action="group-rule-scope"][data-scope="group"]',
    ]) {
      ui.element<HTMLElement>('#group-pane-panel').scrollTop = 960
      ui.click(selector)

      expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(0)
      expect(ui.element<HTMLElement>('.unified-group-list .entity-list').scrollTop).toBe(170)
      expect(ui.element<HTMLElement>('#routing-tab-panel').scrollTop).toBe(320)
    }
    expect(ui.ids()).toEqual(makeConfig().rules.filter((rule) => rule.targetGroupId === 'other').map((rule) => rule.id))
  })

  it('删除搜索结果中的中间记录时选择相邻可见记录，并保留筛选条件', async () => {
    const ui = await openRouting(makeConfig([
      makeRule('keep-first'), makeRule('hidden'), makeRule('keep-middle'), makeRule('keep-last'),
      makeRule('match', 'main', { type: 'MATCH', value: undefined }),
    ]))
    ui.edit('#rule-search', 'keep-')
    ui.click('[data-action="select-rule"][data-id="keep-middle"]')
    ui.click('[data-action="delete-rule"]')

    expect(ui.ids()).toEqual(['keep-first', 'keep-last'])
    expect(ui.selected().getAttribute('data-rule-id')).toBe('keep-last')
    expect(ui.element<HTMLInputElement>('#rule-search').value).toBe('keep-')
  })

  it('删除最后一条匹配结果后保留搜索并移除失效操作栏', async () => {
    const ui = await openRouting()
    ui.edit('#rule-search', 'rule-12.example.test')
    ui.click('[data-action="select-rule"][data-id="rule-12"]')
    ui.click('[data-action="delete-rule"]')

    expect(ui.ids()).toEqual([])
    expect(ui.element<HTMLInputElement>('#rule-search').value).toBe('rule-12.example.test')
    expect(ui.document.querySelector('.selected-rule-toolbar')).toBeNull()
    expect(ui.element('.empty-rule-group').textContent).toContain('没有匹配的规则')
    expect(ui.document.activeElement).toBe(ui.element('#rule-search'))
  })

  it('未归组规则改目标后保留剩余列表位置，处理最后一条后显示其目标组', async () => {
    const ui = await openRouting(makeConfig([
      makeRule('direct-first', 'builtin:DIRECT'), makeRule('direct-last', 'builtin:DIRECT'),
      makeRule('match', 'main', { type: 'MATCH', value: undefined }),
    ]))
    ui.click('[data-action="select-group"][data-id="__ui_unassigned_rules__"]')
    ui.element<HTMLElement>('#group-pane-panel').scrollTop = 240
    ui.edit('[data-rule-id="direct-first"] [data-rule-field="targetGroupId"]', 'other', 'change')

    expect(ui.ids()).toEqual(['direct-last'])
    expect(ui.selected().getAttribute('data-rule-id')).toBe('direct-last')
    expect(ui.element<HTMLElement>('#group-pane-panel').scrollTop).toBe(240)

    ui.edit('[data-rule-id="direct-last"] [data-rule-field="targetGroupId"]', 'other', 'change')
    expect(ui.document.querySelector('[data-action="select-group"][data-id="__ui_unassigned_rules__"]')).toBeNull()
    expect(ui.element('[data-action="select-group"][data-id="other"]').getAttribute('aria-pressed')).toBe('true')
    expect(ui.ids()).toEqual(['direct-first', 'direct-last'])
    expect(ui.selected().getAttribute('data-rule-id')).toBe('direct-last')
  })

  it('在 MATCH 后禁用记录旁插入时，新增启用规则仍放在最终 MATCH 之前', async () => {
    const ui = await openRouting(makeConfig([
      makeRule('first'),
      makeRule('match', 'other', { type: 'MATCH', value: undefined }),
      makeRule('disabled', 'main', { enabled: false }),
    ]))
    ui.click('[data-action="select-rule"][data-id="disabled"]')
    ui.click('[data-action="insert-rule-below"]')
    const addedId = ui.selected().getAttribute('data-rule-id')
    ui.click('[data-action="group-rule-scope"][data-scope="global"]')

    expect(ui.ids()).toEqual(['first', addedId, 'match', 'disabled'])
    expect(ui.element<HTMLInputElement>(`[data-rule-id="${addedId}"] [data-rule-field="enabled"]`).checked).toBe(true)
  })

  it('组内移动不能越过隐藏的其它策略组最终 MATCH', async () => {
    const ui = await openRouting(makeConfig([
      makeRule('first'),
      makeRule('match', 'other', { type: 'MATCH', value: undefined }),
      makeRule('disabled', 'main', { enabled: false }),
    ]))
    ui.click('[data-action="select-rule"][data-id="first"]')
    ui.click('[data-action="move-selected-rule-down"]')
    ui.click('[data-action="group-rule-scope"][data-scope="global"]')

    expect(ui.ids()).toEqual(['first', 'match', 'disabled'])
    ui.click('[data-action="select-rule"][data-id="match"]')
    expect(ui.element<HTMLButtonElement>('.selected-rule-toolbar [data-action="duplicate-rule"]').disabled).toBe(true)
    expect(ui.element<HTMLButtonElement>('[data-action="move-selected-rule-up"]').disabled).toBe(true)
  })
})
