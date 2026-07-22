const { useMemo } = React;

/**
 * 应用左侧主导航，仅包含当前项目已有或本次路由改造明确需要的业务入口。
 * @param {object} props 组件属性。
 * @param {string} props.activeNav 当前激活的导航 ID。
 * @param {Function} props.onNavigate 导航点击回调。
 * @returns {React.ReactElement} 精简后的主导航侧栏。
 */
function Sidebar({ activeNav, onNavigate }) {
  const navItems = [
    { id: "subscriptions", label: "订阅源", icon: "subscription" },
    { id: "nodes", label: "自建节点", icon: "server" },
    { id: "routing", label: "路由配置", icon: "route" },
    { id: "links", label: "订阅输出", icon: "link" }
  ];

  return (
    <aside className="sidebar console-sidebar" aria-label="主导航">
      <div className="brand-lockup compact-brand">
        <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div><div className="brand-name">SubMerger</div><div className="brand-subtitle">订阅配置</div></div>
      </div>

      <nav className="primary-nav console-primary-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={18}></Icon>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

/**
 * 各业务页面共用的标题与操作栏。
 * @param {object} props 组件属性。
 * @param {string} props.title 页面标题。
 * @param {string} [props.status] 与当前数据直接相关的保存或校验状态。
 * @param {"saved"|"dirty"|"error"} [props.statusTone] 状态色。
 * @param {React.ReactNode} [props.actions] 页面级操作按钮。
 * @returns {React.ReactElement} 页面顶部区域。
 */
function WorkspaceHeader({ title, status, statusTone = "saved", actions }) {
  return (
    <header className="page-header workspace-header">
      <div className="title-stack compact-title-stack">
        <div className="title-line">
          <h1>{title}</h1>
          {status ? (
            <span className={`workspace-status ${statusTone}`}>
              <span className="workspace-status-dot"></span>{status}
            </span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="header-actions workspace-actions">{actions}</div> : null}
    </header>
  );
}

/**
 * 路由配置页的标题与发布操作区。
 * @param {object} props 组件属性。
 * @param {boolean} props.dirty 是否存在未保存更改。
 * @param {Function} props.onImport 打开 YAML 导入流程。
 * @param {Function} props.onValidate 触发配置校验。
 * @param {Function} props.onSave 保存草稿。
 * @param {Function} props.onPublish 发布配置。
 * @returns {React.ReactElement} 路由配置页头部。
 */
function PageHeader({ dirty, onImport, onValidate, onSave, onPublish }) {
  return (
    <WorkspaceHeader
      title="路由配置"
      status={dirty ? "有未保存更改" : "草稿已保存"}
      statusTone={dirty ? "dirty" : "saved"}
      actions={
        <React.Fragment>
          <button type="button" className="button ghost" onClick={onImport}><Icon name="import" size={16}></Icon>导入 YAML</button>
          <button type="button" className="button secondary" onClick={onValidate}><Icon name="flask" size={16}></Icon>校验</button>
          <button type="button" className="button secondary" onClick={onSave} disabled={!dirty}><Icon name="save" size={16}></Icon>保存草稿</button>
          <button type="button" className="button primary" onClick={onPublish}><Icon name="upload" size={16}></Icon>发布</button>
        </React.Fragment>
      }
    ></WorkspaceHeader>
  );
}

/**
 * 路由配置的二级标签页。
 * @param {object} props 组件属性。
 * @param {string} props.activeTab 当前标签页。
 * @param {Function} props.onChange 标签页切换回调。
 * @param {object} props.counts 各标签页的真实条目数量。
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
    <div className="studio-tabs compact-studio-tabs" role="tablist" aria-label="路由配置区域">
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
    </div>
  );
}

/**
 * 通用面板标题。
 * @param {object} props 组件属性。
 * @param {string} props.title 标题。
 * @param {string} [props.subtitle] 与当前编辑内容直接相关的辅助文字。
 * @param {React.ReactNode} [props.actions] 右侧操作区域。
 * @returns {React.ReactElement} 面板标题栏。
 */
function PanelHeader({ title, subtitle, actions }) {
  return (
    <div className="panel-header">
      <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
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
 * 路由配置右侧的实时校验与引用关系面板。
 * 只呈现可用于判断是否能够发布的数据，不展示架构宣传或流程说明。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.issues 当前校验结果。
 * @param {object|null} props.selectedGroup 当前策略组。
 * @param {Array<object>} props.rules 所有路由规则。
 * @param {Array<object>} props.groups 所有策略组。
 * @param {Function} props.onPreview 打开 YAML 预览。
 * @param {Function} props.onValidate 再次执行校验。
 * @returns {React.ReactElement} 检查面板。
 */
function Inspector({ issues, selectedGroup, rules, groups, onPreview, onValidate }) {
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

  return (
    <aside className="inspector-panel compact-inspector">
      <PanelHeader
        title="配置检查"
        actions={<button type="button" className="icon-button" onClick={onValidate} aria-label="重新校验"><Icon name="refresh" size={16}></Icon></button>}
      ></PanelHeader>

      <div className={`validation-result ${blocking ? "has-error" : "is-ready"}`}>
        <Icon name={blocking ? "warning" : "check"} size={17}></Icon>
        <strong>{blocking ? `${summary.error} 个错误` : "可以发布"}</strong>
        {summary.warning ? <span>{summary.warning} 个提醒</span> : null}
      </div>

      <div className="issue-list compact-issue-list">
        {issues.filter((issue) => issue.level !== "success").slice(0, 5).map((issue, index) => (
          <div className={`issue-row ${issue.level}`} key={`${issue.title}-${index}`}>
            <div className="issue-icon"><Icon name={issue.level === "error" ? "error" : "warning"} size={14}></Icon></div>
            <div><strong>{issue.title}</strong><span>{issue.detail}</span></div>
          </div>
        ))}
        {!blocking && summary.warning === 0 ? <div className="empty-validation"><Icon name="check" size={15}></Icon>未发现依赖或顺序问题</div> : null}
      </div>

      {selectedGroup ? (
        <section className="inspector-section dependency-section">
          <div className="section-title-row"><strong>引用关系</strong><span>{selectedGroup.name}</span></div>
          <div className="dependency-map">
            <div className="dependency-node source"><span>{inboundRules.length}</span><small>条规则</small></div>
            <div className="dependency-line"></div>
            <div className={`dependency-node current color-${selectedGroup.color}`}><strong>{selectedGroup.name}</strong><small>{selectedGroup.type}</small></div>
            <div className="dependency-line"></div>
            <div className="dependency-node target"><span>{outboundGroups.length || selectedGroup.sources.length}</span><small>个来源</small></div>
          </div>
        </section>
      ) : null}

      <div className="inspector-preview-action">
        <button type="button" className="button preview-button" onClick={onPreview}><Icon name="eye" size={16}></Icon>预览完整 YAML</button>
      </div>
    </aside>
  );
}

Object.assign(window, {
  Sidebar,
  WorkspaceHeader,
  PageHeader,
  StudioTabs,
  PanelHeader,
  Inspector
});
