const { useMemo: useRulesMemo, useState: useRulesState } = React;

/**
 * 规则分类和快速筛选面板。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.categories 规则分类。
 * @param {string} props.activeCategory 当前分类 ID。
 * @param {Function} props.onChange 分类切换回调。
 * @param {Function} props.onAddRule 新建规则回调。
 * @returns {React.ReactElement} 规则分类面板。
 */
function RuleCategoryPanel({ categories, activeCategory, onChange, onAddRule }) {
  return (
    <section className="entity-panel rule-category-panel">
      <PanelHeader
        title="规则集合"
        subtitle="按业务场景组织"
        actions={<button type="button" className="icon-button brand" onClick={onAddRule} aria-label="新建规则"><Icon name="plus" size={17}></Icon></button>}
      ></PanelHeader>
      <div className="category-list">
        {categories.map((category) => (
          <button type="button" key={category.id} className={`category-row ${activeCategory === category.id ? "active" : ""}`} onClick={() => onChange(category.id)}>
            <span className="category-glyph"><Icon name={category.id === "all" ? "layers" : category.id === "fallback" ? "shield" : "route"} size={15}></Icon></span>
            <span>{category.name}</span>
            <strong>{category.count}</strong>
          </button>
        ))}
      </div>
      <div className="order-callout">
        <Icon name="grip" size={17}></Icon>
        <div><strong>顺序即优先级</strong><span>拖动规则行可调整匹配顺序。</span></div>
      </div>
      <div className="rule-help-card">
        <div className="rule-help-icon"><Icon name="command" size={17}></Icon></div>
        <strong>快捷创建</strong>
        <span>使用“添加规则”表单，无需记忆 YAML 语法。</span>
        <button type="button" onClick={onAddRule}>添加规则 <Icon name="chevronRight" size={13}></Icon></button>
      </div>
    </section>
  );
}

/**
 * 规则类型的用户友好说明。
 * @param {string} type Clash 规则类型。
 * @returns {string} 中文说明。
 */
function getRuleTypeLabel(type) {
  return {
    "RULE-SET": "规则集",
    "DOMAIN-SUFFIX": "域名后缀",
    DOMAIN: "完整域名",
    "DOMAIN-KEYWORD": "域名关键词",
    "IP-CIDR": "IP 网段",
    "PROCESS-NAME": "进程名称",
    GEOIP: "国家 / 地区",
    MATCH: "最终兜底"
  }[type] || type;
}

/**
 * 可拖动、可直接编辑的路由规则表格。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.rules 全部规则。
 * @param {Array<object>} props.groups 全部策略组。
 * @param {string} props.activeCategory 当前分类。
 * @param {string} props.selectedRuleId 当前规则 ID。
 * @param {Function} props.onSelectRule 选择规则回调。
 * @param {Function} props.onPatchRule 更新规则回调。
 * @param {Function} props.onDeleteRule 删除规则回调。
 * @param {Function} props.onAddRule 新建规则回调。
 * @param {Function} props.onReorder 规则重排回调。
 * @returns {React.ReactElement} 规则编辑面板。
 */
function RulesEditor({ rules, groups, activeCategory, selectedRuleId, onSelectRule, onPatchRule, onDeleteRule, onAddRule, onReorder }) {
  const [query, setQuery] = useRulesState("");
  const [draggedRuleId, setDraggedRuleId] = useRulesState(null);
  const visibleRules = useRulesMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rules.filter((rule) => {
      const categoryMatch = activeCategory === "all" || rule.category === activeCategory;
      const textMatch = !keyword || `${rule.type} ${rule.value} ${rule.note}`.toLowerCase().includes(keyword);
      return categoryMatch && textMatch;
    });
  }, [rules, activeCategory, query]);

  /**
   * 完成拖放后调整规则顺序。
   * @param {string} targetRuleId 放置目标规则 ID。
   * @returns {void}
   */
  function handleDrop(targetRuleId) {
    if (draggedRuleId && draggedRuleId !== targetRuleId) onReorder(draggedRuleId, targetRuleId);
    setDraggedRuleId(null);
  }

  return (
    <section className="editor-panel rules-editor">
      <PanelHeader
        title="路由规则"
        subtitle="从上到下匹配；拖动即可调整优先级"
        actions={<button type="button" className="button primary small" onClick={onAddRule}><Icon name="plus" size={14}></Icon>添加规则</button>}
      ></PanelHeader>

      <div className="rules-toolbar">
        <div className="panel-search wide-search"><Icon name="search" size={15}></Icon><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索域名、规则集或备注"></input></div>
        <button type="button" className="button ghost small"><Icon name="filter" size={14}></Icon>筛选</button>
        <span className="rule-result-count">{visibleRules.length} 条</span>
      </div>

      <div className="rules-table-wrap">
        <div className="rules-table-head">
          <span></span><span>启用</span><span>匹配类型</span><span>匹配内容</span><span>目标策略</span><span>选项</span><span></span>
        </div>
        <div className="rules-table-body">
          {visibleRules.map((rule, index) => {
            const targetGroup = groups.find((group) => group.id === rule.targetGroupId);
            const isMatch = rule.type === "MATCH";
            return (
              <div
                key={rule.id}
                className={`rule-row ${selectedRuleId === rule.id ? "selected" : ""} ${!rule.enabled ? "disabled" : ""} ${draggedRuleId === rule.id ? "dragging" : ""}`}
                draggable="true"
                onDragStart={() => setDraggedRuleId(rule.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(rule.id)}
                onClick={() => onSelectRule(rule.id)}
              >
                <button type="button" className="drag-button" aria-label={`拖动第 ${index + 1} 条规则`}><Icon name="grip" size={15}></Icon></button>
                <label className="mini-switch" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={rule.enabled} onChange={(event) => onPatchRule(rule.id, { enabled: event.target.checked })}></input>
                  <span></span>
                </label>
                <div className="rule-type-cell"><span>{getRuleTypeLabel(rule.type)}</span><small>{rule.type}</small></div>
                <div className="rule-value-cell">
                  <strong>{isMatch ? "所有剩余流量" : rule.value}</strong>
                  <small>{rule.note}</small>
                </div>
                <button type="button" className="target-select" onClick={(event) => event.stopPropagation()}>
                  <span className={`tiny-color color-${targetGroup?.color || "slate"}`}></span>
                  <select value={rule.targetGroupId} onChange={(event) => onPatchRule(rule.id, { targetGroupId: event.target.value })} aria-label="目标策略组">
                    {groups.filter((group) => group.enabled).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </button>
                <div className="rule-option-cell">{rule.noResolve ? <span>no-resolve</span> : <span className="muted-option">—</span>}</div>
                <button type="button" className="icon-button subtle danger-hover" onClick={(event) => { event.stopPropagation(); onDeleteRule(rule.id); }} aria-label="删除规则"><Icon name="trash" size={14}></Icon></button>
              </div>
            );
          })}
          {!visibleRules.length ? <div className="table-empty"><Icon name="search" size={24}></Icon><strong>没有符合条件的规则</strong><span>清除搜索或切换规则集合。</span></div> : null}
        </div>
      </div>

      <div className="rules-footer-note"><Icon name="shield" size={14}></Icon><span>发布前会检查 MATCH 位置、规则提供者引用和目标策略组。</span></div>
    </section>
  );
}

/**
 * 规则提供者列表面板。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.providers 规则提供者列表。
 * @param {string} props.selectedProviderId 当前提供者 ID。
 * @param {Function} props.onSelect 选择回调。
 * @param {Function} props.onAdd 新建回调。
 * @returns {React.ReactElement} 规则提供者列表。
 */
function ProviderListPanel({ providers, selectedProviderId, onSelect, onAdd }) {
  return (
    <section className="entity-panel provider-list-panel">
      <PanelHeader title="规则提供者" subtitle={`${providers.filter((provider) => provider.enabled).length} 个已启用`} actions={<button type="button" className="icon-button brand" onClick={onAdd}><Icon name="plus" size={17}></Icon></button>}></PanelHeader>
      <div className="provider-list">
        {providers.map((provider) => (
          <button type="button" key={provider.id} className={`provider-row ${selectedProviderId === provider.id ? "active" : ""} ${!provider.enabled ? "disabled" : ""}`} onClick={() => onSelect(provider.id)}>
            <span className="provider-icon"><Icon name="external" size={14}></Icon></span>
            <span><strong>{provider.name}</strong><small>{provider.behavior} · {provider.refs} 次引用</small></span>
            <span className={`provider-state ${provider.enabled ? "online" : "offline"}`}></span>
          </button>
        ))}
      </div>
      <button type="button" className="inline-add-button" onClick={onAdd}><Icon name="plus" size={15}></Icon>新建规则提供者</button>
    </section>
  );
}

/**
 * 单个规则提供者编辑器。
 * @param {object} props 组件属性。
 * @param {object|null} props.provider 当前规则提供者。
 * @param {Function} props.onUpdate 更新回调。
 * @param {Function} props.onDelete 删除回调。
 * @returns {React.ReactElement} 规则提供者编辑面板。
 */
function ProviderEditor({ provider, onUpdate, onDelete }) {
  if (!provider) return <section className="editor-panel centered-empty"><Icon name="layers" size={34}></Icon><h2>选择规则提供者</h2></section>;

  return (
    <section className="editor-panel provider-editor">
      <PanelHeader
        title="编辑规则提供者"
        subtitle={`被 ${provider.refs} 条路由规则引用`}
        actions={<React.Fragment><label className="switch-label"><span>{provider.enabled ? "已启用" : "已停用"}</span><input type="checkbox" checked={provider.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })}></input><span className="switch-control"></span></label><button type="button" className="icon-button danger-hover" onClick={onDelete}><Icon name="trash" size={16}></Icon></button></React.Fragment>}
      ></PanelHeader>
      <div className="editor-scroll">
        <section className="form-section first-section">
          <div className="section-heading"><div><h3>来源信息</h3><p>名称用于 RULE-SET 引用，修改时会自动同步相关规则。</p></div></div>
          <div className="form-grid two-columns">
            <label className="field"><span>名称</span><input value={provider.name} onChange={(event) => onUpdate({ name: event.target.value })}></input></label>
            <label className="field"><span>行为模式</span><select value={provider.behavior} onChange={(event) => onUpdate({ behavior: event.target.value })}><option value="classical">classical</option><option value="domain">domain</option><option value="ipcidr">ipcidr</option></select></label>
          </div>
          <label className="field"><span>下载地址</span><div className="url-field"><Icon name="link" size={15}></Icon><input value={provider.url} onChange={(event) => onUpdate({ url: event.target.value })}></input></div></label>
          <div className="form-grid two-columns">
            <label className="field"><span>更新间隔（秒）</span><input type="number" value={provider.interval} onChange={(event) => onUpdate({ interval: Number(event.target.value) })}></input></label>
            <label className="field"><span>生成路径</span><input value={`./RuleSet/${provider.name}.yaml`} readOnly></input></label>
          </div>
        </section>
        <section className="form-section provider-test-section">
          <div className="section-heading"><div><h3>连接测试</h3><p>发布前检查 URL 可访问性与规则文件格式。</p></div><button type="button" className="button secondary small"><Icon name="flask" size={14}></Icon>立即测试</button></div>
          <div className="connection-result"><span className="connection-check"><Icon name="check" size={15}></Icon></span><div><strong>上次测试成功</strong><span>HTTP 200 · 规则格式有效 · 2 分钟前</span></div><strong>128 ms</strong></div>
        </section>
      </div>
    </section>
  );
}

/**
 * 从原始 YAML 自动生成的顶级字段大纲。
 *
 * 大纲只承担导航职责，不会把 DNS 或其它字段转换成独立的数据模型。
 * @param {object} props 组件属性。
 * @param {object} props.analysis YAML 模板分析结果。
 * @param {string} props.activeKey 当前定位的顶级字段。
 * @param {Function} props.onSelect 选择顶级字段回调。
 * @param {Function} props.onReset 恢复默认模板回调。
 * @returns {React.ReactElement} YAML 大纲面板。
 */
function YamlOutlinePanel({ analysis, activeKey, onSelect, onReset }) {
  return (
    <section className="entity-panel yaml-outline-panel">
      <PanelHeader title="YAML 大纲" subtitle={`${analysis.keys.length} 个顶级字段`}></PanelHeader>
      <div className="outline-explainer">
        <Icon name="code" size={16}></Icon>
        <div><strong>这里不是表单目录</strong><span>内容从右侧 YAML 自动提取，点击只会定位到对应行。</span></div>
      </div>
      <div className="yaml-outline-list">
        {analysis.keys.map((item) => (
          <button type="button" key={`${item.key}-${item.line}`} className={activeKey === item.key ? "active" : ""} onClick={() => onSelect(item.key)}>
            <span className="outline-key-icon"><Icon name={item.kind === "section" ? "layers" : "code"} size={14}></Icon></span>
            <span className="outline-key-copy"><strong>{item.key}</strong><small>{item.kind === "section" ? "对象 / 列表" : "标量值"} · 第 {item.line} 行</small></span>
            <Icon name="chevronRight" size={13}></Icon>
          </button>
        ))}
      </div>
      <div className="managed-boundary-card">
        <div className="managed-boundary-title"><Icon name="shield" size={15}></Icon><strong>可视化生成器保留</strong></div>
        <div className="managed-key-list">{MANAGED_YAML_KEYS.map((key) => <code key={key}>{key}</code>)}</div>
        <span>这些字段在策略组、路由规则和规则提供者页签中维护，不能出现在模板中。</span>
      </div>
      <button type="button" className="inline-add-button reset-template-button" onClick={onReset}><Icon name="history" size={14}></Icon>恢复项目默认模板</button>
    </section>
  );
}

/**
 * 统一的非路由 YAML 模板编辑器。
 * @param {object} props 组件属性。
 * @param {string} props.yamlText YAML 模板文本。
 * @param {object} props.analysis YAML 模板分析结果。
 * @param {string} props.activeKey 当前大纲字段。
 * @param {number} props.jumpToken 大纲定位请求令牌，用于响应重复点击。
 * @param {Function} props.onChange 文本更新回调。
 * @param {Function} props.onFormat 格式化回调。
 * @param {Function} props.onReset 恢复默认模板回调。
 * @param {Function} props.onPreview 打开完整输出预览回调。
 * @returns {React.ReactElement} YAML 模板编辑面板。
 */
function BaseYamlEditor({ yamlText, analysis, activeKey, jumpToken, onChange, onFormat, onReset, onPreview }) {
  const textareaRef = React.useRef(null);
  const lineRailRef = React.useRef(null);

  /**
   * 同步代码文本与行号栏的纵向滚动位置。
   * @param {React.UIEvent<HTMLTextAreaElement>} event 文本域滚动事件。
   * @returns {void}
   */
  function syncLineRail(event) {
    if (lineRailRef.current) lineRailRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  React.useEffect(() => {
    if (!activeKey || !textareaRef.current) return;
    const target = analysis.keys.find((item) => item.key === activeKey);
    if (!target) return;
    const characterOffset = analysis.lines
      .slice(0, target.line - 1)
      .reduce((total, line) => total + line.length + 1, 0);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(characterOffset, characterOffset + target.key.length);
    textareaRef.current.scrollTop = Math.max(0, (target.line - 3) * 17.2);
    if (lineRailRef.current) lineRailRef.current.scrollTop = textareaRef.current.scrollTop;
  }, [activeKey, jumpToken]);

  const issueCount = analysis.managedConflicts.length + analysis.duplicates.length + analysis.syntaxHints.length;

  return (
    <section className="editor-panel yaml-template-editor">
      <PanelHeader
        title="基础 YAML 模板"
        subtitle="除路由生成器保留字段外，其余内容都会解析并合并到最终订阅"
        actions={
          <React.Fragment>
            <button type="button" className="button ghost small" onClick={onReset}><Icon name="history" size={14}></Icon>恢复默认</button>
            <button type="button" className="button secondary small" onClick={onFormat}><Icon name="code" size={14}></Icon>整理格式</button>
            <button type="button" className="button primary small" onClick={onPreview}><Icon name="eye" size={14}></Icon>完整输出</button>
          </React.Fragment>
        }
      ></PanelHeader>

      <div className="template-boundary-banner">
        <span className="boundary-banner-icon"><Icon name="layers" size={16}></Icon></span>
        <div><strong>一个模板，一条清晰边界</strong><span>DNS、端口、TUN、sniffer、profile 等都保留原始 YAML；发布时与可视化生成内容做对象级合并。</span></div>
      </div>

      <div className="template-editor-shell">
        <div className="template-editor-toolbar">
          <div><span className="editor-language">YAML</span><span>base-template.yaml</span></div>
          <div><span>UTF-8</span><span>空格：2</span><span>自动换行：关</span></div>
        </div>
        <div className="code-editor-grid">
          <div className="yaml-line-rail" ref={lineRailRef} aria-hidden="true">
            {analysis.lines.map((_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <textarea
            ref={textareaRef}
            className="base-yaml-textarea"
            value={yamlText}
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncLineRail}
            spellCheck="false"
            aria-label="基础 YAML 模板"
          ></textarea>
        </div>
        <div className={`template-editor-status ${issueCount ? "has-error" : "is-valid"}`}>
          <div><Icon name={issueCount ? "error" : "check"} size={14}></Icon><strong>{issueCount ? `发现 ${issueCount} 个阻断问题` : "模板边界检查通过"}</strong></div>
          <span>{analysis.lineCount} 行</span>
          <span>{analysis.keys.length} 个顶级字段</span>
          <span>{analysis.managedConflicts.length} 个保留字段冲突</span>
        </div>
      </div>

      <div className="merge-flow-strip">
        <div><span className="merge-step-index">1</span><span><strong>解析模板</strong><small>保留全部非路由字段</small></span></div>
        <Icon name="chevronRight" size={14}></Icon>
        <div><span className="merge-step-index">2</span><span><strong>注入生成内容</strong><small>proxies / groups / rules</small></span></div>
        <Icon name="chevronRight" size={14}></Icon>
        <div><span className="merge-step-index">3</span><span><strong>序列化输出</strong><small>通用 Clash 与 Stash</small></span></div>
      </div>
    </section>
  );
}

Object.assign(window, {
  RuleCategoryPanel,
  RulesEditor,
  ProviderListPanel,
  ProviderEditor,
  YamlOutlinePanel,
  BaseYamlEditor
});
