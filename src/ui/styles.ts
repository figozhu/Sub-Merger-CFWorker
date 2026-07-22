/**
 * SubMerger 新版控制台的完整样式。
 *
 * 视觉基准来自 designs/submerger-console 下的完整交互原型与 1440×1000
 * 参考截图。样式不依赖外部字体、图片或 CDN，可直接内联到 Worker 返回的页面。
 */
export const consoleStyles = String.raw`
/* ========================================================================== 
   1. 设计令牌与基础重置
   ========================================================================== */
:root {
  color-scheme: light;
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace;
  --page: #eef1f6;
  --surface: #ffffff;
  --surface-subtle: #f7f8fb;
  --surface-raised: #fbfcfe;
  --ink: #182033;
  --ink-secondary: #4d596f;
  --ink-muted: #8490a5;
  --line: #dfe4ed;
  --line-soft: #edf0f5;
  --brand: #3f63df;
  --brand-strong: #3153cc;
  --brand-soft: #eef1ff;
  --brand-border: #cfd7ff;
  --nav: #111a2c;
  --nav-raised: #18243a;
  --nav-active: #243353;
  --nav-ink: #e9eef8;
  --nav-muted: #8693a9;
  --success: #17835a;
  --success-soft: #e9f7f0;
  --warning: #b66b10;
  --warning-soft: #fff5e6;
  --danger: #c4464e;
  --danger-soft: #fff0f1;
  --cyan: #1687a5;
  --shadow-sm: 0 1px 2px rgba(19, 31, 56, 0.05);
  --shadow-md: 0 10px 30px rgba(21, 34, 58, 0.11);
  --shadow-lg: 0 24px 70px rgba(17, 27, 48, 0.22);
  --radius-sm: 7px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --sidebar-width: 204px;
  --header-height: 78px;
  /* 可读性字号层级：任何承载信息的文字不低于 11px。 */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-md: 13px;
  --text-body: 14px;
  --text-lg: 15px;
  --text-title: 22px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  background: var(--page);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button,
input,
select,
textarea {
  color: inherit;
  font: inherit;
}

button {
  border: 0;
}

button,
select,
input[type="checkbox"] {
  cursor: pointer;
}

button:disabled,
input:disabled,
select:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid rgba(63, 99, 223, 0.2);
  outline-offset: 2px;
}

h1,
h2,
h3,
p,
pre {
  margin: 0;
}

code,
pre,
textarea.code-input {
  font-family: var(--font-mono);
}

.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* ========================================================================== 
   2. 控制台外壳、品牌与四项主导航
   ========================================================================== */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-width: 0;
  overflow: hidden;
  background: var(--page);
}

.sidebar {
  position: relative;
  z-index: 30;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 18px 12px;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  background: var(--nav);
  color: var(--nav-ink);
}

.brand-lockup,
.login-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand-lockup {
  min-height: 44px;
  padding: 0 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 3px;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  padding: 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: #21304b;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.05);
}

.brand-mark span {
  display: block;
  border-radius: 3px;
  background: #6d89f0;
}

.brand-mark span:nth-child(2) {
  grid-row: span 2;
  height: 19px;
  background: #9eaef7;
}

.brand-mark span:nth-child(3) {
  background: #47b3c8;
}

.brand-name {
  color: #ffffff;
  font-size: 15px;
  font-weight: 720;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.brand-subtitle {
  margin-top: 2px;
  color: var(--nav-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.primary-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 44px;
  padding: 0 11px;
  border-radius: 7px;
  background: transparent;
  color: var(--nav-muted);
  text-align: left;
  transition: color 150ms ease, background 150ms ease, transform 150ms ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.055);
  color: var(--nav-ink);
}

.nav-item:active {
  transform: translateY(1px);
}

.nav-item.active,
.nav-item[aria-current="page"] {
  background: var(--nav-active);
  color: #ffffff;
  box-shadow: inset 3px 0 #7c96f4;
}

.nav-item.active svg,
.nav-item[aria-current="page"] svg {
  color: #9fb0ff;
}

.nav-item span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 浏览器端模板可以使用 SVG，也可以使用无外部依赖的短文本图标占位。 */
.nav-item .nav-icon {
  display: grid;
  width: 18px;
  height: 18px;
  min-width: 18px;
  flex: 0 0 18px;
  place-items: center;
  overflow: visible;
  color: currentColor;
  font-size: 9px;
  font-weight: 750;
  line-height: 1;
}

.sidebar-toggle,
.mobile-menu-button,
.sidebar-backdrop {
  display: none;
}

/* ========================================================================== 
   3. 页面标题栏、真实状态与通用操作按钮
   ========================================================================== */
.main-shell {
  width: 100%;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.workspace-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.page-header,
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  min-width: 0;
  min-height: var(--header-height);
  flex: 0 0 var(--header-height);
  padding: 15px 22px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface);
}

.title-stack,
.compact-title-stack {
  min-width: 0;
}

.title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.title-line h1 {
  overflow: hidden;
  color: #172033;
  font-size: 21px;
  font-weight: 730;
  letter-spacing: -0.035em;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  font-size: 9px;
  font-weight: 620;
  white-space: nowrap;
}

.workspace-status-dot,
.status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.workspace-status.saved,
.workspace-status.success {
  border-color: #cae7db;
  background: #f1faf6;
  color: var(--success);
}

.workspace-status.dirty,
.workspace-status.warning {
  border-color: #e8d9b6;
  background: #fffaf0;
  color: #a36a13;
}

.workspace-status.error {
  border-color: #f1cbd0;
  background: #fff5f6;
  color: var(--danger);
}

.header-actions,
.workspace-actions,
.panel-header-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:active:not(:disabled) {
  transform: translateY(0);
}

.button.primary {
  background: var(--brand);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(63, 99, 223, 0.19);
}

.button.primary:hover:not(:disabled) {
  background: var(--brand-strong);
  box-shadow: 0 6px 15px rgba(63, 99, 223, 0.24);
}

.button.secondary {
  border-color: #d7dde8;
  background: #ffffff;
  color: #344056;
  box-shadow: var(--shadow-sm);
}

.button.secondary:hover:not(:disabled),
.button.ghost:hover:not(:disabled) {
  border-color: #bcc6d6;
  background: #f7f8fb;
}

.button.ghost {
  border-color: transparent;
  color: var(--ink-secondary);
}

.button.danger,
.danger-button {
  border-color: #e9bfc4;
  background: #fff4f5;
  color: var(--danger);
}

.button.small {
  min-height: 30px;
  padding: 0 10px;
  font-size: 10px;
}

.icon-button {
  display: inline-grid;
  width: auto;
  min-width: 31px;
  height: 31px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0 8px;
  border: 1px solid #dce1ea;
  border-radius: 7px;
  background: #ffffff;
  color: var(--ink-secondary);
  font-size: 10px;
  white-space: nowrap;
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.icon-button:hover:not(:disabled) {
  border-color: #bec7d5;
  background: var(--surface-subtle);
  color: var(--ink);
}

.icon-button:active:not(:disabled) {
  transform: scale(0.96);
}

.icon-button.brand {
  border-color: var(--brand);
  background: var(--brand);
  color: #ffffff;
}

.icon-button.subtle {
  min-width: 27px;
  height: 27px;
  padding: 0 5px;
  border-color: transparent;
  background: transparent;
  color: #8c97aa;
}

.icon-button.danger,
.danger-hover:hover:not(:disabled) {
  border-color: #f1c9cc !important;
  background: var(--danger-soft) !important;
  color: var(--danger) !important;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

/* ========================================================================== 
   4. 通用内容区、面板、表单与空状态
   ========================================================================== */
.workspace-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px 18px 18px;
  overflow: auto;
  overscroll-behavior: contain;
}

.data-panel,
.entity-panel,
.editor-panel,
.inspector-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.entity-panel,
.editor-panel,
.inspector-panel {
  display: flex;
  flex-direction: column;
}

.panel-header,
.simple-panel-head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 56px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft);
}

.panel-header h2,
.simple-panel-head h2 {
  color: #1e2739;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.45;
}

.panel-header p {
  margin-top: 1px;
  color: var(--ink-muted);
  font-size: 9px;
  line-height: 1.45;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 11px;
}

.field > span,
.field-label {
  color: #536075;
  font-size: 9px;
  font-weight: 620;
}

.field em {
  margin-left: 3px;
  color: #9ba4b3;
  font-size: 8px;
  font-style: normal;
  font-weight: 450;
}

.field input,
.field select,
.field textarea,
.source-fields input,
.source-fields select,
.panel-search input {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d8dee8;
  border-radius: 7px;
  outline: 0;
  background: #ffffff;
  color: #263145;
  font-size: 10px;
  transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
}

.field textarea {
  height: auto;
  min-height: 110px;
  padding: 10px;
  resize: vertical;
}

.field input:hover,
.field select:hover,
.field textarea:hover,
.source-fields input:hover,
.source-fields select:hover {
  border-color: #bcc5d3;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.source-fields input:focus,
.source-fields select:focus,
.panel-search input:focus {
  border-color: #879bec;
  box-shadow: 0 0 0 3px rgba(63, 99, 223, 0.08);
}

.field input[readonly] {
  background: #f7f8fa;
  color: #7e899a;
}

.field.has-error input,
.field.has-error select,
.field.has-error textarea,
.field input.invalid,
.field select.invalid,
.field textarea.invalid {
  border-color: #e89aa2;
  background: #fffafb;
}

.field-error,
.cell-error,
.form-error {
  color: var(--danger);
  font-size: 9px;
  line-height: 1.4;
}

.field-help,
.form-help {
  color: var(--ink-muted);
  font-size: 9px;
}

.form-grid {
  display: grid;
  min-width: 0;
  gap: 0 12px;
}

.form-grid.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid.three-columns {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.span-two {
  grid-column: span 2;
}

.full-field {
  grid-column: 1 / -1;
}

.empty-state,
.empty-list,
.empty-search,
.table-empty,
.centered-empty {
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--ink-muted);
  font-size: 11px;
  text-align: center;
}

.empty-search,
.table-empty,
.centered-empty {
  flex-direction: column;
}

.empty-state strong,
.empty-search strong,
.table-empty strong,
.centered-empty h2 {
  color: #46536a;
  font-size: 12px;
}

.fatal-state {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 28px;
  color: var(--ink-muted);
  text-align: center;
}

.fatal-state strong {
  color: #354157;
  font-size: 14px;
}

.fatal-state span {
  max-width: 520px;
  font-size: 10px;
}

.inline-error {
  padding: 9px 13px;
  border-bottom: 1px solid #f1cbd0;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 9px;
}

/* ========================================================================== 
   5. 独立登录页
   ========================================================================== */
.login-screen {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  padding: 32px;
  overflow: auto;
  background: var(--page);
}

.login-card {
  width: min(390px, 100%);
  overflow: hidden;
  border: 1px solid #dce1e9;
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(30, 43, 66, 0.1);
}

.login-brand {
  padding: 22px 24px;
  border-bottom: 1px solid var(--line-soft);
}

.login-brand .brand-lockup {
  width: 100%;
  min-height: 0;
  padding: 0;
  border-bottom: 0;
}

.login-brand .brand-lockup > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.login-brand strong {
  color: var(--ink);
  font-size: 15px;
}

.login-brand .brand-name {
  color: var(--ink);
}

.login-brand .brand-subtitle {
  color: var(--ink-muted);
}

.login-brand .brand-lockup > div:last-child span {
  color: var(--ink-muted);
  font-size: 10px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 26px 24px 28px;
}

.login-form h1 {
  font-size: 22px;
  letter-spacing: -0.035em;
}

.password-control {
  position: relative;
}

.password-control input {
  padding-right: 58px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 7px;
  display: grid;
  width: 45px;
  height: 31px;
  place-items: center;
  transform: translateY(-50%);
  border-radius: 6px;
  background: transparent;
  color: var(--ink-muted);
  font-size: 10px;
  white-space: nowrap;
}

/* 表格和列表中的排序操作使用紧凑文字按钮，确保中文标签不会折行。 */
.row-order-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.row-order-actions button,
.danger-text {
  min-height: 24px;
  padding: 2px 5px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ink-muted);
  font-size: 9px;
  white-space: nowrap;
}

.row-order-actions button:hover:not(:disabled) {
  background: var(--surface-subtle);
  color: var(--ink-secondary);
}

.danger-text {
  color: var(--danger);
}

.password-toggle:hover {
  background: var(--surface-subtle);
  color: var(--ink);
}

.login-submit {
  width: 100%;
  min-height: 41px;
}

.loading-screen {
  display: flex;
  min-height: 240px;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--ink-muted);
  font-size: 10px;
}

.toast-region {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 100;
  display: flex;
  width: min(330px, calc(100vw - 36px));
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-region .toast {
  position: relative;
  right: auto;
  bottom: auto;
  width: 100%;
  pointer-events: auto;
}

/* ========================================================================== 
   6. 订阅源表格与订阅输出
   ========================================================================== */
.subscription-panel,
.output-panel {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.data-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.data-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th {
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  background: #f7f8fa;
  color: #69758a;
  font-size: 9px;
  font-weight: 670;
  text-align: left;
}

.subscription-table th:nth-child(1) {
  width: 23%;
}

.subscription-table th:nth-child(2) {
  width: 18%;
}

.subscription-table th:last-child {
  width: 56px;
}

.data-table td {
  position: relative;
  padding: 11px 14px 17px;
  border-bottom: 1px solid var(--line-soft);
  vertical-align: top;
}

.data-table tbody tr:last-child td {
  border-bottom: 0;
}

.data-table tbody tr.row-invalid {
  background: #fffafb;
}

.data-table input,
.data-table select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #d7dde7;
  border-radius: 6px;
  outline: 0;
  background: #ffffff;
  color: var(--ink);
  font-size: 11px;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.data-table input:focus,
.data-table select:focus {
  border-color: #8fa4f3;
  box-shadow: 0 0 0 3px rgba(63, 99, 223, 0.09);
}

.data-table input.invalid,
.data-table select.invalid {
  border-color: #e89aa2;
  background: #fffafb;
}

.data-table .cell-error {
  position: absolute;
  bottom: 4px;
  left: 14px;
}

.output-list {
  display: flex;
  flex-direction: column;
}

.output-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 82px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line-soft);
}

.output-row:last-child {
  border-bottom: 0;
}

.output-type {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.output-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand);
}

.output-type > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.output-type strong {
  color: #334056;
  font-size: 11px;
}

.output-type span {
  color: var(--ink-muted);
  font-size: 8px;
}

.output-row code,
.output-url {
  display: block;
  min-width: 0;
  overflow: hidden;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f8f9fb;
  color: #46536a;
  font-family: var(--font-mono);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========================================================================== 
   7. 自建节点摘要与深色 JSON 编辑器
   ========================================================================== */
.nodes-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
  overflow: hidden;
}

.parsed-nodes-panel,
.json-editor-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.simple-panel-head span,
.count-badge {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: #eef1f5;
  color: #6b7689;
  font-size: 9px;
  font-weight: 700;
}

.parsed-node-list {
  flex: 1;
  min-height: 0;
  padding: 6px;
  overflow-y: auto;
}

.parsed-node-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 10px 9px;
  border-bottom: 1px solid var(--line-soft);
}

.node-protocol {
  display: grid;
  width: 42px;
  height: 27px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
}

.parsed-node-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.parsed-node-row strong,
.parsed-node-row > div span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parsed-node-row strong {
  color: #334056;
  font-size: 10px;
}

.parsed-node-row > div span {
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 8px;
}

.code-toolbar,
.template-editor-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid #293346;
  background: #1a2332;
  color: #7e8aa0;
  font-family: var(--font-mono);
  font-size: 8px;
}

.code-editor-grid {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  flex: 1;
  background: #151d2a;
}

.yaml-line-rail {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 11px 8px;
  overflow: hidden;
  border-right: 1px solid #293346;
  color: #536075;
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1.72;
  text-align: right;
  user-select: none;
}

.base-yaml-textarea,
.node-json-textarea {
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 11px 14px;
  resize: none;
  border: 0;
  outline: 0;
  background: #151d2a;
  color: #c5cfdd;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.72;
  tab-size: 2;
  white-space: pre;
}

.editor-validation,
.template-editor-status {
  display: flex;
  min-width: 0;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border-top: 1px solid #293346;
  background: #192231;
  color: #7e8aa0;
  font-size: 8px;
}

.editor-validation.valid,
.template-editor-status.is-valid {
  color: #72bf98;
}

.editor-validation.invalid,
.template-editor-status.has-error {
  color: #ef8e94;
}

/* ========================================================================== 
   8. 路由配置页签与桌面三栏工作区
   ========================================================================== */
.routing-workspace .workspace-header {
  flex: 0 0 var(--header-height);
}

.studio-tabs {
  display: flex;
  min-width: 0;
  min-height: 50px;
  flex: 0 0 50px;
  align-items: end;
  gap: 2px;
  padding: 0 22px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  scrollbar-width: thin;
}

.studio-tab {
  display: flex;
  height: 50px;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ink-muted);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 140ms ease, background 140ms ease, border-color 140ms ease;
}

.studio-tab:hover {
  background: #fafbfc;
  color: var(--ink-secondary);
}

.studio-tab.active,
.studio-tab[aria-selected="true"] {
  border-color: var(--brand);
  color: var(--brand-strong);
}

.tab-count {
  min-width: 19px;
  padding: 0 5px;
  border-radius: 999px;
  background: #edf0f5;
  color: #6e7a8d;
  font-size: 9px;
  line-height: 17px;
  text-align: center;
}

.studio-tab.active .tab-count,
.studio-tab[aria-selected="true"] .tab-count {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.studio-content {
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: 12px 14px 14px;
  overflow: hidden;
}

.studio-grid {
  display: grid;
  grid-template-columns: 242px minmax(460px, 1fr) 282px;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.base-studio-grid,
.studio-grid.base-grid,
.studio-grid.yaml-grid {
  grid-template-columns: 218px minmax(0, 1fr);
}

.editor-scroll,
.entity-list,
.provider-list,
.category-list,
.yaml-outline-list,
.issue-list {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #c9d0dc transparent;
}

.panel-search {
  display: flex;
  height: 34px;
  align-items: center;
  gap: 7px;
  margin: 10px 11px;
  padding: 0 9px;
  border: 1px solid #dce1e9;
  border-radius: 7px;
  background: #f9fafc;
  color: #929cad;
}

.panel-search input {
  height: auto;
  padding: 0;
  border: 0;
  box-shadow: none;
  background: transparent;
  font-size: 9px;
}

.panel-search input:focus {
  box-shadow: none;
}

.panel-search button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 5px;
  background: transparent;
  color: #8c97a8;
}

/* ========================================================================== 
   9. 策略组列表、来源卡片与健康检查
   ========================================================================== */
.entity-row,
.provider-row,
.category-row,
.yaml-outline-list button {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border-radius: 7px;
  background: transparent;
  color: var(--ink-secondary);
  text-align: left;
  transition: background 130ms ease, color 130ms ease, opacity 130ms ease;
}

.entity-list,
.provider-list,
.category-list,
.yaml-outline-list {
  padding: 4px 7px 8px;
}

.entity-row:hover,
.provider-row:hover,
.category-row:hover,
.yaml-outline-list button:hover {
  background: #f7f8fb;
}

.entity-row.active,
.entity-row[aria-selected="true"],
.provider-row.active,
.category-row.active,
.yaml-outline-list button.active {
  background: var(--brand-soft);
  color: var(--brand-strong);
  box-shadow: inset 0 0 0 1px var(--brand-border);
}

.entity-row.disabled,
.provider-row.disabled {
  opacity: 0.54;
}

.entity-glyph,
.category-glyph,
.provider-icon,
.outline-key-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  background: var(--brand-soft);
  color: var(--brand);
}

.entity-copy,
.provider-row > span:nth-child(2),
.outline-key-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.entity-copy strong,
.provider-row strong,
.outline-key-copy strong {
  overflow: hidden;
  color: #354157;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-copy small,
.provider-row small,
.outline-key-copy small {
  overflow: hidden;
  color: #929cad;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-label {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: #eef0f4;
  color: #8b95a5;
  font-size: 8px;
}

.inline-add-button {
  display: flex;
  min-height: 38px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 7px;
  border: 1px dashed #cbd2dd;
  border-radius: 7px;
  background: #fafbfd;
  color: #657188;
  font-size: 9px;
  font-weight: 620;
}

.inline-add-button:hover {
  border-color: var(--brand-border);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.form-section {
  padding: 15px 16px;
  border-bottom: 1px solid var(--line-soft);
}

.form-section:last-child {
  border-bottom: 0;
}

.section-heading,
.section-title-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}

.section-heading h3,
.section-title-row strong {
  color: #3c495f;
  font-size: 10px;
  font-weight: 700;
}

.switch-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #657188;
  font-size: 9px;
  white-space: nowrap;
}

.switch-label input,
.mini-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch-control,
.mini-switch span {
  position: relative;
  width: 30px;
  height: 17px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #c9d0db;
  transition: background 150ms ease;
}

.switch-control::after,
.mini-switch span::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(24, 32, 51, 0.25);
  content: "";
  transition: transform 150ms ease;
}

.switch-label input:checked + .switch-control,
.mini-switch input:checked + span {
  background: var(--brand);
}

.switch-label input:checked + .switch-control::after,
.mini-switch input:checked + span::after {
  transform: translateX(13px);
}

.source-stack {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.source-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dde2eb;
  border-radius: 9px;
  background: #fbfcfd;
}

.source-card:hover {
  border-color: #cbd3df;
}

.source-card-head {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px 5px 10px;
  border-bottom: 1px solid #edf0f4;
  background: #f8f9fb;
}

.source-type,
.source-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.source-type {
  color: #425067;
  font-size: 9px;
}

.source-type > span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand);
}

.source-fields {
  display: flex;
  min-width: 0;
  align-items: end;
  gap: 9px;
  padding: 10px;
}

.source-fields .field,
.source-fields .compact-field {
  min-width: 120px;
  flex: 0 1 170px;
  margin: 0;
}

.source-fields .grow-field {
  flex: 1 1 220px;
}

.source-fields .full-field {
  flex: 1;
}

.regex-input,
.url-field {
  display: flex;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  border: 1px solid #d8dee8;
  border-radius: 7px;
  background: #ffffff;
  color: #8b96a8;
  font-family: var(--font-mono);
  font-size: 9px;
}

.regex-input span,
.url-field svg {
  flex: 0 0 auto;
  margin: 0 8px;
}

.regex-input input,
.url-field input {
  height: 32px;
  padding: 0;
  border: 0;
  box-shadow: none !important;
}

.menu-anchor {
  position: relative;
}

.source-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 15;
  display: flex;
  width: 210px;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #ffffff;
  box-shadow: var(--shadow-md);
}

.source-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 5px 8px;
  border-radius: 6px;
  background: transparent;
  color: #46536a;
  text-align: left;
}

.source-menu button:hover {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.empty-source {
  display: flex;
  min-height: 94px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  border: 1px dashed #cbd2dd;
  border-radius: 8px;
  background: #fafbfd;
  color: var(--ink-muted);
  font-size: 9px;
}

.empty-source strong {
  color: #526076;
}

.feature-pill,
.match-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--success);
  font-size: 9px;
}

.feature-pill > span,
.node-online,
.provider-state {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.node-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.node-chip-list > span {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid #e0e4eb;
  border-radius: 6px;
  background: #fafbfd;
  color: #59667b;
  font-size: 8px;
}

.node-chip-list .remaining-node-count {
  color: var(--ink-muted);
  font-family: var(--font-mono);
}

/* ========================================================================== 
   10. 路由规则分类、搜索、表格与拖动状态
   ========================================================================== */
.category-row {
  min-height: 42px;
}

.category-row > span:nth-child(2) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-row > strong {
  color: #8b96a8;
  font-size: 9px;
}

.rules-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.rules-toolbar .panel-search {
  min-width: 0;
  flex: 1;
}

.rule-result-count {
  flex: 0 0 auto;
  margin-right: 12px;
  color: var(--ink-muted);
  font-size: 9px;
}

.rules-table-wrap {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-x: auto;
}

.rules-table-head,
.rule-row {
  display: grid;
  grid-template-columns: 28px 40px minmax(85px, 0.8fr) minmax(150px, 1.5fr) minmax(112px, 1fr) 68px 30px;
  align-items: center;
  min-width: 660px;
}

.rules-table-head {
  min-height: 32px;
  padding: 0 7px;
  border-bottom: 1px solid #e7eaf0;
  background: #f8f9fb;
  color: #8792a4;
  font-size: 8px;
  font-weight: 650;
}

.rules-table-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  scrollbar-width: thin;
}

.rule-row {
  min-height: 53px;
  padding: 4px 7px;
  border-bottom: 1px solid #eef1f5;
  background: #ffffff;
  transition: background 120ms ease, opacity 120ms ease, box-shadow 120ms ease;
}

.rule-row:hover {
  background: #fafbfe;
}

.rule-row.selected {
  background: #f5f7ff;
  box-shadow: inset 3px 0 var(--brand);
}

.rule-row.disabled {
  opacity: 0.5;
}

.rule-row.dragging {
  background: #edf1ff;
  opacity: 0.46;
}

.drag-button {
  display: grid;
  width: 24px;
  height: 28px;
  place-items: center;
  background: transparent;
  color: #a5adba;
  cursor: grab;
}

.drag-button:active {
  cursor: grabbing;
}

.mini-switch {
  display: grid;
  place-items: center;
}

.rule-type-cell,
.rule-value-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding-right: 7px;
}

.rule-type-cell span,
.rule-value-cell strong {
  overflow: hidden;
  color: #354157;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-type-cell small {
  color: #98a1b1;
  font-family: var(--font-mono);
  font-size: 7px;
}

.target-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  padding: 0 5px;
  overflow: hidden;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  background: #ffffff;
}

.target-select select {
  width: 100%;
  min-width: 0;
  height: 29px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #526076;
  font-size: 8px;
}

.tiny-color {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--brand);
}

.rule-option-cell span {
  display: inline-block;
  padding: 2px 5px;
  border-radius: 5px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-family: var(--font-mono);
  font-size: 7px;
}

.rule-option-cell .muted-option {
  background: transparent;
  color: #a2aab8;
}

/* ========================================================================== 
   11. 规则提供者列表与编辑器
   ========================================================================== */
.provider-row {
  min-height: 49px;
}

.provider-state {
  flex: 0 0 auto;
}

.provider-state.offline {
  background: #b8c0cc;
}

.provider-editor .editor-scroll {
  flex: 1;
}

.checkbox-row {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  color: #526076;
  font-size: 9px;
}

.checkbox-row input {
  width: 15px;
  height: 15px;
  accent-color: var(--brand);
}

/* ========================================================================== 
   12. YAML 模板大纲、编辑器与实时检查
   ========================================================================== */
.yaml-outline-list button {
  min-height: 47px;
}

.yaml-template-editor {
  min-width: 0;
}

.template-editor-shell {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 12px;
  overflow: hidden;
  border: 1px solid #273245;
  border-radius: 9px;
  background: #151d2a;
}

.template-editor-toolbar > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  overflow: hidden;
}

.template-editor-toolbar span {
  white-space: nowrap;
}

.editor-language {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--brand);
  color: #ffffff;
}

.template-editor-status {
  gap: 12px;
  white-space: nowrap;
}

.template-editor-status > div {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
}

.validation-result {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  margin: 10px 10px 6px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font-size: 9px;
}

.validation-result.is-ready {
  border-color: #cae7db;
  background: #f3faf7;
  color: var(--success);
}

.validation-result.has-error {
  border-color: #f0c9ce;
  background: #fff5f6;
  color: var(--danger);
}

.validation-result > span:last-child {
  margin-left: auto;
  color: var(--ink-muted);
  font-size: 8px;
}

.issue-list {
  padding: 3px 10px 10px;
}

.issue-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 2px;
  border-bottom: 1px solid var(--line-soft);
}

.issue-icon {
  display: grid;
  width: 23px;
  height: 23px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  background: var(--warning-soft);
  color: var(--warning);
}

.issue-row.error .issue-icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.issue-row.success .issue-icon {
  background: var(--success-soft);
  color: var(--success);
}

.issue-row > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.issue-row strong {
  color: #46536a;
  font-size: 9px;
}

.issue-row span {
  color: var(--ink-muted);
  font-size: 8px;
  line-height: 1.45;
}

.empty-validation {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 2px;
  color: #738097;
  font-size: 8px;
}

.inspector-section {
  padding: 12px 10px;
  border-top: 1px solid var(--line-soft);
}

.dependency-map {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1.25fr) 16px minmax(0, 1fr);
  align-items: center;
  gap: 3px;
}

.dependency-node {
  display: flex;
  min-width: 0;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fafbfd;
  color: #526076;
  text-align: center;
}

.dependency-node.current {
  border-color: var(--brand-border);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.dependency-node strong,
.dependency-node span {
  max-width: 100%;
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dependency-node small {
  color: var(--ink-muted);
  font-size: 7px;
}

.dependency-line {
  height: 1px;
  background: var(--line);
}

.inspector-preview-action {
  margin-top: auto;
  padding: 11px;
  border-top: 1px solid var(--line-soft);
}

.preview-button {
  width: 100%;
  border-color: var(--brand-border);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

/* ========================================================================== 
   13. 抽屉、模态框、确认态与短时 Toast
   ========================================================================== */
.drawer-backdrop,
.modal-backdrop,
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 39, 0.34);
  backdrop-filter: blur(2px);
  animation: fade-in 150ms ease-out;
}

.drawer-backdrop,
.modal-backdrop {
  z-index: 60;
}

.yaml-drawer {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  width: min(610px, 62vw);
  height: 100%;
  margin-left: auto;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -18px 0 50px rgba(20, 29, 48, 0.18);
  animation: slide-in 210ms cubic-bezier(0.2, 0.75, 0.25, 1);
}

.drawer-header,
.modal-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
  padding: 17px 18px;
  border-bottom: 1px solid var(--line-soft);
}

.drawer-header h2,
.modal-header h2 {
  color: #273247;
  font-size: 15px;
  letter-spacing: -0.02em;
}

.drawer-header p,
.modal-header p {
  margin-top: 2px;
  color: var(--ink-muted);
  font-size: 9px;
}

.drawer-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft);
}

.segmented-control {
  display: inline-flex;
  min-width: 0;
  padding: 3px;
  border-radius: 8px;
  background: #eef1f5;
}

.segmented-control button {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  color: #718096;
  font-size: 9px;
  white-space: nowrap;
}

.segmented-control button.active,
.segmented-control button[aria-pressed="true"] {
  background: #ffffff;
  color: var(--brand-strong);
  box-shadow: var(--shadow-sm);
}

.yaml-meta-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid #273245;
  background: #192231;
  color: #8390a5;
  font-size: 8px;
}

.yaml-meta-row > span:first-child {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #72bf98;
}

.yaml-code {
  min-width: 0;
  min-height: 0;
  padding: 12px 0;
  overflow: auto;
  background: #151d2a;
  color: #c5cfdd;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.65;
}

.yaml-code > div {
  display: grid;
  grid-template-columns: 45px minmax(max-content, 1fr);
  min-width: max-content;
}

.yaml-code > div > span {
  padding-right: 10px;
  border-right: 1px solid #293346;
  color: #536075;
  text-align: right;
  user-select: none;
}

.yaml-code code {
  padding: 0 13px;
  white-space: pre;
}

.drawer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 8px 14px;
  border-top: 1px solid var(--line);
  color: #68758a;
  font-size: 8px;
}

.drawer-footer svg {
  color: var(--success);
}

.modal-backdrop {
  display: grid;
  place-items: center;
  padding: 24px;
}

.modal-card {
  display: flex;
  width: min(480px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 13px;
  background: #ffffff;
  box-shadow: var(--shadow-lg);
  animation: modal-in 180ms cubic-bezier(0.2, 0.8, 0.25, 1);
}

.modal-card.modal-large,
.modal-card.large {
  width: min(760px, calc(100vw - 48px));
}

.modal-body {
  min-width: 0;
  min-height: 0;
  padding: 17px 18px 6px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  min-height: 58px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 18px;
  border-top: 1px solid var(--line-soft);
  background: #fafbfc;
}

.modal-form {
  min-width: 0;
}

.confirm-copy {
  color: var(--ink-secondary);
  font-size: 11px;
  line-height: 1.7;
}

.import-textarea,
.full-import-textarea {
  min-height: 290px !important;
  padding: 11px !important;
  resize: vertical !important;
  background: #161e2d !important;
  color: #c3ccdb !important;
  font-family: var(--font-mono) !important;
  font-size: 9px !important;
  line-height: 1.65 !important;
}

.publish-counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.publish-counts > div {
  display: flex;
  min-height: 74px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fafbfd;
}

.publish-counts strong {
  color: var(--brand-strong);
  font-size: 20px;
}

.publish-counts span {
  color: var(--ink-muted);
  font-size: 8px;
}

.toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 100;
  display: flex;
  width: min(330px, calc(100vw - 36px));
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 10px 11px;
  border: 1px solid #cfe5da;
  border-radius: 9px;
  background: #ffffff;
  box-shadow: var(--shadow-md);
  animation: toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.toast > span:first-child,
.toast-icon {
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  background: var(--success-soft);
  color: var(--success);
}

.toast-warning {
  border-color: #ead9bb;
}

.toast.warning {
  border-color: #ead9bb;
}

.toast-warning > span:first-child,
.toast-warning .toast-icon {
  background: var(--warning-soft);
  color: var(--warning);
}

.toast-error {
  border-color: #efcdd0;
}

.toast.error {
  border-color: #efcdd0;
}

.toast-error > span:first-child,
.toast-error .toast-icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.toast > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

/* 轻量脚本的 Toast 直接使用 strong + span，不要求额外图标包裹结构。 */
.toast > strong {
  color: #354157;
  font-size: 10px;
}

.toast > strong + span {
  color: #8792a4;
  font-size: 8px;
}

.toast.leaving {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast strong {
  color: #354157;
  font-size: 10px;
}

.toast small {
  color: #8792a4;
  font-size: 8px;
}

/* ========================================================================== 
   14. 中等桌面：优先保证编辑区宽度，检查栏可折叠隐藏
   ========================================================================== */
@media (max-width: 1270px) and (min-width: 900px) {
  .studio-grid:not(.base-studio-grid):not(.base-grid):not(.yaml-grid) {
    grid-template-columns: 226px minmax(0, 1fr);
  }

  .studio-grid:not(.base-studio-grid):not(.base-grid):not(.yaml-grid) > .inspector-panel {
    display: none;
  }

  .base-studio-grid,
  .studio-grid.base-grid,
  .studio-grid.yaml-grid {
    grid-template-columns: 210px minmax(0, 1fr);
  }
}

/* ========================================================================== 
   15. 小于 900px：可收起侧栏、纵向编辑器与无页面级横向溢出
   ========================================================================== */
@media (max-width: 899px) {
  :root {
    --header-height: auto;
  }

  body {
    overflow: hidden;
  }

  .app-shell {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 80;
    width: min(280px, 84vw);
    transform: translateX(-102%);
    box-shadow: 18px 0 48px rgba(15, 23, 39, 0.24);
    transition: transform 190ms cubic-bezier(0.2, 0.75, 0.25, 1);
  }

  .sidebar.open,
  .sidebar[data-open="true"],
  .app-shell.sidebar-open .sidebar,
  .app-shell[data-sidebar-open="true"] .sidebar {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    z-index: 70;
  }

  .sidebar-backdrop.open,
  .sidebar-backdrop[data-open="true"],
  .app-shell.sidebar-open .sidebar-backdrop,
  .app-shell[data-sidebar-open="true"] .sidebar-backdrop {
    display: block;
  }

  .sidebar-toggle,
  .mobile-menu-button {
    position: fixed;
    top: 15px;
    left: 12px;
    z-index: 55;
    display: inline-grid;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    place-items: center;
    padding: 0;
    border: 1px solid #dce1ea;
    border-radius: 8px;
    background: #ffffff;
    color: var(--ink-secondary);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .main-shell,
  .workspace-page {
    width: 100%;
    min-width: 0;
    height: 100vh;
    height: 100dvh;
  }

  .page-header,
  .workspace-header {
    min-height: 68px;
    flex: 0 0 auto;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px 12px 58px;
  }

  .title-line {
    min-height: 36px;
    flex-wrap: wrap;
    gap: 6px;
  }

  .title-line h1 {
    font-size: 19px;
  }

  .workspace-status {
    min-height: 21px;
    padding: 0 7px;
  }

  .workspace-actions,
  .header-actions {
    max-width: 66%;
    gap: 5px;
  }

  .workspace-actions .button,
  .header-actions .button {
    min-height: 32px;
    padding: 0 9px;
  }

  .workspace-content {
    width: 100%;
    min-width: 0;
    padding: 12px;
    overflow-x: hidden;
  }

  .nodes-workspace {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .parsed-nodes-panel {
    min-height: 220px;
    flex: 0 0 auto;
  }

  .json-editor-panel {
    min-height: 520px;
    flex: 0 0 auto;
  }

  .output-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }

  .output-row code,
  .output-url {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .studio-tabs {
    padding: 0 10px;
  }

  .studio-tab {
    padding: 0 10px;
  }

  .studio-content {
    width: 100%;
    min-width: 0;
    padding: 10px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .studio-grid,
  .base-studio-grid,
  .studio-grid.base-grid,
  .studio-grid.yaml-grid {
    display: flex;
    width: 100%;
    height: auto;
    min-width: 0;
    flex-direction: column;
    gap: 10px;
  }

  .studio-grid > .entity-panel,
  .studio-grid > .editor-panel,
  .studio-grid > .inspector-panel {
    width: 100%;
    min-width: 0;
    min-height: 320px;
    flex: 0 0 auto;
  }

  .studio-grid > .editor-panel {
    min-height: 580px;
  }

  .studio-grid > .inspector-panel {
    min-height: 300px;
  }

  .entity-list,
  .provider-list,
  .category-list,
  .yaml-outline-list {
    max-height: 300px;
  }

  .source-fields {
    align-items: stretch;
    flex-direction: column;
  }

  .source-fields .field,
  .source-fields .compact-field,
  .source-fields .grow-field {
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
  }

  .form-grid.two-columns,
  .form-grid.three-columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-two {
    grid-column: auto;
  }

  .template-editor-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
    padding-top: 7px;
    padding-bottom: 7px;
  }

  .template-editor-status {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding-top: 7px;
    padding-bottom: 7px;
    white-space: normal;
  }

  .yaml-drawer {
    width: 100%;
    max-width: none;
  }

  .drawer-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .segmented-control {
    width: 100%;
    overflow-x: auto;
  }

  .segmented-control button {
    flex: 1 0 auto;
  }

  .modal-backdrop {
    align-items: end;
    padding: 10px;
  }

  .modal-card,
  .modal-card.modal-large,
  .modal-card.large {
    width: 100%;
    max-height: calc(100dvh - 20px);
    border-radius: 13px;
  }

  .toast {
    right: 12px;
    bottom: 12px;
    width: calc(100vw - 24px);
  }
}

/* ========================================================================== 
   16. 手机窄屏细化：标题操作、表格容器与弹窗按钮
   ========================================================================== */
@media (max-width: 560px) {
  .login-screen {
    align-items: center;
    padding: 18px;
  }

  .login-brand {
    padding: 19px 20px;
  }

  .login-form {
    padding: 22px 20px 24px;
  }

  .page-header,
  .workspace-header {
    align-items: stretch;
    flex-direction: column;
  }

  .workspace-actions,
  .header-actions {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .workspace-actions .button,
  .header-actions .button {
    flex: 0 0 auto;
  }

  .subscription-panel,
  .output-panel {
    border-radius: 8px;
  }

  .output-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .output-row .button {
    width: 100%;
  }

  .output-row code,
  .output-url {
    grid-column: 1;
    grid-row: auto;
  }

  .panel-header {
    align-items: flex-start;
  }

  .panel-header-actions {
    flex-wrap: nowrap;
  }

  .source-menu {
    position: fixed;
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
  }

  .publish-counts {
    grid-template-columns: minmax(0, 1fr);
  }

  .modal-footer {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .modal-footer .button {
    width: 100%;
  }
}

/* ========================================================================== 
   17. 可读性字号层级：放大正文、控件和辅助信息

   原型为高密度展示使用了大量 7–10px 字号，在真实桌面上会明显增加阅读负担。
   以下覆盖不使用页面缩放，而是提升语义层级并同步增加控件高度，确保布局仍可重排。
   ========================================================================== */
.brand-name {
  font-size: 16px;
}

.brand-subtitle {
  font-size: var(--text-sm);
}

.nav-item {
  min-height: 46px;
  font-size: var(--text-body);
}

.nav-item .nav-icon {
  font-size: var(--text-xs);
}

.title-line h1,
.login-form h1 {
  font-size: var(--text-title);
}

.workspace-status,
.status-pill,
.tab-count,
.count-badge {
  font-size: var(--text-sm);
}

.button {
  min-height: 36px;
  padding-right: 14px;
  padding-left: 14px;
  font-size: var(--text-md);
}

.button.small {
  min-height: 32px;
  font-size: var(--text-sm);
}

.icon-button,
.icon-button.subtle {
  min-height: 32px;
  font-size: var(--text-sm);
}

.studio-tab {
  min-height: 48px;
  font-size: var(--text-md);
}

.panel-header h2,
.simple-panel-head h2,
.centered-empty h2 {
  font-size: var(--text-lg);
}

.panel-header p,
.simple-panel-head p,
.drawer-header p,
.modal-header p,
.modal-help,
.field-help,
.form-help,
.inline-help {
  font-size: var(--text-sm);
  line-height: 1.5;
}

.field > span,
.field-label,
.switch-label,
.source-label,
.checkbox-row,
.form-section label > span {
  font-size: var(--text-sm);
}

.field em,
.field-hint,
.muted-label,
.meta-copy {
  font-size: var(--text-xs);
}

.field input,
.field select,
.field textarea,
.panel-search input,
.inline-search input,
.source-fields input,
.source-fields select,
.data-table input:not([type="checkbox"]),
.data-table select,
.data-table textarea,
.regex-input,
.url-field {
  min-height: 38px;
  padding-right: 12px;
  padding-left: 12px;
  font-size: var(--text-md);
  line-height: 1.45;
}

.data-table input[type="checkbox"] {
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  accent-color: var(--brand);
}

.field-error,
.cell-error,
.form-error,
.inline-error,
.empty-search,
.empty-validation,
.empty-source,
.empty-state,
.centered-empty {
  font-size: var(--text-sm);
  line-height: 1.5;
}

.empty-state strong,
.centered-empty h2 {
  font-size: var(--text-lg);
}

.data-table th {
  min-height: 44px;
  font-size: var(--text-sm);
}

.data-table td {
  font-size: var(--text-md);
}

.output-type strong {
  font-size: var(--text-body);
}

.output-type span,
.output-row code,
.output-url {
  font-size: var(--text-sm);
}

.node-protocol,
.code-toolbar,
.yaml-line-rail,
.editor-validation {
  font-size: var(--text-xs);
}

.parsed-node-row strong,
.entity-copy strong,
.provider-row strong,
.outline-key-copy strong,
.section-heading h3,
.section-title-row strong,
.source-type {
  font-size: var(--text-md);
}

.parsed-node-row span,
.entity-copy small,
.provider-row small,
.outline-key-copy small,
.feature-pill,
.match-count,
.node-chip {
  font-size: var(--text-xs);
  line-height: 1.45;
}

.base-yaml-textarea,
.node-json-textarea,
.import-textarea,
.yaml-code {
  font-size: var(--text-md);
  line-height: 1.65;
}

.entity-row {
  min-height: 54px;
}

.category-row,
.outline-row {
  min-height: 42px;
  font-size: var(--text-md);
}

.category-row small,
.outline-row small,
.rule-result-count {
  font-size: var(--text-sm);
}

.inline-add-button,
.segmented-control button,
.validation-result,
.issue-row strong,
.dependency-node strong,
.toast strong {
  font-size: var(--text-sm);
}

.validation-result span,
.issue-row span,
.dependency-node span,
.dependency-node small,
.yaml-meta-row,
.drawer-footer,
.publish-counts span,
.toast span {
  font-size: var(--text-xs);
}

.rules-table {
  min-width: 1120px;
}

.rules-table th {
  font-size: var(--text-xs);
}

.rules-table td {
  min-height: 60px;
  vertical-align: middle;
}

.rule-remark-input {
  width: 100%;
  min-width: 180px;
  min-height: 44px !important;
  padding: 7px 9px !important;
  resize: vertical;
  line-height: 1.4 !important;
}

.row-order-actions button,
.danger-text {
  font-size: var(--text-xs);
}

.import-error-list {
  max-height: 220px;
  margin-top: 12px;
  overflow: auto;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: var(--text-sm);
}

.import-error-list:empty {
  display: none;
}

.import-error-list > strong {
  display: block;
  padding: 10px 12px 4px;
  font-size: var(--text-md);
}

.import-error-list ul {
  margin: 0;
  padding: 6px 12px 10px 30px;
}

.import-error-list li {
  margin: 5px 0;
}

.import-error-list code {
  margin-right: 8px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

@media (max-width: 560px) {
  .title-line h1 {
    font-size: 20px;
  }

  .button,
  .studio-tab,
  .nav-item {
    font-size: var(--text-md);
  }
}

/* ========================================================================== 
   18. 较矮视口：压缩固定区域，为编辑器保留可用高度
   ========================================================================== */
@media (max-height: 760px) and (min-width: 900px) {
  .page-header,
  .workspace-header,
  .routing-workspace .workspace-header {
    min-height: 68px;
    flex-basis: 68px;
    padding-top: 11px;
    padding-bottom: 11px;
  }

  .workspace-content {
    padding-top: 12px;
  }

  .panel-header {
    min-height: 52px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
}

/* ========================================================================== 
   19. 动效与减少动态效果偏好
   ========================================================================== */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in {
  from { transform: translateX(28px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes modal-in {
  from { transform: translateY(10px) scale(0.985); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes toast-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
