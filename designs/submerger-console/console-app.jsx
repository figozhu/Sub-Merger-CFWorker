const { useEffect, useMemo, useState } = React;

/**
 * 全屏模态框壳层。
 * @param {object} props 组件属性。
 * @param {string} props.title 标题。
 * @param {string} [props.subtitle] 辅助说明。
 * @param {React.ReactNode} props.children 主体内容。
 * @param {React.ReactNode} props.footer 底部操作。
 * @param {Function} props.onClose 关闭回调。
 * @param {string} [props.size="medium"] 尺寸类型。
 * @returns {React.ReactElement} 模态框。
 */
function Modal({ title, subtitle, children, footer, onClose, size = "medium" }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <div><h2 id="modal-title">{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><Icon name="x" size={17}></Icon></button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">{footer}</footer>
      </section>
    </div>
  );
}

/**
 * 右侧 YAML 输出抽屉。
 * @param {object} props 组件属性。
 * @param {string} props.yaml YAML 文本。
 * @param {string} props.client 当前客户端类型。
 * @param {Function} props.onClientChange 客户端切换回调。
 * @param {Function} props.onClose 关闭回调。
 * @param {Function} props.onCopy 复制回调。
 * @returns {React.ReactElement} YAML 预览抽屉。
 */
function YamlDrawer({ yaml, client, onClientChange, onClose, onCopy }) {
  const numberedLines = yaml.split("\n");
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="yaml-drawer" aria-label="YAML 输出预览">
        <header className="drawer-header">
          <div><h2>生成结果预览</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭预览"><Icon name="x" size={17}></Icon></button>
        </header>
        <div className="drawer-toolbar">
          <div className="segmented-control">
            <button type="button" className={client === "normal" ? "active" : ""} onClick={() => onClientChange("normal")}>通用 Clash</button>
            <button type="button" className={client === "stash" ? "active" : ""} onClick={() => onClientChange("stash")}>Stash</button>
          </div>
          <button type="button" className="button secondary small" onClick={onCopy}><Icon name="copy" size={14}></Icon>复制</button>
        </div>
        <div className="yaml-meta-row"><span><span className="status-dot ready"></span>语法有效</span><span>{numberedLines.length} 行</span><span>UTF-8</span></div>
        <pre className="yaml-code">{numberedLines.map((line, index) => <div key={`${index}-${line}`}><span>{String(index + 1).padStart(3, "0")}</span><code>{line || " "}</code></div>)}</pre>
      </aside>
    </div>
  );
}

/**
 * 页面右下角的短时反馈提示。
 * @param {object} props 组件属性。
 * @param {object|null} props.toast 提示内容。
 * @returns {React.ReactElement|null} 提示组件。
 */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || "success"}`} role="status">
      <span><Icon name={toast.type === "warning" ? "warning" : toast.type === "error" ? "error" : "check"} size={17}></Icon></span>
      <div><strong>{toast.title}</strong>{toast.detail ? <small>{toast.detail}</small> : null}</div>
    </div>
  );
}

/**
 * 完整控制台交互原型的状态容器。
 * 覆盖登录、订阅源、自建节点、路由配置和订阅输出，所有数据仅保存在浏览器内存中。
 * @returns {React.ReactElement} 完整应用。
 */
function App() {
  const initialScreen = window.location.hash.replace("#", "");
  const availableScreens = ["subscriptions", "nodes", "routing", "links"];
  const [authenticated, setAuthenticated] = useState(initialScreen !== "login");
  const [activeNav, setActiveNav] = useState(availableScreens.includes(initialScreen) ? initialScreen : "subscriptions");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [subscriptions, setSubscriptions] = useState(() => INITIAL_SUBSCRIPTIONS.map((subscription) => ({ ...subscription })));
  const [subscriptionErrors, setSubscriptionErrors] = useState({});
  const [subscriptionDirty, setSubscriptionDirty] = useState(false);
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState(null);
  const [selfNodeJson, setSelfNodeJson] = useState(INITIAL_SELF_NODE_JSON);
  const [selfNodeDirty, setSelfNodeDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState(() => INITIAL_GROUPS.map((group) => ({ ...group, sources: group.sources.map((source) => ({ ...source })) })));
  const [rules, setRules] = useState(() => INITIAL_RULES.map((rule) => ({ ...rule })));
  const [providers, setProviders] = useState(() => INITIAL_PROVIDERS.map((provider) => ({ ...provider })));
  const [baseYaml, setBaseYaml] = useState(INITIAL_BASE_YAML);
  const [selectedGroupId, setSelectedGroupId] = useState("group-ai");
  const [selectedRuleId, setSelectedRuleId] = useState("rule-openai");
  const [selectedProviderId, setSelectedProviderId] = useState("provider-openai");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeYamlKey, setActiveYamlKey] = useState("dns");
  const [yamlJumpToken, setYamlJumpToken] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState("今天 14:32");
  const [revision, setRevision] = useState(18);
  const [modal, setModal] = useState(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlClient, setYamlClient] = useState("normal");
  const [toast, setToast] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", type: "select", description: "" });
  const [newRule, setNewRule] = useState({ type: "DOMAIN-SUFFIX", value: "", targetGroupId: "group-other", category: "system", noResolve: true });
  const [newProvider, setNewProvider] = useState({ name: "", behavior: "classical", url: "", interval: 86400 });
  const [importYamlText, setImportYamlText] = useState("proxy-groups:\n  - name: 新策略组\n    type: select\n    proxies:\n      - DIRECT\n\nrules:\n  - MATCH,新策略组");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) || null;
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || null;
  const inspectorGroup = activeTab === "rules"
    ? groups.find((group) => group.id === selectedRule?.targetGroupId) || null
    : activeTab === "groups" ? selectedGroup : null;
  const yamlAnalysis = useMemo(() => analyzeYamlTemplate(baseYaml), [baseYaml]);
  const selfNodeAnalysis = useMemo(() => analyzeSelfNodeJson(selfNodeJson), [selfNodeJson]);
  const issues = useMemo(() => validateRoutingConfig(groups, rules, providers, baseYaml), [groups, rules, providers, baseYaml]);
  const yaml = useMemo(() => generateYamlPreview(groups, rules, providers, yamlClient, baseYaml), [groups, rules, providers, yamlClient, baseYaml]);
  const blockingErrors = issues.filter((issue) => issue.level === "error").length;

  /**
   * 在右下角显示一次性反馈，并自动隐藏旧提示。
   * @param {string} title 提示标题。
   * @param {string} [detail] 详细说明。
   * @param {string} [type="success"] 提示类型。
   * @returns {void}
   */
  function showToast(title, detail = "", type = "success") {
    const id = Date.now();
    setToast({ id, title, detail, type });
    window.setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
    }, 3200);
  }

  /**
   * 提交登录表单。
   * 原型使用 `admin` 作为演示密码，并保留真实页面的错误反馈状态。
   * @param {React.FormEvent<HTMLFormElement>} event 表单提交事件。
   * @returns {void}
   */
  function submitLogin(event) {
    event.preventDefault();
    if (password !== "admin") {
      setLoginError("密码不正确");
      return;
    }
    setLoginError("");
    setAuthenticated(true);
    setActiveNav("subscriptions");
    window.location.hash = "subscriptions";
  }

  /**
   * 修改一条订阅源记录并清除该行旧的校验错误。
   * @param {string} subscriptionId 订阅源 ID。
   * @param {object} patch 需要合并的字段。
   * @returns {void}
   */
  function patchSubscription(subscriptionId, patch) {
    setSubscriptions((current) => current.map((subscription) => subscription.id === subscriptionId ? { ...subscription, ...patch } : subscription));
    setSubscriptionErrors((current) => ({ ...current, [subscriptionId]: {} }));
    setSubscriptionDirty(true);
  }

  /**
   * 在订阅源列表末尾添加一条可编辑空记录。
   * @returns {void}
   */
  function addSubscription() {
    const subscription = { id: `sub-${Date.now()}`, subName: "", subType: "包年/包月", subUrl: "" };
    setSubscriptions((current) => current.concat(subscription));
    setSubscriptionDirty(true);
  }

  /**
   * 请求删除订阅源，并打开确认对话框。
   * @param {string} subscriptionId 订阅源 ID。
   * @returns {void}
   */
  function requestDeleteSubscription(subscriptionId) {
    setPendingSubscriptionId(subscriptionId);
    setModal("deleteSubscription");
  }

  /**
   * 确认删除当前待处理的订阅源。
   * @returns {void}
   */
  function confirmDeleteSubscription() {
    if (!pendingSubscriptionId) return;
    setSubscriptions((current) => current.filter((subscription) => subscription.id !== pendingSubscriptionId));
    setPendingSubscriptionId(null);
    setModal(null);
    setSubscriptionDirty(true);
    showToast("订阅源已删除");
  }

  /**
   * 校验并保存全部订阅源。
   * @returns {void}
   */
  function saveSubscriptions() {
    if (!subscriptions.length) {
      showToast("至少保留一个订阅源", "", "error");
      return;
    }
    const nextErrors = Object.fromEntries(subscriptions.map((subscription) => [subscription.id, validateSubscription(subscription)]));
    const errorCount = Object.values(nextErrors).reduce((count, errors) => count + Object.keys(errors).length, 0);
    setSubscriptionErrors(nextErrors);
    if (errorCount) {
      showToast(`有 ${errorCount} 个字段需要修正`, "", "error");
      return;
    }
    setSubscriptionDirty(false);
    showToast("订阅源已保存");
  }

  /**
   * 更新自建节点 JSON 文本。
   * @param {string} value 最新 JSON 文本。
   * @returns {void}
   */
  function updateSelfNodeJson(value) {
    setSelfNodeJson(value);
    setSelfNodeDirty(true);
  }

  /**
   * 使用浏览器 JSON 解析器格式化自建节点配置。
   * @returns {void}
   */
  function formatSelfNodeJson() {
    if (!selfNodeAnalysis.valid) {
      showToast("无法格式化无效 JSON", selfNodeAnalysis.message, "error");
      return;
    }
    setSelfNodeJson(JSON.stringify(selfNodeAnalysis.nodes, null, 2));
    setSelfNodeDirty(true);
    showToast("JSON 已格式化");
  }

  /**
   * 保存已经通过结构校验的自建节点配置。
   * @returns {void}
   */
  function saveSelfNodes() {
    if (!selfNodeAnalysis.valid) {
      showToast("JSON 校验未通过", selfNodeAnalysis.message, "error");
      return;
    }
    setSelfNodeDirty(false);
    showToast("自建节点已保存");
  }

  /**
   * 将任意文本复制到系统剪贴板。
   * @param {string} text 要复制的文本。
   * @param {string} label 反馈中显示的对象名称。
   * @returns {Promise<void>} 异步复制结果。
   */
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}链接已复制`);
    } catch (error) {
      showToast("浏览器未授予剪贴板权限", "请手动选择链接复制。", "warning");
    }
  }

  /**
   * 标记当前配置已发生本地修改。
   * @returns {void}
   */
  function markDirty() {
    setDirty(true);
  }

  /**
   * 切换业务页面并同步地址栏哈希，便于直接访问指定原型页面。
   * @param {string} navId 目标导航 ID。
   * @returns {void}
   */
  function handleNavigate(navId) {
    setActiveNav(navId);
    window.location.hash = navId;
  }

  /**
   * 更新当前策略组字段。
   * @param {object} patch 需要合并的字段。
   * @returns {void}
   */
  function updateSelectedGroup(patch) {
    setGroups((current) => current.map((group) => group.id === selectedGroupId ? { ...group, ...patch } : group));
    markDirty();
  }

  /**
   * 更新当前策略组中的单个成员来源。
   * @param {string} sourceId 来源 ID。
   * @param {object} patch 需要合并的字段。
   * @returns {void}
   */
  function updateGroupSource(sourceId, patch) {
    setGroups((current) => current.map((group) => {
      if (group.id !== selectedGroupId) return group;
      return { ...group, sources: group.sources.map((source) => source.id === sourceId ? { ...source, ...patch } : source) };
    }));
    markDirty();
  }

  /**
   * 向当前策略组添加一种成员来源。
   * @param {string} kind 来源类型。
   * @returns {void}
   */
  function addGroupSource(kind) {
    const fallbackGroup = groups.find((group) => group.id !== selectedGroupId);
    const source = kind === "filter"
      ? { id: `source-${Date.now()}`, kind: "filter", source: "all", include: ".*", exclude: "", label: "新节点筛选器" }
      : kind === "group"
        ? { id: `source-${Date.now()}`, kind: "group", groupId: fallbackGroup?.id || "", label: fallbackGroup?.name || "" }
        : { id: `source-${Date.now()}`, kind: "builtin", value: "DIRECT", label: "DIRECT" };
    setGroups((current) => current.map((group) => group.id === selectedGroupId ? { ...group, sources: group.sources.concat(source) } : group));
    markDirty();
  }

  /**
   * 从当前策略组移除成员来源。
   * @param {string} sourceId 来源 ID。
   * @returns {void}
   */
  function removeGroupSource(sourceId) {
    setGroups((current) => current.map((group) => group.id === selectedGroupId ? { ...group, sources: group.sources.filter((source) => source.id !== sourceId) } : group));
    markDirty();
  }

  /**
   * 创建新的策略组并切换到编辑状态。
   * @returns {void}
   */
  function createGroup() {
    const name = newGroup.name.trim();
    if (!name) {
      showToast("请输入策略组名称", "名称不能为空。", "error");
      return;
    }
    if (groups.some((group) => group.name === name)) {
      showToast("策略组名称已存在", "请使用唯一名称。", "error");
      return;
    }
    const group = {
      id: `group-${Date.now()}`,
      name,
      type: newGroup.type,
      description: newGroup.description || "新建的自定义策略组",
      enabled: true,
      color: "indigo",
      matchedCount: 0,
      sources: [{ id: `source-${Date.now()}`, kind: "filter", source: "all", include: ".*", exclude: "", label: "全部可用节点" }]
    };
    setGroups((current) => current.concat(group));
    setSelectedGroupId(group.id);
    setActiveTab("groups");
    setModal(null);
    setNewGroup({ name: "", type: "select", description: "" });
    markDirty();
    showToast("策略组已创建", "继续配置成员来源与健康检查。", "success");
  }

  /**
   * 复制当前策略组并生成新的稳定 ID。
   * @returns {void}
   */
  function duplicateSelectedGroup() {
    if (!selectedGroup) return;
    const id = `group-${Date.now()}`;
    const copy = {
      ...selectedGroup,
      id,
      name: `${selectedGroup.name} 副本`,
      sources: selectedGroup.sources.map((source, index) => ({ ...source, id: `${id}-source-${index}` }))
    };
    setGroups((current) => current.concat(copy));
    setSelectedGroupId(id);
    markDirty();
    showToast("已复制策略组", "规则仍指向原策略组，你可以单独调整副本。", "success");
  }

  /**
   * 删除当前策略组；若仍被规则或其它组引用则阻止删除。
   * @returns {void}
   */
  function deleteSelectedGroup() {
    if (!selectedGroup) return;
    const ruleRefs = rules.filter((rule) => rule.targetGroupId === selectedGroup.id).length;
    const groupRefs = groups.reduce((count, group) => count + group.sources.filter((source) => source.kind === "group" && source.groupId === selectedGroup.id).length, 0);
    if (ruleRefs || groupRefs) {
      showToast("暂时不能删除", `仍有 ${ruleRefs} 条规则和 ${groupRefs} 个策略组引用它。`, "error");
      return;
    }
    const remaining = groups.filter((group) => group.id !== selectedGroup.id);
    setGroups(remaining);
    setSelectedGroupId(remaining[0]?.id || "");
    markDirty();
    showToast("策略组已删除", selectedGroup.name, "success");
  }

  /**
   * 更新一条路由规则。
   * @param {string} ruleId 规则 ID。
   * @param {object} patch 需要合并的字段。
   * @returns {void}
   */
  function patchRule(ruleId, patch) {
    setRules((current) => current.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
    markDirty();
  }

  /**
   * 创建新的路由规则。
   * @returns {void}
   */
  function createRule() {
    if (newRule.type !== "MATCH" && !newRule.value.trim()) {
      showToast("请输入匹配内容", "当前规则类型需要一个值。", "error");
      return;
    }
    const rule = { ...newRule, id: `rule-${Date.now()}`, enabled: true, value: newRule.type === "MATCH" ? "" : newRule.value.trim(), note: "通过可视化编辑器新增" };
    setRules((current) => {
      if (rule.type === "MATCH") return current.concat(rule);
      const matchIndex = current.findIndex((item) => item.type === "MATCH");
      if (matchIndex === -1) return current.concat(rule);
      return current.slice(0, matchIndex).concat(rule, current.slice(matchIndex));
    });
    setSelectedRuleId(rule.id);
    setActiveCategory("all");
    setActiveTab("rules");
    setModal(null);
    setNewRule({ type: "DOMAIN-SUFFIX", value: "", targetGroupId: "group-other", category: "system", noResolve: true });
    markDirty();
    showToast("规则已添加", "已自动放在最终 MATCH 规则之前。", "success");
  }

  /**
   * 删除一条路由规则。
   * @param {string} ruleId 规则 ID。
   * @returns {void}
   */
  function deleteRule(ruleId) {
    const rule = rules.find((item) => item.id === ruleId);
    setRules((current) => current.filter((item) => item.id !== ruleId));
    if (selectedRuleId === ruleId) setSelectedRuleId(rules.find((item) => item.id !== ruleId)?.id || "");
    markDirty();
    showToast("规则已移除", rule?.value || rule?.type || "", "success");
  }

  /**
   * 根据拖放源和目标重排规则。
   * @param {string} sourceId 被拖动规则 ID。
   * @param {string} targetId 目标规则 ID。
   * @returns {void}
   */
  function reorderRule(sourceId, targetId) {
    setRules((current) => {
      const sourceIndex = current.findIndex((rule) => rule.id === sourceId);
      const targetIndex = current.findIndex((rule) => rule.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    markDirty();
  }

  /**
   * 更新规则提供者，并在名称变化时同步 RULE-SET 引用。
   * @param {object} patch 需要合并的字段。
   * @returns {void}
   */
  function updateSelectedProvider(patch) {
    if (!selectedProvider) return;
    if (patch.name && patch.name !== selectedProvider.name) {
      setRules((current) => current.map((rule) => rule.type === "RULE-SET" && rule.value === selectedProvider.name ? { ...rule, value: patch.name } : rule));
    }
    setProviders((current) => current.map((provider) => provider.id === selectedProvider.id ? { ...provider, ...patch } : provider));
    markDirty();
  }

  /**
   * 创建新的规则提供者。
   * @returns {void}
   */
  function createProvider() {
    if (!newProvider.name.trim() || !newProvider.url.trim()) {
      showToast("请填写名称和下载地址", "这两个字段用于生成 rule-providers。", "error");
      return;
    }
    const provider = { ...newProvider, id: `provider-${Date.now()}`, name: newProvider.name.trim(), url: newProvider.url.trim(), enabled: true, refs: 0 };
    setProviders((current) => current.concat(provider));
    setSelectedProviderId(provider.id);
    setActiveTab("providers");
    setModal(null);
    setNewProvider({ name: "", behavior: "classical", url: "", interval: 86400 });
    markDirty();
    showToast("规则提供者已创建", "现在可以在 RULE-SET 规则中引用它。", "success");
  }

  /**
   * 删除当前规则提供者；仍被引用时给出保护提示。
   * @returns {void}
   */
  function deleteSelectedProvider() {
    if (!selectedProvider) return;
    const references = rules.filter((rule) => rule.type === "RULE-SET" && rule.value === selectedProvider.name).length;
    if (references) {
      showToast("暂时不能删除", `仍被 ${references} 条 RULE-SET 规则引用。`, "error");
      return;
    }
    const remaining = providers.filter((provider) => provider.id !== selectedProvider.id);
    setProviders(remaining);
    setSelectedProviderId(remaining[0]?.id || "");
    markDirty();
  }

  /**
   * 更新非路由 YAML 模板，并标记草稿已修改。
   * @param {string} value 最新 YAML 文本。
   * @returns {void}
   */
  function updateBaseYaml(value) {
    setBaseYaml(value);
    markDirty();
  }

  /**
   * 定位到 YAML 模板中的指定顶层字段。
   * 额外递增定位令牌，确保重复点击同一个大纲项时也会再次聚焦并滚动编辑器。
   * @param {string} key 顶层 YAML 字段名。
   * @returns {void}
   */
  function locateYamlKey(key) {
    setActiveYamlKey(key);
    setYamlJumpToken((current) => current + 1);
  }

  /**
   * 对 YAML 模板执行保守的格式整理。
   *
   * 原型仅处理 Tab、行尾空格和连续空行；生产实现应使用项目的 `yaml` 包解析后重新序列化。
   * @returns {void}
   */
  function formatBaseYaml() {
    const formatted = baseYaml
      .replace(/\t/g, "  ")
      .split("\n")
      .map((line) => line.replace(/\s+$/g, ""))
      .join("\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trimEnd()
      .concat("\n");
    setBaseYaml(formatted);
    markDirty();
    showToast("模板格式已整理", "已清理 Tab、行尾空格和多余空行。", "success");
  }

  /**
   * 将 YAML 模板恢复为项目当前默认内容。
   * @returns {void}
   */
  function resetBaseYaml() {
    setBaseYaml(INITIAL_BASE_YAML);
    setActiveYamlKey("dns");
    setYamlJumpToken((current) => current + 1);
    markDirty();
    showToast("已恢复默认 YAML 模板", "尚未保存或发布，可以继续编辑。", "success");
  }

  /**
   * 保存当前草稿状态。
   * @returns {void}
   */
  function saveDraft() {
    setDirty(false);
    setLastSaved("刚刚");
    showToast("草稿已保存", "线上订阅仍使用已发布版本 r" + revision, "success");
  }

  /**
   * 执行即时校验并反馈结果。
   * @returns {void}
   */
  function runValidation() {
    if (blockingErrors) {
      showToast("发现发布阻断", `请先修复 ${blockingErrors} 个错误。`, "error");
    } else {
      const warnings = issues.filter((issue) => issue.level === "warning").length;
      showToast("配置校验通过", warnings ? `${warnings} 个提醒不会阻止发布。` : "未发现问题。", "success");
    }
  }

  /**
   * 打开发布确认；有错误时直接提示并保持草稿。
   * @returns {void}
   */
  function openPublish() {
    if (blockingErrors) {
      runValidation();
      return;
    }
    setModal("publish");
  }

  /**
   * 确认发布并模拟新修订写入与缓存切换。
   * @returns {void}
   */
  function confirmPublish() {
    const nextRevision = revision + 1;
    setRevision(nextRevision);
    setDirty(false);
    setLastSaved("刚刚");
    setModal(null);
    showToast(`版本 r${nextRevision} 已发布`, "订阅缓存将按新版本键重新生成。", "success");
  }

  /**
   * 模拟解析并导入旧 YAML。
   * @returns {void}
   */
  function confirmImport() {
    if (!importYamlText.trim()) {
      showToast("请粘贴 YAML 内容", "导入内容不能为空。", "error");
      return;
    }
    setModal(null);
    markDirty();
    showToast("YAML 已解析为结构化草稿", "识别 1 个策略组、1 条规则；原配置尚未覆盖。", "success");
  }

  /**
   * 将 YAML 复制到系统剪贴板；不支持时仍提供明确反馈。
   * @returns {Promise<void>} 异步复制结果。
   */
  async function copyYaml() {
    try {
      await navigator.clipboard.writeText(yaml);
      showToast("YAML 已复制", yamlClient === "stash" ? "Stash 版本" : "通用 Clash 版本", "success");
    } catch (error) {
      showToast("浏览器未授予剪贴板权限", "请在预览中手动选择复制。", "warning");
    }
  }

  useEffect(() => {
    /**
     * 响应地址栏哈希变化，支持浏览器前进后退和直接切换到登录页。
     * @returns {void}
     */
    function handleHashChange() {
      const nextScreen = window.location.hash.replace("#", "");
      if (nextScreen === "login") {
        setAuthenticated(false);
        return;
      }
      if (availableScreens.includes(nextScreen)) {
        setAuthenticated(true);
        setActiveNav(nextScreen);
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    /**
     * 响应 Escape 键关闭最上层浮层。
     * @param {KeyboardEvent} event 键盘事件。
     * @returns {void}
     */
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      if (modal) setModal(null);
      else if (yamlOpen) setYamlOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modal, yamlOpen]);

  const counts = { groups: groups.length, rules: rules.length, providers: providers.length };

  if (!authenticated) {
    return (
      <LoginScreen
        password={password}
        showPassword={showPassword}
        error={loginError}
        onPasswordChange={(value) => { setPassword(value); setLoginError(""); }}
        onToggleVisibility={() => setShowPassword((current) => !current)}
        onSubmit={submitLogin}
      ></LoginScreen>
    );
  }

  return (
    <div className="app-shell" data-screen-label="SubMerger 控制台">
      <Sidebar activeNav={activeNav} onNavigate={handleNavigate}></Sidebar>

      <main className="main-shell">
        {activeNav === "subscriptions" ? (
          <SubscriptionSourcesPage
            subscriptions={subscriptions}
            errors={subscriptionErrors}
            dirty={subscriptionDirty}
            onAdd={addSubscription}
            onPatch={patchSubscription}
            onDelete={requestDeleteSubscription}
            onSave={saveSubscriptions}
          ></SubscriptionSourcesPage>
        ) : null}

        {activeNav === "nodes" ? (
          <SelfNodesPage
            jsonText={selfNodeJson}
            analysis={selfNodeAnalysis}
            dirty={selfNodeDirty}
            onChange={updateSelfNodeJson}
            onFormat={formatSelfNodeJson}
            onSave={saveSelfNodes}
          ></SelfNodesPage>
        ) : null}

        {activeNav === "links" ? <SubscriptionOutputPage outputs={INITIAL_OUTPUTS} subscriptions={subscriptions} onCopy={copyText}></SubscriptionOutputPage> : null}

        {activeNav === "routing" ? (
          <section className="workspace-page routing-workspace" data-screen-label="路由配置">
            <PageHeader
              dirty={dirty}
              onImport={() => setModal("import")}
              onValidate={runValidation}
              onSave={saveDraft}
              onPublish={openPublish}
            ></PageHeader>
            <StudioTabs activeTab={activeTab} onChange={setActiveTab} counts={counts}></StudioTabs>

            <div className="studio-content">
              <div className={`studio-grid ${activeTab === "base" ? "base-studio-grid" : ""}`}>
                {activeTab === "groups" ? (
                  <React.Fragment>
                    <GroupListPanel groups={groups} selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} onAdd={() => setModal("newGroup")}></GroupListPanel>
                    <GroupEditor
                      group={selectedGroup}
                      groups={groups}
                      onUpdate={updateSelectedGroup}
                      onUpdateSource={updateGroupSource}
                      onAddSource={addGroupSource}
                      onRemoveSource={removeGroupSource}
                      onDuplicate={duplicateSelectedGroup}
                      onDelete={deleteSelectedGroup}
                    ></GroupEditor>
                  </React.Fragment>
                ) : null}

                {activeTab === "rules" ? (
                  <React.Fragment>
                    <RuleCategoryPanel categories={RULE_CATEGORIES.map((category) => ({ ...category, count: category.id === "all" ? rules.length : rules.filter((rule) => rule.category === category.id).length }))} activeCategory={activeCategory} onChange={setActiveCategory} onAddRule={() => setModal("newRule")}></RuleCategoryPanel>
                    <RulesEditor
                      rules={rules}
                      groups={groups}
                      activeCategory={activeCategory}
                      selectedRuleId={selectedRuleId}
                      onSelectRule={setSelectedRuleId}
                      onPatchRule={patchRule}
                      onDeleteRule={deleteRule}
                      onAddRule={() => setModal("newRule")}
                      onReorder={reorderRule}
                    ></RulesEditor>
                  </React.Fragment>
                ) : null}

                {activeTab === "providers" ? (
                  <React.Fragment>
                    <ProviderListPanel providers={providers} selectedProviderId={selectedProviderId} onSelect={setSelectedProviderId} onAdd={() => setModal("newProvider")}></ProviderListPanel>
                    <ProviderEditor provider={selectedProvider} onUpdate={updateSelectedProvider} onDelete={deleteSelectedProvider}></ProviderEditor>
                  </React.Fragment>
                ) : null}

                {activeTab === "base" ? (
                  <React.Fragment>
                    <YamlOutlinePanel analysis={yamlAnalysis} activeKey={activeYamlKey} onSelect={locateYamlKey}></YamlOutlinePanel>
                    <BaseYamlEditor
                      yamlText={baseYaml}
                      analysis={yamlAnalysis}
                      activeKey={activeYamlKey}
                      jumpToken={yamlJumpToken}
                      onChange={updateBaseYaml}
                      onFormat={formatBaseYaml}
                      onReset={resetBaseYaml}
                      onPreview={() => setYamlOpen(true)}
                    ></BaseYamlEditor>
                  </React.Fragment>
                ) : null}

                {activeTab !== "base" ? <Inspector issues={issues} selectedGroup={inspectorGroup} rules={rules} groups={groups} onPreview={() => setYamlOpen(true)} onValidate={runValidation}></Inspector> : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {yamlOpen ? <YamlDrawer yaml={yaml} client={yamlClient} onClientChange={setYamlClient} onClose={() => setYamlOpen(false)} onCopy={copyYaml}></YamlDrawer> : null}

      {modal === "deleteSubscription" ? (
        <Modal title="删除订阅源" onClose={() => { setModal(null); setPendingSubscriptionId(null); }} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => { setModal(null); setPendingSubscriptionId(null); }}>取消</button><button type="button" className="button danger-button" onClick={confirmDeleteSubscription}>删除</button></React.Fragment>}>
          <p className="confirm-copy">确定删除“{subscriptions.find((subscription) => subscription.id === pendingSubscriptionId)?.subName || "未命名订阅源"}”吗？</p>
        </Modal>
      ) : null}

      {modal === "newGroup" ? (
        <Modal title="新建策略组" onClose={() => setModal(null)} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => setModal(null)}>取消</button><button type="button" className="button primary" onClick={createGroup}><Icon name="plus" size={15}></Icon>创建策略组</button></React.Fragment>}>
          <div className="modal-form">
            <label className="field"><span>策略组名称</span><input autoFocus value={newGroup.name} onChange={(event) => setNewGroup((current) => ({ ...current, name: event.target.value }))} placeholder="例如：学术资源"></input></label>
            <label className="field"><span>策略类型</span><select value={newGroup.type} onChange={(event) => setNewGroup((current) => ({ ...current, type: event.target.value }))}><option value="select">手动选择（select）</option><option value="url-test">自动测速（url-test）</option><option value="fallback">故障转移（fallback）</option><option value="load-balance">负载均衡（load-balance）</option></select></label>
          </div>
        </Modal>
      ) : null}

      {modal === "newRule" ? (
        <Modal title="添加路由规则" onClose={() => setModal(null)} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => setModal(null)}>取消</button><button type="button" className="button primary" onClick={createRule}><Icon name="plus" size={15}></Icon>添加到规则列表</button></React.Fragment>}>
          <div className="modal-form">
            <div className="form-grid two-columns">
              <label className="field"><span>匹配类型</span><select value={newRule.type} onChange={(event) => setNewRule((current) => ({ ...current, type: event.target.value, value: event.target.value === "MATCH" ? "" : current.value }))}><option value="DOMAIN-SUFFIX">域名后缀</option><option value="DOMAIN">完整域名</option><option value="DOMAIN-KEYWORD">域名关键词</option><option value="IP-CIDR">IP 网段</option><option value="RULE-SET">规则集</option><option value="PROCESS-NAME">进程名称</option><option value="GEOIP">国家 / 地区</option><option value="MATCH">最终兜底</option></select></label>
              <label className="field"><span>规则集合</span><select value={newRule.category} onChange={(event) => setNewRule((current) => ({ ...current, category: event.target.value }))}>{RULE_CATEGORIES.filter((category) => category.id !== "all").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            </div>
            <label className="field"><span>匹配内容</span><input disabled={newRule.type === "MATCH"} value={newRule.value} onChange={(event) => setNewRule((current) => ({ ...current, value: event.target.value }))} placeholder={newRule.type === "RULE-SET" ? "例如：OpenAI" : newRule.type === "IP-CIDR" ? "例如：10.0.0.0/8" : newRule.type === "MATCH" ? "MATCH 不需要匹配内容" : "例如：example.com"}></input></label>
            <label className="field"><span>目标策略组</span><select value={newRule.targetGroupId} onChange={(event) => setNewRule((current) => ({ ...current, targetGroupId: event.target.value }))}>{groups.filter((group) => group.enabled).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="checkbox-row"><input type="checkbox" checked={newRule.noResolve} disabled={newRule.type === "MATCH"} onChange={(event) => setNewRule((current) => ({ ...current, noResolve: event.target.checked }))}></input><span><strong>添加 no-resolve</strong></span></label>
          </div>
        </Modal>
      ) : null}

      {modal === "newProvider" ? (
        <Modal title="新建规则提供者" onClose={() => setModal(null)} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => setModal(null)}>取消</button><button type="button" className="button primary" onClick={createProvider}>创建提供者</button></React.Fragment>}>
          <div className="modal-form">
            <div className="form-grid two-columns"><label className="field"><span>名称</span><input value={newProvider.name} onChange={(event) => setNewProvider((current) => ({ ...current, name: event.target.value }))} placeholder="例如：GitHub"></input></label><label className="field"><span>行为模式</span><select value={newProvider.behavior} onChange={(event) => setNewProvider((current) => ({ ...current, behavior: event.target.value }))}><option value="classical">classical</option><option value="domain">domain</option><option value="ipcidr">ipcidr</option></select></label></div>
            <label className="field"><span>下载地址</span><input value={newProvider.url} onChange={(event) => setNewProvider((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com/rules.yaml"></input></label>
            <label className="field"><span>更新间隔（秒）</span><input type="number" value={newProvider.interval} onChange={(event) => setNewProvider((current) => ({ ...current, interval: Number(event.target.value) }))}></input></label>
          </div>
        </Modal>
      ) : null}

      {modal === "import" ? (
        <Modal title="从 YAML 导入" size="large" onClose={() => setModal(null)} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => setModal(null)}>取消</button><button type="button" className="button primary" onClick={confirmImport}><Icon name="import" size={15}></Icon>解析并导入草稿</button></React.Fragment>}>
          <label className="field"><span>Clash YAML</span><textarea className="import-textarea full-import-textarea" value={importYamlText} onChange={(event) => setImportYamlText(event.target.value)} spellCheck="false"></textarea></label>
        </Modal>
      ) : null}

      {modal === "publish" ? (
        <Modal title="发布路由配置" subtitle={`新版本 r${revision + 1}`} onClose={() => setModal(null)} footer={<React.Fragment><button type="button" className="button ghost" onClick={() => setModal(null)}>取消</button><button type="button" className="button primary" onClick={confirmPublish}><Icon name="upload" size={15}></Icon>确认发布</button></React.Fragment>}>
          <div className="publish-summary">
            <div className="publish-counts"><div><strong>{groups.filter((group) => group.enabled).length}</strong><span>策略组</span></div><div><strong>{rules.filter((rule) => rule.enabled).length}</strong><span>路由规则</span></div><div><strong>{providers.filter((provider) => provider.enabled).length}</strong><span>规则提供者</span></div></div>
          </div>
        </Modal>
      ) : null}

      <Toast toast={toast}></Toast>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App></App>);
