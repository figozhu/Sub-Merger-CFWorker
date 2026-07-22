/**
 * 路由工作室原型的初始策略组数据。
 *
 * 说明：真实实现中应由 `/api/routing-config` 返回这些对象；原型使用静态数据，
 * 用于演示稳定 ID、节点筛选器、策略组引用和内置策略之间的关系。
 */
const INITIAL_GROUPS = [
  {
    id: "group-other",
    name: "其它流量",
    type: "select",
    enabled: true,
    description: "未命中专用规则时的默认代理入口",
    color: "indigo",
    matchedCount: 3,
    sources: [
      { id: "src-other-self", kind: "group", groupId: "group-self", label: "自建节点" },
      { id: "src-other-relay", kind: "group", groupId: "group-relay", label: "中转代理" },
      { id: "src-other-ai", kind: "group", groupId: "group-ai", label: "海外 AI" }
    ]
  },
  {
    id: "group-self",
    name: "自建节点",
    type: "select",
    enabled: true,
    description: "仅包含控制台维护的自建代理节点",
    color: "cyan",
    matchedCount: 4,
    sources: [
      { id: "src-self", kind: "filter", source: "self", include: ".*", exclude: "", label: "自建节点源" }
    ]
  },
  {
    id: "group-airport",
    name: "机场节点",
    type: "select",
    enabled: true,
    description: "来自订阅源且通过全局排除条件的节点",
    color: "slate",
    matchedCount: 28,
    sources: [
      { id: "src-airport", kind: "filter", source: "subscription", include: ".*", exclude: "到期|剩余|官网", label: "全部机场节点" }
    ]
  },
  {
    id: "group-relay",
    name: "中转代理",
    type: "select",
    enabled: true,
    description: "香港、新加坡等低延迟中转节点",
    color: "blue",
    matchedCount: 12,
    sources: [
      { id: "src-relay", kind: "filter", source: "all", include: "香港|新加坡|HK|SG", exclude: "家宽|实验", label: "区域筛选器" }
    ]
  },
  {
    id: "group-ai",
    name: "海外AI",
    type: "select",
    enabled: true,
    description: "面向 OpenAI、Claude 与 Gemini 的稳定出口",
    color: "violet",
    matchedCount: 8,
    sources: [
      { id: "src-ai", kind: "filter", source: "all", include: "美国|日本|新加坡|US|JP|SG", exclude: "香港|HK", label: "AI 可用区域" },
      { id: "src-ai-fallback", kind: "group", groupId: "group-fallback", label: "故障转移" }
    ]
  },
  {
    id: "group-telegram",
    name: "IM-Telegram",
    type: "select",
    enabled: true,
    description: "Telegram 即时通信专用策略",
    color: "cyan",
    matchedCount: 9,
    sources: [
      { id: "src-tg-other", kind: "group", groupId: "group-other", label: "其它流量" },
      { id: "src-tg", kind: "filter", source: "all", include: "Telegram|TG|新加坡", exclude: "", label: "Telegram 节点" }
    ]
  },
  {
    id: "group-whatsapp",
    name: "IM-WhatsApp",
    type: "select",
    enabled: true,
    description: "WhatsApp 即时通信专用策略",
    color: "green",
    matchedCount: 7,
    sources: [
      { id: "src-wa-other", kind: "group", groupId: "group-other", label: "其它流量" },
      { id: "src-wa", kind: "filter", source: "all", include: "WhatsApp|美国|US", exclude: "", label: "WhatsApp 节点" }
    ]
  },
  {
    id: "group-media",
    name: "海外媒体",
    type: "url-test",
    enabled: true,
    description: "自动选择可流畅播放海外流媒体的节点",
    color: "pink",
    matchedCount: 10,
    testUrl: "https://www.gstatic.com/generate_204",
    interval: 600,
    tolerance: 80,
    sources: [
      { id: "src-media", kind: "filter", source: "all", include: "Netflix|YouTube|媒体|美国|日本", exclude: "倍数", label: "流媒体节点" }
    ]
  },
  {
    id: "group-binance",
    name: "币安",
    type: "select",
    enabled: true,
    description: "数字资产服务的指定出口",
    color: "amber",
    matchedCount: 6,
    sources: [
      { id: "src-binance", kind: "filter", source: "all", include: "台湾|日本|新加坡|TW|JP|SG", exclude: "香港|美国", label: "合规区域" }
    ]
  },
  {
    id: "group-steam",
    name: "GameSteam",
    type: "select",
    enabled: true,
    description: "Steam 国际内容与游戏下载策略",
    color: "blue",
    matchedCount: 15,
    sources: [
      { id: "src-steam", kind: "filter", source: "all", include: "游戏|Steam|香港|日本", exclude: "", label: "游戏节点" }
    ]
  },
  {
    id: "group-emby",
    name: "EMBY",
    type: "select",
    enabled: true,
    description: "Emby 公益服与媒体站点专用策略",
    color: "pink",
    matchedCount: 11,
    sources: [
      { id: "src-emby", kind: "filter", source: "all", include: "EMBY|媒体|香港|新加坡", exclude: "", label: "Emby 节点" }
    ]
  },
  {
    id: "group-fallback",
    name: "故障转移",
    type: "fallback",
    enabled: true,
    description: "主节点不可用时自动切换到下一个可用节点",
    color: "orange",
    matchedCount: 5,
    testUrl: "https://www.gstatic.com/generate_204",
    interval: 1800,
    sources: [
      { id: "src-fallback", kind: "filter", source: "all", include: "专线|IEPL|IPLC", exclude: "实验", label: "高可用节点" }
    ]
  },
  {
    id: "group-direct",
    name: "直接连接",
    type: "select",
    enabled: true,
    description: "不经过代理，直接访问目标服务",
    color: "green",
    matchedCount: 1,
    sources: [
      { id: "src-direct", kind: "builtin", value: "DIRECT", label: "DIRECT" }
    ]
  }
];

/**
 * 原型中的规则分类。分类只负责界面组织，不影响 Clash 最终规则语义。
 */
const RULE_CATEGORIES = [
  { id: "all", name: "全部规则", count: 14 },
  { id: "system", name: "基础与系统", count: 4 },
  { id: "ai", name: "AI 服务", count: 5 },
  { id: "media", name: "媒体与娱乐", count: 2 },
  { id: "finance", name: "数字资产", count: 1 },
  { id: "fallback", name: "兜底规则", count: 2 }
];

/**
 * 路由规则初始数据。targetGroupId 使用稳定 ID，避免策略组改名后规则失效。
 */
const INITIAL_RULES = [
  { id: "rule-jsdelivr", enabled: true, category: "system", type: "DOMAIN-SUFFIX", value: "fastly.jsdelivr.net", targetGroupId: "group-direct", noResolve: true, note: "规则集下载地址" },
  { id: "rule-openai", enabled: true, category: "ai", type: "RULE-SET", value: "OpenAI", targetGroupId: "group-ai", noResolve: true, note: "OpenAI 服务" },
  { id: "rule-gemini", enabled: true, category: "ai", type: "RULE-SET", value: "Gemini", targetGroupId: "group-ai", noResolve: true, note: "Gemini 服务" },
  { id: "rule-anthropic", enabled: true, category: "ai", type: "RULE-SET", value: "Anthropic", targetGroupId: "group-ai", noResolve: true, note: "Anthropic 服务" },
  { id: "rule-claude", enabled: true, category: "ai", type: "RULE-SET", value: "Claude", targetGroupId: "group-ai", noResolve: true, note: "Claude 服务" },
  { id: "rule-google", enabled: true, category: "ai", type: "RULE-SET", value: "Google", targetGroupId: "group-ai", noResolve: true, note: "Google AI 相关服务" },
  { id: "rule-youtube", enabled: true, category: "media", type: "RULE-SET", value: "Youtube", targetGroupId: "group-media", noResolve: true, note: "YouTube 媒体" },
  { id: "rule-twitter", enabled: true, category: "media", type: "RULE-SET", value: "Twitter", targetGroupId: "group-media", noResolve: true, note: "Twitter / X" },
  { id: "rule-figma", enabled: true, category: "system", type: "DOMAIN-SUFFIX", value: "figma.com", targetGroupId: "group-direct", noResolve: true, note: "设计工具直连" },
  { id: "rule-binance", enabled: true, category: "finance", type: "RULE-SET", value: "Binance", targetGroupId: "group-binance", noResolve: true, note: "币安规则集" },
  { id: "rule-steam-cn", enabled: true, category: "system", type: "RULE-SET", value: "SteamCN", targetGroupId: "group-direct", noResolve: true, note: "Steam 国内服务" },
  { id: "rule-steam", enabled: true, category: "media", type: "RULE-SET", value: "Steam", targetGroupId: "group-steam", noResolve: true, note: "Steam 国际服务" },
  { id: "rule-direct", enabled: true, category: "fallback", type: "RULE-SET", value: "direct", targetGroupId: "group-direct", noResolve: true, note: "直连规则集" },
  { id: "rule-match", enabled: true, category: "fallback", type: "MATCH", value: "", targetGroupId: "group-other", noResolve: false, note: "最终兜底，必须位于末尾" }
];

/**
 * 规则提供者初始数据，用于演示结构化增删改和引用状态。
 */
const INITIAL_PROVIDERS = [
  { id: "provider-openai", name: "OpenAI", behavior: "classical", url: "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI/OpenAI.yaml", interval: 86400, enabled: true, refs: 1 },
  { id: "provider-gemini", name: "Gemini", behavior: "classical", url: "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Gemini/Gemini.yaml", interval: 86400, enabled: true, refs: 1 },
  { id: "provider-anthropic", name: "Anthropic", behavior: "classical", url: "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Anthropic/Anthropic.yaml", interval: 86400, enabled: true, refs: 1 },
  { id: "provider-youtube", name: "Youtube", behavior: "classical", url: "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/YouTube/YouTube.yaml", interval: 86400, enabled: true, refs: 1 },
  { id: "provider-binance", name: "Binance", behavior: "classical", url: "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Binance/Binance.yaml", interval: 86400, enabled: true, refs: 1 },
  { id: "provider-direct", name: "direct", behavior: "domain", url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt", interval: 86400, enabled: true, refs: 1 }
];

/**
 * 由可视化工作室负责生成的顶级 YAML 字段。
 *
 * 这些字段不能再次出现在用户模板中，否则会产生重复键或覆盖关系不明确的问题。
 */
const MANAGED_YAML_KEYS = ["proxies", "proxy-groups", "rules", "rule-providers"];

/**
 * 非路由部分的初始 YAML 模板。
 *
 * 端口、DNS、TUN、sniffer、profile 等字段均原样保留在同一个模板中；
 * 界面不再为其中任何一类字段建立特殊表单模型。
 */
const INITIAL_BASE_YAML = `# 基础 YAML 模板
# 除 proxies、proxy-groups、rules、rule-providers 外，均可在这里维护

mixed-port: 7890
allow-lan: false
mode: Rule
log-level: info
external-controller: 127.0.0.1:60000

dns:
  enable: true
  listen: ':53'
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  ipv6: true
  default-nameserver:
    - system
    - 223.6.6.6
    - 8.8.8.8
  nameserver:
    - 8.8.8.8
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4

profile:
  store-selected: true
  store-fake-ip: true
`;

/**
 * 对用户维护的 YAML 模板执行轻量结构分析。
 *
 * 原型只用于展示大纲和受管字段冲突；真实实现应复用项目现有的 `yaml` 包进行完整解析。
 * @param {string} yamlText YAML 模板文本。
 * @returns {object} 顶级字段、冲突、重复键和行数等分析结果。
 */
function analyzeYamlTemplate(yamlText) {
  const lines = String(yamlText || "").split("\n");
  const keys = [];
  const keyCounts = {};
  const syntaxHints = [];

  lines.forEach((line, index) => {
    if (line.includes("\t")) {
      syntaxHints.push({ line: index + 1, message: "YAML 缩进不应使用 Tab 字符" });
    }
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s|$)/);
    if (!match) return;
    const key = match[1];
    keys.push({ key, line: index + 1, kind: line.trim().endsWith(":") ? "section" : "value" });
    keyCounts[key] = (keyCounts[key] || 0) + 1;
  });

  const duplicates = Object.entries(keyCounts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  const managedConflicts = keys.filter((item) => MANAGED_YAML_KEYS.includes(item.key));

  return {
    lines,
    lineCount: lines.length,
    keys,
    duplicates,
    managedConflicts,
    syntaxHints,
    valid: duplicates.length === 0 && managedConflicts.length === 0 && syntaxHints.length === 0
  };
}

/**
 * 将任意字符串转换成适合展示在 YAML 中的安全值。
 * @param {string} value 原始字符串。
 * @returns {string} 已处理的 YAML 字符串。
 */
function quoteYamlValue(value) {
  const text = String(value ?? "");
  return /^[A-Za-z0-9_./:+|*?-]+$/.test(text) ? text : JSON.stringify(text);
}

/**
 * 校验策略组引用是否包含循环依赖。
 * @param {Array<object>} groups 所有策略组。
 * @returns {Array<object>} 检测到的循环依赖问题。
 */
function detectGroupCycles(groups) {
  const graph = new Map(groups.map((group) => [
    group.id,
    group.sources.filter((source) => source.kind === "group").map((source) => source.groupId)
  ]));
  const visiting = new Set();
  const visited = new Set();
  const issues = [];

  /**
   * 深度优先遍历单个策略组。
   * @param {string} groupId 当前策略组 ID。
   * @param {Array<string>} trail 当前访问路径。
   * @returns {void}
   */
  function visit(groupId, trail) {
    if (visiting.has(groupId)) {
      const cycleStart = trail.indexOf(groupId);
      const cycleIds = trail.slice(cycleStart).concat(groupId);
      const cycleNames = cycleIds.map((id) => groups.find((group) => group.id === id)?.name || id);
      issues.push({ level: "error", title: "策略组存在循环引用", detail: cycleNames.join(" → ") });
      return;
    }
    if (visited.has(groupId)) return;

    visiting.add(groupId);
    const nextIds = graph.get(groupId) || [];
    nextIds.forEach((nextId) => visit(nextId, trail.concat(groupId)));
    visiting.delete(groupId);
    visited.add(groupId);
  }

  groups.forEach((group) => visit(group.id, []));
  return issues;
}

/**
 * 对当前路由配置做发布前校验。
 * @param {Array<object>} groups 策略组列表。
 * @param {Array<object>} rules 路由规则列表。
 * @param {Array<object>} providers 规则提供者列表。
 * @param {string} yamlTemplate 非路由部分的 YAML 模板。
 * @returns {Array<object>} 包含错误、警告与建议的校验结果。
 */
function validateRoutingConfig(groups, rules, providers, yamlTemplate = "") {
  const issues = [];
  const groupIds = new Set(groups.map((group) => group.id));
  const enabledProviderNames = new Set(providers.filter((provider) => provider.enabled).map((provider) => provider.name));
  const nameCounts = groups.reduce((counts, group) => {
    counts[group.name] = (counts[group.name] || 0) + 1;
    return counts;
  }, {});

  Object.entries(nameCounts).forEach(([name, count]) => {
    if (count > 1) {
      issues.push({ level: "error", title: "策略组名称重复", detail: `“${name}” 出现 ${count} 次，Clash 要求名称唯一。` });
    }
  });

  groups.forEach((group) => {
    if (!group.sources.length) {
      issues.push({ level: "warning", title: `${group.name} 暂无成员`, detail: "该策略组生成后可能为空，请添加节点筛选器或其它策略组。" });
    }

    group.sources.forEach((source) => {
      if (source.kind === "group" && !groupIds.has(source.groupId)) {
        issues.push({ level: "error", title: `${group.name} 引用了不存在的策略组`, detail: source.groupId });
      }
      if (source.kind === "filter") {
        [source.include, source.exclude].filter(Boolean).forEach((pattern) => {
          try {
            new RegExp(pattern);
          } catch (error) {
            issues.push({ level: "error", title: `${group.name} 的正则表达式无效`, detail: `${pattern} · ${error.message}` });
          }
        });
      }
    });
  });

  rules.filter((rule) => rule.enabled).forEach((rule) => {
    if (!groupIds.has(rule.targetGroupId)) {
      issues.push({ level: "error", title: "规则目标策略组不存在", detail: `${rule.type} ${rule.value || ""}`.trim() });
    }
    if (rule.type === "RULE-SET" && !enabledProviderNames.has(rule.value)) {
      issues.push({ level: "warning", title: `规则提供者 ${rule.value} 未启用或不存在`, detail: "该 RULE-SET 规则发布后将无法加载。" });
    }
  });

  const enabledRules = rules.filter((rule) => rule.enabled);
  const matchIndex = enabledRules.findIndex((rule) => rule.type === "MATCH");
  if (matchIndex !== -1 && matchIndex !== enabledRules.length - 1) {
    issues.push({ level: "error", title: "MATCH 必须是最后一条启用规则", detail: "MATCH 之后的规则永远不会生效。" });
  }

  const templateAnalysis = analyzeYamlTemplate(yamlTemplate);
  templateAnalysis.managedConflicts.forEach((conflict) => {
    issues.push({ level: "error", title: `YAML 模板包含受管字段 ${conflict.key}`, detail: `第 ${conflict.line} 行与可视化配置生成结果冲突，请从模板中移除。` });
  });
  templateAnalysis.duplicates.forEach((duplicate) => {
    issues.push({ level: "error", title: `YAML 模板顶级字段 ${duplicate.key} 重复`, detail: `共出现 ${duplicate.count} 次，请合并为一个字段。` });
  });
  templateAnalysis.syntaxHints.forEach((hint) => {
    issues.push({ level: "error", title: "YAML 模板包含不安全缩进", detail: `第 ${hint.line} 行：${hint.message}` });
  });

  issues.push(...detectGroupCycles(groups));
  if (!issues.some((issue) => issue.level === "error")) {
    issues.unshift({ level: "success", title: "配置边界与依赖完整", detail: "YAML 模板未覆盖受管字段，路由引用和顺序检查也已通过。" });
  }
  return issues;
}

/**
 * 根据策略组、规则和提供者生成一段可读的 Clash YAML 预览。
 * @param {Array<object>} groups 策略组列表。
 * @param {Array<object>} rules 路由规则列表。
 * @param {Array<object>} providers 规则提供者列表。
 * @param {string} client 客户端类型，支持 normal 或 stash。
 * @param {string} yamlTemplate 非路由部分的 YAML 模板。
 * @returns {string} 生成后的 YAML 文本。
 */
function generateYamlPreview(groups, rules, providers, client, yamlTemplate = "") {
  const enabledGroups = groups.filter((group) => group.enabled);
  const groupById = new Map(enabledGroups.map((group) => [group.id, group]));
  const lines = [
    `# 由路由工作室生成 · ${client === "stash" ? "Stash" : "通用"}配置`,
    "# 当前为交互原型预览，不会修改线上数据",
    "",
    "# ── 用户维护的 YAML 模板 ──",
    ...String(yamlTemplate || "").trim().split("\n"),
    "",
    "# ── 订阅生成器自动维护 ──",
    "proxies:",
    "  - name: \"🇸🇬 新加坡 01\"",
    "    type: ss",
    "    server: sg.example.com",
    "    port: 443",
    "  - name: \"自建-SG-01\"",
    "    type: vmess",
    "    server: self.example.com",
    "    port: 443",
    "",
    "proxy-groups:"
  ];

  enabledGroups.forEach((group) => {
    lines.push(`  - name: ${quoteYamlValue(group.name)}`);
    lines.push(`    type: ${group.type}`);
    if (["url-test", "fallback"].includes(group.type)) {
      lines.push(`    url: ${quoteYamlValue(group.testUrl || "https://www.gstatic.com/generate_204")}`);
      lines.push(`    interval: ${group.interval || 600}`);
      if (group.type === "url-test") lines.push(`    tolerance: ${group.tolerance || 80}`);
    }
    lines.push("    proxies:");
    group.sources.forEach((source) => {
      if (source.kind === "builtin") lines.push(`      - ${source.value}`);
      if (source.kind === "group") lines.push(`      - ${quoteYamlValue(groupById.get(source.groupId)?.name || source.label)}`);
      if (source.kind === "filter") {
        lines.push(`      # 节点筛选：${source.label} · ${source.include || ".*"}`);
        const samples = source.source === "self"
          ? ["自建-SG-01", "自建-US-02"]
          : ["🇸🇬 新加坡 01", "🇯🇵 日本 02", "🇺🇸 美国 03"];
        samples.slice(0, 2).forEach((sample) => lines.push(`      - ${quoteYamlValue(sample)}`));
      }
    });
  });

  lines.push("", "rule-providers:");
  providers.filter((provider) => provider.enabled).forEach((provider) => {
    lines.push(`  ${quoteYamlValue(provider.name)}:`);
    lines.push("    type: http");
    lines.push(`    behavior: ${provider.behavior}`);
    lines.push(`    url: ${quoteYamlValue(provider.url)}`);
    lines.push(`    path: ./RuleSet/${provider.name}.yaml`);
    lines.push(`    interval: ${provider.interval}`);
  });

  lines.push("", "rules:");
  rules.filter((rule) => rule.enabled).forEach((rule) => {
    const targetName = groupById.get(rule.targetGroupId)?.name || rule.targetGroupId;
    const parts = rule.type === "MATCH"
      ? ["MATCH", targetName]
      : [rule.type, rule.value, targetName];
    if (rule.noResolve && rule.type !== "MATCH") parts.push("no-resolve");
    lines.push(`  - ${parts.map(quoteYamlValue).join(",")}`);
  });

  return lines.join("\n");
}

Object.assign(window, {
  INITIAL_GROUPS,
  RULE_CATEGORIES,
  INITIAL_RULES,
  INITIAL_PROVIDERS,
  MANAGED_YAML_KEYS,
  INITIAL_BASE_YAML,
  analyzeYamlTemplate,
  validateRoutingConfig,
  generateYamlPreview
});
