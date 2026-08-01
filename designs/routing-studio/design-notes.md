# 路由工作室：方案与设计说明

## 1. 现状与核心问题

当前配置链路有三个耦合点：

1. 策略组、节点筛选器和组间引用硬编码在 `generateProxyConfigYaml.ts`，增加或调整分组都需要改代码、测试并重新发布 Worker。
2. 通用 Clash 与 Stash 分别维护一套几乎相同的逻辑，容易出现分支漂移。
3. 规则提供者、路由规则与策略组的名称引用混在整段 YAML 中，控制台无法可靠校验依赖；但 DNS、端口、TUN、嗅探等客户端配置本身适合继续用原始 YAML 维护，没有必要被拆成一套不完整的表单模型。

这不是单纯的 UI 问题。若只把文本框换成表格，策略组名称仍会成为脆弱的“外键”，重命名后规则依然可能失效。

## 2. 推荐的配置模型

引入版本化的 `RoutingConfigV2`，所有关系使用稳定 ID，最终生成 YAML 时才解析成显示名称。

```ts
interface RoutingConfigV2 {
  schemaVersion: 2;
  revision: number;
  groups: PolicyGroup[];
  nodeSelectors: NodeSelector[];
  ruleProviders: RuleProvider[];
  rules: RoutingRule[];
  yamlTemplate: string;
  updatedAt: string;
}

interface PolicyGroup {
  id: string;
  name: string;
  type: "select" | "url-test" | "fallback" | "load-balance";
  enabled: boolean;
  members: Array<
    | { kind: "selector"; selectorId: string }
    | { kind: "group"; groupId: string }
    | { kind: "builtin"; value: "DIRECT" | "REJECT" | "PASS" }
  >;
  healthCheck?: {
    url: string;
    interval: number;
    tolerance?: number;
  };
}

interface NodeSelector {
  id: string;
  name: string;
  source: "all" | "subscription" | "self";
  includePattern: string;
  excludePattern?: string;
}

interface RoutingRule {
  id: string;
  enabled: boolean;
  categoryId: string;
  type: string;
  value?: string;
  targetGroupId: string;
  noResolve?: boolean;
}
```

关键收益：

- 策略组可以改名，规则不会断开。
- 节点筛选器可以复用，不再为每个分组增加一对环境变量。
- 普通 Clash 与 Stash 共用一个编译管线，仅在末端应用客户端能力过滤。
- 可以在发布前构建依赖图，发现循环引用、缺失目标和无效正则。

配置边界保持明确：可视化编辑器拥有 `proxies`、`proxy-groups`、`rule-providers`、`rules` 四个受管字段；其余顶层字段全部保留在一份 `yamlTemplate` 中。DNS 只是模板中的普通顶层字段，不再拥有特殊的数据模型或独立页签。

## 3. 编译与校验流程

建议将当前生成器拆成四层：

1. `loadRoutingConfig`：读取已发布的 `RoutingConfigV2`，没有则执行旧配置迁移。
2. `resolveNodeSelectors`：对订阅节点、自建节点与客户端能力做一次统一过滤，得到 `selectorId -> nodes` 映射。
3. `compileProxyGroups`：按成员顺序解析内置策略、其它策略组与节点筛选器；统一去重。
4. `mergeYamlTemplateAndGeneratedConfig`：解析 YAML 模板、拒绝模板中的受管字段，再注入生成的节点、策略组、规则提供者与路由规则，最后由 `yaml` 库统一序列化。

发布前至少校验：

- 策略组名称为空或重复。
- 正则表达式无效。
- 策略组之间存在循环引用。
- 规则目标策略组不存在或已停用。
- `RULE-SET` 引用的规则提供者不存在或已停用。
- 启用的 `MATCH` 不是最后一条规则。
- 策略组编译后为空。
- URL、健康检查参数和规则提供者格式无效。
- YAML 模板出现 `proxies`、`proxy-groups`、`rule-providers` 或 `rules`，与可视化生成结果发生所有权冲突。

## 4. API 与发布模型

建议增加独立 API，避免继续扩张现有 `/api/config`：

| API | 用途 |
| --- | --- |
| `GET /api/routing-config` | 获取草稿、已发布版本和节点样本摘要 |
| `PUT /api/routing-config/draft` | 保存草稿，不影响订阅输出 |
| `POST /api/routing-config/validate` | 服务端执行完整校验与编译预演 |
| `POST /api/routing-config/import` | 将旧 YAML 解析成结构化草稿 |
| `GET /api/routing-config/preview?client=normal` | 获取通用 Clash 输出预览 |
| `GET /api/routing-config/preview?client=stash` | 获取 Stash 输出预览 |
| `POST /api/routing-config/publish` | 创建不可变修订并切换生效版本 |

KV 推荐采用修订号而不是“保存后删除固定缓存键”：

```text
${TABLENAME}:routing:draft
${TABLENAME}:routing:active-revision
${TABLENAME}:routing:revision:19
${TABLENAME}:${KEY_VERSION}:19:cacheObj:${SubscriptionType}
```

发布时先写入 `revision:19`，校验成功后再更新 `active-revision`。订阅缓存键包含修订号，避免主动删除遗漏，也便于快速回滚。

## 5. 兼容迁移

1. 第一次打开路由工作室时，读取当前硬编码分组、环境变量筛选器与 `defaultYaml`。
2. 用 `yaml` 库提取 `proxy-groups`、`rule-providers` 与 `rules`，转换为带稳定 ID 的结构化配置。
3. 删除这三个受管字段以及旧数据中的 `proxies` 后，将所有剩余顶层字段原样序列化成一份 YAML 模板，不再区分“基础配置”和“高级 YAML”。
4. 显示导入摘要与警告，用户确认后只保存为草稿。
5. 第一次发布 V2 后切换 `active-revision`；旧 `/api/config` 数据保留一个迁移周期，可随时回滚。

不建议在浏览器中直接完成最终校验。浏览器负责即时反馈，服务端必须用同一套 schema 和编译器再次校验，避免前后端规则不一致。

## 6. UI 信息架构

原型采用四个工作区：

1. **策略组**：左侧选择分组，中间编辑成员来源与健康检查，右侧实时查看依赖、匹配节点数和校验结果。
2. **路由规则**：按业务集合筛选，规则行可拖动排序，类型、匹配内容与目标策略直接编辑。
3. **规则提供者**：结构化维护名称、行为、URL 和更新间隔，并显示引用数量与连接测试。
4. **YAML 模板**：用一个原始 YAML 编辑器维护所有非受管顶层字段；左侧大纲只从文本中自动提取顶层键，用于定位与边界说明，不代表字段被表单化。

顶部明确区分“保存草稿”和“发布配置”。用户可以在不影响线上订阅的情况下反复编辑、校验和预览；发布时生成不可变修订。

## 7. 原型交互清单

- 搜索、选择、新建、复制和删除策略组。
- 修改组名、类型、启用状态和用途说明。
- 添加或删除节点筛选器、策略组引用和内置策略。
- 编辑正则筛选器与健康检查参数。
- 切换到路由规则，编辑目标策略、启用状态并拖动排序。
- 新建和删除路由规则。
- 新建、编辑和保护删除规则提供者。
- 编辑单一 YAML 模板，通过自动大纲定位顶层字段，并即时检查重复键、Tab 缩进和受管字段冲突。
- 查看通用 Clash / Stash YAML 预览并复制。
- 保存草稿、执行校验和模拟发布新修订。
- 从旧 YAML 导入并显示预检说明。

## 8. 视觉方向

- 延续现有蓝色识别，但减少渐变、 emoji 和大面积装饰。
- 使用深色主导航、白色工作面板和克制的靛蓝强调色，形成清晰的运维工作台层级。
- 通过三栏结构同时呈现“选择对象—编辑对象—检查影响”，减少在多个页面之间来回跳转。
- 以状态色表达校验结果，颜色不承担唯一信息，错误和警告都附带文字说明。

## 9. V2：策略组与分流合并

V2 将原来的“策略组”和“路由规则”一级工作区合并为“策略组与分流”。数据层仍保留全局有序的扁平规则数组，编辑层则以 `targetGroupId` 将规则放回所属策略组，避免用户在两个独立页面之间反复确认目标关系。

- 选择策略组后，默认直接进入该组的“分流规则”，组名、类型和输出条件始终保留在同一上下文。
- “成员与检测”作为组内二级页签存在，不与分流规则争夺一级导航。
- 规则列表默认只显示当前策略组；“全局顺序”仍可检查最终 YAML 的真实顺序和跨组目标。
- 选中规则后集中显示“上方插入、下方插入、复制、上移、下移、删除”，降低重复配置时的操作成本。
- 新建和插入规则自动继承当前策略组；复制项紧邻原记录出现，并自动成为当前选中项。
- `MATCH` 继续作为全局兜底规则受到保护：不可复制，插入到其下方时会自动调整到其上方。
- 桌面端保留三栏工作台；移动端按“策略组列表—组信息—组内配置—检查结果”纵向排列，规则字段改为单列且操作栏可横向滚动。
