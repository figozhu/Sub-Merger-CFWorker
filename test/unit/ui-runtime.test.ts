import { describe, expect, it } from 'vitest'
import { consoleClientScript } from '../../src/ui/script'
import { renderDashboardPage, renderLoginPage } from '../../src/ui/pages'

describe('生产 UI 运行时', () => {
  it('浏览器脚本可以被 JavaScript 引擎解析', () => {
    expect(() => new Function(consoleClientScript)).not.toThrow()
  })

  it('不包含原型 CDN React/Babel，且主导航只有四项真实入口', () => {
    const html = renderDashboardPage()
    expect(html).not.toMatch(/unpkg|ReactDOM|babel/i)
    expect((html.match(/data-nav=/g) || []).length).toBe(4)
    expect(html).not.toMatch(/总览|系统设置|管理员账户|生产环境/)
    expect(renderLoginPage()).not.toMatch(/用户名|记住我|注册|找回密码/)
  })
})
