/**
 * 新版控制台的轻量浏览器脚本。
 * 使用事件委托和原生 DOM API 实现完整交互，不引入 React、Babel 或 CDN 运行时。
 */
export const consoleClientScript = String.raw`
(() => {
  'use strict';

  const VALID_NAVS = ['subscriptions', 'nodes', 'routing', 'links'];
  const MANAGED_YAML_KEYS = ['proxies', 'proxy-groups', 'rule-providers', 'rules'];
  const workspace = document.getElementById('workspace');
  const overlayRoot = document.getElementById('overlay-root');
  const toastRoot = document.getElementById('toast-root');
  const sidebar = document.getElementById('sidebar');

  /** 控制台全部可变状态；只保存真实 API 数据和当前编辑状态。 */
  const state = {
    activeNav: 'subscriptions',
    subscriptions: [],
    subscriptionsBaseline: '[]',
    subscriptionErrors: {},
    selfNodesRaw: '[]',
    selfNodesBaseline: '[]',
    selfNodeAnalysis: { valid: true, nodes: [], errors: [] },
    outputs: [],
    routing: null,
    routingBaseline: '',
    routingTab: 'groups',
    selectedGroupId: '',
    selectedRuleId: '',
    selectedProviderId: '',
    groupQuery: '',
    ruleQuery: '',
    ruleCategory: 'all',
    providerQuery: '',
    routingIssues: { errors: [], warnings: [] },
    routingPreviews: {},
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
   * 判断任意页面是否存在未保存更改。
   * @returns {boolean} 需要离开确认时为 true。
   */
  function hasUnsavedChanges() {
    return JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline
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
    if (!state.subscriptions.length) errors.global = { message: '至少需要保留一条订阅源' };
    state.subscriptionErrors = errors;
    return Object.keys(errors).length === 0;
  }

  /**
   * 读取四类控制台数据并建立编辑基线。
   * @returns {Promise<void>} 全部数据加载完成后重新渲染当前页面。
   */
  async function loadApplication() {
    try {
      const results = await Promise.all([
        api('/api/subscriptions'),
        api('/api/self-nodes'),
        api('/api/routing-config'),
        api('/api/outputs'),
      ]);
      state.subscriptions = results[0].subscriptions || [];
      state.subscriptionsBaseline = JSON.stringify(state.subscriptions);
      state.selfNodesRaw = results[1].raw || '[]';
      state.selfNodesBaseline = state.selfNodesRaw;
      state.selfNodeAnalysis = analyzeSelfNodes(state.selfNodesRaw);
      state.routing = results[2];
      state.routingBaseline = JSON.stringify(results[2].config);
      state.outputs = results[3].outputs || [];
      state.selectedGroupId = results[2].config.groups[0] ? results[2].config.groups[0].id : '';
      state.selectedRuleId = results[2].config.rules[0] ? results[2].config.rules[0].id : '';
      state.selectedProviderId = results[2].config.providers[0] ? results[2].config.providers[0].id : '';
      render();
    } catch (error) {
      workspace.innerHTML = '<div class="fatal-state"><strong>配置加载失败</strong><span>' + escapeHtml(error.message) + '</span><button class="button primary" id="retry-load">重试</button></div>';
      document.getElementById('retry-load').addEventListener('click', loadApplication);
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
      + '"><span class="workspace-status-dot"></span>' + escapeHtml(status) + '</span></div></div><div class="header-actions workspace-actions">'
      + (actions || '') + '</div></header>';
  }

  /**
   * 渲染订阅源表格及真实保存状态。
   * @returns {string} 订阅源页面 HTML。
   */
  function renderSubscriptionsPage() {
    const dirty = JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline;
    const rows = state.subscriptions.map(function (subscription, index) {
      const errors = state.subscriptionErrors[index] || {};
      return '<tr class="' + (Object.keys(errors).length ? 'row-invalid' : '') + '" data-sub-index="' + index + '">'
        + '<td><input data-sub-field="subName" value="' + escapeHtml(subscription.subName) + '" aria-label="订阅源名称" placeholder="订阅源名称" class="' + (errors.subName ? 'invalid' : '') + '">'
        + (errors.subName ? '<small class="cell-error">' + escapeHtml(errors.subName) + '</small>' : '') + '</td>'
        + '<td><select data-sub-field="subType" aria-label="订阅类型"><option value="包年/包月"' + (subscription.subType === '包年/包月' ? ' selected' : '') + '>包年/包月</option><option value="流量包"' + (subscription.subType === '流量包' ? ' selected' : '') + '>流量包</option></select></td>'
        + '<td><input data-sub-field="subUrl" value="' + escapeHtml(subscription.subUrl) + '" aria-label="订阅地址" placeholder="https://example.com/sub" spellcheck="false" class="' + (errors.subUrl ? 'invalid' : '') + '">'
        + (errors.subUrl ? '<small class="cell-error">' + escapeHtml(errors.subUrl) + '</small>' : '') + '</td>'
        + '<td><button type="button" class="icon-button danger" data-action="delete-subscription" data-index="' + index + '" aria-label="删除 ' + escapeHtml(subscription.subName || '订阅源') + '">删除</button></td></tr>';
    }).join('');
    const actions = '<button type="button" class="button secondary" data-action="add-subscription">添加订阅源</button>'
      + '<button type="button" class="button primary" data-action="save-subscriptions" data-busy-key="subscriptions"' + (!dirty ? ' disabled' : '') + '>保存</button>';
    return pageHeader('订阅源', dirty ? '有未保存更改' : state.subscriptions.length + ' 个订阅源', dirty ? 'dirty' : 'saved', actions)
      + '<div class="workspace-content"><section class="data-panel subscription-panel">'
      + (state.subscriptionErrors.global ? '<div class="inline-error">' + escapeHtml(state.subscriptionErrors.global.message) + '</div>' : '')
      + '<div class="data-table-wrap"><table class="data-table subscription-table"><thead><tr><th>名称</th><th>类型</th><th>订阅地址</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + (!state.subscriptions.length ? '<div class="empty-state"><strong>还没有订阅源</strong><button class="button primary" data-action="add-subscription">添加订阅源</button></div>' : '')
      + '</section></div>';
  }

  /**
   * 渲染自建节点摘要、JSON 编辑器、行号和实时校验状态。
   * @returns {string} 自建节点页面 HTML。
   */
  function renderNodesPage() {
    const analysis = state.selfNodeAnalysis;
    const dirty = state.selfNodesRaw !== state.selfNodesBaseline;
    const nodes = analysis.nodes.map(function (node, index) {
      return '<div class="parsed-node-row"><span class="node-protocol">' + escapeHtml(String(node.type || '?').toUpperCase()) + '</span><div><strong>'
        + escapeHtml(node.name || ('未命名节点 ' + (index + 1))) + '</strong><span>' + escapeHtml(node.server || '—') + (node.port ? ':' + escapeHtml(node.port) : '') + '</span></div></div>';
    }).join('');
    const lines = state.selfNodesRaw.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
    const actions = '<button type="button" class="button secondary" data-action="format-self-nodes">格式化</button>'
      + '<button type="button" class="button primary" data-action="save-self-nodes" data-busy-key="selfNodes"' + (!dirty || !analysis.valid ? ' disabled' : '') + '>保存节点</button>';
    const status = analysis.valid ? (dirty ? '有未保存更改' : analysis.nodes.length + ' 个节点') : 'JSON 无效';
    return pageHeader('自建节点', status, analysis.valid ? (dirty ? 'dirty' : 'saved') : 'error', actions)
      + '<div class="workspace-content nodes-workspace"><section class="data-panel parsed-nodes-panel"><div class="simple-panel-head"><h2>节点</h2><span>' + analysis.nodes.length + '</span></div><div class="parsed-node-list">'
      + (nodes || '<div class="empty-list">暂无可显示节点</div>') + '</div></section>'
      + '<section class="data-panel json-editor-panel"><div class="code-toolbar"><span>self-nodes.json</span><span>UTF-8 · 2 空格</span></div><div class="code-editor-grid node-code-grid"><div class="yaml-line-rail" id="node-line-rail" aria-hidden="true">'
      + lines + '</div><textarea id="self-nodes-editor" class="base-yaml-textarea node-json-textarea" spellcheck="false" aria-label="自建节点 JSON">' + escapeHtml(state.selfNodesRaw) + '</textarea></div>'
      + '<div class="editor-validation ' + (analysis.valid ? 'valid' : 'invalid') + '"><span>' + escapeHtml(analysis.valid ? analysis.nodes.length + ' 个节点，格式有效' : analysis.errors[0].message) + '</span></div></section></div>';
  }

  /**
   * 渲染两类真实订阅输出与各自已保存订阅源数量。
   * @returns {string} 输出页面 HTML。
   */
  function renderOutputsPage() {
    const rows = state.outputs.map(function (output, index) {
      return '<article class="output-row"><div class="output-type"><span class="output-icon" aria-hidden="true"></span><div><strong>' + escapeHtml(output.name) + '</strong><span>' + escapeHtml(output.sourceCount) + ' 个订阅源</span></div></div>'
        + '<code>' + escapeHtml(output.url) + '</code><button type="button" class="button secondary" data-action="copy-output" data-index="' + index + '">复制</button></article>';
    }).join('');
    return pageHeader('订阅输出', state.outputs.length + ' 个链接', 'saved', '')
      + '<div class="workspace-content"><section class="data-panel output-panel"><div class="output-list">' + rows + '</div></section></div>';
  }

  /**
   * 生成策略组下拉选项，并包含兼容旧规则使用的 DIRECT/REJECT 目标。
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
    return ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'RULE-SET', 'PROCESS-NAME', 'GEOIP', 'MATCH'].map(function (type) {
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
   * 渲染策略组列表、当前组编辑器和真实节点匹配预览。
   * @returns {{left:string,center:string}} 两栏 HTML。
   */
  function renderGroupsWorkspace() {
    const config = state.routing.config;
    const query = state.groupQuery.trim().toLowerCase();
    const visible = config.groups.filter(function (group) { return !query || group.name.toLowerCase().indexOf(query) >= 0 || group.type.indexOf(query) >= 0; });
    const rows = visible.map(function (group, index) {
      const preview = state.routingPreviews[group.id];
      const realIndex = config.groups.findIndex(function (item) { return item.id === group.id; });
      return '<div class="entity-row ' + (state.selectedGroupId === group.id ? 'active ' : '') + (!group.enabled ? 'disabled' : '') + '" data-action="select-group" data-id="' + escapeHtml(group.id) + '"><span class="entity-copy"><strong>' + escapeHtml(group.name || '未命名策略组') + '</strong><small>' + escapeHtml(group.type) + ' · ' + (preview ? preview.count + ' 个节点' : '待预览') + '</small></span><span class="row-order-actions"><button data-action="move-group-up" data-index="' + realIndex + '"' + (realIndex === 0 ? ' disabled' : '') + '>上移</button><button data-action="move-group-down" data-index="' + realIndex + '"' + (realIndex === config.groups.length - 1 ? ' disabled' : '') + '>下移</button></span></div>';
    }).join('');
    const left = '<section class="entity-panel group-list-panel"><div class="panel-header"><div><h2>策略组</h2><p>' + config.groups.filter(function (group) { return group.enabled; }).length + ' 个已启用</p></div><button class="icon-button brand" data-action="add-group" aria-label="新建策略组">新增</button></div><div class="panel-search"><input id="group-search" value="' + escapeHtml(state.groupQuery) + '" placeholder="搜索名称或类型" aria-label="搜索策略组"></div><div class="entity-list">' + (rows || '<div class="empty-search">未找到策略组</div>') + '</div></section>';

    const group = config.groups.find(function (item) { return item.id === state.selectedGroupId; });
    if (!group) return { left: left, center: '<section class="editor-panel centered-empty"><h2>选择一个策略组</h2><p>从左侧列表选择，或新建一个策略组。</p></section>' };
    const preview = state.routingPreviews[group.id] || { count: 0, names: [] };
    const healthRequired = group.type !== 'select';
    const health = group.healthCheck || { url: 'https://www.gstatic.com/generate_204', interval: 600, tolerance: 80, strategy: 'consistent-hashing' };
    const previewNames = preview.names.map(function (name) { return '<span class="node-chip">' + escapeHtml(name) + '</span>'; }).join('');
    const healthFields = healthRequired ? '<section class="form-section"><div class="section-heading"><h3>健康检查</h3></div><div class="form-grid three-columns"><label class="field"><span>测试地址</span><input data-group-health="url" value="' + escapeHtml(health.url) + '"></label><label class="field"><span>间隔（秒）</span><input type="number" min="1" data-group-health="interval" value="' + escapeHtml(health.interval) + '"></label>'
      + (group.type === 'url-test' ? '<label class="field"><span>延迟容差</span><input type="number" min="0" data-group-health="tolerance" value="' + escapeHtml(health.tolerance || 0) + '"></label>' : '')
      + (group.type === 'load-balance' ? '<label class="field"><span>负载策略</span><select data-group-health="strategy"><option value="consistent-hashing"' + (health.strategy === 'consistent-hashing' ? ' selected' : '') + '>consistent-hashing</option><option value="round-robin"' + (health.strategy === 'round-robin' ? ' selected' : '') + '>round-robin</option></select></label>' : '') + '</div></section>' : '';
    const center = '<section class="editor-panel group-editor"><div class="panel-header"><div><h2>编辑策略组</h2></div><div class="panel-header-actions"><label class="switch-label"><span>已启用</span><input type="checkbox" data-group-field="enabled"' + (group.enabled ? ' checked' : '') + '></label><button class="icon-button" data-action="duplicate-group">复制</button><button class="icon-button danger" data-action="delete-group">删除</button></div></div><div class="editor-scroll">'
      + '<section class="form-section first-section"><div class="section-heading"><h3>基本信息</h3></div><div class="form-grid two-columns"><label class="field"><span>策略组名称</span><input data-group-field="name" value="' + escapeHtml(group.name) + '"></label><label class="field"><span>策略类型</span><select data-group-field="type"><option value="select"' + (group.type === 'select' ? ' selected' : '') + '>手动选择（select）</option><option value="url-test"' + (group.type === 'url-test' ? ' selected' : '') + '>自动测速（url-test）</option><option value="fallback"' + (group.type === 'fallback' ? ' selected' : '') + '>故障转移（fallback）</option><option value="load-balance"' + (group.type === 'load-balance' ? ' selected' : '') + '>负载均衡（load-balance）</option></select></label></div></section>'
      + '<section class="form-section"><div class="section-heading source-heading"><h3>成员来源</h3><div class="button-cluster"><button class="button secondary small" data-action="add-source" data-kind="filter">添加筛选器</button><button class="button secondary small" data-action="add-source" data-kind="group">引用策略组</button><button class="button secondary small" data-action="add-source" data-kind="builtin">内置策略</button></div></div><div class="source-list">' + group.sources.map(function (source, index) { return renderSourceCard(source, group, index); }).join('') + '</div></section>'
      + healthFields + '<section class="form-section"><div class="section-heading"><h3>节点匹配预览</h3><strong class="preview-count">' + preview.count + ' 个节点</strong></div><div class="node-preview-list">' + (previewNames || '<span class="warning-copy">尚未生成预览，点击右侧“预览完整 YAML”获取真实节点匹配。</span>') + '</div></section></div></section>';
    return { left: left, center: center };
  }

  /**
   * 渲染规则分类、搜索与完整字段编辑表。
   * @returns {{left:string,center:string}} 两栏 HTML。
   */
  function renderRulesWorkspace() {
    const rules = state.routing.config.rules;
    const categories = ['all'].concat(Array.from(new Set(rules.map(function (rule) { return rule.category || 'general'; }))));
    const categoryRows = categories.map(function (category) {
      const count = category === 'all' ? rules.length : rules.filter(function (rule) { return rule.category === category; }).length;
      return '<button class="category-row ' + (state.ruleCategory === category ? 'active' : '') + '" data-action="select-rule-category" data-category="' + escapeHtml(category) + '"><span>' + escapeHtml(category === 'all' ? '全部规则' : category) + '</span><small>' + count + '</small></button>';
    }).join('');
    const left = '<section class="entity-panel rule-category-panel"><div class="panel-header"><div><h2>规则分类</h2><p>' + rules.length + ' 条规则</p></div><button class="icon-button brand" data-action="add-rule">新增</button></div><div class="category-list">' + categoryRows + '</div></section>';
    const keyword = state.ruleQuery.trim().toLowerCase();
    const filtered = rules.filter(function (rule) {
      const categoryMatch = state.ruleCategory === 'all' || rule.category === state.ruleCategory;
      const keywordMatch = !keyword || [rule.type, rule.value, rule.category, rule.remark].join(' ').toLowerCase().indexOf(keyword) >= 0;
      return categoryMatch && keywordMatch;
    });
    const rows = filtered.map(function (rule) {
      const index = rules.findIndex(function (item) { return item.id === rule.id; });
      const valueControl = rule.type === 'MATCH' ? '<span class="muted-label">无需内容</span>' : rule.type === 'RULE-SET'
        ? '<select data-rule-field="providerId" data-rule-index="' + index + '">' + providerOptions(rule.providerId) + '</select>'
        : '<input data-rule-field="value" data-rule-index="' + index + '" value="' + escapeHtml(rule.value || '') + '">';
      return '<tr data-rule-index="' + index + '"><td><input type="checkbox" data-rule-field="enabled" data-rule-index="' + index + '"' + (rule.enabled ? ' checked' : '') + ' aria-label="启用规则"></td><td><select data-rule-field="type" data-rule-index="' + index + '">' + ruleTypeOptions(rule.type) + '</select></td><td>' + valueControl + '</td><td><select data-rule-field="targetGroupId" data-rule-index="' + index + '">' + groupOptions(rule.targetGroupId, '') + '</select></td><td><textarea class="rule-remark-input" rows="2" data-rule-field="remark" data-rule-index="' + index + '" placeholder="导出为规则上方注释" aria-label="规则备注">' + escapeHtml(rule.remark || '') + '</textarea></td><td><input data-rule-field="category" data-rule-index="' + index + '" value="' + escapeHtml(rule.category) + '"></td><td><input type="checkbox" data-rule-field="noResolve" data-rule-index="' + index + '"' + (rule.noResolve ? ' checked' : '') + (rule.type === 'MATCH' ? ' disabled' : '') + ' aria-label="no-resolve"></td><td class="row-order-actions"><button data-action="move-rule-up" data-index="' + index + '"' + (index === 0 ? ' disabled' : '') + '>上移</button><button data-action="move-rule-down" data-index="' + index + '"' + (index === rules.length - 1 ? ' disabled' : '') + '>下移</button><button class="danger-text" data-action="delete-rule" data-index="' + index + '">删除</button></td></tr>';
    }).join('');
    const center = '<section class="editor-panel rules-editor"><div class="panel-header"><div><h2>路由规则</h2><p>启用顺序即最终 YAML 顺序；备注导出为规则上一行注释</p></div><div class="panel-search inline-search"><input id="rule-search" value="' + escapeHtml(state.ruleQuery) + '" placeholder="搜索类型、内容、备注或分类"></div></div><div class="data-table-wrap rules-table-wrap"><table class="data-table rules-table"><thead><tr><th>启用</th><th>类型</th><th>匹配内容 / 提供者</th><th>目标</th><th>备注</th><th>分类</th><th>no-resolve</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
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
    const left = '<section class="entity-panel provider-list-panel"><div class="panel-header"><div><h2>规则提供者</h2><p>' + providers.length + ' 个提供者</p></div><button class="icon-button brand" data-action="add-provider">新增</button></div><div class="panel-search"><input id="provider-search" value="' + escapeHtml(state.providerQuery) + '" placeholder="搜索名称或行为"></div><div class="entity-list">' + (rows || '<div class="empty-search">未找到提供者</div>') + '</div></section>';
    const provider = providers.find(function (item) { return item.id === state.selectedProviderId; });
    if (!provider) return { left: left, center: '<section class="editor-panel centered-empty"><h2>选择规则提供者</h2></section>' };
    const refs = state.routing.config.rules.filter(function (rule) { return rule.enabled && rule.type === 'RULE-SET' && rule.providerId === provider.id; });
    const center = '<section class="editor-panel provider-editor"><div class="panel-header"><div><h2>编辑规则提供者</h2><p>' + refs.length + ' 条启用规则引用</p></div><div class="panel-header-actions"><label class="switch-label"><span>已启用</span><input type="checkbox" data-provider-field="enabled"' + (provider.enabled ? ' checked' : '') + '></label><button class="icon-button danger" data-action="delete-provider">删除</button></div></div><div class="editor-scroll"><section class="form-section first-section"><div class="form-grid two-columns"><label class="field"><span>名称</span><input data-provider-field="name" value="' + escapeHtml(provider.name) + '"></label><label class="field"><span>行为模式</span><select data-provider-field="behavior"><option value="classical"' + (provider.behavior === 'classical' ? ' selected' : '') + '>classical</option><option value="domain"' + (provider.behavior === 'domain' ? ' selected' : '') + '>domain</option><option value="ipcidr"' + (provider.behavior === 'ipcidr' ? ' selected' : '') + '>ipcidr</option></select></label></div><label class="field"><span>下载地址</span><input data-provider-field="url" value="' + escapeHtml(provider.url) + '"></label><div class="form-grid two-columns"><label class="field"><span>更新间隔（秒）</span><input type="number" min="1" data-provider-field="interval" value="' + escapeHtml(provider.interval) + '"></label><label class="field"><span>生成路径</span><input data-provider-field="path" value="' + escapeHtml(provider.path) + '"></label></div></section></div></section>';
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
    const outlineRows = outline.map(function (item) {
      const conflict = MANAGED_YAML_KEYS.indexOf(item.key) >= 0;
      return '<button class="outline-row ' + (conflict ? 'conflict' : '') + '" data-action="locate-yaml" data-line="' + item.line + '"><span>' + escapeHtml(item.key) + '</span><small>第 ' + item.line + ' 行</small></button>';
    }).join('');
    const lines = text.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
    const left = '<section class="entity-panel yaml-outline-panel"><div class="panel-header"><div><h2>顶级字段</h2><p>' + outline.length + ' 个字段</p></div></div><div class="outline-list">' + (outlineRows || '<div class="empty-search">空 Mapping</div>') + '</div></section>';
    const center = '<section class="editor-panel base-yaml-editor"><div class="panel-header"><div><h2>YAML 模板</h2><p>仅维护 DNS、TUN、profile 等非受管字段</p></div><div class="panel-header-actions"><button class="button secondary small" data-action="reset-base-yaml">恢复默认</button><button class="button secondary small" data-action="format-base-yaml">整理格式</button><button class="button primary small" data-action="preview-routing">完整输出</button></div></div><div class="code-editor-grid base-code-grid"><div class="yaml-line-rail" id="yaml-line-rail" aria-hidden="true">' + lines + '</div><textarea id="base-yaml-editor" class="base-yaml-textarea" spellcheck="false" aria-label="YAML 模板">' + escapeHtml(text) + '</textarea></div><div class="editor-validation valid"><span>' + text.split('\n').length + ' 行；发布前由服务端检查语法、重复键与受管字段冲突</span></div></section>';
    return { left: left, center: center };
  }

  /**
   * 渲染右侧发布检查面板。
   * @returns {string} 检查面板 HTML。
   */
  function renderInspector() {
    const errors = state.routingIssues.errors || [];
    const warnings = state.routingIssues.warnings || [];
    const issues = errors.concat(warnings).slice(0, 6).map(function (issue) {
      return '<div class="issue-row ' + (errors.indexOf(issue) >= 0 ? 'error' : 'warning') + '"><div><strong>' + escapeHtml(issue.message) + '</strong><span>' + escapeHtml(issue.path) + '</span></div></div>';
    }).join('');
    return '<aside class="inspector-panel"><div class="panel-header"><div><h2>配置检查</h2></div><button class="icon-button" data-action="validate-routing">校验</button></div><div class="validation-result ' + (errors.length ? 'has-error' : 'is-ready') + '"><strong>' + (errors.length ? errors.length + ' 个错误' : '可以校验或发布') + '</strong>' + (warnings.length ? '<span>' + warnings.length + ' 个提醒</span>' : '') + '</div><div class="issue-list">' + (issues || '<div class="empty-validation">尚无阻断问题</div>') + '</div><div class="inspector-preview-action"><button class="button preview-button" data-action="preview-routing">预览完整 YAML</button></div></aside>';
  }

  /**
   * 渲染路由配置四个页签及页面级草稿/发布操作。
   * @returns {string} 路由配置页面 HTML。
   */
  function renderRoutingPage() {
    if (!state.routing) return '<div class="loading-screen">正在加载路由配置…</div>';
    const dirty = JSON.stringify(state.routing.config) !== state.routingBaseline;
    const status = dirty ? '有未保存更改' : state.routing.revision > 0 ? '修订 ' + state.routing.revision + ' 已发布' : (state.routing.migrated ? '迁移草稿待检查' : '草稿已保存');
    const actions = '<button class="button ghost" data-action="import-routing">导入 YAML</button><button class="button secondary" data-action="validate-routing" data-busy-key="routingValidate">校验</button><button class="button secondary" data-action="save-routing" data-busy-key="routingSave"' + (!dirty && !state.routing.migrated ? ' disabled' : '') + '>保存草稿</button><button class="button primary" data-action="publish-routing" data-busy-key="routingPublish">发布</button>';
    const counts = { groups: state.routing.config.groups.length, rules: state.routing.config.rules.length, providers: state.routing.config.providers.length };
    const tabs = [
      ['groups', '策略组', counts.groups], ['rules', '路由规则', counts.rules], ['providers', '规则提供者', counts.providers], ['base', 'YAML 模板', null]
    ].map(function (tab) { return '<button class="studio-tab ' + (state.routingTab === tab[0] ? 'active' : '') + '" data-action="routing-tab" data-tab="' + tab[0] + '"><span>' + tab[1] + '</span>' + (tab[2] == null ? '' : '<small class="tab-count">' + tab[2] + '</small>') + '</button>'; }).join('');
    let content;
    if (state.routingTab === 'groups') content = renderGroupsWorkspace();
    else if (state.routingTab === 'rules') content = renderRulesWorkspace();
    else if (state.routingTab === 'providers') content = renderProvidersWorkspace();
    else content = renderBaseYamlWorkspace();
    return pageHeader('路由配置', status, dirty ? 'dirty' : 'saved', actions)
      + '<div class="studio-tabs" role="tablist">' + tabs + '</div><div class="studio-content"><div class="studio-grid ' + (state.routingTab === 'base' ? 'base-studio-grid' : '') + '">' + content.left + content.center + (state.routingTab === 'base' ? '' : renderInspector()) + '</div></div>';
  }

  /**
   * 根据当前 Hash 渲染页面并同步侧栏选中状态。
   */
  function render() {
    document.querySelectorAll('[data-nav]').forEach(function (item) { item.classList.toggle('active', item.getAttribute('data-nav') === state.activeNav); });
    if (state.activeNav === 'subscriptions') workspace.innerHTML = renderSubscriptionsPage();
    else if (state.activeNav === 'nodes') workspace.innerHTML = renderNodesPage();
    else if (state.activeNav === 'routing') workspace.innerHTML = renderRoutingPage();
    else workspace.innerHTML = renderOutputsPage();
    bindEditorScroll();
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

  /** 关闭当前模态框或 YAML 预览抽屉。 */
  function closeOverlay() {
    overlayRoot.innerHTML = '';
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
      render();
      if (!quiet) showToast(result.valid ? '配置校验通过' : '配置校验未通过', result.valid ? 'success' : 'error', result.valid ? (result.warnings.length + ' 个提醒') : (result.errors.length + ' 个错误'));
      return Boolean(result.valid);
    } catch (error) {
      state.routingIssues = { errors: error.errors || [{ path: '', message: error.message }], warnings: [] };
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
      state.routing = Object.assign({}, state.routing, data, { config: clone(state.routing.config), migrated: false });
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
      state.routingBaseline = JSON.stringify(state.routing.config);
      state.routingIssues = data.validation || { errors: [], warnings: [] };
      render();
      showToast('修订 ' + data.revision + ' 已发布', 'success', '两类订阅缓存已清理');
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
    overlayRoot.innerHTML = '<div class="drawer-backdrop"><aside class="yaml-drawer" role="dialog" aria-modal="true" aria-labelledby="preview-title"><div class="drawer-header"><div><h2 id="preview-title">完整输出</h2><p>使用当前草稿和真实节点，预览不会写 KV 或缓存</p></div><button class="icon-button" data-action="close-preview">关闭</button></div><div class="preview-controls"><label>客户端<select id="preview-client"><option value="normal">通用</option><option value="stash">Stash</option></select></label><label>订阅类型<select id="preview-output"><option value="monthly">包年/包月</option><option value="trafficPackage">流量包</option></select></label><button class="button secondary" id="refresh-preview">生成预览</button><button class="button primary" id="copy-preview" disabled>复制 YAML</button></div><pre class="yaml-preview" id="yaml-preview">正在生成真实预览…</pre></aside></div>';
    overlayRoot.querySelector('[data-action="close-preview"]').addEventListener('click', closeOverlay);
    overlayRoot.querySelector('.drawer-backdrop').addEventListener('click', closeOverlay);
    overlayRoot.querySelector('.yaml-drawer').addEventListener('click', function (event) { event.stopPropagation(); });
    document.getElementById('refresh-preview').addEventListener('click', refreshPreview);
    document.getElementById('preview-client').addEventListener('change', refreshPreview);
    document.getElementById('preview-output').addEventListener('change', refreshPreview);
    document.getElementById('copy-preview').addEventListener('click', function () { copyText(document.getElementById('yaml-preview').textContent, '完整 YAML'); });
    refreshPreview();
  }

  /**
   * 生成当前抽屉选项对应的 YAML，并把真实节点匹配数量同步回策略组列表。
   */
  async function refreshPreview() {
    const client = document.getElementById('preview-client').value;
    const output = document.getElementById('preview-output').value;
    const preview = document.getElementById('yaml-preview');
    const copyButton = document.getElementById('copy-preview');
    preview.textContent = '正在解析订阅节点并生成预览…';
    copyButton.disabled = true;
    try {
      const data = await api('/api/routing-config/preview', { method: 'POST', body: JSON.stringify({ config: state.routing.config, client: client, output: output }) });
      preview.textContent = data.yaml;
      copyButton.disabled = false;
      state.routingPreviews = {};
      (data.previews || []).forEach(function (item) { state.routingPreviews[item.groupId] = item; });
    } catch (error) { preview.textContent = '# 预览生成失败\n' + error.message; }
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
      list.innerHTML = analysis.nodes.map(function (node, index) {
        return '<div class="parsed-node-row"><span class="node-protocol">' + escapeHtml(String(node.type || '?').toUpperCase()) + '</span><div><strong>' + escapeHtml(node.name || ('未命名节点 ' + (index + 1))) + '</strong><span>' + escapeHtml(node.server || '—') + (node.port ? ':' + escapeHtml(node.port) : '') + '</span></div></div>';
      }).join('') || '<div class="empty-list">暂无可显示节点</div>';
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
    const outline = document.querySelector('.outline-list');
    if (outline) {
      const items = analyzeYamlOutline(state.routing.config.baseYaml);
      outline.innerHTML = items.map(function (item) { return '<button class="outline-row ' + (MANAGED_YAML_KEYS.indexOf(item.key) >= 0 ? 'conflict' : '') + '" data-action="locate-yaml" data-line="' + item.line + '"><span>' + escapeHtml(item.key) + '</span><small>第 ' + item.line + ' 行</small></button>'; }).join('') || '<div class="empty-search">空 Mapping</div>';
    }
    const rail = document.getElementById('yaml-line-rail');
    if (rail) rail.innerHTML = state.routing.config.baseYaml.split('\n').map(function (_, index) { return '<span>' + (index + 1) + '</span>'; }).join('');
  }

  /**
   * 在不重建当前表单的情况下刷新标题栏未保存状态和保存按钮。
   */
  function updateDirtyIndicator() {
    const status = document.querySelector('.workspace-status');
    if (!status) return;
    let dirty = false;
    if (state.activeNav === 'subscriptions') dirty = JSON.stringify(state.subscriptions) !== state.subscriptionsBaseline;
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
        : state.activeNav === 'routing' ? (state.routing.revision > 0 ? '修订 ' + state.routing.revision + ' 已发布' : '草稿已保存') : '';
      status.innerHTML = '<span class="workspace-status-dot"></span>' + escapeHtml(cleanText);
    }
    const saveSelector = state.activeNav === 'subscriptions' ? '[data-action="save-subscriptions"]' : state.activeNav === 'routing' ? '[data-action="save-routing"]' : '';
    const save = saveSelector ? document.querySelector(saveSelector) : null;
    if (save && dirty) save.disabled = false;
  }

  /**
   * 处理工作区内所有文本输入，直接写回状态模型。
   * @param {InputEvent} event 输入事件。
   */
  function handleWorkspaceInput(event) {
    const target = event.target;
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
    if (target.id === 'group-search') { state.groupQuery = target.value; return; }
    if (target.id === 'rule-search') { state.ruleQuery = target.value; return; }
    if (target.id === 'provider-search') { state.providerQuery = target.value; return; }
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
    if (['group-search', 'rule-search', 'provider-search'].includes(target.id)) render();
    if (groupField === 'type') {
      const group = state.routing.config.groups.find(function (item) { return item.id === state.selectedGroupId; });
      if (group.type === 'select') delete group.healthCheck;
      else group.healthCheck = group.healthCheck || { url: 'https://www.gstatic.com/generate_204', interval: 600, tolerance: 80, strategy: 'consistent-hashing' };
      render();
    }
    const ruleField = target.getAttribute('data-rule-field');
    if (ruleField === 'type') {
      const rule = state.routing.config.rules[Number(target.getAttribute('data-rule-index'))];
      if (rule.type === 'MATCH') { rule.value = ''; delete rule.providerId; rule.noResolve = false; }
      else if (rule.type === 'RULE-SET') { rule.providerId = state.routing.config.providers[0] ? state.routing.config.providers[0].id : ''; rule.value = ''; }
      else { delete rule.providerId; rule.value = rule.value || ''; }
      render();
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

    if (action === 'add-subscription') {
      state.subscriptions.push({ subName: '', subType: '包年/包月', subUrl: '' });
      render();
    } else if (action === 'delete-subscription') {
      const index = Number(button.getAttribute('data-index'));
      openModal('删除订阅源', '<p class="confirm-copy">确定删除“' + escapeHtml(state.subscriptions[index].subName || '未命名订阅源') + '”吗？</p>', '删除', function () { state.subscriptions.splice(index, 1); render(); return true; });
    } else if (action === 'save-subscriptions') {
      if (!validateSubscriptions()) { render(); showToast('请修正订阅源字段', 'error'); return; }
      setBusy('subscriptions', true);
      try {
        const data = await api('/api/subscriptions', { method: 'PUT', body: JSON.stringify({ subscriptions: state.subscriptions }) });
        state.subscriptions = data.subscriptions;
        state.subscriptionsBaseline = JSON.stringify(data.subscriptions);
        state.subscriptionErrors = {};
        state.outputs = (await api('/api/outputs')).outputs;
        render();
        showToast('订阅源已保存', 'success', '两类正式缓存已清理');
      } catch (error) {
        (error.errors || []).forEach(function (issue) {
          const match = /subscriptions\[(\d+)\]\.(\w+)/.exec(issue.path);
          if (match) {
            state.subscriptionErrors[match[1]] = state.subscriptionErrors[match[1]] || {};
            state.subscriptionErrors[match[1]][match[2]] = issue.message;
          }
        });
        render();
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
        showToast('自建节点已保存', 'success', '未知协议字段已完整保留');
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
      render();
    } else if (action === 'move-group-up' || action === 'move-group-down') {
      moveItem(state.routing.config.groups, Number(button.getAttribute('data-index')), action === 'move-group-up' ? -1 : 1);
      render();
    } else if (action === 'add-group') {
      const id = createId('group');
      state.routing.config.groups.push({ id: id, name: '新策略组', type: 'select', enabled: true, visibility: 'always', sources: [{ id: createId('source'), kind: 'builtin', value: 'DIRECT', appliesTo: 'all', when: 'always' }] });
      state.selectedGroupId = id;
      render();
    } else if (action === 'duplicate-group') {
      const source = state.routing.config.groups.find(function (group) { return group.id === state.selectedGroupId; });
      const copy = clone(source);
      copy.id = createId('group');
      copy.name = source.name + ' 副本';
      copy.sources.forEach(function (item) { item.id = createId('source'); });
      state.routing.config.groups.splice(state.routing.config.groups.indexOf(source) + 1, 0, copy);
      state.selectedGroupId = copy.id;
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
    } else if (action === 'select-rule-category') {
      state.ruleCategory = button.getAttribute('data-category');
      render();
    } else if (action === 'add-rule') {
      const matchIndex = state.routing.config.rules.findIndex(function (rule) { return rule.enabled && rule.type === 'MATCH'; });
      const target = state.routing.config.groups.find(function (group) { return group.enabled; });
      const rule = { id: createId('rule'), enabled: true, category: state.ruleCategory === 'all' ? 'general' : state.ruleCategory, remark: '', type: 'DOMAIN-SUFFIX', value: 'example.com', targetGroupId: target ? target.id : 'builtin:DIRECT', noResolve: false };
      state.routing.config.rules.splice(matchIndex < 0 ? state.routing.config.rules.length : matchIndex, 0, rule);
      render();
    } else if (action === 'delete-rule') {
      state.routing.config.rules.splice(Number(button.getAttribute('data-index')), 1);
      render();
    } else if (action === 'move-rule-up' || action === 'move-rule-down') {
      moveItem(state.routing.config.rules, Number(button.getAttribute('data-index')), action === 'move-rule-up' ? -1 : 1);
      render();
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
      openModal('从完整 Clash YAML 导入', '<p class="modal-help">将拆分策略组、路由规则、规则提供者和基础 YAML；运行时 proxies 不会写入草稿。导入后仍需校验并主动发布。</p><label class="field"><span>完整 Clash YAML</span><textarea id="import-yaml" class="import-textarea" spellcheck="false" placeholder="粘贴完整 Clash YAML"></textarea></label><div class="import-error-list" id="import-errors" role="alert"></div>', '解析并导入草稿', async function () {
        const text = document.getElementById('import-yaml').value;
        try {
          const data = await api('/api/routing-config/import', { method: 'POST', body: JSON.stringify({ yaml: text }) });
          state.routing.config = data.config;
          state.selectedGroupId = data.config.groups[0] ? data.config.groups[0].id : '';
          state.selectedProviderId = data.config.providers[0] ? data.config.providers[0].id : '';
          state.routingTab = 'groups';
          state.routingIssues = { errors: [], warnings: [] };
          state.routingPreviews = {};
          let validationTone = 'success';
          let validationMessage = '请再次检查并发布';
          try {
            state.routingIssues = await api('/api/routing-config/validate', { method: 'POST', body: JSON.stringify({ config: data.config }) });
          } catch (validationError) {
            state.routingIssues = { errors: validationError.errors || [{ path: '', message: validationError.message }], warnings: [] };
            validationTone = 'warning';
            validationMessage = state.routingIssues.errors.length + ' 个校验问题待处理';
          }
          render();
          showToast('完整 YAML 已拆分为当前草稿', validationTone, data.summary.groups + ' 个策略组 · ' + data.summary.rules + ' 条规则 · ' + data.summary.providers + ' 个提供者 · ' + data.summary.baseFields + ' 个基础字段；' + validationMessage);
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
    sidebar.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
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

  workspace.addEventListener('input', function (event) { handleWorkspaceInput(event); updateDirtyIndicator(); });
  workspace.addEventListener('change', handleWorkspaceChange);
  workspace.addEventListener('click', handleWorkspaceClick);
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

  /** Escape 关闭当前弹窗或抽屉。 */
  window.addEventListener('keydown', function (event) { if (event.key === 'Escape' && overlayRoot.innerHTML) closeOverlay(); });

  const initialHash = window.location.hash.replace('#', '');
  state.activeNav = VALID_NAVS.includes(initialHash) ? initialHash : 'subscriptions';
  if (!initialHash) history.replaceState(null, '', '#subscriptions');
  loadApplication();
})();
`
