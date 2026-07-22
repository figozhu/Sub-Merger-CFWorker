const { useMemo: useGroupsMemo, useState: useGroupsState } = React;

/**
 * 将策略组类型转换成更易理解的中文名称。
 * @param {string} type Clash 策略组类型。
 * @returns {string} 中文类型名称。
 */
function getGroupTypeLabel(type) {
  return {
    select: "手动选择",
    "url-test": "自动测速",
    fallback: "故障转移",
    "load-balance": "负载均衡"
  }[type] || type;
}

/**
 * 策略组列表与搜索面板。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.groups 策略组列表。
 * @param {string} props.selectedGroupId 当前策略组 ID。
 * @param {Function} props.onSelect 选择策略组回调。
 * @param {Function} props.onAdd 新建策略组回调。
 * @returns {React.ReactElement} 策略组列表面板。
 */
function GroupListPanel({ groups, selectedGroupId, onSelect, onAdd }) {
  const [query, setQuery] = useGroupsState("");
  const filteredGroups = useGroupsMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => `${group.name} ${group.description} ${group.type}`.toLowerCase().includes(keyword));
  }, [groups, query]);

  return (
    <section className="entity-panel group-list-panel">
      <PanelHeader
        title="策略组"
        subtitle={`${groups.filter((group) => group.enabled).length} 个已启用`}
        actions={<button type="button" className="icon-button brand" onClick={onAdd} aria-label="新建策略组"><Icon name="plus" size={17}></Icon></button>}
      ></PanelHeader>
      <div className="panel-search">
        <Icon name="search" size={15}></Icon>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或类型" aria-label="搜索策略组"></input>
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><Icon name="x" size={13}></Icon></button> : null}
      </div>

      <div className="entity-list" role="listbox" aria-label="策略组">
        {filteredGroups.map((group) => (
          <button
            type="button"
            role="option"
            aria-selected={selectedGroupId === group.id}
            key={group.id}
            className={`entity-row ${selectedGroupId === group.id ? "active" : ""} ${!group.enabled ? "disabled" : ""}`}
            onClick={() => onSelect(group.id)}
          >
            <span className={`entity-glyph color-${group.color}`}><Icon name={group.type === "fallback" ? "refresh" : group.type === "url-test" ? "flask" : "nodes"} size={15}></Icon></span>
            <span className="entity-copy">
              <strong>{group.name}</strong>
              <small>{getGroupTypeLabel(group.type)} · {group.matchedCount} 个节点</small>
            </span>
            {!group.enabled ? <span className="muted-label">停用</span> : <Icon name="chevronRight" size={14}></Icon>}
          </button>
        ))}
        {!filteredGroups.length ? (
          <div className="empty-search"><Icon name="search" size={22}></Icon><strong>未找到策略组</strong><span>换一个关键词试试</span></div>
        ) : null}
      </div>

      <button type="button" className="inline-add-button" onClick={onAdd}><Icon name="plus" size={15}></Icon>新建策略组</button>
    </section>
  );
}

/**
 * 策略组成员来源卡片。
 * @param {object} props 组件属性。
 * @param {object} props.source 成员来源对象。
 * @param {Array<object>} props.groups 全部策略组，用于引用选择。
 * @param {string} props.currentGroupId 当前策略组 ID。
 * @param {Function} props.onChange 来源更新回调。
 * @param {Function} props.onRemove 删除来源回调。
 * @returns {React.ReactElement} 成员来源编辑卡片。
 */
function MemberSourceCard({ source, groups, currentGroupId, onChange, onRemove }) {
  const sourceIcon = source.kind === "filter" ? "filter" : source.kind === "group" ? "nodes" : "code";
  const title = source.kind === "filter" ? "节点筛选器" : source.kind === "group" ? "引用策略组" : "内置策略";

  return (
    <div className="source-card">
      <div className="source-card-head">
        <div className="source-type"><span><Icon name={sourceIcon} size={15}></Icon></span><strong>{title}</strong></div>
        <div className="source-actions">
          <button type="button" className="icon-button subtle danger-hover" onClick={onRemove} aria-label="删除成员来源"><Icon name="trash" size={15}></Icon></button>
        </div>
      </div>

      {source.kind === "filter" ? (
        <div className="source-fields filter-fields">
          <label className="field compact-field">
            <span>节点来源</span>
            <select value={source.source} onChange={(event) => onChange({ source: event.target.value })}>
              <option value="all">全部可用节点</option>
              <option value="subscription">仅订阅节点</option>
              <option value="self">仅自建节点</option>
            </select>
          </label>
          <label className="field compact-field grow-field">
            <span>名称包含 <em>支持正则</em></span>
            <div className="regex-input"><span>/</span><input value={source.include} onChange={(event) => onChange({ include: event.target.value })} placeholder="美国|日本|US|JP"></input><span>/i</span></div>
          </label>
          <label className="field compact-field grow-field">
            <span>排除 <em>可选</em></span>
            <div className="regex-input"><span>/</span><input value={source.exclude} onChange={(event) => onChange({ exclude: event.target.value })} placeholder="香港|实验"></input><span>/i</span></div>
          </label>
        </div>
      ) : null}

      {source.kind === "group" ? (
        <div className="source-fields">
          <label className="field compact-field full-field">
            <span>选择被引用的策略组</span>
            <select value={source.groupId} onChange={(event) => onChange({ groupId: event.target.value, label: groups.find((group) => group.id === event.target.value)?.name || "" })}>
              {groups.filter((group) => group.id !== currentGroupId).map((group) => <option key={group.id} value={group.id}>{group.name} · {getGroupTypeLabel(group.type)}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {source.kind === "builtin" ? (
        <div className="source-fields">
          <label className="field compact-field full-field">
            <span>内置动作</span>
            <select value={source.value} onChange={(event) => onChange({ value: event.target.value, label: event.target.value })}>
              <option value="DIRECT">DIRECT · 直接连接</option>
              <option value="REJECT">REJECT · 拒绝连接</option>
              <option value="PASS">PASS · 跳过当前规则</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 策略组主编辑器。
 * @param {object} props 组件属性。
 * @param {object|null} props.group 当前策略组。
 * @param {Array<object>} props.groups 全部策略组。
 * @param {Function} props.onUpdate 更新策略组回调。
 * @param {Function} props.onUpdateSource 更新成员来源回调。
 * @param {Function} props.onAddSource 添加成员来源回调。
 * @param {Function} props.onRemoveSource 删除成员来源回调。
 * @param {Function} props.onDuplicate 复制策略组回调。
 * @param {Function} props.onDelete 删除策略组回调。
 * @returns {React.ReactElement} 策略组编辑区域。
 */
function GroupEditor({ group, groups, onUpdate, onUpdateSource, onAddSource, onRemoveSource, onDuplicate, onDelete }) {
  const [sourceMenuOpen, setSourceMenuOpen] = useGroupsState(false);

  if (!group) {
    return <section className="editor-panel centered-empty"><Icon name="nodes" size={34}></Icon><h2>选择一个策略组</h2><p>从左侧列表选择，或新建一个策略组。</p></section>;
  }

  const sampleNodes = ["🇸🇬 新加坡 01", "🇯🇵 日本 IEPL 02", "🇺🇸 美国家宽 03", "🇸🇬 自建-SG-01", "🇯🇵 东京专线 04", "🇺🇸 洛杉矶 05"];
  const isHealthChecked = ["url-test", "fallback", "load-balance"].includes(group.type);

  return (
    <section className="editor-panel group-editor">
      <PanelHeader
        title="编辑策略组"
        actions={
          <React.Fragment>
            <label className="switch-label">
              <span>{group.enabled ? "已启用" : "已停用"}</span>
              <input type="checkbox" checked={group.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })}></input>
              <span className="switch-control"></span>
            </label>
            <button type="button" className="icon-button" onClick={onDuplicate} aria-label="复制策略组"><Icon name="duplicate" size={16}></Icon></button>
            <button type="button" className="icon-button danger-hover" onClick={onDelete} aria-label="删除策略组"><Icon name="trash" size={16}></Icon></button>
          </React.Fragment>
        }
      ></PanelHeader>

      <div className="editor-scroll">
        <section className="form-section first-section">
          <div className="section-heading"><div><h3>基本信息</h3></div></div>
          <div className="form-grid two-columns">
            <label className="field">
              <span>策略组名称</span>
              <input value={group.name} onChange={(event) => onUpdate({ name: event.target.value })} placeholder="例如：海外 AI"></input>
            </label>
            <label className="field">
              <span>策略类型</span>
              <select value={group.type} onChange={(event) => onUpdate({ type: event.target.value })}>
                <option value="select">手动选择（select）</option>
                <option value="url-test">自动测速（url-test）</option>
                <option value="fallback">故障转移（fallback）</option>
                <option value="load-balance">负载均衡（load-balance）</option>
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading source-heading">
            <div><h3>成员来源</h3></div>
            <div className="menu-anchor">
              <button type="button" className="button secondary small" onClick={() => setSourceMenuOpen((open) => !open)}><Icon name="plus" size={14}></Icon>添加来源<Icon name="chevronDown" size={13}></Icon></button>
              {sourceMenuOpen ? (
                <div className="source-menu">
                  <button type="button" onClick={() => { onAddSource("filter"); setSourceMenuOpen(false); }}><span><Icon name="filter" size={15}></Icon></span><div><strong>节点筛选器</strong></div></button>
                  <button type="button" onClick={() => { onAddSource("group"); setSourceMenuOpen(false); }}><span><Icon name="nodes" size={15}></Icon></span><div><strong>引用策略组</strong></div></button>
                  <button type="button" onClick={() => { onAddSource("builtin"); setSourceMenuOpen(false); }}><span><Icon name="code" size={15}></Icon></span><div><strong>内置策略</strong></div></button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="source-stack">
            {group.sources.map((source) => (
              <MemberSourceCard
                key={source.id}
                source={source}
                groups={groups}
                currentGroupId={group.id}
                onChange={(patch) => onUpdateSource(source.id, patch)}
                onRemove={() => onRemoveSource(source.id)}
              ></MemberSourceCard>
            ))}
            {!group.sources.length ? <button type="button" className="empty-source" onClick={() => onAddSource("filter")}><Icon name="plus" size={18}></Icon><strong>添加第一个成员来源</strong><span>策略组至少需要一个来源</span></button> : null}
          </div>
        </section>

        {isHealthChecked ? (
          <section className="form-section health-section">
            <div className="section-heading"><div><h3>健康检查</h3></div><span className="feature-pill"><span></span>已开启</span></div>
            <div className="form-grid three-columns">
              <label className="field span-two"><span>测试地址</span><input value={group.testUrl || ""} onChange={(event) => onUpdate({ testUrl: event.target.value })}></input></label>
              <label className="field"><span>间隔（秒）</span><input type="number" value={group.interval || 600} onChange={(event) => onUpdate({ interval: Number(event.target.value) })}></input></label>
              {group.type === "url-test" ? <label className="field"><span>延迟容差（ms）</span><input type="number" value={group.tolerance || 80} onChange={(event) => onUpdate({ tolerance: Number(event.target.value) })}></input></label> : null}
            </div>
          </section>
        ) : null}

        <section className="form-section match-preview-section">
          <div className="section-heading">
            <div><h3>节点匹配预览</h3></div>
            <div className="match-count"><strong>{group.matchedCount}</strong><span>个节点</span></div>
          </div>
          <div className="node-chip-list">
            {sampleNodes.slice(0, Math.min(6, Math.max(1, group.matchedCount))).map((node) => <span key={node}><span className="node-online"></span>{node}</span>)}
            {group.matchedCount > 6 ? <span className="remaining-node-count">+{group.matchedCount - 6}</span> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

Object.assign(window, {
  getGroupTypeLabel,
  GroupListPanel,
  GroupEditor
});
