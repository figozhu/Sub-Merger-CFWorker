/**
 * 新版控制台的轻量浏览器脚本。
 * 使用事件委托和原生 DOM API 实现完整交互，不引入 React、Babel 或 CDN 运行时。
 */
export const consoleClientScript = String.raw`
(() => {
  'use strict';

  const VALID_NAVS = ['subscriptions', 'nodes', 'routing', 'links', 'logs'];
  const MANAGED_YAML_KEYS = ['proxies', 'proxy-groups', 'rule-providers', 'rules'];
  /** 仅供 UI 使用的虚拟分组 ID，不会写入路由配置或生成到 Clash YAML。 */
  const UNASSIGNED_RULES_GROUP_ID = '__ui_unassigned_rules__';
  const workspace = document.getElementById('workspace');
  const overlayRoot = document.getElementById('overlay-root');
  const toastRoot = document.getElementById('toast-root');
  const sidebar = document.getElementById('sidebar');
  /** 记录打开浮层前的焦点元素，关闭后尽量把键盘操作位置还给用户。 */
  let overlayReturnFocus = null;
  /** 完整预览生成新节点摘要后，关闭浮层时需要重绘后台页面。 */
  let overlayNeedsRender = false;
  /** 上次渲染的路由视图标识，用于区分原地编辑和主动切换策略组/搜索范围。 */
  let renderedRoutingView = null;

  /** 控制台全部可变状态；只保存真实 API 数据和当前编辑状态。 */
  const state = {
    activeNav: 'subscriptions',
    applicationError: '',
    subscriptions: [],
    subscriptionsBaseline: '[]',
    subscriptionErrors: {},
    userAgent: '',
    userAgentBaseline: '',
    defaultUserAgent: '',
    userAgentError: '',
    selfNodesRaw: '[]',
    selfNodesBaseline: '[]',
    selfNodeAnalysis: { valid: true, nodes: [], errors: [] },
    outputs: [],
    logs: [],
    logsCategory: 'diagnostic',
    logsCursor: '',
    logsLoaded: false,
    logsLoading: false,
    logsError: '',
    diagnostic: null,
    diagnosticSourceIndex: '0',
    diagnosticUserAgent: '',
    routing: null,
    routingBaseline: '',
    routingTab: 'groups',
    selectedGroupId: '',
    selectedRuleId: '',
    selectedProviderId: '',
    groupPane: 'rules',
    groupRuleScope: 'group',
    groupQuery: '',
    ruleQuery: '',
    providerQuery: '',
    routingIssues: { errors: [], warnings: [] },
    routingValidatedSnapshot: '',
    routingPreviews: {},
    previewRequestId: 0,
    busy: new Set(),
    suppressHash: false,
  };

  /**
   * 转义用户数据后再放入 HTML，防止订阅名称、URL 或节点字段形成持久化脚本注入。
   * @param {unknown} value 任意待显示值。
   * @returns {string} 可安全插入文本或属性的字符串。
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 生成不依赖后端的临时稳定 ID。
   * 保存后 ID 会原样进入 KV，重命名和排序不会改变引用。
   * @param {string} prefix 实体前缀。
   * @returns {string} 当前页面会话内唯一的 ID。
   */
  function createId(prefix) {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return prefix + '-' + globalThis.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  /**
   * 深拷贝可序列化配置，避免编辑器修改 API 响应对象的共享引用。
   * @param {unknown} value 可 JSON 序列化的数据。
   * @returns {unknown} 深拷贝结果。
   */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * 找出目标没有指向任何真实 proxy-group 的规则。
   *
   * 这类规则包括 DIRECT、REJECT、迁移保留的直接节点目标，以及引用了已不存在
   * 策略组 ID 的异常旧规则。它们会进入 UI 兜底分组，但目标值保持原样，直到用户
   * 主动把规则改到真实策略组。
   * @returns {Array<object>} 按最终 YAML 顺序排列的未归组规则。
   */
  function getUnassignedRules() {
    if (!state.routing || !state.routing.config) return [];
    const groupIds = new Set(state.routing.config.groups.map(function (group) { return group.id; }));
    return state.routing.config.rules.filter(function (rule) { return !groupIds.has(rule.targetGroupId); });
  }

  /**
   * 读取真实策略组或 UI 兜底分组当前包含的规则。
   *
   * @param {string} groupId 真实策略组 ID，或未归组规则虚拟 ID。
   * @returns {Array<object>} 保持全局顺序的规则数组。
   */
  function getRulesForGroup(groupId) {
    if (!state.routing || !state.routing.config) return [];
    if (groupId === UNASSIGNED_RULES_GROUP_ID) return getUnassignedRules();
    return state.routing.config.rules.filter(function (rule) { return rule.targetGroupId === groupId; });
  }

  /**
   * 判断任意页面是否存在未保存更改。
   * @returns {boolean} 需要离开确认时为 true。
   */
  function hasUnsavedChanges() {
    return JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline
      || state.userAgent !== state.userAgentBaseline
      || state.selfNodesRaw !== state.selfNodesBaseline
      || (state.routing && JSON.stringify(state.routing.config) !== state.routingBaseline);
  }

  /**
   * 向右下角展示短暂 Toast。
   * @param {string} message 主要提示。
   * @param {'success'|'error'|'warning'} tone 状态色。
   * @param {string} detail 可选补充说明。
   */
  function showToast(message, tone, detail) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + (tone || 'success');
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.innerHTML = '<strong>' + escapeHtml(message) + '</strong>' + (detail ? '<span>' + escapeHtml(detail) + '</span>' : '');
    toastRoot.appendChild(toast);
    window.setTimeout(function () { toast.classList.add('leaving'); }, 2800);
    window.setTimeout(function () { toast.remove(); }, 3300);
  }

  /**
   * 统一调用受认证 API，并在会话过期时跳回登录页。
   * @param {string} url API 地址。
   * @param {RequestInit} options fetch 选项。
   * @returns {Promise<any>} 已解析的统一响应 data。
   * @throws 响应失败时抛出带 status、errors 的 Error。
   */
  async function api(url, options) {
    const requestOptions = Object.assign({}, options || {});
    requestOptions.headers = Object.assign({ 'Accept': 'application/json' }, requestOptions.headers || {});
    if (requestOptions.body && !requestOptions.headers['Content-Type']) requestOptions.headers['Content-Type'] = 'application/json';
    const response = await fetch(url, requestOptions);
    if (response.status === 401) {
      window.location.assign('/');
      throw new Error('登录状态已过期');
    }
    let result;
    try { result = await response.json(); } catch (_) { result = { code: 1, msg: '服务返回了无法解析的响应' }; }
    if (!response.ok || result.code !== 0) {
      const error = new Error(result.msg || '请求失败');
      error.status = response.status;
      error.errors = result.errors || [];
      throw error;
    }
    return result.data;
  }

  /**
   * 切换按钮请求状态，阻止重复提交。
   * @param {string} key 操作唯一键。
   * @param {boolean} active 是否进入加载状态。
   */
  function setBusy(key, active) {
    if (active) state.busy.add(key); else state.busy.delete(key);
    document.querySelectorAll('[data-busy-key="' + key + '"]').forEach(function (button) {
      if (active) {
        button.setAttribute('data-busy-was-disabled', button.disabled ? 'true' : 'false');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
      } else if (button.hasAttribute('aria-busy')) {
        button.disabled = button.getAttribute('data-busy-was-disabled') === 'true';
        button.removeAttribute('aria-busy');
        button.removeAttribute('data-busy-was-disabled');
      }
    });
  }

  /**
   * 解析自建节点 JSON，并执行与服务端一致的名称校验。
   * @param {string} raw JSON 文本。
   * @returns {{valid:boolean,nodes:Array,errors:Array}} 实时分析结果。
   */
  function analyzeSelfNodes(raw) {
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return { valid: false, nodes: [], errors: [{ message: 'JSON 根节点必须是数组' }] };
      const errors = [];
      const names = new Map();
      parsed.forEach(function (node, index) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) {
          errors.push({ message: '第 ' + (index + 1) + ' 个节点必须是对象' });
          return;
        }
        const name = typeof node.name === 'string' ? node.name.trim() : '';
        if (!name) errors.push({ message: '第 ' + (index + 1) + ' 个节点缺少非空名称' });
        else if (names.has(name)) errors.push({ message: '节点名称“' + name + '”重复' });
        else names.set(name, index);
      });
      return { valid: errors.length === 0, nodes: parsed, errors: errors };
    } catch (error) {
      return { valid: false, nodes: [], errors: [{ message: 'JSON 语法错误：' + error.message }] };
    }
  }

  /**
   * 校验全部订阅源并返回按行、字段组织的错误。
   * @returns {Record<string,Record<string,string>>} 前端字段错误。
   */
  function validateSubscriptions() {
    const errors = {};
    state.subscriptions.forEach(function (subscription, index) {
      const row = {};
      if (!String(subscription.subName || '').trim()) row.subName = '请输入名称';
      if (['包年/包月', '流量包'].indexOf(subscription.subType) < 0) row.subType = '请选择有效类型';
      try {
        const url = new URL(String(subscription.subUrl || ''));
        if (['http:', 'https:'].indexOf(url.protocol) < 0) row.subUrl = '仅支持 HTTP 或 HTTPS';
      } catch (_) { row.subUrl = '请输入有效地址'; }
      if (Object.keys(row).length) errors[index] = row;
    });
    state.subscriptionErrors = errors;
    return Object.keys(errors).length === 0;
  }

  /**
   * 读取控制台数据并建立编辑基线；配置异常时仍允许进入独立错误日志页。
   * @returns {Promise<void>} 全部数据加载完成后重新渲染当前页面。
   */
  async function loadApplication() {
    try {
      const settled = await Promise.allSettled([
        api('/api/subscriptions'),
        api('/api/self-nodes'),
        api('/api/routing-config'),
        api('/api/outputs'),
        api('/api/subscriptions/settings'),
      ]);
      // 即使路由配置损坏，也保留已读取的源列表，便于管理员在日志页继续诊断。
      if (settled[0].status === 'fulfilled') {
        state.subscriptions = settled[0].value.subscriptions || [];
        state.subscriptionsBaseline = JSON.stringify(state.subscriptions);
      }
      const failed = settled.find(function (result) { return result.status === 'rejected'; });
      if (failed) throw failed.reason;
      const results = settled.map(function (result) { return result.value; });
      state.applicationError = '';
      state.subscriptions = results[0].subscriptions || [];
      state.subscriptionsBaseline = JSON.stringify(state.subscriptions);
      state.selfNodesRaw = results[1].raw || '[]';
      state.selfNodesBaseline = state.selfNodesRaw;
      state.selfNodeAnalysis = analyzeSelfNodes(state.selfNodesRaw);
      state.routing = results[2];
      state.routingBaseline = JSON.stringify(results[2].config);
      state.outputs = results[3].outputs || [];
      state.userAgent = results[4].userAgent;
      state.userAgentBaseline = state.userAgent;
      state.defaultUserAgent = results[4].defaultUserAgent;
      state.selectedGroupId = results[2].config.groups[0]
        ? results[2].config.groups[0].id
        : (getUnassignedRules().length ? UNASSIGNED_RULES_GROUP_ID : '');
      const firstGroupRule = getRulesForGroup(state.selectedGroupId)[0];
      state.selectedRuleId = firstGroupRule ? firstGroupRule.id : '';
      state.selectedProviderId = results[2].config.providers[0] ? results[2].config.providers[0].id : '';
      render();
    } catch (error) {
      state.applicationError = error.message;
      render();
    }
  }

  /**
   * 生成页面共用的标题栏。
   * @param {string} title 页面名称。
   * @param {string} status 真实状态文案。
   * @param {string} tone 状态色。
   * @param {string} actions 操作按钮 HTML。
   * @returns {string} 标题栏 HTML。
   */
  function pageHeader(title, status, tone, actions) {
    return '<header class="page-header workspace-header"><div class="title-stack"><div class="title-line"><h1>'
      + escapeHtml(title) + '</h1><span class="workspace-status ' + escapeHtml(tone || 'saved')
      + '" role="status" aria-live="polite" aria-atomic="true"><span class="workspace-status-dot"></span>' + escapeHtml(status) + '</span></div></div><div class="header-actions workspace-actions">'
      + (actions || '') + '</div></header>';
  }

  /**
   * 渲染订阅源表格及真实保存状态。
   * @returns {string} 订阅源页面 HTML。
   */
  function renderSubscriptionsPage() {
    const sourcesDirty = JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline;
    const dirty = sourcesDirty || state.userAgent !== state.userAgentBaseline;
    const rows = state.subscriptions.map(function (subscription, index) {
      const errors = state.subscriptionErrors[index] || {};
      const nameErrorId = 'subscription-name-error-' + index;
      const urlErrorId = 'subscription-url-error-' + index;
      return '<tr class="' + (Object.keys(errors).length ? 'row-invalid' : '') + '" data-sub-index="' + index + '">'
        + '<td><input data-sub-field="subName" value="' + escapeHtml(subscription.subName) + '" aria-label="订阅源名称" placeholder="订阅源名称" class="' + (errors.subName ? 'invalid' : '') + '"' + (errors.subName ? ' aria-invalid="true" aria-describedby="' + nameErrorId + '"' : '') + '>'
        + (errors.subName ? '<small class="cell-error" id="' + nameErrorId + '">' + escapeHtml(errors.subName) + '</small>' : '') + '</td>'
        + '<td><select data-sub-field="subType" aria-label="订阅类型"><option value="包年/包月"' + (subscription.subType === '包年/包月' ? ' selected' : '') + '>包年/包月</option><option value="流量包"' + (subscription.subType === '流量包' ? ' selected' : '') + '>流量包</option></select></td>'
        + '<td><input data-sub-field="subUrl" value="' + escapeHtml(subscription.subUrl) + '" aria-label="订阅地址" placeholder="https://example.com/sub" spellcheck="false" class="' + (errors.subUrl ? 'invalid' : '') + '"' + (errors.subUrl ? ' aria-invalid="true" aria-describedby="' + urlErrorId + '"' : '') + '>'
        + (errors.subUrl ? '<small class="cell-error" id="' + urlErrorId + '">' + escapeHtml(errors.subUrl) + '</small>' : '') + '</td>'
        + '<td><button type="button" class="icon-button danger" data-action="delete-subscription" data-index="' + index + '" aria-label="删除 ' + escapeHtml(subscription.subName || '订阅源') + '">删除</button></td></tr>';
    }).join('');
    const actions = '<button type="button" class="button secondary" data-action="add-subscription">添加订阅源</button>'
      + '<button type="button" class="button primary" data-action="save-subscriptions" data-busy-key="subscriptions"' + (!sourcesDirty ? ' disabled' : '') + '>保存订阅源</button>';
    return pageHeader('订阅源', dirty ? '有未保存更改' : state.subscriptions.length + ' 个订阅源', dirty ? 'dirty' : 'saved', actions)
      + '<div class="workspace-content">' + renderGlobalUserAgent() + '<section class="data-panel subscription-panel">'
      + (state.subscriptionErrors.global ? '<div class="inline-error">' + escapeHtml(state.subscriptionErrors.global.message) + '</div>' : '')
      + '<div class="data-table-wrap"><table class="data-table subscription-table"><thead><tr><th>名称</th><th>类型</th><th>订阅地址</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + (!state.subscriptions.length ? '<div class="empty-state"><strong>还没有订阅源</strong><p>可仅使用自建节点，输出时会自动省略空策略组。</p><button class="button primary" data-action="add-subscription">添加订阅源</button></div>' : '')
      + '</section></div>';
  }

  /**
   * 渲染全部源共用的 UA 设置，与订阅源列表独立保存。
   * @returns {string} 全局 UA 面板，空值仅显示默认提示，不写入配置。
   */
  function renderGlobalUserAgent() {
    const busy = state.busy.has('subscriptionSettings');
    const disabled = busy || state.userAgent === state.userAgentBaseline;
    return '<section class="data-panel subscription-ua-panel"><h2>全局 User-Agent</h2><p id="global-ua-help">适用于全部订阅源。留空使用默认值：<code>' + escapeHtml(state.defaultUserAgent) + '</code>。</p>'
      + '<div class="global-ua-controls"><label class="field"><span>自定义 UA（可选）</span><input id="global-user-agent" aria-label="全局 User-Agent" aria-describedby="global-ua-help global-ua-error"' + (state.userAgentError ? ' aria-invalid="true"' : '') + ' value="' + escapeHtml(state.userAgent) + '" placeholder="留空使用 ' + escapeHtml(state.defaultUserAgent) + '" maxlength="256" spellcheck="false" autocomplete="off"></label>'
      + '<button type="button" class="button secondary" data-action="save-subscription-settings" data-busy-key="subscriptionSettings"' + (disabled ? ' disabled' : '') + ' aria-busy="' + busy + '">' + (busy ? '保存中…' : '保存 UA') + '</button></div>'
      + '<small class="field-error" id="global-ua-error" role="alert">' + escapeHtml(state.userAgentError) + '</small></section>';
  }

  /**
   * 生成一条自建节点摘要，确保初次渲染与输入时的实时预览完全一致。
   * @param {object} node 节点对象。
   * @param {number} index 节点在 JSON 数组中的索引。
   * @returns {string} 已转义的节点摘要 HTML。
   */
  function renderParsedNodeRow(node, index) {
    const protocol = String(node.type || '?').toUpperCase();
    const name = node.name || ('未命名节点 ' + (index + 1));
    const address = String(node.server || '—') + (node.port ? ':' + node.port : '');
    return '<div class="parsed-node-row"><span class="node-protocol" title="' + escapeHtml(protocol) + '">' + escapeHtml(protocol) + '</span><div><strong title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</strong><span title="' + escapeHtml(address) + '">' + escapeHtml(address) + '</span></div></div>';
  }

  /**
   * 渲染自建节点摘要、JSON 编辑器、行号和实时校验状态。
   * @returns {string} 自建节点页面 HTML。
   */
  function renderNodesPage() {
    const analysis = state.selfNodeAnalysis;
    const dirty = state.selfNodesRaw !== state.selfNodesBaseline;
    const nodes = analysis.nodes.map(renderParsedNodeRow).join('');
    const lines = state.selfNodesRaw.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
    const actions = '<button type="button" class="button secondary" data-action="format-self-nodes">格式化</button>'
      + '<button type="button" class="button primary" data-action="save-self-nodes" data-busy-key="selfNodes"' + (!dirty || !analysis.valid ? ' disabled' : '') + '>保存节点</button>';
    const status = analysis.valid ? (dirty ? '有未保存更改' : analysis.nodes.length + ' 个节点') : 'JSON 无效';
    return pageHeader('自建节点', status, analysis.valid ? (dirty ? 'dirty' : 'saved') : 'error', actions)
      + '<div class="workspace-content nodes-workspace"><section class="data-panel parsed-nodes-panel"><div class="simple-panel-head"><h2>节点</h2><span>' + analysis.nodes.length + '</span></div><div class="parsed-node-list">'
      + (nodes || '<div class="empty-list">' + (analysis.valid ? '暂无可显示节点' : 'JSON 无效，修复后恢复节点预览') + '</div>') + '</div></section>'
      + '<section class="data-panel json-editor-panel"><div class="node-config-help" id="node-config-help">添加不同类型的节点，可查看 <a href="https://wiki.metacubex.one/en/config/proxies/" target="_blank" rel="noopener noreferrer">Mihomo 节点配置帮助 ↗</a>。Wiki 示例为 YAML，本页需填写 JSON 数组；请将示例中 proxies 下的节点列表转换为 JSON 后粘贴，无需保留外层 proxies 字段。</div><div class="code-toolbar"><span>self-nodes.json</span><span>UTF-8 · 2 空格</span></div><div class="code-editor-grid node-code-grid"><div class="yaml-line-rail" id="node-line-rail" aria-hidden="true">'
      + lines + '</div><textarea id="self-nodes-editor" class="base-yaml-textarea node-json-textarea" spellcheck="false" aria-label="自建节点 JSON" aria-describedby="node-config-help">' + escapeHtml(state.selfNodesRaw) + '</textarea></div>'
      + '<div class="editor-validation ' + (analysis.valid ? 'valid' : 'invalid') + '"><span>' + escapeHtml(analysis.valid ? analysis.nodes.length + ' 个节点，格式有效' : analysis.errors[0].message) + '</span></div></section></div>';
  }

  /**
   * 渲染两类真实订阅输出与各自已保存订阅源数量。
   * @returns {string} 输出页面 HTML。
   */
  function renderOutputsPage() {
    const rows = state.outputs.map(function (output, index) {
      return '<article class="output-row"><div class="output-type"><div><strong>' + escapeHtml(output.name) + '</strong><span>' + escapeHtml(output.sourceCount) + ' 个订阅源</span></div></div>'
        + '<code title="' + escapeHtml(output.url) + '">' + escapeHtml(output.url) + '</code><button type="button" class="button secondary" data-action="copy-output" data-index="' + index + '" aria-label="复制' + escapeHtml(output.name) + '订阅链接">复制</button></article>';
    }).join('');
    return pageHeader('订阅输出', state.outputs.length + ' 个链接', 'saved', '')
      + '<div class="workspace-content"><section class="data-panel output-panel"><div class="output-list">' + rows + '</div></section></div>';
  }

  /**
   * 生成策略组下拉选项，并包含兼容旧规则使用的内置目标和直接节点目标。
   * @param {string} selected 当前选中 ID。
   * @param {string} excludedId 需要排除的当前策略组 ID。
   * @returns {string} option HTML。
   */
  function groupOptions(selected, excludedId) {
    const groups = state.routing.config.groups.filter(function (group) { return group.enabled && group.id !== excludedId; });
    const options = groups.map(function (group) {
      return '<option value="' + escapeHtml(group.id) + '"' + (selected === group.id ? ' selected' : '') + '>' + escapeHtml(group.name) + '</option>';
    });
    if (!excludedId) {
      options.push('<option value="builtin:DIRECT"' + (selected === 'builtin:DIRECT' ? ' selected' : '') + '>DIRECT</option>');
      options.push('<option value="builtin:REJECT"' + (selected === 'builtin:REJECT' ? ' selected' : '') + '>REJECT</option>');
      if (selected.indexOf('legacy-target:') === 0) {
        const legacyName = selected.slice('legacy-target:'.length) || '未命名节点';
        options.push('<option value="' + escapeHtml(selected) + '" selected>直接节点：' + escapeHtml(legacyName) + '</option>');
      } else if (selected && selected !== 'builtin:DIRECT' && selected !== 'builtin:REJECT'
        && !state.routing.config.groups.some(function (group) { return group.id === selected; })) {
        options.push('<option value="' + escapeHtml(selected) + '" selected>未知目标：' + escapeHtml(selected) + '（请重新选择）</option>');
      }
    }
    return options.join('');
  }

  /**
   * 生成规则提供者下拉选项。
   * @param {string} selected 当前 providerId。
   * @returns {string} option HTML。
   */
  function providerOptions(selected) {
    return state.routing.config.providers.filter(function (provider) { return provider.enabled; }).map(function (provider) {
      return '<option value="' + escapeHtml(provider.id) + '"' + (selected === provider.id ? ' selected' : '') + '>' + escapeHtml(provider.name) + '</option>';
    }).join('');
  }

  /**
   * 生成路由规则类型下拉选项并保持当前值。
   * @param {string} selected 当前规则类型。
   * @returns {string} option HTML。
   */
  function ruleTypeOptions(selected) {
    return ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'RULE-SET', 'PROCESS-NAME', 'PROCESS-NAME-WILDCARD', 'GEOIP', 'MATCH'].map(function (type) {
      return '<option value="' + type + '"' + (selected === type ? ' selected' : '') + '>' + type + '</option>';
    }).join('');
  }

  /**
   * 生成一张成员来源编辑卡。
   * @param {object} source 成员来源。
   * @param {object} group 当前策略组。
   * @param {number} index 来源顺序。
   * @returns {string} 来源卡 HTML。
   */
  function renderSourceCard(source, group, index) {
    const scope = '<label class="field compact-field"><span>适用输出</span><select data-source-field="appliesTo" data-source-index="' + index + '"><option value="all"' + (source.appliesTo === 'all' ? ' selected' : '') + '>全部</option><option value="monthly"' + (source.appliesTo === 'monthly' ? ' selected' : '') + '>仅包年/包月</option><option value="trafficPackage"' + (source.appliesTo === 'trafficPackage' ? ' selected' : '') + '>仅流量包</option></select></label>';
    let fields = '';
    if (source.kind === 'filter') {
      fields = '<div class="source-fields filter-fields"><label class="field compact-field"><span>节点范围</span><select data-source-field="source" data-source-index="' + index + '"><option value="all"' + (source.source === 'all' ? ' selected' : '') + '>全部节点</option><option value="subscription"' + (source.source === 'subscription' ? ' selected' : '') + '>仅订阅节点</option><option value="self"' + (source.source === 'self' ? ' selected' : '') + '>仅自建节点</option></select></label>'
        + '<label class="field compact-field grow-field"><span>包含正则</span><input data-source-field="include" data-source-index="' + index + '" value="' + escapeHtml(source.include) + '" placeholder="空值匹配全部"></label>'
        + '<label class="field compact-field grow-field"><span>排除正则</span><input data-source-field="exclude" data-source-index="' + index + '" value="' + escapeHtml(source.exclude) + '" placeholder="可选"></label>' + scope + '</div>';
    } else if (source.kind === 'group') {
      fields = '<div class="source-fields"><label class="field compact-field full-field"><span>引用策略组</span><select data-source-field="groupId" data-source-index="' + index + '">' + groupOptions(source.groupId, group.id) + '</select></label>' + scope + '</div>';
    } else {
      fields = '<div class="source-fields"><label class="field compact-field full-field"><span>内置策略</span><select disabled><option>DIRECT</option></select></label>' + scope + '</div>';
    }
    const title = source.kind === 'filter' ? '节点筛选器' : source.kind === 'group' ? '引用策略组' : '内置策略';
    return '<div class="source-card"><div class="source-card-head"><strong>' + title + '</strong><div class="source-actions">'
      + '<button class="icon-button subtle" data-action="move-source-up" data-index="' + index + '" aria-label="上移成员来源"' + (index === 0 ? ' disabled' : '') + '>上移</button>'
      + '<button class="icon-button subtle" data-action="move-source-down" data-index="' + index + '" aria-label="下移成员来源"' + (index === group.sources.length - 1 ? ' disabled' : '') + '>下移</button>'
      + '<button class="icon-button danger" data-action="remove-source" data-index="' + index + '" aria-label="删除成员来源">删除</button></div></div>' + fields + '</div>';
  }

  /**
   * 渲染当前策略组的成员来源、健康检查与节点匹配预览。
   *
   * 这些设置与分流规则共用同一个策略组上下文，通过组内二级页签切换，
   * 不再要求用户回到独立模块寻找对应对象。
   * @param {object} group 当前策略组。
   * @returns {string} 策略组运行设置 HTML。
   */
  function renderGroupSettings(group) {
    const preview = state.routingPreviews[group.id] || { count: 0, names: [] };
    const healthRequired = group.type !== 'select';
    const health = group.healthCheck || { url: 'https://www.gstatic.com/generate_204', interval: 600, tolerance: 80, strategy: 'consistent-hashing' };
    const previewNames = preview.names.map(function (name) {
      return '<span class="node-chip" role="listitem" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>';
    }).join('');
    const remainingCount = Math.max(0, preview.count - preview.names.length);
    const remainingNodeSummary = remainingCount > 0
      ? '<span class="node-preview-more" role="listitem">另有 ' + remainingCount + ' 个节点未展开</span>'
      : '';
    const healthFields = healthRequired ? '<section class="form-section"><div class="section-heading"><div><h3>健康检查</h3><p>生成测速、切换或负载均衡参数。</p></div></div><div class="form-grid three-columns"><label class="field span-two"><span>测试地址</span><input data-group-health="url" value="' + escapeHtml(health.url) + '"></label><label class="field"><span>间隔（秒）</span><input type="number" min="1" data-group-health="interval" value="' + escapeHtml(health.interval) + '"></label>'
      + (group.type === 'url-test' ? '<label class="field"><span>延迟容差</span><input type="number" min="0" data-group-health="tolerance" value="' + escapeHtml(health.tolerance || 0) + '"></label>' : '')
      + (group.type === 'load-balance' ? '<label class="field"><span>负载策略</span><select data-group-health="strategy"><option value="consistent-hashing"' + (health.strategy === 'consistent-hashing' ? ' selected' : '') + '>consistent-hashing</option><option value="round-robin"' + (health.strategy === 'round-robin' ? ' selected' : '') + '>round-robin</option></select></label>' : '') + '</div></section>' : '';
    return '<div class="nested-group-settings"><section class="form-section first-section"><div class="section-heading source-heading"><div><h3>成员来源</h3><p>按从上到下的顺序生成节点，并自动去重。</p></div><div class="button-cluster"><button class="button secondary small" data-action="add-source" data-kind="filter">添加筛选器</button><button class="button secondary small" data-action="add-source" data-kind="group">引用策略组</button><button class="button secondary small" data-action="add-source" data-kind="builtin">内置策略</button></div></div><div class="source-list">' + group.sources.map(function (source, index) { return renderSourceCard(source, group, index); }).join('') + '</div></section>'
      + healthFields + '<section class="form-section"><div class="section-heading"><div><h3>节点匹配预览</h3><p>最近一次预览的匹配结果。</p></div><strong class="preview-count">' + preview.count + ' 个节点</strong></div><div class="node-preview-list" role="list" aria-label="匹配到的节点">' + (previewNames ? previewNames + remainingNodeSummary : '<span class="node-preview-empty">点击“预览完整 YAML”查看匹配节点。</span>') + '</div></section></div>';
  }

  /**
   * 渲染当前策略组下的嵌套分流规则。
   *
   * 默认范围只显示目标为当前策略组的规则；全局范围仍在同一面板中展示
   * 最终扁平顺序，以支持 DIRECT、REJECT 与跨策略组顺序检查。
   * @param {object} group 当前策略组。
   * @returns {string} 分流规则编辑区 HTML。
   */
  function renderNestedRules(group) {
    const rules = state.routing.config.rules;
    const isFallbackGroup = group.id === UNASSIGNED_RULES_GROUP_ID;
    const groupRules = getRulesForGroup(group.id);
    const scopedRules = state.groupRuleScope === 'global' ? rules : groupRules;
    const keyword = state.ruleQuery.trim().toLowerCase();
    const visibleRules = scopedRules.filter(matchesRuleQuery);
    const selectedRule = rules.find(function (rule) { return rule.id === state.selectedRuleId; });
    const selectedVisible = Boolean(selectedRule && visibleRules.some(function (rule) { return rule.id === selectedRule.id; }));
    const selectedGlobalIndex = selectedRule ? rules.findIndex(function (rule) { return rule.id === selectedRule.id; }) : -1;
    const selectedScopeIndex = selectedRule ? scopedRules.findIndex(function (rule) { return rule.id === selectedRule.id; }) : -1;
    const previousScopeRule = selectedScopeIndex > 0 ? scopedRules[selectedScopeIndex - 1] : null;
    const nextScopeRule = selectedScopeIndex >= 0 ? scopedRules[selectedScopeIndex + 1] : null;
    const rows = visibleRules.map(function (rule) {
      const index = rules.findIndex(function (item) { return item.id === rule.id; });
      const valueControl = rule.type === 'MATCH'
        ? '<div class="nested-rule-placeholder">最终兜底，无需匹配内容</div>'
        : rule.type === 'RULE-SET'
          ? '<select class="nested-rule-value" data-rule-field="providerId" data-rule-index="' + index + '" aria-label="规则提供者">' + providerOptions(rule.providerId) + '</select>'
          : '<input class="nested-rule-value" data-rule-field="value" data-rule-index="' + index + '" value="' + escapeHtml(rule.value || '') + '" aria-label="匹配内容">';
      const showTargetControl = state.groupRuleScope === 'global' || isFallbackGroup;
      const targetControl = showTargetControl
        ? '<select class="nested-rule-target" data-rule-field="targetGroupId" data-rule-index="' + index + '" aria-label="目标策略">' + groupOptions(rule.targetGroupId, '') + '</select>'
        : '';
      return '<article data-rule-id="' + escapeHtml(rule.id) + '" class="nested-rule-record ' + (state.selectedRuleId === rule.id ? 'selected ' : '') + (!rule.enabled ? 'disabled' : '') + '"><div class="nested-rule-primary ' + (showTargetControl ? 'with-target' : '') + '">'
        + '<button class="rule-order-button" data-action="select-rule" data-id="' + escapeHtml(rule.id) + '" aria-label="选择第 ' + (index + 1) + ' 条规则">#' + String(index + 1).padStart(2, '0') + '</button>'
        + '<label class="nested-rule-enable" title="启用规则"><input type="checkbox" data-rule-field="enabled" data-rule-index="' + index + '"' + (rule.enabled ? ' checked' : '') + ' aria-label="启用规则"></label>'
        + '<select class="nested-rule-type" data-rule-field="type" data-rule-index="' + index + '" aria-label="规则类型">' + ruleTypeOptions(rule.type) + '</select>'
        + valueControl + targetControl
        + '<button class="rule-copy-button" data-action="duplicate-rule" data-id="' + escapeHtml(rule.id) + '" aria-label="复制规则"' + (rule.type === 'MATCH' ? ' disabled' : '') + '>复制</button></div>'
        + '<div class="nested-rule-secondary"><input data-rule-field="remark" data-rule-index="' + index + '" value="' + escapeHtml(rule.remark || '') + '" placeholder="备注：导出为规则上方注释" aria-label="规则备注"><input data-rule-field="category" data-rule-index="' + index + '" value="' + escapeHtml(rule.category || 'general') + '" aria-label="规则分类"><label class="nested-rule-option"><input type="checkbox" data-rule-field="noResolve" data-rule-index="' + index + '"' + (rule.noResolve ? ' checked' : '') + (rule.type === 'MATCH' ? ' disabled' : '') + '><span>no-resolve</span></label></div></article>';
    }).join('');
    const selectedToolbar = selectedVisible
      ? '<div class="selected-rule-toolbar" role="toolbar" aria-label="选中规则操作"><div><span>已选</span><strong>#' + String(selectedGlobalIndex + 1).padStart(2, '0') + ' · ' + escapeHtml(selectedRule.type) + '</strong></div><div class="selected-rule-actions">'
        + '<button data-action="insert-rule-above" data-id="' + escapeHtml(selectedRule.id) + '">上方插入</button><button data-action="insert-rule-below" data-id="' + escapeHtml(selectedRule.id) + '">下方插入</button>'
        + '<button data-action="duplicate-rule" data-id="' + escapeHtml(selectedRule.id) + '"' + (selectedRule.type === 'MATCH' ? ' disabled' : '') + '>复制</button>'
        + '<button data-action="move-selected-rule-up" data-id="' + escapeHtml(selectedRule.id) + '"' + (!previousScopeRule || !canSwapRoutingRules(selectedRule, previousScopeRule) ? ' disabled' : '') + '>上移</button><button data-action="move-selected-rule-down" data-id="' + escapeHtml(selectedRule.id) + '"' + (!nextScopeRule || !canSwapRoutingRules(selectedRule, nextScopeRule) ? ' disabled' : '') + '>下移</button>'
        + '<button class="danger" data-action="delete-rule" data-index="' + selectedGlobalIndex + '">删除</button></div></div>'
      : '<div class="rule-selection-hint">点击规则序号选中记录，即可在其上方或下方插入。</div>';
    const empty = keyword
      ? '<div class="empty-rule-group"><strong>没有匹配的规则</strong><span>清除搜索条件后再试。</span></div>'
      : isFallbackGroup
        ? '<div class="empty-rule-group"><strong>暂无未归组规则</strong><span>直接指向节点、DIRECT 或 REJECT 的规则会显示在这里。</span></div>'
        : '<button class="empty-rule-group" data-action="add-rule"><strong>这个策略组还没有分流规则</strong><span>添加第一条规则，目标将自动设置为当前策略组。</span></button>';
    const description = state.groupRuleScope === 'global'
      ? '规则按从上到下的顺序匹配。'
      : isFallbackGroup
        ? '直接指向 DIRECT、REJECT 或节点的规则，可在此调整目标。'
        : '';
    const addButton = isFallbackGroup ? '' : '<button class="button primary small" data-action="add-rule">添加规则</button>';
    const localScopeLabel = isFallbackGroup ? '未归组规则' : '当前策略组';
    return '<section class="nested-rules-panel"><div class="nested-section-heading"><div><h3>分流规则</h3>' + (description ? '<p>' + description + '</p>' : '') + '</div>' + addButton + '</div>'
      + '<div class="nested-rule-toolbar"><div class="segmented-control nested-rule-scope" aria-label="规则显示范围"><button class="' + (state.groupRuleScope === 'group' ? 'active' : '') + '" data-action="group-rule-scope" data-scope="group" aria-pressed="' + (state.groupRuleScope === 'group') + '">' + localScopeLabel + ' <span>' + groupRules.length + '</span></button><button class="' + (state.groupRuleScope === 'global' ? 'active' : '') + '" data-action="group-rule-scope" data-scope="global" aria-pressed="' + (state.groupRuleScope === 'global') + '">全局顺序 <span>' + rules.length + '</span></button></div><label class="nested-rule-search"><input id="rule-search" value="' + escapeHtml(state.ruleQuery) + '" placeholder="搜索类型、内容、备注或分类" aria-label="搜索规则"></label></div>'
      + selectedToolbar + '<div class="nested-rule-list">' + (rows || empty) + '</div></section>';
  }

  /**
   * 渲染策略组列表，以及“策略组 → 分流规则/成员设置”的统一编辑器。
   * @returns {{left:string,center:string}} 两栏 HTML。
   */
  function renderGroupsWorkspace() {
    const config = state.routing.config;
    const query = state.groupQuery.trim().toLowerCase();
    const unassignedRules = getUnassignedRules();
    const visible = config.groups.filter(function (group) { return !query || group.name.toLowerCase().indexOf(query) >= 0 || group.type.indexOf(query) >= 0; });
    const groupRows = visible.map(function (group) {
      const preview = state.routingPreviews[group.id];
      const realIndex = config.groups.findIndex(function (item) { return item.id === group.id; });
      const ruleCount = config.rules.filter(function (rule) { return rule.targetGroupId === group.id; }).length;
      return '<div class="entity-row unified-group-row ' + (state.selectedGroupId === group.id ? 'active ' : '') + (!group.enabled ? 'disabled' : '') + '"><button class="group-row-select" data-action="select-group" data-id="' + escapeHtml(group.id) + '" aria-pressed="' + (state.selectedGroupId === group.id) + '"><span class="entity-copy"><strong>' + escapeHtml(group.name || '未命名策略组') + '</strong><small>' + escapeHtml(group.type) + ' · ' + (preview ? preview.count + ' 个节点' : '待预览') + '</small></span><span class="group-rule-badge ' + (ruleCount ? '' : 'empty') + '">' + ruleCount + ' 条</span></button><span class="row-order-actions"><button data-action="move-group-up" data-index="' + realIndex + '"' + (realIndex === 0 ? ' disabled' : '') + '>上移</button><button data-action="move-group-down" data-index="' + realIndex + '"' + (realIndex === config.groups.length - 1 ? ' disabled' : '') + '>下移</button></span></div>';
    }).join('');
    const fallbackSearchText = '未归组规则 兜底 direct reject 直接节点 未知目标';
    const fallbackRow = unassignedRules.length && (!query || fallbackSearchText.indexOf(query) >= 0)
      ? '<div class="entity-row unified-group-row ' + (state.selectedGroupId === UNASSIGNED_RULES_GROUP_ID ? 'active ' : '') + '"><button class="group-row-select" data-action="select-group" data-id="' + UNASSIGNED_RULES_GROUP_ID + '" aria-pressed="' + (state.selectedGroupId === UNASSIGNED_RULES_GROUP_ID) + '"><span class="entity-copy"><strong>未归组规则</strong><small>DIRECT / REJECT / 直接节点</small></span><span class="group-rule-badge">' + unassignedRules.length + ' 条</span></button></div>'
      : '';
    const rows = groupRows + fallbackRow;
    const unassignedSummary = unassignedRules.length ? ' · ' + unassignedRules.length + ' 条未归组' : '';
    const left = '<section class="entity-panel group-list-panel unified-group-list"><div class="panel-header"><div><h2>策略组</h2><p>' + config.groups.filter(function (group) { return group.enabled; }).length + ' 个已启用' + unassignedSummary + '</p></div><button class="icon-button brand" data-action="add-group" aria-label="新建策略组">新增</button></div><div class="panel-search"><input id="group-search" value="' + escapeHtml(state.groupQuery) + '" placeholder="搜索名称或类型" aria-label="搜索策略组"></div><div class="entity-list" aria-label="策略组列表">' + (rows || '<div class="empty-search">未找到策略组</div>') + '</div></section>';
    if (state.selectedGroupId === UNASSIGNED_RULES_GROUP_ID) {
      const fallbackGroup = { id: UNASSIGNED_RULES_GROUP_ID, name: '未归组规则' };
      const center = '<section class="editor-panel group-editor unified-group-editor"><div class="panel-header unified-editor-header"><div><h2>未归组规则</h2><p>' + unassignedRules.length + ' 条分流规则</p></div></div>'
        + '<div class="unified-editor-scroll" id="group-pane-panel">' + renderNestedRules(fallbackGroup) + '</div></section>';
      return { left: left, center: center };
    }
    const group = config.groups.find(function (item) { return item.id === state.selectedGroupId; });
    if (!group) return { left: left, center: '<section class="editor-panel centered-empty"><h2>选择一个策略组</h2><p>选择后可在同一处配置其分流规则与成员来源。</p></section>' };
    const ruleCount = config.rules.filter(function (rule) { return rule.targetGroupId === group.id; }).length;
    const center = '<section class="editor-panel group-editor unified-group-editor"><div class="panel-header unified-editor-header"><div><h2>' + escapeHtml(group.name || '未命名策略组') + '</h2><p>' + ruleCount + ' 条分流规则</p></div><div class="panel-header-actions"><label class="switch-label"><span>已启用</span><input type="checkbox" data-group-field="enabled"' + (group.enabled ? ' checked' : '') + '><span class="switch-control" aria-hidden="true"></span></label><button class="icon-button" data-action="duplicate-group">复制</button><button class="icon-button danger" data-action="delete-group">删除</button></div></div>'
      + '<div class="unified-group-context"><label class="field"><span>策略组名称</span><input data-group-field="name" value="' + escapeHtml(group.name) + '"></label><label class="field"><span>策略类型</span><select data-group-field="type"><option value="select"' + (group.type === 'select' ? ' selected' : '') + '>手动选择（select）</option><option value="url-test"' + (group.type === 'url-test' ? ' selected' : '') + '>自动测速（url-test）</option><option value="fallback"' + (group.type === 'fallback' ? ' selected' : '') + '>故障转移（fallback）</option><option value="load-balance"' + (group.type === 'load-balance' ? ' selected' : '') + '>负载均衡（load-balance）</option></select></label><label class="field"><span>输出条件</span><select data-group-field="visibility"><option value="always"' + ((group.visibility || 'always') === 'always' ? ' selected' : '') + '>始终输出</option><option value="withSelfNodes"' + (group.visibility === 'withSelfNodes' ? ' selected' : '') + '>仅有自建节点时输出</option></select></label></div>'
      + '<div class="group-pane-tabs" role="tablist" aria-label="策略组配置区域"><button class="' + (state.groupPane === 'rules' ? 'active' : '') + '" data-action="group-pane" data-pane="rules" role="tab" aria-selected="' + (state.groupPane === 'rules') + '" aria-controls="group-pane-panel" tabindex="' + (state.groupPane === 'rules' ? '0' : '-1') + '">分流规则 <span>' + ruleCount + '</span></button><button class="' + (state.groupPane === 'settings' ? 'active' : '') + '" data-action="group-pane" data-pane="settings" role="tab" aria-selected="' + (state.groupPane === 'settings') + '" aria-controls="group-pane-panel" tabindex="' + (state.groupPane === 'settings' ? '0' : '-1') + '">成员与检测 <span>' + group.sources.length + '</span></button></div>'
      + '<div class="unified-editor-scroll" id="group-pane-panel" role="tabpanel">' + (state.groupPane === 'rules' ? renderNestedRules(group) : renderGroupSettings(group)) + '</div></section>';
    return { left: left, center: center };
  }

  /**
   * 渲染规则提供者列表与当前提供者表单，引用数由规则实时计算。
   * @returns {{left:string,center:string}} 两栏 HTML。
   */
  function renderProvidersWorkspace() {
    const providers = state.routing.config.providers;
    const query = state.providerQuery.trim().toLowerCase();
    const visible = providers.filter(function (provider) { return !query || provider.name.toLowerCase().indexOf(query) >= 0 || provider.behavior.indexOf(query) >= 0; });
    const rows = visible.map(function (provider) {
      const refs = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.type === 'RULE-SET' && rule.providerId === provider.id; }).length;
      return '<button class="entity-row ' + (state.selectedProviderId === provider.id ? 'active ' : '') + (!provider.enabled ? 'disabled' : '') + '" data-action="select-provider" data-id="' + escapeHtml(provider.id) + '"><span class="entity-copy"><strong>' + escapeHtml(provider.name || '未命名提供者') + '</strong><small>' + escapeHtml(provider.behavior) + ' · ' + refs + ' 条引用</small></span></button>';
    }).join('');
    const left = '<section class="entity-panel provider-list-panel"><div class="panel-header"><div><h2>规则提供者</h2><p>' + providers.length + ' 个提供者</p></div><button class="icon-button brand" data-action="add-provider">新增</button></div><div class="panel-search"><input id="provider-search" value="' + escapeHtml(state.providerQuery) + '" placeholder="搜索名称或行为" aria-label="搜索规则提供者"></div><div class="entity-list">' + (rows || '<div class="empty-search">未找到提供者</div>') + '</div></section>';
    const provider = providers.find(function (item) { return item.id === state.selectedProviderId; });
    if (!provider) return { left: left, center: '<section class="editor-panel centered-empty"><h2>选择规则提供者</h2></section>' };
    const refs = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.type === 'RULE-SET' && rule.providerId === provider.id; });
    const center = '<section class="editor-panel provider-editor"><div class="panel-header"><div><h2>编辑规则提供者</h2><p>' + refs.length + ' 条启用规则引用</p></div><div class="panel-header-actions"><label class="switch-label"><span>已启用</span><input type="checkbox" data-provider-field="enabled"' + (provider.enabled ? ' checked' : '') + '><span class="switch-control" aria-hidden="true"></span></label><button class="icon-button danger" data-action="delete-provider">删除</button></div></div><div class="editor-scroll"><section class="form-section first-section"><div class="form-grid two-columns"><label class="field"><span>名称</span><input data-provider-field="name" value="' + escapeHtml(provider.name) + '"></label><label class="field"><span>行为模式</span><select data-provider-field="behavior"><option value="classical"' + (provider.behavior === 'classical' ? ' selected' : '') + '>classical</option><option value="domain"' + (provider.behavior === 'domain' ? ' selected' : '') + '>domain</option><option value="ipcidr"' + (provider.behavior === 'ipcidr' ? ' selected' : '') + '>ipcidr</option></select></label></div><label class="field"><span>下载地址</span><input data-provider-field="url" value="' + escapeHtml(provider.url) + '"></label><div class="form-grid two-columns"><label class="field"><span>更新间隔（秒）</span><input type="number" min="1" data-provider-field="interval" value="' + escapeHtml(provider.interval) + '"></label><label class="field"><span>生成路径</span><input data-provider-field="path" value="' + escapeHtml(provider.path) + '"></label></div></section></div></section>';
    return { left: left, center: center };
  }

  /**
   * 从 YAML 文本提取顶级字段和大致行号，用于左侧大纲定位。
   * 真正语法、重复键和受管字段校验仍由服务端 yaml 包完成。
   * @param {string} text YAML 模板。
   * @returns {Array<{key:string,line:number}>} 顶级字段大纲。
   */
  function analyzeYamlOutline(text) {
    const items = [];
    text.split('\n').forEach(function (line, index) {
      const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
      if (match) items.push({ key: match[1], line: index + 1 });
    });
    return items;
  }

  /**
   * 渲染 YAML 模板大纲、原始编辑器、行号和实际操作。
   * @returns {{left:string,center:string}} 两栏 HTML。
   */
  function renderBaseYamlWorkspace() {
    const text = state.routing.config.baseYaml || '';
    const outline = analyzeYamlOutline(text);
    const managedConflicts = outline.filter(function (item) { return MANAGED_YAML_KEYS.indexOf(item.key) >= 0; });
    const outlineRows = outline.map(function (item) {
      const conflict = MANAGED_YAML_KEYS.indexOf(item.key) >= 0;
      return '<button class="outline-row ' + (conflict ? 'conflict' : '') + '" data-action="locate-yaml" data-line="' + item.line + '"><span>' + escapeHtml(item.key) + '</span><small>第 ' + item.line + ' 行</small></button>';
    }).join('');
    const lines = text.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
    const left = '<section class="entity-panel yaml-outline-panel"><div class="panel-header"><div><h2>顶级字段</h2><p>' + outline.length + ' 个字段</p></div></div><div class="outline-list">' + (outlineRows || '<div class="empty-search">暂无配置项</div>') + '</div></section>';
    const validationClass = managedConflicts.length ? 'invalid' : 'pending';
    const validationCopy = managedConflicts.length
      ? '检测到 ' + managedConflicts.length + ' 个字段需在节点、策略组或规则页面编辑'
      : text.split('\n').length + ' 行；保存或发布时检查 YAML 格式';
    const center = '<section class="editor-panel base-yaml-editor"><div class="panel-header"><div><h2>YAML 模板</h2><p>DNS、TUN、profile 等基础选项</p></div><div class="panel-header-actions"><button class="button secondary small" data-action="reset-base-yaml">恢复默认</button><button class="button secondary small" data-action="format-base-yaml">整理格式</button><button class="button primary small" data-action="preview-routing">完整输出</button></div></div><div class="code-editor-grid base-code-grid"><div class="yaml-line-rail" id="yaml-line-rail" aria-hidden="true">' + lines + '</div><textarea id="base-yaml-editor" class="base-yaml-textarea" spellcheck="false" aria-label="YAML 模板">' + escapeHtml(text) + '</textarea></div><div class="editor-validation ' + validationClass + '"><span>' + validationCopy + '</span></div></section>';
    return { left: left, center: center };
  }

  /**
   * 渲染右侧发布检查面板。
   * @returns {string} 检查面板 HTML。
   */
  function renderInspector() {
    const errors = state.routingIssues.errors || [];
    const warnings = state.routingIssues.warnings || [];
    const currentSnapshot = JSON.stringify(state.routing.config);
    const hasValidated = Boolean(state.routingValidatedSnapshot);
    const isCurrent = hasValidated && state.routingValidatedSnapshot === currentSnapshot;
    const validationTone = !hasValidated ? 'is-idle' : !isCurrent ? 'is-stale' : errors.length ? 'has-error' : 'is-ready';
    const validationTitle = !hasValidated ? '尚未校验' : !isCurrent ? '配置已更改' : errors.length ? errors.length + ' 个错误' : '校验已通过';
    const emptyMessage = !hasValidated ? '修改完成后运行一次校验' : !isCurrent ? '请重新校验后再发布' : '未发现配置错误';
    const issues = errors.concat(warnings).slice(0, 6).map(function (issue) {
      return '<div class="issue-row ' + (errors.indexOf(issue) >= 0 ? 'error' : 'warning') + '"><div><strong>' + escapeHtml(issue.message) + '</strong><span>' + escapeHtml(issue.path) + '</span></div></div>';
    }).join('');
    return '<aside class="inspector-panel"><div class="panel-header"><div><h2>配置检查</h2></div><button class="icon-button" data-action="validate-routing">校验</button></div><div class="validation-result ' + validationTone + '"><strong>' + validationTitle + '</strong>' + (isCurrent && warnings.length ? '<span>' + warnings.length + ' 个提醒</span>' : '') + '</div><div class="issue-list">' + (isCurrent && issues ? issues : '<div class="empty-validation">' + emptyMessage + '</div>') + '</div><div class="inspector-preview-action"><button class="button preview-button" data-action="preview-routing">预览完整 YAML</button></div></aside>';
  }

  /**
   * 渲染路由配置三个页签及页面级草稿/发布操作。
   *
   * 路由规则已并入策略组详情，不再作为独立页签，避免用户在两个模块之间
   * 来回切换并重复选择目标策略组。
   * @returns {string} 路由配置页面 HTML。
   */
  function renderRoutingPage() {
    if (!state.routing) return '<div class="loading-screen">正在加载路由配置…</div>';
    const dirty = JSON.stringify(state.routing.config) !== state.routingBaseline;
    const status = dirty ? '有未保存更改' : state.routing.revision > 0 ? '修订 ' + state.routing.revision + ' 已发布' : (state.routing.initialized ? '默认配置待保存' : state.routing.migrated ? '旧配置待确认' : '草稿已保存');
    const actions = '<button class="button ghost" data-action="import-routing">导入 YAML</button><button class="button secondary" data-action="preview-routing">完整输出</button><button class="button secondary" data-action="validate-routing" data-busy-key="routingValidate">校验</button><button class="button secondary" data-action="save-routing" data-busy-key="routingSave"' + (!dirty && !state.routing.migrated && !state.routing.initialized ? ' disabled' : '') + '>保存草稿</button><button class="button primary" data-action="publish-routing" data-busy-key="routingPublish">发布</button>';
    const counts = { groups: state.routing.config.groups.length, rules: state.routing.config.rules.length, providers: state.routing.config.providers.length };
    const tabs = [
      ['groups', '策略组与分流', counts.groups], ['providers', '规则提供者', counts.providers], ['base', 'YAML 模板', null]
    ].map(function (tab) { return '<button class="studio-tab ' + (state.routingTab === tab[0] ? 'active' : '') + '" data-action="routing-tab" data-tab="' + tab[0] + '" role="tab" aria-selected="' + (state.routingTab === tab[0]) + '" aria-controls="routing-tab-panel" tabindex="' + (state.routingTab === tab[0] ? '0' : '-1') + '"><span>' + tab[1] + '</span>' + (tab[2] == null ? '' : '<small class="tab-count">' + tab[2] + '</small>') + '</button>'; }).join('');
    let content;
    if (state.routingTab === 'groups') content = renderGroupsWorkspace();
    else if (state.routingTab === 'providers') content = renderProvidersWorkspace();
    else content = renderBaseYamlWorkspace();
    return pageHeader('路由配置', status, dirty ? 'dirty' : 'saved', actions)
      + '<div class="studio-tabs" role="tablist" aria-label="路由配置区域">' + tabs + '</div>'
      + (state.routingTab === 'base' ? '' : '<div class="rule-source-reference"><a href="https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Clash/README.md" target="_blank" rel="noopener noreferrer">blackmatrix7 规则目录 ↗</a><span>YouTube、Telegram 等服务的 Clash 规则集，可在「规则提供者」中添加所选规则集的下载地址。</span></div>')
      + '<div class="studio-content" id="routing-tab-panel" role="tabpanel"><div class="studio-grid ' + (state.routingTab === 'base' ? 'base-studio-grid' : '') + '">' + content.left + content.center + (state.routingTab === 'base' ? '' : renderInspector()) + '</div></div>';
  }

  /**
   * 获取当前路由编辑上下文；搜索、分组或范围变化时，不恢复旧规则列表的滚动。
   * @returns {object|null} 路由视图标识，离开路由页时返回 null。
   */
  function getRoutingView() {
    if (state.activeNav !== 'routing') return null;
    return { tab: state.routingTab, group: JSON.stringify([state.selectedGroupId, state.groupPane, state.groupRuleScope, state.ruleQuery]) };
  }

  /**
   * 按稳定 ID 查找已渲染规则，避免排序后数组索引变化或用户 ID 破坏选择器。
   * @param {string} ruleId 规则稳定 ID。
   * @returns {HTMLElement|undefined} 当前可见列表内的规则元素。
   */
  function findRuleElement(ruleId) {
    return Array.from(workspace.querySelectorAll('[data-rule-id]')).find(function (row) { return row.getAttribute('data-rule-id') === ruleId; });
  }

  /**
   * 在替换 DOM 前保存路由各层滚动和焦点描述，不持有即将失效的 DOM 引用。
   * @returns {object|null} 重绘快照；首次进入路由页时没有可恢复内容。
   */
  function captureRoutingView() {
    if (!renderedRoutingView || !getRoutingView()) return null;
    const active = document.activeElement;
    const row = active && active.closest('[data-rule-id]');
    const focus = active && workspace.contains(active) ? {
      id: active.id,
      ruleId: row && row.getAttribute('data-rule-id'),
      field: active.getAttribute('data-rule-field'),
      action: active.getAttribute('data-action'),
      toolbar: Boolean(active.closest('.selected-rule-toolbar')),
      start: active.selectionStart,
      end: active.selectionEnd,
    } : null;
    const scrolls = ['#routing-tab-panel', '.unified-group-list .entity-list', '#group-pane-panel'].map(function (selector) {
      const element = workspace.querySelector(selector);
      return element ? { selector: selector, top: element.scrollTop, left: element.scrollLeft } : null;
    }).filter(Boolean);
    return { view: renderedRoutingView, scrolls: scrolls, focus: focus };
  }

  /**
   * 最小幅度滚动规则的可滚动祖先，同时避开吸顶操作栏；兼容窄屏外层滚动。
   * @param {HTMLElement} row 需要显示的规则记录。
   * @returns {void} 只调整位置，不改变选中记录和键盘焦点。
   */
  function revealRoutingRule(row) {
    const toolbar = workspace.querySelector('.selected-rule-toolbar');
    for (let parent = row.parentElement; parent && workspace.contains(parent); parent = parent.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || parent.clientHeight === 0 || parent.scrollHeight <= parent.clientHeight) continue;
      const bounds = parent.getBoundingClientRect();
      const top = bounds.top + parent.clientTop + 8 + (toolbar && parent.contains(toolbar) ? toolbar.offsetHeight : 0);
      const bottom = bounds.top + parent.clientTop + parent.clientHeight - 8;
      const rect = row.getBoundingClientRect();
      if (rect.top < top) parent.scrollTop += rect.top - top;
      else if (rect.bottom > bottom) parent.scrollTop += Math.min(rect.top - top, rect.bottom - bottom);
    }
  }

  /**
   * 恢复同一编辑上下文的位置，并按显式操作意图显示/聚焦规则。
   * @param {object|null} snapshot 重绘前快照。
   * @param {{revealRuleId?:string,focusRule?:boolean}} options 新建/复制聚焦内容；移动保留操作按钮焦点。
   * @returns {void} 焦点使用 preventScroll，避免浏览器再次把列表拉回顶部。
   */
  function restoreRoutingView(snapshot, options) {
    const view = getRoutingView();
    const sameTab = snapshot && view && snapshot.view.tab === view.tab;
    const sameGroup = sameTab && snapshot.view.group === view.group;
    if (sameTab) snapshot.scrolls.forEach(function (scroll) {
      if (scroll.selector === '#group-pane-panel' && !sameGroup) return;
      const element = workspace.querySelector(scroll.selector);
      if (element) { element.scrollTop = scroll.top; element.scrollLeft = scroll.left; }
    });
    let focus = null;
    const saved = snapshot && snapshot.focus;
    if (sameGroup && saved) {
      if (saved.id) focus = document.getElementById(saved.id);
      else {
        const root = saved.ruleId ? findRuleElement(saved.ruleId) : saved.toolbar ? workspace.querySelector('.selected-rule-toolbar') : null;
        if (root) focus = Array.from(root.querySelectorAll('[data-rule-field], [data-action]')).find(function (element) {
          return saved.field ? element.getAttribute('data-rule-field') === saved.field : element.getAttribute('data-action') === saved.action;
        });
      }
      if (focus && !focus.disabled) {
        focus.focus({ preventScroll: true });
        if (saved.start != null && saved.end != null && focus.setSelectionRange) focus.setSelectionRange(saved.start, saved.end);
      }
    }
    const row = options.revealRuleId && findRuleElement(options.revealRuleId);
    if (row) {
      revealRoutingRule(row);
      if (options.focusRule) {
        focus = row.querySelector('.nested-rule-value') || row.querySelector('.rule-order-button');
        if (focus) {
          focus.focus({ preventScroll: true });
          if (focus instanceof HTMLInputElement) focus.select();
        }
      } else if (!focus || focus.disabled) {
        row.querySelector('.rule-order-button').focus({ preventScroll: true });
      }
    } else if (sameTab && saved && (saved.ruleId || saved.toolbar) && (!focus || focus.disabled)) {
      // 删除最后一个结果或更改类型导致记录被过滤时，仍给键盘用户一个明确的继续操作入口。
      const search = document.getElementById('rule-search');
      if (search) search.focus({ preventScroll: true });
    }
  }

  /**
   * 根据当前 Hash 渲染页面，同步导航并恢复原地编辑的滚动和焦点。
   * @param {{revealRuleId?:string,focusRule?:boolean}} options 可选规则定位意图。
   * @returns {void} 主动切换页面/分组时不继承旧规则滚动。
   */
  function render(options) {
    const routingSnapshot = captureRoutingView();
    document.querySelectorAll('[data-nav]').forEach(function (item) {
      const active = item.getAttribute('data-nav') === state.activeNav;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (state.applicationError && state.activeNav !== 'logs') {
      workspace.innerHTML = '<div class="fatal-state"><strong>配置加载失败</strong><span>' + escapeHtml(state.applicationError) + '</span><button class="button primary" data-action="retry-application">重试</button><button class="button secondary" data-action="open-logs">查看错误日志</button></div>';
    }
    else if (state.activeNav === 'subscriptions') workspace.innerHTML = renderSubscriptionsPage();
    else if (state.activeNav === 'nodes') workspace.innerHTML = renderNodesPage();
    else if (state.activeNav === 'routing') workspace.innerHTML = renderRoutingPage();
    else if (state.activeNav === 'logs') workspace.innerHTML = renderLogsPage();
    else workspace.innerHTML = renderOutputsPage();
    bindEditorScroll();
    restoreRoutingView(routingSnapshot, options || {});
    renderedRoutingView = getRoutingView();
    if (state.activeNav === 'logs' && !state.logsLoaded && !state.logsLoading) refreshLogs(false);
  }

  /**
   * 渲染脱敏诊断元数据，所有来源名称和响应头先转义后展示。
   * @param {object} entry 单条日志或本次诊断结果。
   * @returns {string} 可展开的日志卡片。
   */
  function renderLogEntry(entry) {
    const labels = { error: '错误', warning: '警告', info: '成功' };
    const isAccess = entry.scope === 'access';
    const title = isAccess ? (entry.subscriptionType || '') + '订阅访问' : entry.sourceName || (entry.scope === 'scheduled' ? '定时刷新' : '服务运行');
    const timestamp = entry.requestStartedAt || entry.timestamp;
    const metadata = [
      ['请求方法', entry.requestMethod], ['订阅端点', entry.requestPath], ['IP 来源', entry.clientIpSource],
      ['订阅类型', entry.subscriptionType], ['源域名', entry.sourceHost], ['最终域名', entry.finalHost],
      ['User-Agent', entry.userAgent], ['HTTP 状态', entry.httpStatus], ['耗时', entry.durationMs == null ? '' : entry.durationMs + ' ms'],
      ['响应大小', entry.responseBytes == null ? '' : entry.responseBytes + ' 字节'], ['节点数', entry.nodeCount],
      ['Content-Type', entry.contentType], ['Content-Encoding', entry.contentEncoding], ['CF Ray', entry.cfRay],
      ['人机验证', entry.challenge == null ? '' : (entry.challenge ? '是' : '否')],
      ['发生重定向', entry.redirected == null ? '' : (entry.redirected ? '是' : '否')],
      ['解析错误', entry.parserCode], ['YAML 行号', entry.parserLine], ['异常类型', entry.errorName]
    ].filter(function (pair) { return pair[1] !== undefined && pair[1] !== null && pair[1] !== ''; });
    return '<article class="log-entry"><div class="log-entry-heading"><span class="log-level ' + escapeHtml(entry.level) + '">' + escapeHtml(labels[entry.level] || entry.level) + '</span><strong>' + escapeHtml(title) + '</strong><time>' + escapeHtml(timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '本次诊断') + '</time></div>'
      + '<p><code>' + escapeHtml(entry.code) + '</code> ' + escapeHtml(entry.message) + '</p>'
      + (isAccess ? '<dl class="log-access-summary"><div><dt>来源 IP</dt><dd>' + escapeHtml(entry.clientIp || '未知') + '</dd></div><div><dt>客户端 UA</dt><dd>' + escapeHtml(entry.clientUserAgent || '未提供') + '</dd></div></dl>' : '')
      + (entry.hint ? '<p class="log-hint">' + escapeHtml(entry.hint) + '</p>' : '')
      + (metadata.length ? '<details><summary>查看请求详情</summary><dl class="log-metadata">' + metadata.map(function (pair) { return '<div><dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + '</dd></div>'; }).join('') + '</dl></details>' : '') + '</article>';
  }

  /**
   * 渲染错误日志与单源诊断页，复用已有控制台组件和移动端布局。
   * @returns {string} 日志页面 HTML。
   */
  function renderLogsPage() {
    const saved = JSON.parse(state.subscriptionsBaseline);
    const options = saved.map(function (item, index) { return '<option value="' + index + '"' + (String(index) === state.diagnosticSourceIndex ? ' selected' : '') + '>' + escapeHtml(item.subName) + ' · ' + escapeHtml(item.subType) + '</option>'; }).join('');
    const diagnosing = state.busy.has('diagnose');
    const isAccess = state.logsCategory === 'access';
    const actions = '<button class="button secondary" data-action="refresh-logs"' + (state.logsLoading ? ' disabled' : '') + '>刷新日志</button>';
    const diagnosticPanel = '<section class="data-panel diagnostic-panel"><h2>订阅源诊断</h2><p class="log-hint">检查订阅源能否正常获取节点，最多等待 20 秒。</p>'
      + '<div class="diagnostic-controls"><label><span>已保存的订阅源</span><select id="diagnostic-source" aria-label="诊断订阅源">' + (options || '<option>暂无已保存的源</option>') + '</select></label>'
      + '<label><span>临时 User-Agent（可选）</span><input id="diagnostic-ua" value="' + escapeHtml(state.diagnosticUserAgent) + '" placeholder="留空使用当前配置，可填写 Clash.Meta" maxlength="256" spellcheck="false"></label>'
      + '<button class="button primary" data-action="diagnose-subscription"' + (!saved.length || diagnosing ? ' disabled' : '') + ' aria-busy="' + diagnosing + '">' + (diagnosing ? '诊断中…' : '开始诊断') + '</button></div>'
      + '<p class="log-hint">临时 UA 只用于本次比较；诊断结果会记入日志。源配置有更改时请先保存。</p>'
      + '<div role="status" aria-live="polite">' + (state.diagnostic ? renderLogEntry(state.diagnostic) : '') + '</div></section>';
    const categories = [['diagnostic', '运行诊断'], ['access', '订阅访问']].map(function (item) {
      return '<button class="button ' + (state.logsCategory === item[0] ? 'primary' : 'ghost') + '" data-action="logs-category" data-category="' + item[0] + '" aria-pressed="' + (state.logsCategory === item[0]) + '"' + (state.logsLoading ? ' disabled' : '') + '>' + item[1] + '</button>';
    }).join('');
    const note = isAccess ? '记录客户端拉取订阅的来源 IP、客户端 UA、访问时间和响应状态，包含缓存请求及失败请求。' : '记录抓取、解析和运行错误；成功记录来自主动诊断。';
    return pageHeader('错误日志', state.logsLoading ? '正在读取…' : state.logs.length + ' 条已加载', 'saved', actions)
      + '<div class="workspace-content logs-workspace">' + (!isAccess ? diagnosticPanel : '')
      + '<section class="data-panel log-list-panel"><div class="simple-panel-head"><h2>' + (isAccess ? '订阅访问记录' : '最近诊断记录') + '</h2><span>保留 7 天 · 每页 50 条</span></div><div class="log-category-tabs" role="group" aria-label="日志分类">' + categories + '</div><p class="log-retention-note">' + note + ' 新记录可能稍有延迟，可稍后刷新。</p>'
      + (state.logsError ? '<p class="inline-error" role="alert">' + escapeHtml(state.logsError) + '</p>' : '')
      + '<div class="log-list">' + (state.logs.map(renderLogEntry).join('') || '<div class="empty-list">' + (state.logsLoading ? '正在读取日志…' : state.logsError ? '日志读取失败，请点击刷新重试' : isAccess ? '暂无客户端订阅访问记录' : '暂无日志；可选择订阅源执行诊断') + '</div>') + '</div>'
      + (state.logsCursor ? '<div class="log-pagination"><button class="button secondary" data-action="more-logs"' + (state.logsLoading ? ' disabled' : '') + '>加载更多</button></div>' : '') + '</section></div>';
  }

  /**
   * 读取或追加一页日志；失败时保留现有记录并提供重试。
   * @param {boolean} append 是否使用当前分页游标追加数据。
   * @returns {Promise<void>} 完成读取并更新日志页。
   */
  async function refreshLogs(append) {
    if (state.logsLoading) return;
    state.logsLoading = true;
    state.logsError = '';
    if (state.activeNav === 'logs') render();
    try {
      const data = await api('/api/logs?category=' + encodeURIComponent(state.logsCategory) + (append && state.logsCursor ? '&cursor=' + encodeURIComponent(state.logsCursor) : ''));
      const records = append ? state.logs.concat(data.logs) : data.logs;
      state.logs = Array.from(new Map(records.map(function (entry) { return [entry.id, entry]; })).values());
      state.logsCursor = data.cursor || '';
    } catch (error) { state.logsError = error.message; }
    finally {
      state.logsLoading = false;
      state.logsLoaded = true;
      if (state.activeNav === 'logs') render();
    }
  }

  /**
   * 为 JSON/YAML 编辑器绑定行号同步滚动。
   * 每次页面重绘后重新绑定当前可见编辑器。
   */
  function bindEditorScroll() {
    const nodeEditor = document.getElementById('self-nodes-editor');
    const nodeRail = document.getElementById('node-line-rail');
    if (nodeEditor && nodeRail) nodeEditor.addEventListener('scroll', function () { nodeRail.scrollTop = nodeEditor.scrollTop; });
    const yamlEditor = document.getElementById('base-yaml-editor');
    const yamlRail = document.getElementById('yaml-line-rail');
    if (yamlEditor && yamlRail) yamlEditor.addEventListener('scroll', function () { yamlRail.scrollTop = yamlEditor.scrollTop; });
  }

  /**
   * 在数组中交换相邻项，所有排序操作都直接更新最终 YAML 使用的数组顺序。
   * @param {Array} items 目标数组。
   * @param {number} index 当前索引。
   * @param {number} delta -1 上移，1 下移。
   */
  function moveItem(items, index, delta) {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    const temporary = items[index];
    items[index] = items[target];
    items[target] = temporary;
  }

  /**
   * 创建一条归属于指定目标策略的默认分流规则。
   *
   * @param {string} targetGroupId 策略组稳定 ID 或内置目标。
   * @param {string} category 管理端分类。
   * @returns {object} 尚未插入配置数组的路由规则。
   */
  function createDefaultRoutingRule(targetGroupId, category) {
    return {
      id: createId('rule'),
      enabled: true,
      category: category || 'general',
      remark: '',
      type: 'DOMAIN-SUFFIX',
      value: 'example.com',
      targetGroupId: targetGroupId,
      noResolve: false,
    };
  }

  /**
   * 对显示和操作使用相同的搜索条件，避免工具栏指向被过滤掉的规则。
   * @param {object} rule 待判断的规则。
   * @returns {boolean} 是否匹配当前搜索；空搜索匹配所有规则。
   */
  function matchesRuleQuery(rule) {
    const keyword = state.ruleQuery.trim().toLowerCase();
    return !keyword || [rule.type, rule.value, rule.category, rule.remark].join(' ').toLowerCase().indexOf(keyword) >= 0;
  }

  /**
   * 完成新增或复制后显示新记录；仅当搜索会隐藏新记录时清除搜索并解释原因。
   * @param {object} rule 已插入配置的新规则。
   * @returns {void} 聚焦匹配内容/提供者，让用户可以立即修改。
   */
  function editCreatedRoutingRule(rule) {
    const clearedQuery = !matchesRuleQuery(rule);
    if (clearedQuery) state.ruleQuery = '';
    state.selectedRuleId = rule.id;
    render({ revealRuleId: rule.id, focusRule: true });
    if (clearedQuery) showToast('已清除规则搜索', 'success', '显示刚创建的规则，方便继续编辑');
  }

  /**
   * 限制启用的新规则位于最终 MATCH 之前，包括从 MATCH 后禁用记录发起的插入。
   * @param {number} index 原计划插入的全局位置。
   * @returns {number} 不越过最终启用 MATCH 的插入位置。
   */
  function routingInsertIndex(index) {
    const matchIndex = state.routing.config.rules.findIndex(function (rule) { return rule.enabled && rule.type === 'MATCH'; });
    return matchIndex < 0 ? index : Math.min(index, matchIndex);
  }

  /**
   * 检查交换两个规则是否会让启用规则跨越最终 MATCH；组内视图也检查隐藏组的 MATCH。
   * @param {object} source 待移动规则。
   * @param {object} target 交换位置的规则。
   * @returns {boolean} 可以安全交换时为 true；最终启用 MATCH 固定不参与交换。
   */
  function canSwapRoutingRules(source, target) {
    const rules = state.routing.config.rules;
    const matchIndex = rules.findIndex(function (rule) { return rule.enabled && rule.type === 'MATCH'; });
    if (matchIndex < 0) return true;
    const sourceIndex = rules.indexOf(source);
    const targetIndex = rules.indexOf(target);
    if (sourceIndex === matchIndex || targetIndex === matchIndex) return false;
    return !(source.enabled && sourceIndex < matchIndex && targetIndex > matchIndex)
      && !(target.enabled && targetIndex < matchIndex && sourceIndex > matchIndex);
  }

  /**
   * 在当前策略组最后一条归属规则之后添加新规则。
   *
   * 启用的 MATCH 永远保持在新规则之后，防止一次快捷操作立即制造无效顺序。
   * @returns {void}
   */
  function addRuleToCurrentGroup() {
    const rules = state.routing.config.rules;
    const selectedGroup = state.routing.config.groups.find(function (group) { return group.id === state.selectedGroupId; });
    const fallbackGroup = state.routing.config.groups.find(function (group) { return group.enabled; });
    const targetGroupId = selectedGroup ? selectedGroup.id : fallbackGroup ? fallbackGroup.id : 'builtin:DIRECT';
    const groupIndexes = rules.map(function (rule, index) { return rule.targetGroupId === targetGroupId ? index : -1; }).filter(function (index) { return index >= 0; });
    const matchIndex = rules.findIndex(function (rule) { return rule.enabled && rule.type === 'MATCH'; });
    let insertIndex = groupIndexes.length ? groupIndexes[groupIndexes.length - 1] + 1 : (matchIndex >= 0 ? matchIndex : rules.length);
    if (matchIndex >= 0) insertIndex = Math.min(insertIndex, matchIndex);
    const rule = createDefaultRoutingRule(targetGroupId, 'general');
    rules.splice(insertIndex, 0, rule);
    state.groupPane = 'rules';
    editCreatedRoutingRule(rule);
    showToast('已添加分流规则', 'success', selectedGroup ? '目标自动设置为“' + selectedGroup.name + '”' : '已放在最终 MATCH 之前');
  }

  /**
   * 在锚点规则的上方或下方插入一条新规则。
   *
   * 组内视图继承当前策略组，全局视图继承锚点目标；在 MATCH 下方插入时
   * 自动改为 MATCH 上方，确保最终兜底仍位于启用规则末尾。
   * @param {string} ruleId 锚点规则 ID。
   * @param {'above'|'below'} position 插入方向。
   * @returns {void}
   */
  function insertAdjacentRoutingRule(ruleId, position) {
    const rules = state.routing.config.rules;
    const anchorIndex = rules.findIndex(function (rule) { return rule.id === ruleId; });
    if (anchorIndex < 0) return;
    const anchor = rules[anchorIndex];
    const targetGroupId = state.groupRuleScope === 'group' && state.selectedGroupId !== UNASSIGNED_RULES_GROUP_ID
      ? state.selectedGroupId
      : anchor.targetGroupId;
    const rule = createDefaultRoutingRule(targetGroupId, anchor.category || 'general');
    const requestedIndex = anchor.type === 'MATCH' ? anchorIndex : anchorIndex + (position === 'below' ? 1 : 0);
    const insertIndex = routingInsertIndex(requestedIndex);
    rules.splice(insertIndex, 0, rule);
    editCreatedRoutingRule(rule);
    const keptBeforeMatch = insertIndex < requestedIndex || (anchor.type === 'MATCH' && position === 'below');
    showToast(keptBeforeMatch ? '已在最终 MATCH 上方插入规则' : position === 'above' ? '已在上方插入规则' : '已在下方插入规则', 'success', '目标策略已自动继承');
  }

  /**
   * 复制一条非 MATCH 规则，并把副本紧邻原记录插入。
   *
   * @param {string} ruleId 原规则 ID。
   * @returns {void}
   */
  function duplicateRoutingRule(ruleId) {
    const rules = state.routing.config.rules;
    const sourceIndex = rules.findIndex(function (rule) { return rule.id === ruleId; });
    if (sourceIndex < 0) return;
    const source = rules[sourceIndex];
    if (source.type === 'MATCH') {
      showToast('最终 MATCH 不能复制', 'warning', '配置只能保留一个最终兜底规则');
      return;
    }
    const copy = clone(source);
    copy.id = createId('rule');
    copy.remark = source.remark ? source.remark + '（副本）' : '';
    rules.splice(copy.enabled ? routingInsertIndex(sourceIndex + 1) : sourceIndex + 1, 0, copy);
    editCreatedRoutingRule(copy);
    showToast('规则已复制', 'success', '副本已插入原记录下方');
  }

  /**
   * 按当前显示范围移动规则。
   *
   * 组内范围仅交换同一目标策略组所占的顺序槽位，避免隐藏的其它策略组
   * 规则被意外改序；全局范围则交换真实相邻记录。
   * @param {string} ruleId 待移动规则 ID。
   * @param {-1|1} delta 移动方向。
   * @returns {void}
   */
  function moveRoutingRuleInScope(ruleId, delta) {
    const rules = state.routing.config.rules;
    const sourceIndex = rules.findIndex(function (rule) { return rule.id === ruleId; });
    if (sourceIndex < 0) return;
    const currentScopeRuleIds = new Set(getRulesForGroup(state.selectedGroupId).map(function (rule) { return rule.id; }));
    const candidateIndexes = state.groupRuleScope === 'global'
      ? rules.map(function (_, index) { return index; })
      : rules.map(function (rule, index) { return currentScopeRuleIds.has(rule.id) ? index : -1; }).filter(function (index) { return index >= 0; });
    const slotIndex = candidateIndexes.indexOf(sourceIndex);
    const targetIndex = candidateIndexes[slotIndex + delta];
    if (targetIndex == null) return;
    const sourceRule = rules[sourceIndex];
    const targetRule = rules[targetIndex];
    if (!canSwapRoutingRules(sourceRule, targetRule)) {
      showToast('最终 MATCH 必须保持在末尾', 'warning', '请在 MATCH 上方调整其它规则');
      return;
    }
    const temporary = rules[sourceIndex];
    rules[sourceIndex] = rules[targetIndex];
    rules[targetIndex] = temporary;
    state.selectedRuleId = ruleId;
    render({ revealRuleId: ruleId });
  }

  /**
   * 复制文本并提供成功或失败反馈。
   * @param {string} text 待复制文本。
   * @param {string} label 反馈对象名称。
   */
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label + '已复制', 'success');
    } catch (_) {
      showToast('复制失败', 'error', '请检查浏览器剪贴板权限');
    }
  }

  /**
   * 打开统一模态框，并把确认回调限制在当前弹窗内。
   * @param {string} title 标题。
   * @param {string} body 内容 HTML。
   * @param {string} primaryLabel 主操作文案。
   * @param {Function} onConfirm 确认回调；返回 false 时保持弹窗。
   */
  function openModal(title, body, primaryLabel, onConfirm) {
    overlayReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayNeedsRender = false;
    overlayRoot.innerHTML = '<div class="modal-backdrop" data-action="close-overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">' + escapeHtml(title) + '</h2><button class="icon-button" data-action="close-overlay" aria-label="关闭">关闭</button></div><div class="modal-body">' + body + '</div><div class="modal-footer"><button class="button ghost" data-action="close-overlay">取消</button><button class="button primary" id="modal-confirm">' + escapeHtml(primaryLabel) + '</button></div></section></div>';
    const card = overlayRoot.querySelector('.modal-card');
    card.addEventListener('click', function (event) { event.stopPropagation(); });
    overlayRoot.querySelectorAll('[data-action="close-overlay"]').forEach(function (button) { button.addEventListener('click', closeOverlay); });
    document.getElementById('modal-confirm').addEventListener('click', async function () {
      const shouldClose = await onConfirm();
      if (shouldClose !== false) closeOverlay();
    });
    const focusable = overlayRoot.querySelector('textarea,input,select,button');
    if (focusable) focusable.focus();
  }

  /**
   * 关闭当前模态框或 YAML 预览抽屉，并恢复触发控件焦点。
   *
   * 完整预览会更新节点匹配摘要，因此仅在该场景关闭时重绘后台页面；
   * 普通弹窗关闭不会重绘，避免打断尚未提交的表单输入。
   */
  function closeOverlay() {
    const returnFocus = overlayReturnFocus;
    const returnAction = returnFocus && returnFocus.getAttribute ? returnFocus.getAttribute('data-action') : '';
    const shouldRender = overlayNeedsRender;
    state.previewRequestId += 1;
    overlayRoot.innerHTML = '';
    overlayReturnFocus = null;
    overlayNeedsRender = false;
    if (shouldRender) render();
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    else if (returnAction) {
      const replacement = workspace.querySelector('[data-action="' + returnAction + '"]');
      if (replacement) replacement.focus();
    }
  }

  /**
   * 调用服务端校验当前路由草稿并显示可定位问题。
   * @param {boolean} quiet 是否仅更新状态而不显示成功 Toast。
   * @returns {Promise<boolean>} 是否可以发布。
   */
  async function validateRouting(quiet) {
    setBusy('routingValidate', true);
    try {
      const result = await api('/api/routing-config/validate', { method: 'POST', body: JSON.stringify({ config: state.routing.config }) });
      state.routingIssues = result;
      state.routingValidatedSnapshot = JSON.stringify(state.routing.config);
      render();
      if (!quiet) showToast(result.valid ? '配置校验通过' : '配置校验未通过', result.valid ? 'success' : 'error', result.valid ? (result.warnings.length + ' 个提醒') : (result.errors.length + ' 个错误'));
      return Boolean(result.valid);
    } catch (error) {
      state.routingIssues = { errors: error.errors || [{ path: '', message: error.message }], warnings: [] };
      state.routingValidatedSnapshot = JSON.stringify(state.routing.config);
      render();
      if (!quiet) showToast('校验失败', 'error', error.message);
      return false;
    } finally { setBusy('routingValidate', false); }
  }

  /**
   * 保存路由草稿；不会发布、清缓存或改变订阅输出。
   */
  async function saveRoutingDraft() {
    setBusy('routingSave', true);
    try {
      const data = await api('/api/routing-config/draft', { method: 'PUT', body: JSON.stringify({ config: state.routing.config, baseRevision: state.routing.revision }) });
      state.routing = Object.assign({}, state.routing, data, { config: clone(state.routing.config), migrated: false, initialized: false });
      state.routingBaseline = JSON.stringify(state.routing.config);
      render();
      showToast('路由草稿已保存', 'success', '正式订阅输出未改变');
    } catch (error) { showToast('草稿保存失败', 'error', error.message); }
    finally { setBusy('routingSave', false); }
  }

  /**
   * 校验并发布当前草稿。
   * 409 修订冲突不会覆盖 KV，用户可刷新后重新合并更改。
   */
  async function publishRouting() {
    setBusy('routingPublish', true);
    try {
      const data = await api('/api/routing-config/publish', { method: 'POST', body: JSON.stringify({ config: state.routing.config, baseRevision: state.routing.revision }) });
      state.routing.revision = data.revision;
      state.routing.updatedAt = data.updatedAt;
      state.routing.migrated = false;
      state.routing.initialized = false;
      state.routingBaseline = JSON.stringify(state.routing.config);
      state.routingIssues = data.validation || { errors: [], warnings: [] };
      state.routingValidatedSnapshot = JSON.stringify(state.routing.config);
      render();
      showToast('修订 ' + data.revision + ' 已发布', 'success', '更新客户端订阅后生效');
    } catch (error) {
      if (error.status === 409) showToast('发布版本已过期', 'error', '请刷新页面后重新应用更改');
      else {
        state.routingIssues = { errors: error.errors || [], warnings: [] };
        render();
        showToast('发布失败', 'error', error.message);
      }
    } finally { setBusy('routingPublish', false); }
  }

  /**
   * 打开完整 YAML 抽屉，并根据客户端和订阅类型实时请求真实节点预览。
   */
  function openPreviewDrawer() {
    overlayReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayNeedsRender = false;
    overlayRoot.innerHTML = '<div class="drawer-backdrop"><aside class="yaml-drawer" role="dialog" aria-modal="true" aria-labelledby="preview-title" aria-describedby="preview-description"><div class="drawer-header"><div><h2 id="preview-title">完整输出</h2><p id="preview-description">预览当前草稿的订阅配置</p></div><button class="icon-button" data-action="close-preview" aria-label="关闭完整输出预览">关闭</button></div><div class="preview-controls"><label><span>客户端</span><select id="preview-client"><option value="normal">通用</option><option value="stash">Stash</option></select></label><label><span>订阅类型</span><select id="preview-output"><option value="monthly">包年/包月</option><option value="trafficPackage">流量包</option></select></label><button class="button secondary" id="refresh-preview">生成预览</button><button class="button primary" id="copy-preview" disabled>复制 YAML</button></div><div class="yaml-preview-meta"><span id="preview-status" role="status" aria-live="polite">准备生成预览…</span></div><pre class="yaml-preview" id="yaml-preview" tabindex="0" aria-label="完整 YAML 内容" aria-busy="true">正在生成预览…</pre></aside></div>';
    overlayRoot.querySelector('[data-action="close-preview"]').addEventListener('click', closeOverlay);
    overlayRoot.querySelector('.drawer-backdrop').addEventListener('click', closeOverlay);
    overlayRoot.querySelector('.yaml-drawer').addEventListener('click', function (event) { event.stopPropagation(); });
    document.getElementById('refresh-preview').addEventListener('click', refreshPreview);
    document.getElementById('preview-client').addEventListener('change', refreshPreview);
    document.getElementById('preview-output').addEventListener('change', refreshPreview);
    document.getElementById('copy-preview').addEventListener('click', function () { copyText(document.getElementById('yaml-preview').textContent, '完整 YAML'); });
    overlayRoot.querySelector('[data-action="close-preview"]').focus();
    refreshPreview();
  }

  /**
   * 生成当前抽屉选项对应的 YAML，并把真实节点匹配数量同步回策略组列表。
   */
  async function refreshPreview() {
    const clientSelect = document.getElementById('preview-client');
    const outputSelect = document.getElementById('preview-output');
    const preview = document.getElementById('yaml-preview');
    const copyButton = document.getElementById('copy-preview');
    const refreshButton = document.getElementById('refresh-preview');
    const status = document.getElementById('preview-status');
    if (!clientSelect || !outputSelect || !preview || !copyButton || !refreshButton || !status) return;
    const client = clientSelect.value;
    const output = outputSelect.value;
    const requestId = ++state.previewRequestId;
    preview.textContent = '正在解析订阅节点并生成预览…';
    preview.classList.remove('is-error');
    preview.setAttribute('aria-busy', 'true');
    preview.removeAttribute('role');
    status.textContent = '正在获取节点并生成预览…';
    copyButton.disabled = true;
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
    refreshButton.textContent = '生成中…';
    try {
      const data = await api('/api/routing-config/preview', { method: 'POST', body: JSON.stringify({ config: state.routing.config, client: client, output: output }) });
      if (requestId !== state.previewRequestId || !overlayRoot.contains(preview)) return;
      preview.textContent = data.yaml;
      preview.setAttribute('aria-busy', 'false');
      copyButton.disabled = false;
      status.textContent = '已生成 ' + data.yaml.split('\n').length + ' 行 YAML';
      state.routingPreviews = {};
      (data.previews || []).forEach(function (item) { state.routingPreviews[item.groupId] = item; });
      overlayNeedsRender = true;
    } catch (error) {
      if (requestId !== state.previewRequestId || !overlayRoot.contains(preview)) return;
      preview.textContent = '# 预览生成失败\n' + error.message;
      preview.classList.add('is-error');
      preview.setAttribute('role', 'alert');
      preview.setAttribute('aria-busy', 'false');
      status.textContent = '预览生成失败，请检查错误详情';
    } finally {
      if (requestId === state.previewRequestId && overlayRoot.contains(refreshButton)) {
        refreshButton.disabled = false;
        refreshButton.removeAttribute('aria-busy');
        refreshButton.textContent = '重新生成';
      }
    }
  }

  /**
   * 实时更新自建节点摘要和错误，不重建 textarea，避免打断输入光标。
   */
  function updateSelfNodesLiveView() {
    const analysis = state.selfNodeAnalysis;
    const countBadge = document.querySelector('.parsed-nodes-panel .simple-panel-head span');
    if (countBadge) countBadge.textContent = String(analysis.nodes.length);
    const list = document.querySelector('.parsed-node-list');
    if (list) {
      list.innerHTML = analysis.nodes.map(renderParsedNodeRow).join('') || '<div class="empty-list">' + (analysis.valid ? '暂无可显示节点' : 'JSON 无效，修复后恢复节点预览') + '</div>';
    }
    const validation = document.querySelector('.editor-validation');
    if (validation) {
      validation.className = 'editor-validation ' + (analysis.valid ? 'valid' : 'invalid');
      validation.textContent = analysis.valid ? analysis.nodes.length + ' 个节点，格式有效' : analysis.errors[0].message;
    }
    const rail = document.getElementById('node-line-rail');
    if (rail) rail.innerHTML = state.selfNodesRaw.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
    const save = document.querySelector('[data-action="save-self-nodes"]');
    if (save) save.disabled = !analysis.valid || state.selfNodesRaw === state.selfNodesBaseline;
  }

  /**
   * 更新 YAML 大纲与行号，不重建编辑器输入。
   */
  function updateYamlLiveView() {
    const items = analyzeYamlOutline(state.routing.config.baseYaml);
    const outline = document.querySelector('.outline-list');
    if (outline) {
      outline.innerHTML = items.map(function (item) { return '<button class="outline-row ' + (MANAGED_YAML_KEYS.indexOf(item.key) >= 0 ? 'conflict' : '') + '" data-action="locate-yaml" data-line="' + item.line + '"><span>' + escapeHtml(item.key) + '</span><small>第 ' + item.line + ' 行</small></button>'; }).join('') || '<div class="empty-search">暂无配置项</div>';
    }
    const conflicts = items.filter(function (item) { return MANAGED_YAML_KEYS.indexOf(item.key) >= 0; });
    const validation = document.querySelector('.base-yaml-editor .editor-validation');
    if (validation) {
      validation.className = 'editor-validation ' + (conflicts.length ? 'invalid' : 'pending');
      validation.textContent = conflicts.length
        ? '检测到 ' + conflicts.length + ' 个字段需在节点、策略组或规则页面编辑'
        : state.routing.config.baseYaml.split('\n').length + ' 行；保存或发布时检查 YAML 格式';
    }
    const rail = document.getElementById('yaml-line-rail');
    if (rail) rail.innerHTML = state.routing.config.baseYaml.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
  }

  /**
   * 在不重建当前表单的情况下刷新标题栏未保存状态和保存按钮。
   */
  function updateDirtyIndicator() {
    if (state.activeNav === 'logs') return;
    const status = document.querySelector('.workspace-status');
    if (!status) return;
    let dirty = false;
    if (state.activeNav === 'subscriptions') dirty = JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline || state.userAgent !== state.userAgentBaseline;
    else if (state.activeNav === 'nodes') dirty = state.selfNodesRaw !== state.selfNodesBaseline;
    else if (state.activeNav === 'routing') dirty = JSON.stringify(state.routing.config) !== state.routingBaseline;
    if (state.activeNav === 'nodes' && !state.selfNodeAnalysis.valid) {
      status.className = 'workspace-status error';
      status.innerHTML = '<span class="workspace-status-dot"></span>JSON 无效';
    } else if (dirty) {
      status.className = 'workspace-status dirty';
      status.innerHTML = '<span class="workspace-status-dot"></span>有未保存更改';
    } else {
      status.className = 'workspace-status saved';
      const cleanText = state.activeNav === 'subscriptions' ? state.subscriptions.length + ' 个订阅源'
        : state.activeNav === 'nodes' ? state.selfNodeAnalysis.nodes.length + ' 个节点'
        : state.activeNav === 'routing' ? (state.routing.revision > 0 ? '修订 ' + state.routing.revision + ' 已发布' : state.routing.initialized ? '默认配置待保存' : state.routing.migrated ? '旧配置待确认' : '草稿已保存') : '';
      status.innerHTML = '<span class="workspace-status-dot"></span>' + escapeHtml(cleanText);
    }
    const saveSelector = state.activeNav === 'subscriptions' ? '[data-action="save-subscriptions"]' : state.activeNav === 'routing' ? '[data-action="save-routing"]' : '';
    const save = saveSelector ? document.querySelector(saveSelector) : null;
    if (save) save.disabled = !dirty && !(state.activeNav === 'routing' && state.routing && (state.routing.migrated || state.routing.initialized));
    if (state.activeNav === 'subscriptions') {
      if (save) save.disabled = state.busy.has('subscriptions') || JSON.stringify(state.subscriptions) === state.subscriptionsBaseline;
      const saveUserAgent = document.querySelector('[data-action="save-subscription-settings"]');
      if (saveUserAgent) saveUserAgent.disabled = state.busy.has('subscriptionSettings') || state.userAgent === state.userAgentBaseline;
    }
  }

  /**
   * 处理工作区内所有文本输入，直接写回状态模型。
   * @param {InputEvent} event 输入事件。
   */
  function handleWorkspaceInput(event) {
    const target = event.target;
    if (target.id === 'global-user-agent') {
      state.userAgent = target.value;
      state.userAgentError = '';
      target.removeAttribute('aria-invalid');
      document.getElementById('global-ua-error').textContent = '';
      return;
    }
    const subField = target.getAttribute('data-sub-field');
    if (subField) {
      const index = Number(target.closest('[data-sub-index]').getAttribute('data-sub-index'));
      state.subscriptions[index][subField] = target.value;
      const save = document.querySelector('[data-action="save-subscriptions"]');
      if (save) save.disabled = false;
      return;
    }
    if (target.id === 'self-nodes-editor') {
      state.selfNodesRaw = target.value;
      state.selfNodeAnalysis = analyzeSelfNodes(target.value);
      updateSelfNodesLiveView();
      return;
    }
    if (['group-search', 'rule-search', 'provider-search'].includes(target.id)) {
      const stateKey = target.id === 'group-search' ? 'groupQuery' : target.id === 'rule-search' ? 'ruleQuery' : 'providerQuery';
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      state[stateKey] = target.value;
      render();
      const replacement = document.getElementById(target.id);
      if (replacement) {
        replacement.focus();
        if (selectionStart != null && selectionEnd != null) replacement.setSelectionRange(selectionStart, selectionEnd);
      }
      return;
    }
    if (target.id === 'base-yaml-editor') {
      state.routing.config.baseYaml = target.value;
      updateYamlLiveView();
      return;
    }
    const group = state.routing && state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
    const groupField = target.getAttribute('data-group-field');
    if (group && groupField) { group[groupField] = target.type === 'checkbox' ? target.checked : target.value; return; }
    const healthField = target.getAttribute('data-group-health');
    if (group && healthField) {
      group.healthCheck = group.healthCheck || {};
      group.healthCheck[healthField] = target.type === 'number' ? Number(target.value) : target.value;
      return;
    }
    const sourceField = target.getAttribute('data-source-field');
    if (group && sourceField) {
      const source = group.sources[Number(target.getAttribute('data-source-index'))];
      if (source) source[sourceField] = target.value;
      return;
    }
    const ruleField = target.getAttribute('data-rule-field');
    if (state.routing && ruleField) {
      const rule = state.routing.config.rules[Number(target.getAttribute('data-rule-index'))];
      if (rule) rule[ruleField] = target.type === 'checkbox' ? target.checked : target.value;
      return;
    }
    const providerField = target.getAttribute('data-provider-field');
    if (state.routing && providerField) {
      const provider = state.routing.config.providers.find(function (item) { return item.id === state.selectedProviderId; });
      if (provider) provider[providerField] = target.type === 'checkbox' ? target.checked : target.type === 'number' ? Number(target.value) : target.value;
    }
  }

  /**
   * 处理会影响其它字段可用性的 select、checkbox 变更，并在必要时重绘。
   * @param {Event} event 变更事件。
   */
  function handleWorkspaceChange(event) {
    const target = event.target;
    // input 事件可能已经更新了目标组，邻居必须从尚未重绘的 DOM 顺序读取。
    const editedRow = target.closest('[data-rule-id]');
    const visibleRuleIds = Array.from(workspace.querySelectorAll('[data-rule-id]')).map(function (row) { return row.getAttribute('data-rule-id'); });
    const editedRowIndex = editedRow ? visibleRuleIds.indexOf(editedRow.getAttribute('data-rule-id')) : -1;
    const groupField = target.getAttribute('data-group-field');
    if (groupField === 'enabled' && !target.checked) {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      const ruleRefs = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.targetGroupId === group.id; }).length;
      const groupRefs = state.routing.config.groups.filter(function (candidate) { return candidate.enabled && candidate.sources.some(function (source) { return source.kind === 'group' && source.groupId === group.id; }); }).length;
      if (ruleRefs || groupRefs) {
        target.checked = true;
        showToast('无法停用被引用的策略组', 'error', ruleRefs + ' 条规则、' + groupRefs + ' 个策略组仍在引用');
        return;
      }
    }
    const providerField = target.getAttribute('data-provider-field');
    if (providerField === 'enabled' && !target.checked) {
      const provider = state.routing.config.providers.find(function (item) { return item.id === state.selectedProviderId; });
      const references = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.type === 'RULE-SET' && rule.providerId === provider.id; }).length;
      if (references) {
        target.checked = true;
        showToast('无法停用被引用的规则提供者', 'error', references + ' 条启用规则仍在引用');
        return;
      }
    }
    handleWorkspaceInput(event);
    updateDirtyIndicator();
    if (groupField === 'type') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      if (group.type === 'select') delete group.healthCheck;
      else group.healthCheck = group.healthCheck || { url: 'https://www.gstatic.com/generate_204', interval: 600, tolerance: 80, strategy: 'consistent-hashing' };
      render();
    }
    const ruleField = target.getAttribute('data-rule-field');
    if (ruleField === 'enabled') render();
    if (ruleField === 'type') {
      const rule = state.routing.config.rules[Number(target.getAttribute('data-rule-index'))];
      if (rule.type === 'MATCH') { rule.value = ''; delete rule.providerId; rule.noResolve = false; }
      else if (rule.type === 'RULE-SET') { rule.providerId = state.routing.config.providers[0] ? state.routing.config.providers[0].id : ''; rule.value = ''; }
      else { delete rule.providerId; rule.value = rule.value || ''; }
      render();
    }
    if (ruleField === 'targetGroupId') {
      const rule = state.routing.config.rules[Number(target.getAttribute('data-rule-index'))];
      const destinationGroup = rule && state.routing.config.groups.find(function (group) { return group.id === rule.targetGroupId; });
      if (state.selectedGroupId === UNASSIGNED_RULES_GROUP_ID) {
        const remainingRules = getUnassignedRules();
        if (!remainingRules.length) {
          const nextGroup = destinationGroup || state.routing.config.groups[0];
          state.selectedGroupId = nextGroup ? nextGroup.id : '';
          const nextRule = getRulesForGroup(state.selectedGroupId)[0];
          state.selectedRuleId = destinationGroup && rule ? rule.id : (nextRule ? nextRule.id : '');
        } else if (state.groupRuleScope === 'group') {
          const remainingIds = new Set(remainingRules.filter(matchesRuleQuery).map(function (item) { return item.id; }));
          const nextId = visibleRuleIds.slice(editedRowIndex + 1).find(function (id) { return remainingIds.has(id); })
            || visibleRuleIds.slice(0, editedRowIndex).reverse().find(function (id) { return remainingIds.has(id); });
          if (!remainingIds.has(state.selectedRuleId) || !remainingIds.has(rule.id)) state.selectedRuleId = nextId || '';
        }
      }
      const ruleStillVisible = state.groupRuleScope === 'global' || getRulesForGroup(state.selectedGroupId).some(function (item) { return item.id === rule.id; });
      render({ revealRuleId: ruleStillVisible ? rule.id : state.selectedRuleId });
      if (destinationGroup) showToast('规则已归组', 'success', '目标已改为“' + destinationGroup.name + '”');
    }
  }

  /**
   * 处理工作区按钮点击，所有操作均对应真实数据修改或 API 请求。
   * @param {MouseEvent} event 点击事件。
   */
  async function handleWorkspaceClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');

    if (action === 'retry-application') { await loadApplication(); return; }
    if (action === 'open-logs') { navigate('logs'); return; }

    if (action === 'save-subscription-settings') {
      if (state.busy.has('subscriptionSettings')) return;
      const submittedUserAgent = state.userAgent;
      state.userAgentError = '';
      setBusy('subscriptionSettings', true);
      try {
        const data = await api('/api/subscriptions/settings', { method: 'PUT', body: JSON.stringify({ userAgent: submittedUserAgent }) });
        if (state.userAgent === submittedUserAgent) state.userAgent = data.userAgent;
        state.userAgentBaseline = data.userAgent;
        state.defaultUserAgent = data.defaultUserAgent;
        showToast('全局 UA 已保存', 'success', data.userAgent ? '下次获取订阅源时使用自定义 UA' : '已恢复默认值 ' + data.defaultUserAgent);
      } catch (error) {
        state.userAgentError = (error.errors || []).find(function (issue) { return issue.path === 'userAgent'; })?.message || error.message;
        showToast('UA 保存失败', 'error', state.userAgentError);
      } finally {
        setBusy('subscriptionSettings', false);
        render();
        if (state.activeNav === 'subscriptions' && state.userAgentError) document.getElementById('global-user-agent').focus();
      }
      return;
    }

    if (action === 'logs-category') {
      const category = button.getAttribute('data-category');
      if (state.logsLoading || category === state.logsCategory || !['diagnostic', 'access'].includes(category)) return;
      state.logsCategory = category;
      state.logs = [];
      state.logsCursor = '';
      await refreshLogs(false);
      return;
    }
    if (action === 'refresh-logs' || action === 'more-logs') {
      await refreshLogs(action === 'more-logs');
      return;
    }
    if (action === 'diagnose-subscription') {
      if (state.busy.has('diagnose')) return;
      state.diagnosticSourceIndex = document.getElementById('diagnostic-source').value;
      state.diagnosticUserAgent = document.getElementById('diagnostic-ua').value.trim();
      state.busy.add('diagnose');
      state.diagnostic = null;
      render();
      try {
        const result = await api('/api/subscriptions/diagnose', { method: 'POST', body: JSON.stringify({ index: Number(state.diagnosticSourceIndex), userAgent: state.diagnosticUserAgent }) });
        state.diagnostic = result.diagnostic;
        await refreshLogs(false);
      } catch (error) { showToast('诊断请求失败', 'error', error.message); }
      finally { state.busy.delete('diagnose'); render(); }
      return;
    }

    if (action === 'add-subscription') {
      state.subscriptions.push({ subName: '', subType: '包年/包月', subUrl: '' });
      render();
    } else if (action === 'delete-subscription') {
      const index = Number(button.getAttribute('data-index'));
      openModal('删除订阅源', '<p class="confirm-copy">确定删除“' + escapeHtml(state.subscriptions[index].subName || '未命名订阅源') + '”吗？</p>', '删除', function () { state.subscriptions.splice(index, 1); render(); return true; });
    } else if (action === 'save-subscriptions') {
      if (!validateSubscriptions()) {
        render();
        const firstInvalidField = workspace.querySelector('[aria-invalid="true"]');
        if (firstInvalidField) firstInvalidField.focus();
        showToast('请修正订阅源字段', 'error');
        return;
      }
      setBusy('subscriptions', true);
      try {
        const data = await api('/api/subscriptions', { method: 'PUT', body: JSON.stringify({ subscriptions: state.subscriptions }) });
        state.subscriptions = data.subscriptions;
        state.subscriptionsBaseline = JSON.stringify(data.subscriptions);
        state.subscriptionErrors = {};
        state.outputs = (await api('/api/outputs')).outputs;
        render();
        showToast('订阅源已保存', 'success', '更新客户端订阅即可使用');
      } catch (error) {
        (error.errors || []).forEach(function (issue) {
          const match = /subscriptions\[(\d+)\]\.(\w+)/.exec(issue.path);
          if (match) {
            state.subscriptionErrors[match[1]] = state.subscriptionErrors[match[1]] || {};
            state.subscriptionErrors[match[1]][match[2]] = issue.message;
          }
        });
        render();
        const firstInvalidField = workspace.querySelector('[aria-invalid="true"]');
        if (firstInvalidField) firstInvalidField.focus();
        showToast('订阅源保存失败', 'error', error.message);
      } finally { setBusy('subscriptions', false); }
    } else if (action === 'format-self-nodes') {
      if (!state.selfNodeAnalysis.valid) { showToast('JSON 无法格式化', 'error', state.selfNodeAnalysis.errors[0].message); return; }
      state.selfNodesRaw = JSON.stringify(state.selfNodeAnalysis.nodes, null, 2);
      state.selfNodeAnalysis = analyzeSelfNodes(state.selfNodesRaw);
      render();
    } else if (action === 'save-self-nodes') {
      setBusy('selfNodes', true);
      try {
        const data = await api('/api/self-nodes', { method: 'PUT', body: JSON.stringify({ raw: state.selfNodesRaw }) });
        state.selfNodesRaw = data.raw;
        state.selfNodesBaseline = data.raw;
        state.selfNodeAnalysis = analyzeSelfNodes(data.raw);
        render();
        showToast('自建节点已保存', 'success', '更新客户端订阅即可使用');
      } catch (error) { showToast('节点保存失败', 'error', error.message); }
      finally { setBusy('selfNodes', false); }
    } else if (action === 'copy-output') {
      const output = state.outputs[Number(button.getAttribute('data-index'))];
      copyText(output.url, output.name + '链接');
    } else if (action === 'routing-tab') {
      state.routingTab = button.getAttribute('data-tab');
      render();
    } else if (action === 'select-group') {
      state.selectedGroupId = button.getAttribute('data-id');
      state.groupPane = 'rules';
      state.groupRuleScope = 'group';
      state.ruleQuery = '';
      const firstRule = getRulesForGroup(state.selectedGroupId)[0];
      state.selectedRuleId = firstRule ? firstRule.id : '';
      render();
      const selectedGroupButton = workspace.querySelector('[data-action="select-group"][data-id="' + state.selectedGroupId + '"]');
      if (selectedGroupButton) selectedGroupButton.focus({ preventScroll: true });
    } else if (action === 'group-pane') {
      state.groupPane = button.getAttribute('data-pane');
      render();
    } else if (action === 'group-rule-scope') {
      state.groupRuleScope = button.getAttribute('data-scope');
      const scopeRules = state.groupRuleScope === 'global'
        ? state.routing.config.rules
        : getRulesForGroup(state.selectedGroupId);
      if (!scopeRules.some(function (rule) { return rule.id === state.selectedRuleId; })) {
        state.selectedRuleId = scopeRules[0] ? scopeRules[0].id : '';
      }
      render();
    } else if (action === 'select-rule') {
      state.selectedRuleId = button.getAttribute('data-id');
      render({ revealRuleId: state.selectedRuleId });
    } else if (action === 'move-group-up' || action === 'move-group-down') {
      moveItem(state.routing.config.groups, Number(button.getAttribute('data-index')), action === 'move-group-up' ? -1 : 1);
      render();
    } else if (action === 'add-group') {
      const id = createId('group');
      state.routing.config.groups.push({ id: id, name: '新策略组', type: 'select', enabled: true, visibility: 'always', sources: [{ id: createId('source'), kind: 'builtin', value: 'DIRECT', appliesTo: 'all', when: 'always' }] });
      state.selectedGroupId = id;
      state.selectedRuleId = '';
      state.groupPane = 'rules';
      state.groupRuleScope = 'group';
      render();
    } else if (action === 'duplicate-group') {
      const source = state.routing.config.groups.find(function (group) { return group.id === state.selectedGroupId; });
      const copy = clone(source);
      copy.id = createId('group');
      copy.name = source.name + ' 副本';
      copy.sources.forEach(function (item) { item.id = createId('source'); });
      state.routing.config.groups.splice(state.routing.config.groups.indexOf(source) + 1, 0, copy);
      state.selectedGroupId = copy.id;
      state.selectedRuleId = '';
      state.groupPane = 'rules';
      state.groupRuleScope = 'group';
      render();
    } else if (action === 'delete-group') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      const ruleRefs = state.routing.config.rules.filter(function (rule) { return rule.targetGroupId === group.id; });
      const groupRefs = state.routing.config.groups.filter(function (candidate) { return candidate.sources.some(function (source) { return source.kind === 'group' && source.groupId === group.id; }); });
      if (ruleRefs.length || groupRefs.length) {
        showToast('无法删除被引用的策略组', 'error', ruleRefs.length + ' 条规则、' + groupRefs.length + ' 个策略组仍在引用');
      } else {
        openModal('删除策略组', '<p class="confirm-copy">确定删除“' + escapeHtml(group.name) + '”吗？</p>', '删除', function () {
           const index = state.routing.config.groups.indexOf(group);
           state.routing.config.groups.splice(index, 1);
           state.selectedGroupId = state.routing.config.groups[0] ? state.routing.config.groups[0].id : '';
           const nextRule = state.routing.config.rules.find(function (rule) { return rule.targetGroupId === state.selectedGroupId; });
           state.selectedRuleId = nextRule ? nextRule.id : '';
           render();
          return true;
        });
      }
    } else if (action === 'add-source') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      const kind = button.getAttribute('data-kind');
      if (kind === 'filter') group.sources.push({ id: createId('source'), kind: 'filter', source: 'all', include: '', exclude: '', appliesTo: 'all', when: 'always' });
      else if (kind === 'group') {
        const target = state.routing.config.groups.find(function (item) { return item.id !== group.id; });
        if (!target) { showToast('没有可引用的其它策略组', 'warning'); return; }
        group.sources.push({ id: createId('source'), kind: 'group', groupId: target.id, appliesTo: 'all', when: 'always' });
      } else group.sources.push({ id: createId('source'), kind: 'builtin', value: 'DIRECT', appliesTo: 'all', when: 'always' });
      render();
    } else if (action === 'remove-source') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      group.sources.splice(Number(button.getAttribute('data-index')), 1);
      render();
    } else if (action === 'move-source-up' || action === 'move-source-down') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      moveItem(group.sources, Number(button.getAttribute('data-index')), action === 'move-source-up' ? -1 : 1);
      render();
    } else if (action === 'add-rule') {
      addRuleToCurrentGroup();
    } else if (action === 'insert-rule-above' || action === 'insert-rule-below') {
      insertAdjacentRoutingRule(button.getAttribute('data-id'), action === 'insert-rule-above' ? 'above' : 'below');
    } else if (action === 'duplicate-rule') {
      duplicateRoutingRule(button.getAttribute('data-id'));
    } else if (action === 'delete-rule') {
      const index = Number(button.getAttribute('data-index'));
      const removed = state.routing.config.rules[index];
      // 先记录当前可见邻居，再删除；保留用户正在处理的局部位置。
      const visibleRules = (state.groupRuleScope === 'global' ? state.routing.config.rules : getRulesForGroup(state.selectedGroupId)).filter(matchesRuleQuery);
      const visibleIndex = visibleRules.findIndex(function (rule) { return rule === removed; });
      const neighbor = visibleRules[visibleIndex + 1] || visibleRules[visibleIndex - 1];
      state.routing.config.rules.splice(index, 1);
      state.selectedRuleId = neighbor ? neighbor.id : '';
      if (state.selectedGroupId === UNASSIGNED_RULES_GROUP_ID && !getUnassignedRules().length) {
        state.selectedGroupId = state.routing.config.groups[0] ? state.routing.config.groups[0].id : '';
        const firstGroupRule = getRulesForGroup(state.selectedGroupId)[0];
        state.selectedRuleId = firstGroupRule ? firstGroupRule.id : '';
      }
      render({ revealRuleId: state.selectedRuleId });
      showToast('规则已删除', 'success', removed ? (removed.remark || removed.value || removed.type) : '');
    } else if (action === 'move-selected-rule-up' || action === 'move-selected-rule-down') {
      moveRoutingRuleInScope(button.getAttribute('data-id'), action === 'move-selected-rule-up' ? -1 : 1);
    } else if (action === 'move-rule-up' || action === 'move-rule-down') {
      const rule = state.routing.config.rules[Number(button.getAttribute('data-index'))];
      if (rule) moveRoutingRuleInScope(rule.id, action === 'move-rule-up' ? -1 : 1);
    } else if (action === 'select-provider') {
      state.selectedProviderId = button.getAttribute('data-id');
      render();
    } else if (action === 'add-provider') {
      const id = createId('provider');
      state.routing.config.providers.push({ id: id, name: '新规则集', enabled: true, type: 'http', behavior: 'classical', url: 'https://example.com/rules.yaml', path: './RuleSet/new-rules.yaml', interval: 86400 });
      state.selectedProviderId = id;
      render();
    } else if (action === 'delete-provider') {
      const provider = state.routing.config.providers.find(function (item) { return item.id === state.selectedProviderId; });
      const refs = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.type === 'RULE-SET' && rule.providerId === provider.id; });
      if (refs.length) showToast('无法删除被引用的规则提供者', 'error', refs.length + ' 条启用规则仍在引用');
      else openModal('删除规则提供者', '<p class="confirm-copy">确定删除“' + escapeHtml(provider.name) + '”吗？</p>', '删除', function () {
        state.routing.config.providers.splice(state.routing.config.providers.indexOf(provider), 1);
        state.selectedProviderId = state.routing.config.providers[0] ? state.routing.config.providers[0].id : '';
        render(); return true;
      });
    } else if (action === 'locate-yaml') {
      const editor = document.getElementById('base-yaml-editor');
      const line = Number(button.getAttribute('data-line'));
      const lines = editor.value.split('\n');
      const start = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
      editor.focus(); editor.setSelectionRange(start, start + lines[line - 1].length);
    } else if (action === 'reset-base-yaml') {
      openModal('恢复默认 YAML 模板', '<p class="confirm-copy">这会替换当前模板文本，但不会立即保存或发布。</p>', '恢复默认', function () { state.routing.config.baseYaml = state.routing.defaultBaseYaml || ''; render(); return true; });
    } else if (action === 'format-base-yaml') {
      openModal('整理 YAML 格式', '<p class="confirm-copy">格式化可能改变注释位置与引号风格，是否继续？</p>', '整理格式', async function () {
        try {
          const data = await api('/api/routing-config/format', { method: 'POST', body: JSON.stringify({ baseYaml: state.routing.config.baseYaml }) });
          state.routing.config.baseYaml = data.baseYaml;
          render(); return true;
        } catch (error) { showToast('YAML 格式化失败', 'error', error.message); return false; }
      });
    } else if (action === 'validate-routing') {
      validateRouting(false);
    } else if (action === 'save-routing') {
      saveRoutingDraft();
    } else if (action === 'publish-routing') {
      const valid = await validateRouting(true);
      if (!valid) { showToast('请先修复发布错误', 'error'); return; }
      const config = state.routing.config;
      openModal('发布路由配置', '<div class="publish-counts"><div><strong>' + config.groups.filter(function (item) { return item.enabled; }).length + '</strong><span>策略组</span></div><div><strong>' + config.rules.filter(function (item) { return item.enabled; }).length + '</strong><span>路由规则</span></div><div><strong>' + config.providers.filter(function (item) { return item.enabled; }).length + '</strong><span>规则提供者</span></div></div>', '确认发布', async function () { await publishRouting(); return true; });
    } else if (action === 'preview-routing') {
      openPreviewDrawer();
    } else if (action === 'import-routing') {
      openModal('从完整 Clash YAML 导入', '<p class="modal-help">导入策略组、分流规则和基础配置。节点请在“订阅源”或“自建节点”中添加。检查后发布生效。</p><label class="field"><span>完整 Clash YAML</span><textarea id="import-yaml" class="import-textarea" spellcheck="false" placeholder="粘贴完整 Clash YAML"></textarea></label><div class="import-error-list" id="import-errors" role="alert"></div>', '解析并导入草稿', async function () {
        const text = document.getElementById('import-yaml').value;
        try {
          const data = await api('/api/routing-config/import', { method: 'POST', body: JSON.stringify({ yaml: text }) });
          state.routing.config = data.config;
          state.selectedGroupId = data.config.groups[0]
            ? data.config.groups[0].id
            : (getUnassignedRules().length ? UNASSIGNED_RULES_GROUP_ID : '');
          const firstImportedRule = getRulesForGroup(state.selectedGroupId)[0];
          state.selectedRuleId = firstImportedRule ? firstImportedRule.id : '';
          state.selectedProviderId = data.config.providers[0] ? data.config.providers[0].id : '';
          state.routingTab = 'groups';
          state.groupPane = 'rules';
          state.groupRuleScope = 'group';
          state.routingIssues = { errors: [], warnings: [] };
          state.routingValidatedSnapshot = '';
          state.routingPreviews = {};
          let validationTone = 'success';
          let validationMessage = '请再次检查并发布';
          try {
            state.routingIssues = await api('/api/routing-config/validate', { method: 'POST', body: JSON.stringify({ config: data.config }) });
            state.routingValidatedSnapshot = JSON.stringify(data.config);
          } catch (validationError) {
            state.routingIssues = { errors: validationError.errors || [{ path: '', message: validationError.message }], warnings: [] };
            state.routingValidatedSnapshot = JSON.stringify(data.config);
            validationTone = 'warning';
            validationMessage = state.routingIssues.errors.length + ' 个校验问题待处理';
          }
          render();
          showToast('已导入路由草稿', validationTone, data.summary.groups + ' 个策略组 · ' + data.summary.rules + ' 条规则 · ' + data.summary.providers + ' 个提供者 · ' + data.summary.baseFields + ' 个基础字段；' + validationMessage);
          return true;
        } catch (error) {
          const issues = error.errors && error.errors.length ? error.errors : [{ path: 'yaml', message: error.message }];
          const errorRoot = document.getElementById('import-errors');
          if (errorRoot) errorRoot.innerHTML = '<strong>发现 ' + issues.length + ' 个问题，未替换当前草稿</strong><ul>' + issues.map(function (issue) { return '<li><code>' + escapeHtml(issue.path || 'yaml') + '</code><span>' + escapeHtml(issue.message) + '</span></li>'; }).join('') + '</ul>';
          showToast('YAML 导入失败', 'error', '请处理弹窗内列出的全部问题');
          return false;
        }
      });
    }
  }

  /**
   * 统一更新移动端侧栏与菜单按钮的可访问状态。
   * @param {boolean} open 是否展开侧栏。
   */
  function setSidebarOpen(open) {
    const menuButton = document.getElementById('mobile-menu-button');
    const compact = window.matchMedia('(max-width: 899px)').matches;
    const shouldHide = compact && !open;
    sidebar.classList.toggle('open', open);
    sidebar.inert = shouldHide;
    if (shouldHide) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    if (open) {
      const current = sidebar.querySelector('[aria-current="page"]');
      if (current) current.focus();
    } else if (sidebar.contains(document.activeElement)) {
      menuButton.focus();
    }
  }

  /**
   * 导航到 Hash 对应页面；存在未保存更改时先征求确认。
   * @param {string} navId 目标页面 ID。
   */
  function navigate(navId) {
    if (!VALID_NAVS.includes(navId)) navId = 'subscriptions';
    if (navId === state.activeNav) { setSidebarOpen(false); return; }
    if (hasUnsavedChanges() && !window.confirm('存在未保存更改，确定离开当前页面吗？')) return;
    state.activeNav = navId;
    state.suppressHash = true;
    window.location.hash = navId;
    setSidebarOpen(false);
    render();
  }

  workspace.addEventListener('input', function (event) {
    if (event.target.id === 'diagnostic-ua') { state.diagnosticUserAgent = event.target.value; return; }
    handleWorkspaceInput(event); updateDirtyIndicator();
  });
  workspace.addEventListener('change', function (event) {
    if (event.target.id === 'diagnostic-source') { state.diagnosticSourceIndex = event.target.value; return; }
    handleWorkspaceChange(event);
  });
  workspace.addEventListener('click', handleWorkspaceClick);
  /**
   * 为路由页主页签和策略组二级页签补齐标准方向键切换。
   * Home/End 跳到首尾，左右方向键移动一个页签并立即激活。
   */
  workspace.addEventListener('keydown', function (event) {
    const currentTab = event.target.closest('[role="tab"]');
    if (!currentTab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabList = currentTab.closest('[role="tablist"]');
    if (!tabList) return;
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex < 0 || !tabs.length) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else nextIndex = (currentIndex + 1) % tabs.length;
    const nextTab = tabs[nextIndex];
    const action = nextTab.getAttribute('data-action');
    const keyAttribute = nextTab.hasAttribute('data-tab') ? 'data-tab' : 'data-pane';
    const keyValue = nextTab.getAttribute(keyAttribute);
    nextTab.click();
    const replacement = workspace.querySelector('[data-action="' + action + '"][' + keyAttribute + '="' + keyValue + '"]');
    if (replacement) replacement.focus();
  });
  document.querySelectorAll('[data-nav]').forEach(function (button) { button.addEventListener('click', function () { navigate(button.getAttribute('data-nav')); }); });
  document.getElementById('mobile-menu-button').addEventListener('click', function () { setSidebarOpen(!sidebar.classList.contains('open')); });
  document.getElementById('sidebar-backdrop').addEventListener('click', function () { setSidebarOpen(false); });

  /** 保持前进、后退和直接 Hash 访问与页面状态一致。 */
  window.addEventListener('hashchange', function () {
    if (state.suppressHash) { state.suppressHash = false; return; }
    const next = window.location.hash.replace('#', '');
    if (!VALID_NAVS.includes(next)) { navigate('subscriptions'); return; }
    if (hasUnsavedChanges() && !window.confirm('存在未保存更改，确定切换页面吗？')) {
      state.suppressHash = true;
      window.location.hash = state.activeNav;
      return;
    }
    state.activeNav = next;
    render();
  });

  /** 关闭或刷新标签页时使用浏览器原生二次确认保护草稿。 */
  window.addEventListener('beforeunload', function (event) {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  /**
   * Escape 关闭当前弹窗；Tab 键则被限制在当前浮层内循环。
   * 这样键盘用户不会意外移动到遮罩后的表单和导航控件。
   */
  window.addEventListener('keydown', function (event) {
    if (!overlayRoot.innerHTML) {
      if (event.key === 'Escape' && sidebar.classList.contains('open')) {
        event.preventDefault();
        setSidebarOpen(false);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(overlayRoot.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (element) {
      return element.getClientRects().length > 0;
    });
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const initialHash = window.location.hash.replace('#', '');
  state.activeNav = VALID_NAVS.includes(initialHash) ? initialHash : 'subscriptions';
  if (!initialHash) history.replaceState(null, '', '#subscriptions');
  setSidebarOpen(false);
  loadApplication();
})();
`
