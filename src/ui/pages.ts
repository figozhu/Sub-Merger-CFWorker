import { consoleStyles } from './styles'
import { consoleClientScript } from './script'

/**
 * 生成所有页面共用的品牌标识。
 * 标识结构直接复用设计原型提供的资产构成，不依赖外部图片或 CDN。
 * @returns 品牌标识 HTML。
 */
function renderBrand(): string {
  return `<div class="brand-lockup compact-brand">
    <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
    <div><div class="brand-name">SubMerger</div><div class="brand-subtitle">订阅配置</div></div>
  </div>`
}

/**
 * 生成独立登录页。
 * 页面只包含密码、显隐按钮和登录操作，脚本调用现有 POST /login 接口。
 * @returns 可直接由 Hono 返回的完整 HTML 文档。
 */
export function renderLoginPage(): string {
  return `<!doctype html>
  <html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>登录 · SubMerger</title>
    <style>${consoleStyles}</style>
  </head>
  <body>
    <main class="login-screen" data-screen-label="登录">
      <section class="login-card">
        <div class="login-brand">${renderBrand()}</div>
        <form class="login-form" id="login-form" novalidate>
          <h1>登录</h1>
          <label class="field" id="password-field">
            <span>管理密码</span>
            <div class="password-control">
              <input id="login-password" type="password" autocomplete="current-password" autofocus aria-describedby="login-error">
              <button type="button" class="password-toggle" id="toggle-password" aria-label="显示密码">显示</button>
            </div>
            <small id="login-error" class="field-error" role="alert"></small>
          </label>
          <button type="submit" class="button primary login-submit" id="login-submit">登录</button>
        </form>
      </section>
    </main>
    <script>
      (() => {
        const form = document.getElementById('login-form');
        const password = document.getElementById('login-password');
        const toggle = document.getElementById('toggle-password');
        const submit = document.getElementById('login-submit');
        const error = document.getElementById('login-error');
        const field = document.getElementById('password-field');

        /** 切换密码显隐状态，同时更新按钮的可访问名称。 */
        toggle.addEventListener('click', () => {
          const visible = password.type === 'text';
          password.type = visible ? 'password' : 'text';
          toggle.textContent = visible ? '显示' : '隐藏';
          toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
          password.focus();
        });

        /**
         * 显式支持密码框回车提交。
         * 部分嵌入式浏览器不会为单输入表单触发隐式提交，统一改走表单 submit 流程。
         */
        password.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (!submit.disabled) form.requestSubmit();
        });

        /** 提交登录请求；失败时把错误贴近密码字段并保持输入焦点。 */
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          error.textContent = '';
          field.classList.remove('has-error');
          submit.disabled = true;
          submit.textContent = '登录中…';
          try {
            const response = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: password.value }),
            });
            const result = await response.json();
            if (!response.ok || result.code !== 0) throw new Error('密码不正确');
            window.location.assign('/dashboard#subscriptions');
          } catch (requestError) {
            error.textContent = requestError instanceof Error ? requestError.message : '登录失败，请重试';
            field.classList.add('has-error');
            password.focus();
            password.select();
          } finally {
            submit.disabled = false;
            submit.textContent = '登录';
          }
        });
      })();
    </script>
  </body>
  </html>`
}

/**
 * 生成登录后的新版控制台 Shell。
 * 四个业务页面由轻量浏览器脚本按 Hash 渲染，生产运行时不依赖 React 或 Babel。
 * @returns 可直接由 Hono 返回的完整 HTML 文档。
 */
export function renderDashboardPage(): string {
  return `<!doctype html>
  <html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>SubMerger · 订阅配置</title>
    <style>${consoleStyles}</style>
  </head>
  <body>
    <div class="app-shell" id="app-shell">
      <aside class="sidebar console-sidebar" id="sidebar" aria-label="主导航">
        ${renderBrand()}
        <nav class="primary-nav console-primary-nav">
          <button type="button" class="nav-item" data-nav="subscriptions"><span>订阅源</span></button>
          <button type="button" class="nav-item" data-nav="nodes"><span>自建节点</span></button>
          <button type="button" class="nav-item" data-nav="routing"><span>路由配置</span></button>
          <button type="button" class="nav-item" data-nav="links"><span>订阅输出</span></button>
        </nav>
      </aside>
      <button type="button" class="sidebar-backdrop" id="sidebar-backdrop" aria-label="关闭导航"></button>
      <main class="main-shell">
        <button type="button" class="mobile-menu-button" id="mobile-menu-button" aria-label="打开导航" aria-expanded="false" aria-controls="sidebar">菜单</button>
        <section id="workspace" class="workspace-page" aria-live="polite">
          <div class="loading-screen"><span class="loading-spinner"></span><strong>正在加载配置…</strong></div>
        </section>
      </main>
      <div id="overlay-root"></div>
      <div id="toast-root" class="toast-region" aria-live="polite"></div>
    </div>
    <script>${consoleClientScript}</script>
  </body>
  </html>`
}
