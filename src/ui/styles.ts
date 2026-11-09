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
  /* 辅助文字仍需在白色与浅灰表面保持足够对比度。 */
  --ink-muted: #66738a;
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
  /* 操作列需要同时容纳删除按钮和表格单元格的左右留白。 */
  width: 72px;
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

/* 多行数据使用轻量斑马纹，横向扫读时更容易保持在同一行。 */
.data-table tbody tr:nth-child(even) {
  background: #f8f9fc;
}

.data-table tbody tr:hover {
  background: #f2f5fb;
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

.subscription-table .icon-button {
  height: 38px;
  min-height: 38px;
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

.output-row:nth-child(even) {
  background: #f8f9fc;
}

.output-row:hover {
  background: #f2f5fb;
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

.output-type > div {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
}

.output-type strong,
.output-type span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* 配置帮助与编辑器一起显示，长说明在手机上自然换行。 */
.node-config-help {
  flex: 0 0 auto;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line-soft);
  background: #f4f7fb;
  color: #526079;
  font-size: var(--text-sm);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.node-config-help a {
  color: #285bb5;
  text-decoration: underline;
  text-underline-offset: 3px;
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
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-width: 0;
  align-items: center;
  gap: 11px;
  padding: 10px 9px;
  border-bottom: 1px solid var(--line-soft);
}

.parsed-node-row:nth-child(even) {
  background: #f8f9fc;
}

.parsed-node-row:hover {
  background: #f2f5fb;
}

.node-protocol {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 27px;
  place-items: center;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
}

.parsed-node-row > div {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
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

.code-toolbar > span,
.template-editor-toolbar > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-toolbar > span:last-child,
.template-editor-toolbar > span:last-child {
  flex: 0 0 auto;
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

/* 规则目录与规则编辑页签相邻，窄屏允许简介换行，不挤占编辑栏宽度。 */
.rule-source-reference {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--surface);
  color: var(--ink-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.rule-source-reference a {
  color: var(--brand-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
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
.outline-list,
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
.yaml-outline-list button,
.outline-list button {
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
.yaml-outline-list,
.outline-list {
  padding: 4px 7px 8px;
}

/* 长列表同样保持奇偶行节奏，选中态会在下方规则中覆盖此背景。 */
.entity-list > .entity-row:nth-child(even),
.provider-list > .entity-row:nth-child(even),
.provider-list > .provider-row:nth-child(even) {
  background: #f8f9fc;
}

.entity-row:hover,
.provider-row:hover,
.category-row:hover,
.yaml-outline-list button:hover,
.outline-list button:hover {
  background: #f7f8fb;
}

.entity-row.active,
.entity-row[aria-selected="true"],
.provider-row.active,
.category-row.active,
.yaml-outline-list button.active,
.outline-list button.active {
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
  color: #68758a;
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

.switch-label input:focus-visible + .switch-control,
.mini-switch input:focus-visible + span {
  outline: 3px solid rgba(63, 99, 223, 0.2);
  outline-offset: 2px;
}

.switch-label input:checked + .switch-control::after,
.mini-switch input:checked + span::after {
  transform: translateX(13px);
}

.source-stack,
.source-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.button-cluster {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.source-heading > div:first-child {
  min-width: 180px;
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

.source-card-head > strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.source-actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  flex-wrap: wrap;
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

/* 节点匹配结果使用可换行标签，避免长节点名再次粘连成一整段文字。 */
.node-preview-list {
  display: flex;
  max-height: 220px;
  min-width: 0;
  min-height: 46px;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  padding: 2px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #c9d0dc transparent;
}

.node-chip,
.node-preview-more {
  display: inline-flex;
  max-width: 100%;
  min-height: 30px;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid #dfe4ec;
  border-radius: 999px;
  background: #f9fafc;
  color: #4f5c71;
  overflow-wrap: anywhere;
}

.node-chip::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
  content: "";
}

.node-preview-more {
  border-style: dashed;
  background: #ffffff;
  color: var(--ink-muted);
}

.preview-count {
  display: inline-flex;
  min-height: 28px;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: var(--text-xs);
  font-weight: 700;
  white-space: nowrap;
}

.node-preview-empty {
  width: 100%;
  padding: 13px 14px;
  border: 1px dashed #d7ddea;
  border-radius: 9px;
  background: #fafbfe;
  color: var(--ink-muted);
  font-size: var(--text-sm);
  line-height: 1.55;
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
   10.1 策略组内嵌分流规则

   规则继续以扁平数组保存，但在编辑层级中归属于策略组；用户可以在同一
   工作区切换“当前策略组”和“全局顺序”，兼顾常规配置效率与最终顺序校验。
   ========================================================================== */
.unified-group-list {
  min-width: 0;
}

.unified-group-row {
  gap: 7px;
}

.group-row-select {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.unified-group-row .row-order-actions {
  flex-direction: column;
  gap: 1px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.unified-group-row:hover .row-order-actions,
.unified-group-row.active .row-order-actions,
.unified-group-row:focus-within .row-order-actions {
  opacity: 1;
}

.group-rule-badge {
  display: inline-flex;
  min-width: 42px;
  min-height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: var(--text-xs);
  font-weight: 700;
  white-space: nowrap;
}

.group-rule-badge.empty {
  background: #f1f3f6;
  color: #929bac;
}

.unified-group-editor {
  min-width: 0;
  overflow: hidden;
}

.unified-editor-header {
  min-height: 68px;
}

.unified-editor-header > div:first-child {
  min-width: 0;
  flex: 1 1 auto;
}

.unified-editor-header h2 {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unified-group-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
  padding: 14px 16px 15px;
  border-bottom: 1px solid var(--line);
  background: #fbfcff;
}

.group-pane-tabs {
  display: flex;
  min-height: 48px;
  flex: 0 0 auto;
  align-items: stretch;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: #ffffff;
}

.group-pane-tabs button {
  position: relative;
  display: inline-flex;
  min-width: 142px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: #68758a;
  font-size: var(--text-md);
  font-weight: 650;
  cursor: pointer;
}

.group-pane-tabs button::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 2px;
  background: transparent;
  content: "";
}

.group-pane-tabs button.active {
  color: var(--brand-strong);
}

.group-pane-tabs button.active::after {
  background: var(--brand);
}

.group-pane-tabs button span {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #eef1f6;
  color: #727d90;
  font-size: var(--text-xs);
}

.group-pane-tabs button.active span {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.unified-editor-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  /* 重绘后由脚本恢复位置，避免浏览器滚动锚定再次调整同一容器。 */
  overflow-anchor: none;
  background: #f7f8fb;
  scrollbar-width: thin;
  scrollbar-color: #c9d0dc transparent;
}

.studio-content,
.unified-group-list .entity-list {
  /* 窄屏外层与策略组列表也参与位置恢复。 */
  overflow-anchor: none;
}

.nested-group-settings {
  min-height: 100%;
  background: #ffffff;
}

.nested-rules-panel {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 11px;
  padding: 16px;
}

.nested-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.nested-section-heading h3 {
  margin: 0;
  color: #2f3a50;
  font-size: var(--text-lg);
}

.nested-section-heading p,
.nested-group-settings .section-heading p {
  margin: 3px 0 0;
  color: #7f899b;
  font-size: var(--text-sm);
  line-height: 1.5;
}

.nested-rule-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.nested-rule-scope {
  flex: 0 0 auto;
}

.nested-rule-scope button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.nested-rule-scope button span {
  display: inline-grid;
  min-width: 20px;
  height: 18px;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  font-size: var(--text-xs);
}

.nested-rule-search {
  min-width: 200px;
  max-width: 310px;
  flex: 1;
}

.nested-rule-search input {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 0 11px;
  border: 1px solid #dce1e9;
  border-radius: 7px;
  outline: 0;
  background: #ffffff;
  color: var(--ink);
  font-size: var(--text-md);
}

.nested-rule-search input:focus {
  border-color: #91a0cd;
  box-shadow: 0 0 0 3px rgba(78, 94, 158, 0.09);
}

.selected-rule-toolbar,
.rule-selection-hint {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  border: 1px solid #d8def0;
  border-radius: 8px;
  background: #f1f4ff;
  color: #59677f;
}

.selected-rule-toolbar {
  position: sticky;
  top: -1px;
  z-index: 4;
  justify-content: space-between;
  padding: 5px 7px 5px 12px;
  box-shadow: 0 7px 16px rgba(40, 50, 75, 0.06);
}

.selected-rule-toolbar > div:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.selected-rule-toolbar > div:first-child span {
  color: #7c879a;
  font-size: var(--text-xs);
}

.selected-rule-toolbar > div:first-child strong {
  color: var(--brand-strong);
  font-size: var(--text-sm);
}

.selected-rule-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

.selected-rule-actions button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #56647a;
  font-size: var(--text-xs);
  cursor: pointer;
  white-space: nowrap;
}

.selected-rule-actions button:hover:not(:disabled) {
  background: #ffffff;
  color: var(--brand-strong);
}

.selected-rule-actions button.danger {
  color: var(--danger);
}

.selected-rule-actions button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.rule-selection-hint {
  justify-content: center;
  padding: 0 12px;
  border-style: dashed;
  background: #fafbfe;
  color: #7d8799;
  font-size: var(--text-sm);
}

.nested-rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-rule-record {
  overflow: hidden;
  border: 1px solid #dfe3eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 1px rgba(23, 31, 49, 0.02);
  transition: border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}

/* 一条规则可能包含主、副两行，因此以整张记录卡交替着色。 */
.nested-rule-list > .nested-rule-record:nth-of-type(even) {
  background: #f7f9fd;
}

.nested-rule-record:hover {
  background: #f2f5fb;
  border-color: #cbd3e1;
  box-shadow: 0 5px 16px rgba(28, 38, 63, 0.06);
}

.nested-rule-record.selected {
  background: #f1f4ff;
  border-color: #8999ce;
  box-shadow: 0 0 0 2px rgba(78, 94, 158, 0.11), 0 6px 18px rgba(40, 52, 86, 0.08);
}

.nested-rule-record.disabled {
  opacity: 0.57;
}

.nested-rule-primary {
  display: grid;
  grid-template-columns: 48px 28px minmax(118px, 0.55fr) minmax(190px, 1.5fr) 48px;
  align-items: center;
  gap: 7px;
  padding: 9px 9px 7px;
}

.nested-rule-primary.with-target {
  grid-template-columns: 48px 28px minmax(118px, 0.55fr) minmax(170px, 1.35fr) minmax(130px, 0.7fr) 48px;
}

.rule-order-button {
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid #d9deea;
  border-radius: 6px;
  background: #f7f8fb;
  color: #68758a;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
}

.nested-rule-record.selected .rule-order-button {
  border-color: #8798d0;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.nested-rule-enable {
  display: grid;
  place-items: center;
}

.nested-rule-enable input,
.nested-rule-option input {
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  accent-color: var(--brand);
}

.nested-rule-primary select,
.nested-rule-primary input,
.nested-rule-secondary input {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  outline: 0;
  background: #ffffff;
  color: #465369;
  font-size: var(--text-md);
}

.nested-rule-primary select:focus,
.nested-rule-primary input:focus,
.nested-rule-secondary input:focus {
  border-color: #8f9dca;
  box-shadow: 0 0 0 3px rgba(78, 94, 158, 0.08);
}

.nested-rule-type {
  font-family: var(--font-mono);
}

.nested-rule-placeholder {
  display: flex;
  min-width: 0;
  min-height: 38px;
  align-items: center;
  padding: 0 10px;
  border: 1px dashed #d7dce6;
  border-radius: 6px;
  color: #9099a9;
  font-size: var(--text-sm);
}

.rule-copy-button {
  display: grid;
  min-width: 46px;
  min-height: 38px;
  place-items: center;
  padding: 0 7px;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  background: #ffffff;
  color: #727e91;
  font-size: var(--text-xs);
  cursor: pointer;
}

.rule-copy-button:hover:not(:disabled) {
  border-color: #aeb9d5;
  color: var(--brand-strong);
}

.rule-copy-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nested-rule-secondary {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(110px, 0.35fr) auto;
  align-items: center;
  gap: 7px;
  padding: 0 9px 9px 84px;
}

.nested-rule-option {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: #657187;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.empty-rule-group {
  display: grid;
  width: 100%;
  min-height: 190px;
  place-items: center;
  align-content: center;
  gap: 7px;
  border: 1px dashed #cfd6e2;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.64);
  color: #7f899a;
  cursor: pointer;
}

.empty-rule-group strong {
  color: #46536a;
  font-size: var(--text-md);
}

.empty-rule-group span {
  font-size: var(--text-sm);
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
.yaml-outline-list button,
.outline-list button {
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
  grid-template-rows: auto auto auto minmax(0, 1fr);
  width: min(760px, 72vw);
  max-width: 100%;
  height: 100%;
  min-height: 0;
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

.validation-result.is-idle,
.validation-result.is-stale {
  border-color: #e6d8bd;
  background: var(--warning-soft);
  color: var(--warning);
}

/* 完整输出的筛选与操作区在中等宽度下允许自然换行。 */
.preview-controls {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: #ffffff;
}

.preview-controls label {
  display: grid;
  min-width: 132px;
  flex: 1 1 150px;
  gap: 4px;
  color: var(--ink-muted);
  font-size: var(--text-xs);
  font-weight: 650;
}

.preview-controls select {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 0 32px 0 10px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #ffffff;
  color: var(--ink-secondary);
  font-size: var(--text-md);
}

.preview-controls .button {
  min-height: 36px;
  flex: 0 0 auto;
}

.yaml-preview-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #273245;
  background: #192231;
  color: #8794a8;
  font-size: var(--text-xs);
}

.yaml-preview-meta > span:first-child {
  color: #76c8a1;
  font-weight: 650;
}

/* 代码区自身承担双向滚动，抽屉标题与操作区始终固定可见。 */
.yaml-preview {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 16px 18px 28px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 0;
  background: #151d2a;
  color: #cbd5e3;
  font-family: var(--font-mono);
  font-size: var(--text-md);
  line-height: 1.68;
  tab-size: 2;
  white-space: pre;
  scrollbar-width: thin;
  scrollbar-color: #58657a #1b2535;
}

.yaml-preview:focus-visible {
  position: relative;
  outline: 3px solid rgba(116, 145, 255, 0.55);
  outline-offset: -3px;
}

.yaml-preview.is-error {
  background: #281b22;
  color: #ffc5ca;
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
  font-size: var(--text-md) !important;
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
@media (max-width: 1380px) and (min-width: 900px) {
  .unified-group-context {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .unified-group-context .field:last-child {
    grid-column: 1 / -1;
  }

  .selected-rule-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .selected-rule-actions {
    width: 100%;
    overflow-x: auto;
  }
}

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

/*
 * 中等桌面宽度下，左侧策略组列表会压缩规则编辑区。
 * 提前把规则记录重排为多行，避免长规则值和目标策略被父卡片裁切。
 */
@media (max-width: 1180px) and (min-width: 900px),
       (min-width: 1271px) and (max-width: 1380px) {
  .nested-rule-primary,
  .nested-rule-primary.with-target {
    grid-template-columns: 48px 30px minmax(0, 1fr) 48px;
  }

  .nested-rule-type {
    grid-column: 3;
    grid-row: 1;
  }

  .rule-copy-button {
    grid-column: 4;
    grid-row: 1;
  }

  .nested-rule-value,
  .nested-rule-placeholder,
  .nested-rule-target {
    grid-column: 1 / -1;
  }

  .nested-rule-secondary {
    grid-template-columns: minmax(0, 1fr);
    padding-left: 9px;
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
    height: min(320px, 38dvh);
    min-height: 220px;
    max-height: 320px;
    flex: 0 0 auto;
  }

  .json-editor-panel {
    height: min(620px, 72dvh);
    min-height: 520px;
    max-height: 620px;
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

  .studio-grid > .unified-group-list {
    min-height: 300px;
    max-height: 380px;
  }

  .studio-grid > .unified-group-editor {
    min-height: 780px;
  }

  .studio-grid > .unified-group-editor,
  .unified-group-editor .unified-editor-scroll {
    /* 窄屏统一由外层滚动，让选中规则操作栏随列表吸顶，连续移动无需返回列表开头。 */
    overflow: visible;
  }

  .studio-grid > .inspector-panel {
    min-height: 300px;
  }

  .entity-list,
  .provider-list,
  .category-list,
  .yaml-outline-list,
  .outline-list {
    max-height: 300px;
  }

  .unified-group-list .entity-list {
    max-height: 250px;
  }

  .unified-group-context {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-pane-tabs {
    overflow-x: auto;
  }

  .nested-rule-toolbar,
  .nested-section-heading,
  .selected-rule-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .nested-rule-search {
    width: 100%;
    max-width: none;
  }

  .selected-rule-actions {
    width: 100%;
    overflow-x: auto;
  }

  .nested-rule-primary,
  .nested-rule-primary.with-target {
    grid-template-columns: 48px 30px minmax(0, 1fr) 48px;
  }

  .nested-rule-type {
    grid-column: 3;
    grid-row: 1;
  }

  .rule-copy-button {
    grid-column: 4;
    grid-row: 1;
  }

  .nested-rule-value,
  .nested-rule-placeholder,
  .nested-rule-target {
    grid-column: 1 / -1;
  }

  .nested-rule-secondary {
    grid-template-columns: minmax(0, 1fr);
    padding-left: 9px;
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

/* 触屏设备没有稳定的悬停态，排序操作必须保持可见。 */
@media (hover: none) {
  .unified-group-row .row-order-actions {
    opacity: 1;
  }

  .row-order-actions button,
  .selected-rule-actions button,
  .segmented-control button,
  .password-toggle {
    min-height: 44px;
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

  /* 标题仍为菜单按钮预留位置，操作栏则回到整行并优先显示主操作。 */
  .workspace-actions {
    width: calc(100% + 46px);
    margin-left: -46px;
  }

  .workspace-actions .button,
  .header-actions .button {
    flex: 0 0 auto;
  }

  .workspace-actions .button.primary {
    order: -1;
  }

  .subscription-panel,
  .output-panel {
    border-radius: 8px;
  }

  /* 窄屏横向浏览表格时固定操作列，让删除入口始终可见。 */
  .subscription-table th:last-child,
  .subscription-table td:last-child {
    position: sticky;
    right: 0;
    z-index: 2;
    background: #ffffff;
    box-shadow: -10px 0 14px -14px rgba(24, 35, 58, 0.7);
  }

  .subscription-table th:last-child {
    z-index: 3;
    background: #f7f8fa;
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
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .source-heading {
    flex-direction: column;
  }

  .button-cluster {
    width: 100%;
    justify-content: flex-start;
  }

  .preview-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    padding: 10px 12px;
  }

  .preview-controls label,
  .preview-controls .button {
    width: 100%;
    min-width: 0;
  }

  .yaml-preview-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
    padding: 7px 12px;
  }

  .yaml-preview {
    padding: 13px 14px 24px;
    font-size: 12px;
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

/* 使用更具体的选择器覆盖早期高密度原型字号。 */
.parsed-node-row > div span,
.toast > strong + span {
  font-size: var(--text-xs);
  line-height: 1.45;
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

/* 全局 UA 设置独立于源列表，窄屏自动换行以保留完整输入宽度。 */
.subscription-ua-panel { padding: 20px; margin-bottom: 18px; }
.subscription-ua-panel h2 { margin: 0; font-size: 15px; }
.subscription-ua-panel p { color: var(--ink-muted); margin: 8px 0 14px; font-size: 13px; }
.global-ua-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
.global-ua-controls .field { flex: 1 1 280px; min-width: 0; margin: 0; }
.global-ua-controls input { font-family: var(--font-mono); }
.global-ua-controls .button { margin-bottom: 0; }
.subscription-ua-panel .field-error { display: block; margin-top: 6px; }

/* 错误日志沿用控制台面板，长响应头与移动屏幕均可自然换行。 */
.logs-workspace { overflow: auto; display: block; }
.diagnostic-panel { padding: 22px; margin-bottom: 20px; }
.diagnostic-panel h2 { margin: 0 0 8px; font-size: 16px; }
.diagnostic-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin: 18px 0 10px; }
.diagnostic-controls label { display: grid; gap: 6px; flex: 1 1 240px; min-width: 0; }
.diagnostic-controls input, .diagnostic-controls select { width: 100%; min-width: 0; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px 10px; background: var(--surface); }
.log-list-panel { overflow: hidden; }
.log-category-tabs { display: flex; gap: 8px; padding: 14px 20px 0; }
.log-access-summary { display: grid; grid-template-columns: minmax(130px, 1fr) minmax(0, 3fr); gap: 12px 22px; margin: 14px 0; }
.log-access-summary div { min-width: 0; }
.log-access-summary dt { color: var(--ink-muted); font-size: 12px; }
.log-access-summary dd { margin: 3px 0 0; font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .log-access-summary { grid-template-columns: minmax(0, 1fr); } }
.log-retention-note { padding: 0 20px; color: var(--ink-muted); }
.log-entry { padding: 18px 20px; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
.log-entry:nth-child(even) { background: var(--surface-subtle); }
.log-entry-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.log-entry-heading time { margin-left: auto; color: var(--ink-muted); font-size: 12px; }
.log-entry p { margin: 9px 0; }
.log-entry code { font-size: 12px; color: var(--ink-secondary); }
.log-hint { color: var(--ink-muted); font-size: 13px; }
.log-level { padding: 2px 9px; border-radius: 5px; font-size: 12px; }
.log-level.error { background: var(--danger-soft); color: var(--danger); }
.log-level.warning { background: var(--warning-soft); color: var(--warning); }
.log-level.info { background: var(--success-soft); color: var(--success); }
.log-entry summary { cursor: pointer; color: var(--brand); font-size: 13px; }
.log-metadata { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px 22px; }
.log-metadata div { min-width: 0; }
.log-metadata dt { color: var(--ink-muted); font-size: 12px; }
.log-metadata dd { margin: 0; font-family: var(--font-mono); font-size: 12px; }
.log-pagination { padding: 16px 20px; border-top: 1px solid var(--line); }

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
