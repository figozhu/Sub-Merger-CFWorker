const { useMemo: useUnifiedMemo, useState: useUnifiedState } = React;

/**
 * 策略组树形列表。
 *
 * 每个策略组同时显示节点数量和归属规则数量，让用户在进入详情前就能发现
 * “没有任何分流规则”的不完整配置。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.groups 策略组列表。
 * @param {Array<object>} props.rules 全部路由规则。
 * @param {string} props.selectedGroupId 当前策略组 ID。
 * @param {Function} props.onSelect 选择策略组回调。
 * @param {Function} props.onAdd 新建策略组回调。
 * @returns {React.ReactElement} 策略组列表面板。
 */
function UnifiedGroupList({ groups, rules, selectedGroupId, onSelect, onAdd }) {
  const [query, setQuery] = useUnifiedState("");
  const visibleGroups = useUnifiedMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => `${group.name} ${group.type} ${group.description || ""}`.toLowerCase().includes(keyword));
  }, [groups, query]);

  return (
    <section className="entity-panel group-list-panel unified-group-list">
      <PanelHeader
        title="策略组"
        subtitle={`${groups.filter((group) => group.enabled).length} 个已启用 · 选择后配置其分流`}
        actions={<button type="button" className="icon-button brand" onClick={onAdd} aria-label="新建策略组"><Icon name="plus" size={17}></Icon></button>}
      ></PanelHeader>
      <div className="panel-search">
        <Icon name="search" size={15}></Icon>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索策略组" aria-label="搜索策略组"></input>
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><Icon name="x" size={13}></Icon></button> : null}
      </div>
      <div className="entity-list" role="listbox" aria-label="策略组与分流规则">
        {visibleGroups.map((group) => {
          const ruleCount = rules.filter((rule) => rule.targetGroupId === group.id).length;
          return (
            <button
              type="button"
              role="option"
              aria-selected={selectedGroupId === group.id}
              key={group.id}
              className={`entity-row unified-group-row ${selectedGroupId === group.id ? "active" : ""} ${!group.enabled ? "disabled" : ""}`}
              onClick={() => onSelect(group.id)}
            >
              <span className={`entity-glyph color-${group.color || "indigo"}`}><Icon name={group.type === "fallback" ? "refresh" : group.type === "url-test" ? "flask" : "nodes"} size={15}></Icon></span>
              <span className="entity-copy">
                <strong>{group.name}</strong>
                <small>{getGroupTypeLabel(group.type)} · {group.matchedCount || 0} 个节点</small>
              </span>
              <span className={`group-rule-badge ${ruleCount ? "" : "empty"}`}>{ruleCount} 条</span>
            </button>
          );
        })}
        {!visibleGroups.length ? <div className="empty-search"><strong>未找到策略组</strong><span>换一个关键词试试</span></div> : null}
      </div>
      <button type="button" className="inline-add-button" onClick={onAdd}><Icon name="plus" size={15}></Icon>新建策略组</button>
    </section>
  );
}

/**
 * 单条嵌套路由规则。
 *
 * 当前策略组视图隐藏重复的目标选择器；切换到全局顺序后再显示目标列，
 * 以便处理 DIRECT、REJECT 和跨策略组排序。
 * @param {object} props 组件属性。
 * @param {object} props.rule 规则对象。
 * @param {number} props.globalIndex 规则在最终 YAML 中的真实索引。
 * @param {boolean} props.selected 是否为当前选中规则。
 * @param {boolean} props.globalScope 是否显示全局目标字段。
 * @param {Array<object>} props.groups 策略组列表。
 * @param {Function} props.onSelect 选择规则回调。
 * @param {Function} props.onPatch 修改规则回调。
 * @param {Function} props.onDuplicate 复制规则回调。
 * @returns {React.ReactElement} 可直接编辑的规则行。
 */
function UnifiedRuleRow({ rule, globalIndex, selected, globalScope, groups, onSelect, onPatch, onDuplicate }) {
  return (
    <article className={`unified-rule-row ${selected ? "selected" : ""} ${!rule.enabled ? "disabled" : ""}`}>
      <div className="unified-rule-primary">
        <button type="button" className="rule-order-button" onClick={onSelect} aria-label={`选择第 ${globalIndex + 1} 条规则`}>#{String(globalIndex + 1).padStart(2, "0")}</button>
        <label className="mini-switch" title="启用规则">
          <input type="checkbox" checked={rule.enabled} onChange={(event) => onPatch({ enabled: event.target.checked })}></input>
        </label>
        <select
          className="rule-type-select"
          value={rule.type}
          onChange={(event) => onPatch({
            type: event.target.value,
            value: event.target.value === "MATCH" ? "" : rule.value,
            noResolve: event.target.value === "MATCH" ? false : rule.noResolve
          })}
          aria-label="规则类型"
        >
          {["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "IP-CIDR", "RULE-SET", "PROCESS-NAME", "GEOIP", "MATCH"].map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        {rule.type === "MATCH" ? (
          <div className="rule-value-placeholder">最终兜底，无需匹配内容</div>
        ) : (
          <input className="rule-value-input" value={rule.value || ""} onChange={(event) => onPatch({ value: event.target.value })} aria-label="匹配内容"></input>
        )}
        {globalScope ? (
          <select className="rule-target-select" value={rule.targetGroupId} onChange={(event) => onPatch({ targetGroupId: event.target.value })} aria-label="目标策略">
            {groups.filter((group) => group.enabled).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            <option value="builtin:DIRECT">DIRECT</option>
            <option value="builtin:REJECT">REJECT</option>
          </select>
        ) : null}
        <button type="button" className="rule-copy-button" onClick={onDuplicate} disabled={rule.type === "MATCH"} aria-label="复制规则"><Icon name="copy" size={14}></Icon></button>
      </div>
      <div className="unified-rule-secondary">
        <input value={rule.note || rule.remark || ""} onChange={(event) => onPatch({ note: event.target.value })} placeholder="备注：导出为规则上方注释" aria-label="规则备注"></input>
        <input value={rule.category || "general"} onChange={(event) => onPatch({ category: event.target.value })} aria-label="规则分类"></input>
        <label className="rule-option-toggle">
          <input type="checkbox" checked={Boolean(rule.noResolve)} disabled={rule.type === "MATCH"} onChange={(event) => onPatch({ noResolve: event.target.checked })}></input>
          <span>no-resolve</span>
        </label>
      </div>
    </article>
  );
}

/**
 * 当前策略组下的分流规则工作区。
 *
 * 默认仅显示归属于当前策略组的规则；“全局顺序”保留为同一层级中的检查视图，
 * 用来维护 Clash 真实的扁平规则数组，而不是重新建立一个独立的规则模块。
 * @param {object} props 组件属性。
 * @returns {React.ReactElement} 分流规则编辑区。
 */
function UnifiedRulesPanel({
  group,
  groups,
  rules,
  selectedRuleId,
  scope,
  onScopeChange,
  onSelectRule,
  onPatchRule,
  onAddRule,
  onInsertRule,
  onDuplicateRule,
  onDeleteRule,
  onMoveRule
}) {
  const [query, setQuery] = useUnifiedState("");
  const scopedRules = useUnifiedMemo(() => {
    const candidates = scope === "global" ? rules : rules.filter((rule) => rule.targetGroupId === group.id);
    const keyword = query.trim().toLowerCase();
    if (!keyword) return candidates;
    return candidates.filter((rule) => `${rule.type} ${rule.value || ""} ${rule.note || rule.remark || ""} ${rule.category || ""}`.toLowerCase().includes(keyword));
  }, [group.id, query, rules, scope]);
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) || null;
  const selectedVisible = selectedRule && scopedRules.some((rule) => rule.id === selectedRule.id);
  const selectedGlobalIndex = selectedRule ? rules.findIndex((rule) => rule.id === selectedRule.id) : -1;
  const selectedScopeIndex = selectedRule ? scopedRules.findIndex((rule) => rule.id === selectedRule.id) : -1;

  return (
    <section className="unified-rules-panel">
      <div className="nested-section-heading">
        <div>
          <h3>分流规则</h3>
          <p>{scope === "global" ? "检查最终 YAML 的真实顺序，并处理 DIRECT / REJECT 规则。" : `新规则会自动归属“${group.name}”，无需重复选择目标。`}</p>
        </div>
        <button type="button" className="button primary small" onClick={onAddRule}><Icon name="plus" size={14}></Icon>添加规则</button>
      </div>
      <div className="unified-rule-toolbar">
        <div className="segmented-control rule-scope-control" aria-label="规则显示范围">
          <button type="button" className={scope === "group" ? "active" : ""} onClick={() => onScopeChange("group")}>当前策略组 <span>{rules.filter((rule) => rule.targetGroupId === group.id).length}</span></button>
          <button type="button" className={scope === "global" ? "active" : ""} onClick={() => onScopeChange("global")}>全局顺序 <span>{rules.length}</span></button>
        </div>
        <label className="compact-rule-search"><Icon name="search" size={14}></Icon><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则"></input></label>
      </div>

      {selectedVisible ? (
        <div className="selected-rule-toolbar" role="toolbar" aria-label="选中规则操作">
          <div><span>已选</span><strong>#{String(selectedGlobalIndex + 1).padStart(2, "0")} · {selectedRule.type}</strong></div>
          <div className="selected-rule-actions">
            <button type="button" onClick={() => onInsertRule(selectedRule.id, "above")}><Icon name="plus" size={13}></Icon>上方插入</button>
            <button type="button" onClick={() => onInsertRule(selectedRule.id, "below")}><Icon name="plus" size={13}></Icon>下方插入</button>
            <button type="button" onClick={() => onDuplicateRule(selectedRule.id)} disabled={selectedRule.type === "MATCH"}><Icon name="copy" size={13}></Icon>复制</button>
            <button type="button" onClick={() => onMoveRule(selectedRule.id, -1, scope)} disabled={selectedScopeIndex <= 0}>上移</button>
            <button type="button" onClick={() => onMoveRule(selectedRule.id, 1, scope)} disabled={selectedScopeIndex < 0 || selectedScopeIndex >= scopedRules.length - 1}>下移</button>
            <button type="button" className="danger" onClick={() => onDeleteRule(selectedRule.id)}><Icon name="trash" size={13}></Icon>删除</button>
          </div>
        </div>
      ) : (
        <div className="rule-selection-hint"><Icon name="route" size={14}></Icon>点击规则序号选中记录，即可在其上方或下方插入。</div>
      )}

      <div className="unified-rule-list">
        {scopedRules.map((rule) => (
          <UnifiedRuleRow
            key={rule.id}
            rule={rule}
            globalIndex={rules.findIndex((item) => item.id === rule.id)}
            selected={selectedRuleId === rule.id}
            globalScope={scope === "global"}
            groups={groups}
            onSelect={() => onSelectRule(rule.id)}
            onPatch={(patch) => onPatchRule(rule.id, patch)}
            onDuplicate={() => onDuplicateRule(rule.id)}
          ></UnifiedRuleRow>
        ))}
        {!scopedRules.length ? (
          <button type="button" className="empty-rule-group" onClick={onAddRule}>
            <Icon name="route" size={22}></Icon>
            <strong>{query ? "没有匹配的规则" : "这个策略组还没有分流规则"}</strong>
            <span>{query ? "清除搜索条件后再试" : "添加第一条规则，目标将自动设置为当前策略组。"}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * 当前策略组的成员来源与健康检查面板。
 * @param {object} props 组件属性。
 * @returns {React.ReactElement} 策略组运行设置。
 */
function UnifiedGroupSettings({ group, groups, onUpdate, onUpdateSource, onAddSource, onRemoveSource }) {
  return (
    <div className="unified-settings-panel">
      <section className="form-section first-section">
        <div className="section-heading source-heading">
          <div><h3>成员来源</h3><p>按从上到下的顺序生成节点，并自动去重。</p></div>
          <div className="button-cluster">
            <button type="button" className="button secondary small" onClick={() => onAddSource("filter")}>节点筛选器</button>
            <button type="button" className="button secondary small" onClick={() => onAddSource("group")}>引用策略组</button>
            <button type="button" className="button secondary small" onClick={() => onAddSource("builtin")}>内置策略</button>
          </div>
        </div>
        <div className="source-list">
          {group.sources.map((source) => (
            <div className="source-card compact-unified-source" key={source.id}>
              <div className="source-card-head">
                <strong>{source.kind === "filter" ? "节点筛选器" : source.kind === "group" ? "引用策略组" : "内置策略"}</strong>
                <button type="button" className="icon-button subtle danger-hover" onClick={() => onRemoveSource(source.id)} aria-label="删除成员来源"><Icon name="trash" size={15}></Icon></button>
              </div>
              {source.kind === "filter" ? (
                <div className="source-fields filter-fields">
                  <label className="field compact-field"><span>节点来源</span><select value={source.source || "all"} onChange={(event) => onUpdateSource(source.id, { source: event.target.value })}><option value="all">全部节点</option><option value="subscription">仅订阅节点</option><option value="self">仅自建节点</option></select></label>
                  <label className="field compact-field grow-field"><span>名称包含</span><input value={source.include || ""} onChange={(event) => onUpdateSource(source.id, { include: event.target.value })}></input></label>
                  <label className="field compact-field grow-field"><span>排除</span><input value={source.exclude || ""} onChange={(event) => onUpdateSource(source.id, { exclude: event.target.value })}></input></label>
                </div>
              ) : source.kind === "group" ? (
                <label className="field"><span>被引用策略组</span><select value={source.groupId} onChange={(event) => onUpdateSource(source.id, { groupId: event.target.value })}>{groups.filter((candidate) => candidate.id !== group.id).map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select></label>
              ) : (
                <label className="field"><span>内置策略</span><input value="DIRECT" disabled></input></label>
              )}
            </div>
          ))}
        </div>
      </section>
      {group.type !== "select" ? (
        <section className="form-section">
          <div className="section-heading"><div><h3>健康检查</h3><p>用于测速、故障转移或负载均衡。</p></div></div>
          <div className="form-grid three-columns">
            <label className="field span-two"><span>测试地址</span><input value={group.testUrl || ""} onChange={(event) => onUpdate({ testUrl: event.target.value })}></input></label>
            <label className="field"><span>间隔（秒）</span><input type="number" value={group.interval || 600} onChange={(event) => onUpdate({ interval: Number(event.target.value) })}></input></label>
          </div>
        </section>
      ) : null}
      <section className="form-section match-preview-section">
        <div className="section-heading"><div><h3>节点匹配预览</h3><p>基于最近一次订阅抓取的节点样本。</p></div><div className="match-count"><strong>{group.matchedCount || 0}</strong><span>个节点</span></div></div>
        <div className="node-chip-list">
          {sampleNodes.slice(0, Math.min(6, Math.max(1, group.matchedCount || 0))).map((node) => <span key={node}><span className="node-online"></span>{node}</span>)}
        </div>
      </section>
    </div>
  );
}

/**
 * 策略组与其分流规则的统一详情面板。
 * @param {object} props 组件属性。
 * @returns {React.ReactElement} 中央编辑器。
 */
function UnifiedGroupEditor(props) {
  const { group, groups, rules, pane, onPaneChange, onUpdate, onDuplicateGroup, onDeleteGroup } = props;
  if (!group) {
    return <section className="editor-panel centered-empty"><h2>选择一个策略组</h2><p>在左侧选择策略组后，配置会与其分流规则一起显示。</p></section>;
  }
  const groupRuleCount = rules.filter((rule) => rule.targetGroupId === group.id).length;
  return (
    <section className="editor-panel unified-group-editor">
      <div className="panel-header unified-editor-header">
        <div><h2>{group.name || "未命名策略组"}</h2><p>稳定 ID：{group.id} · {groupRuleCount} 条归属规则</p></div>
        <div className="panel-header-actions">
          <label className="switch-label"><span>已启用</span><input type="checkbox" checked={group.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })}></input></label>
          <button type="button" className="icon-button" onClick={onDuplicateGroup} aria-label="复制策略组"><Icon name="copy" size={15}></Icon></button>
          <button type="button" className="icon-button danger" onClick={onDeleteGroup} aria-label="删除策略组"><Icon name="trash" size={15}></Icon></button>
        </div>
      </div>
      <div className="unified-group-context">
        <label className="field"><span>策略组名称</span><input value={group.name} onChange={(event) => onUpdate({ name: event.target.value })}></input></label>
        <label className="field"><span>策略类型</span><select value={group.type} onChange={(event) => onUpdate({ type: event.target.value })}><option value="select">手动选择（select）</option><option value="url-test">自动测速（url-test）</option><option value="fallback">故障转移（fallback）</option><option value="load-balance">负载均衡（load-balance）</option></select></label>
        <label className="field context-description"><span>用途说明</span><input value={group.description || ""} onChange={(event) => onUpdate({ description: event.target.value })} placeholder="便于理解这个策略组负责哪些流量"></input></label>
      </div>
      <div className="group-pane-tabs" role="tablist" aria-label="策略组配置区域">
        <button type="button" role="tab" aria-selected={pane === "rules"} className={pane === "rules" ? "active" : ""} onClick={() => onPaneChange("rules")}><Icon name="route" size={15}></Icon>分流规则 <span>{groupRuleCount}</span></button>
        <button type="button" role="tab" aria-selected={pane === "settings"} className={pane === "settings" ? "active" : ""} onClick={() => onPaneChange("settings")}><Icon name="filter" size={15}></Icon>成员与检测 <span>{group.sources.length}</span></button>
      </div>
      <div className="unified-editor-scroll">
        {pane === "rules" ? <UnifiedRulesPanel {...props}></UnifiedRulesPanel> : <UnifiedGroupSettings {...props}></UnifiedGroupSettings>}
      </div>
    </section>
  );
}

Object.assign(window, {
  UnifiedGroupList,
  UnifiedGroupEditor
});
