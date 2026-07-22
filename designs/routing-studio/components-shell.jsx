const { useMemo } = React;

/**
 * 应用左侧主导航。
 * @param {object} props 组件属性。
 * @param {string} props.activeNav 当前激活的导航 ID。
 * @param {Function} props.onNavigate 导航点击回调。
 * @returns {React.ReactElement} 主导航侧栏。
 */
function Sidebar({ activeNav, onNavigate }) {
  const navItems = [
    { id: "overview", label: "总览", icon: "grid" },
    { id: "subscriptions", label: "订阅源", icon: "subscription" },
    { id: "nodes", label: "节点管理", icon: "server" },
    { id: "routing", label: "路由工作室", icon: "route", badge: "新" },
    { id: "links", label: "订阅输出", icon: "link" }
  ];

  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <div className="brand-name">SubMerger</div>
          <div className="brand-subtitle">配置控制台</div>
        </div>
      </div>

      <nav className="primary-nav">
        <div className="nav-label">工作区</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={18}></Icon>
            <span>{item.label}</span>
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer"></div>

      <div className="environment-card">
        <div className="environment-row">
          <span className="environment-dot"></span>
          <span>生产环境</span>
          <span className="environment-region">HKG</span>
        </div>
        <div className="environment-meta">Worker 运行正常</div>
      </div>

      <button type="button" className="nav-item sidebar-settings" onClick={() => onNavigate("settings")}>
        <Icon name="settings" size={18}></Icon>
        <span>系统设置</span>
      </button>

      <div className="account-row">
        <div className="avatar">F</div>
        <div className="account-copy">
          <strong>管理员</strong>
          <span>已安全登录</span>
        </div>
        <Icon name="more" size={18}></Icon>
      </div>
    </aside>
  );
}

/**
 * 路由工作室顶部标题与主要操作区。
 * @param {object} props 组件属性。
 * @param {boolean} props.dirty 是否存在未保存更改。
 * @param {string} props.lastSaved 最近保存时间。
 * @param {Function} props.onImport 打开 YAML 导入流程。
 * @param {Function} props.onValidate 触发配置校验。
 * @param {Function} props.onSave 保存草稿。
 * @param {Function} props.onPublish 发布配置。
 * @returns {React.ReactElement} 页面顶部区域。
 */
function PageHeader({ dirty, lastSaved, onImport, onValidate, onSave, onPublish }) {
  return (
    <header className="page-header">
      <div className="title-stack">
        <div className="breadcrumb"><span>配置中心</span><Icon name="chevronRight" size={13}></Icon><strong>路由工作室</strong></div>
        <div className="title-line">
          <h1>路由工作室</h1>
          {dirty ? <span className="unsaved-pill"><span></span>有未保存更改</span> : <span className="saved-pill"><Icon name="check" size={13}></Icon>草稿已保存</span>}
        </div>
        <p>用可视化管理路由关系，同时保留其它 YAML 的完整表达能力。</p>
      </div>

      <div className="header-actions">
        <div className="saved-time">最近保存：{lastSaved}</div>
        <button type="button" className="button ghost" onClick={onImport}>
          <Icon name="import" size={16}></Icon>导入 YAML
        </button>
        <button type="button" className="button secondary" onClick={onValidate}>
          <Icon name="flask" size={16}></Icon>校验配置
        </button>
        <button type="button" className="button secondary compact-save" onClick={onSave} disabled={!dirty}>
          <Icon name="save" size={16}></Icon>保存草稿
        </button>
        <button type="button" className="button primary" onClick={onPublish}>
          <Icon name="upload" size={16}></Icon>发布配置
        </button>
      </div>
    </header>
  );
}

/**
 * 路由工作室的二级标签页。
 * @param {object} props 组件属性。
 * @param {string} props.activeTab 当前标签页。
 * @param {Function} props.onChange 标签页切换回调。
 * @param {object} props.counts 各标签页数量。
 * @returns {React.ReactElement} 二级导航。
 */
function StudioTabs({ activeTab, onChange, counts }) {
  const tabs = [
    { id: "groups", label: "策略组", icon: "nodes", count: counts.groups },
    { id: "rules", label: "路由规则", icon: "route", count: counts.rules },
    { id: "providers", label: "规则提供者", icon: "layers", count: counts.providers },
    { id: "base", label: "YAML 模板", icon: "code" }
  ];

  return (
    <div className="studio-tabs" role="tablist" aria-label="路由配置区域">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`studio-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <Icon name={tab.icon} size={16}></Icon>
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
      <div className="studio-tab-spacer"></div>
      <div className="schema-version"><Icon name="shield" size={15}></Icon>配置架构 v2</div>
    </div>
  );
}

/**
 * 通用面板标题。
 * @param {object} props 组件属性。
 * @param {string} props.title 标题。
 * @param {string} [props.subtitle] 辅助说明。
 * @param {React.ReactNode} [props.actions] 右侧操作区域。
 * @returns {React.ReactElement} 面板标题栏。
 */
function PanelHeader({ title, subtitle, actions }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="panel-header-actions">{actions}</div> : null}
    </div>
  );
}

/**
 * 将校验结果汇总为错误、警告和通过数量。
 * @param {Array<object>} issues 校验结果。
 * @returns {object} 汇总统计。
 */
function summarizeIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary[issue.level] = (summary[issue.level] || 0) + 1;
    return summary;
  }, { error: 0, warning: 0, success: 0 });
}

/**
 * 右侧实时校验和依赖信息面板。
 * @param {object} props 组件属性。
 * @param {Array<object>} issues 当前校验结果。
 * @param {object|null} props.selectedGroup 当前策略组。
 * @param {Array<object>} props.rules 所有路由规则。
 * @param {Array<object>} props.groups 所有策略组。
 * @param {string} props.contextMode 当前工作区类型。
 * @param {object|null} props.yamlAnalysis YAML 模板分析结果。
 * @param {Function} props.onPreview 打开 YAML 预览。
 * @param {Function} props.onValidate 再次执行校验。
 * @returns {React.ReactElement} 检查面板。
 */
function Inspector({ issues, selectedGroup, rules, groups, contextMode, yamlAnalysis, onPreview, onValidate }) {
  const summary = summarizeIssues(issues);
  const inboundRules = useMemo(() => {
    if (!selectedGroup) return [];
    return rules.filter((rule) => rule.enabled && rule.targetGroupId === selectedGroup.id);
  }, [rules, selectedGroup]);
  const outboundGroups = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.sources
      .filter((source) => source.kind === "group")
      .map((source) => groups.find((group) => group.id === source.groupId))
      .filter(Boolean);
  }, [groups, selectedGroup]);
  const blocking = summary.error > 0;
  const isYamlContext = contextMode === "base";
  const visibleIssues = isYamlContext
    ? issues.filter((issue) => issue.level === "success" || issue.title.startsWith("YAML"))
    : issues;

  return (
    <aside className="inspector-panel">
      <PanelHeader
        title={isYamlContext ? "YAML 合并检查" : "配置检查"}
        subtitle={isYamlContext ? "检查语法边界与顶级字段" : "随编辑实时更新"}
        actions={<button type="button" className="icon-button" onClick={onValidate} aria-label="重新校验"><Icon name="refresh" size={16}></Icon></button>}
      ></PanelHeader>

      <div className={`quality-card ${blocking ? "has-error" : "is-ready"}`}>
        <div className="quality-icon"><Icon name={blocking ? "warning" : "check"} size={20}></Icon></div>
        <div>
          <strong>{blocking ? "存在发布阻断" : isYamlContext ? "模板可以安全合并" : "可以安全发布"}</strong>
          <span>{blocking ? `${summary.error} 个错误需要处理` : isYamlContext ? "未覆盖可视化生成器保留字段" : "依赖与顺序检查已通过"}</span>
        </div>
      </div>

      <div className="summary-grid">
        {isYamlContext ? (
          <React.Fragment>
            <div><strong>{yamlAnalysis?.managedConflicts.length || 0}</strong><span>字段冲突</span></div>
            <div><strong>{yamlAnalysis?.keys.length || 0}</strong><span>顶级字段</span></div>
            <div><strong>{yamlAnalysis?.lineCount || 0}</strong><span>模板行数</span></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div><strong>{summary.error}</strong><span>错误</span></div>
            <div><strong>{summary.warning}</strong><span>提醒</span></div>
            <div><strong>{groups.filter((group) => group.enabled).length}</strong><span>启用分组</span></div>
          </React.Fragment>
        )}
      </div>

      <section className="inspector-section">
        <div className="section-kicker">即时检查</div>
        <div className="issue-list">
          {visibleIssues.slice(0, 4).map((issue, index) => (
            <div className={`issue-row ${issue.level}`} key={`${issue.title}-${index}`}>
              <div className="issue-icon"><Icon name={issue.level === "success" ? "check" : issue.level === "error" ? "error" : "warning"} size={14}></Icon></div>
              <div><strong>{issue.title}</strong><span>{issue.detail}</span></div>
            </div>
          ))}
        </div>
      </section>

      {selectedGroup ? (
        <section className="inspector-section dependency-section">
          <div className="section-title-row">
            <div className="section-kicker">当前依赖</div>
            <span>{selectedGroup.name}</span>
          </div>
          <div className="dependency-map">
            <div className="dependency-node source"><span>{inboundRules.length}</span><small>条规则指向</small></div>
            <div className="dependency-line"></div>
            <div className={`dependency-node current color-${selectedGroup.color}`}><strong>{selectedGroup.name}</strong><small>{selectedGroup.type}</small></div>
            <div className="dependency-line"></div>
            <div className="dependency-node target"><span>{outboundGroups.length || selectedGroup.sources.length}</span><small>个成员来源</small></div>
          </div>
          <div className="dependency-tags">
            {inboundRules.slice(0, 3).map((rule) => <span key={rule.id}>{rule.value || rule.type}</span>)}
            {inboundRules.length > 3 ? <span>+{inboundRules.length - 3}</span> : null}
          </div>
        </section>
      ) : null}

      <section className="inspector-section preview-section">
        <div className="section-kicker">输出预览</div>
        <div className="mini-code" aria-label="YAML 输出预览">
          {isYamlContext ? (
            <React.Fragment>
              <span><b>dns:</b></span>
              <span>  enable: true</span>
              <span>  enhanced-mode: fake-ip</span>
              <span># + 自动生成路由字段</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <span><b>proxy-groups:</b></span>
              <span>  - name: {selectedGroup?.name || "其它流量"}</span>
              <span>    type: {selectedGroup?.type || "select"}</span>
              <span>    proxies: [...]</span>
            </React.Fragment>
          )}
        </div>
        <button type="button" className="button preview-button" onClick={onPreview}>
          <Icon name="eye" size={16}></Icon>查看完整 YAML
        </button>
      </section>
    </aside>
  );
}

/**
 * 页面底部的轻量状态栏。
 * @param {object} props 组件属性。
 * @param {boolean} props.dirty 是否有未保存修改。
 * @param {number} props.revision 已发布修订号。
 * @param {number} props.nodeCount 当前节点样本数量。
 * @returns {React.ReactElement} 状态栏。
 */
function StatusBar({ dirty, revision, nodeCount }) {
  return (
    <footer className="status-bar">
      <div><span className={`status-dot ${dirty ? "dirty" : "ready"}`}></span>{dirty ? "草稿有未保存修改" : "草稿与已保存版本一致"}</div>
      <div className="status-spacer"></div>
      <span>节点样本 {nodeCount}</span>
      <span>发布版本 r{revision}</span>
      <span>缓存键已绑定版本号</span>
    </footer>
  );
}

Object.assign(window, {
  Sidebar,
  PageHeader,
  StudioTabs,
  PanelHeader,
  Inspector,
  StatusBar
});
