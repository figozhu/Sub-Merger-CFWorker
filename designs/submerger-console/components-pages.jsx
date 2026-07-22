/**
 * 独立登录页。
 * @param {object} props 组件属性。
 * @param {string} props.password 当前密码。
 * @param {boolean} props.showPassword 是否显示明文密码。
 * @param {string} props.error 登录错误。
 * @param {Function} props.onPasswordChange 密码更新回调。
 * @param {Function} props.onToggleVisibility 切换密码可见性。
 * @param {Function} props.onSubmit 提交登录。
 * @returns {React.ReactElement} 登录界面。
 */
function LoginScreen({ password, showPassword, error, onPasswordChange, onToggleVisibility, onSubmit }) {
  return (
    <main className="login-screen" data-screen-label="登录">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div><strong>SubMerger</strong><span>订阅配置</span></div>
        </div>
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <h1>登录</h1>
          <label className={`field ${error ? "has-error" : ""}`}>
            <span>管理密码</span>
            <div className="password-control">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
              ></input>
              <button type="button" className="password-toggle" onClick={onToggleVisibility} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
                <Icon name="eye" size={17}></Icon>
              </button>
            </div>
            {error ? <small id="login-error" className="field-error">{error}</small> : null}
          </label>
          <button type="submit" className="button primary login-submit">登录</button>
        </form>
      </section>
    </main>
  );
}

/**
 * 订阅源配置页面。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.subscriptions 订阅源列表。
 * @param {object} props.errors 按订阅源 ID 组织的字段错误。
 * @param {boolean} props.dirty 是否存在未保存修改。
 * @param {Function} props.onAdd 新增订阅源。
 * @param {Function} props.onPatch 修改订阅源。
 * @param {Function} props.onDelete 删除订阅源。
 * @param {Function} props.onSave 保存订阅源。
 * @returns {React.ReactElement} 订阅源管理页。
 */
function SubscriptionSourcesPage({ subscriptions, errors, dirty, onAdd, onPatch, onDelete, onSave }) {
  return (
    <section className="workspace-page" data-screen-label="订阅源">
      <WorkspaceHeader
        title="订阅源"
        status={dirty ? "有未保存更改" : `${subscriptions.length} 个订阅源`}
        statusTone={dirty ? "dirty" : "saved"}
        actions={
          <React.Fragment>
            <button type="button" className="button secondary" onClick={onAdd}><Icon name="plus" size={16}></Icon>添加订阅源</button>
            <button type="button" className="button primary" onClick={onSave} disabled={!dirty}><Icon name="save" size={16}></Icon>保存</button>
          </React.Fragment>
        }
      ></WorkspaceHeader>

      <div className="workspace-content">
        <section className="data-panel subscription-panel">
          <div className="data-table-wrap">
            <table className="data-table subscription-table">
              <thead><tr><th>名称</th><th>类型</th><th>订阅地址</th><th aria-label="操作"></th></tr></thead>
              <tbody>
                {subscriptions.map((subscription) => {
                  const rowErrors = errors[subscription.id] || {};
                  return (
                    <tr key={subscription.id} className={Object.keys(rowErrors).length ? "row-invalid" : ""}>
                      <td>
                        <input
                          aria-label={`${subscription.subName || "新订阅源"}名称`}
                          value={subscription.subName}
                          onChange={(event) => onPatch(subscription.id, { subName: event.target.value })}
                          className={rowErrors.subName ? "invalid" : ""}
                          placeholder="订阅源名称"
                        ></input>
                        {rowErrors.subName ? <small className="cell-error">{rowErrors.subName}</small> : null}
                      </td>
                      <td>
                        <select value={subscription.subType} onChange={(event) => onPatch(subscription.id, { subType: event.target.value })} aria-label={`${subscription.subName || "新订阅源"}类型`}>
                          <option value="包年/包月">包年/包月</option>
                          <option value="流量包">流量包</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`${subscription.subName || "新订阅源"}地址`}
                          value={subscription.subUrl}
                          onChange={(event) => onPatch(subscription.id, { subUrl: event.target.value })}
                          className={rowErrors.subUrl ? "invalid" : ""}
                          placeholder="https://example.com/sub"
                          spellCheck="false"
                        ></input>
                        {rowErrors.subUrl ? <small className="cell-error">{rowErrors.subUrl}</small> : null}
                      </td>
                      <td><button type="button" className="icon-button danger" onClick={() => onDelete(subscription.id)} aria-label={`删除 ${subscription.subName || "订阅源"}`}><Icon name="trash" size={16}></Icon></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!subscriptions.length ? (
            <div className="empty-state"><strong>还没有订阅源</strong><button type="button" className="button primary" onClick={onAdd}>添加订阅源</button></div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

/**
 * 自建节点 JSON 配置页面。
 * @param {object} props 组件属性。
 * @param {string} props.jsonText 节点 JSON 文本。
 * @param {object} props.analysis JSON 解析结果。
 * @param {boolean} props.dirty 是否存在未保存修改。
 * @param {Function} props.onChange 文本更新回调。
 * @param {Function} props.onFormat 格式化回调。
 * @param {Function} props.onSave 保存回调。
 * @returns {React.ReactElement} 自建节点配置页。
 */
function SelfNodesPage({ jsonText, analysis, dirty, onChange, onFormat, onSave }) {
  const textareaRef = React.useRef(null);
  const lineRailRef = React.useRef(null);
  const lines = jsonText.split("\n");

  /**
   * 保持代码编辑器的行号与文本同步滚动。
   * @param {React.UIEvent<HTMLTextAreaElement>} event 文本域滚动事件。
   * @returns {void}
   */
  function syncLineRail(event) {
    if (lineRailRef.current) lineRailRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  return (
    <section className="workspace-page" data-screen-label="自建节点">
      <WorkspaceHeader
        title="自建节点"
        status={analysis.valid ? (dirty ? "有未保存更改" : analysis.message) : "JSON 无效"}
        statusTone={analysis.valid ? (dirty ? "dirty" : "saved") : "error"}
        actions={
          <React.Fragment>
            <button type="button" className="button secondary" onClick={onFormat}><Icon name="code" size={16}></Icon>格式化</button>
            <button type="button" className="button primary" onClick={onSave} disabled={!dirty || !analysis.valid}><Icon name="save" size={16}></Icon>保存节点</button>
          </React.Fragment>
        }
      ></WorkspaceHeader>

      <div className="workspace-content nodes-workspace">
        <section className="data-panel parsed-nodes-panel">
          <div className="simple-panel-head"><h2>节点</h2><span>{analysis.nodes.length}</span></div>
          <div className="parsed-node-list">
            {analysis.nodes.map((node, index) => (
              <div className="parsed-node-row" key={`${node.name || "node"}-${index}`}>
                <span className="node-protocol">{String(node.type || "?").toUpperCase()}</span>
                <div><strong>{node.name || `未命名节点 ${index + 1}`}</strong><span>{node.server || "—"}:{node.port || "—"}</span></div>
              </div>
            ))}
            {!analysis.nodes.length ? <div className="empty-list">暂无可显示节点</div> : null}
          </div>
        </section>

        <section className="data-panel json-editor-panel">
          <div className="code-toolbar"><span>self-nodes.json</span><span>UTF-8 · 2 空格</span></div>
          <div className="code-editor-grid node-code-grid">
            <div className="yaml-line-rail" ref={lineRailRef} aria-hidden="true">{lines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea
              ref={textareaRef}
              className="base-yaml-textarea node-json-textarea"
              value={jsonText}
              onChange={(event) => onChange(event.target.value)}
              onScroll={syncLineRail}
              spellCheck="false"
              aria-label="自建节点 JSON"
            ></textarea>
          </div>
          <div className={`editor-validation ${analysis.valid ? "valid" : "invalid"}`}>
            <Icon name={analysis.valid ? "check" : "error"} size={14}></Icon><span>{analysis.valid ? `${analysis.message}，格式有效` : analysis.message}</span>
          </div>
        </section>
      </div>
    </section>
  );
}

/**
 * 合并订阅输出页面。
 * @param {object} props 组件属性。
 * @param {Array<object>} props.outputs 输出端点。
 * @param {Array<object>} props.subscriptions 当前订阅源。
 * @param {Function} props.onCopy 复制链接回调。
 * @returns {React.ReactElement} 订阅输出页。
 */
function SubscriptionOutputPage({ outputs, subscriptions, onCopy }) {
  const origin = "https://sub-merger.example.workers.dev";
  return (
    <section className="workspace-page" data-screen-label="订阅输出">
      <WorkspaceHeader title="订阅输出" status={`${outputs.length} 个链接`} statusTone="saved"></WorkspaceHeader>
      <div className="workspace-content">
        <section className="data-panel output-panel">
          <div className="output-list">
            {outputs.map((output) => {
              const sourceCount = subscriptions.filter((subscription) => subscription.subType === output.sourceType).length;
              const fullUrl = `${origin}${output.endpoint}`;
              return (
                <article className="output-row" key={output.id}>
                  <div className="output-type"><span className="output-icon"><Icon name="link" size={17}></Icon></span><div><strong>{output.name}</strong><span>{sourceCount} 个订阅源</span></div></div>
                  <code>{fullUrl}</code>
                  <button type="button" className="button secondary" onClick={() => onCopy(fullUrl, output.name)}><Icon name="copy" size={15}></Icon>复制</button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

Object.assign(window, {
  LoginScreen,
  SubscriptionSourcesPage,
  SelfNodesPage,
  SubscriptionOutputPage
});
