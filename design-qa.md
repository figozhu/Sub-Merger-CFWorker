# SubMerger Console 设计验收记录

## 验收范围

- 需求基线：`designs/submerger-console/development-requirements.md`
- 交互原型：`designs/submerger-console/submerger-console-prototype.html`
- 页面：登录、订阅源、自建节点、路由配置、订阅输出
- 桌面视口：1280 × 720，设备像素比 1
- 字体反馈复核视口：2560 × 1271，设备像素比 1
- 移动视口：390 × 844，设备像素比 1

## 同状态视觉对照

桌面端参考图与实现图均由同一内置浏览器、同一视口、同一业务数据状态采集。每个对照图左侧为原型，右侧为实现。

| 页面 | 参考图 | 实现图 | 并排对照 |
| --- | --- | --- | --- |
| 登录 | `designs/submerger-console/reference-login-1280x720.png` | `designs/submerger-console/implementation-login-1280x720.png` | `designs/submerger-console/qa-login-comparison-1280x720.png` |
| 订阅源 | `designs/submerger-console/reference-dashboard-1280x720.png` | `designs/submerger-console/implementation-dashboard-1280x720.png` | `designs/submerger-console/qa-dashboard-comparison-1280x720.png` |
| 自建节点 | `designs/submerger-console/reference-nodes-1280x720.png` | `designs/submerger-console/implementation-nodes-1280x720.png` | `designs/submerger-console/qa-nodes-comparison-1280x720.png` |
| 路由配置 | `designs/submerger-console/reference-routing-1280x720.png` | `designs/submerger-console/implementation-routing-1280x720.png` | `designs/submerger-console/qa-routing-comparison-1280x720.png` |
| 订阅输出 | `designs/submerger-console/reference-links-1280x720.png` | `designs/submerger-console/implementation-links-1280x720.png` | `designs/submerger-console/qa-links-comparison-1280x720.png` |

移动端实现证据：

- `designs/submerger-console/implementation-dashboard-390x844.png`
- `designs/submerger-console/implementation-mobile-menu-390x844.png`
- `designs/submerger-console/implementation-links-390x844.png`
- `designs/submerger-console/audit-routing-mobile-after.png`

本轮字体与规则备注反馈证据：

- 修改前用户截图：`designs/submerger-console/audit-routing-before-font-scale.png`
- 修改后同尺寸截图：`designs/submerger-console/audit-routing-after-font-scale-2560x1271.png`
- 修改前后并排对照：`designs/submerger-console/qa-font-scale-comparison.png`
- 路由规则备注列：`designs/submerger-console/audit-routing-rules-after-2560x1271.png`

## 对照迭代记录

1. 首轮发现登录页密码显隐文字折行、路由编辑器文字操作按钮过窄；调整按钮最小宽度、内边距和不换行规则。
2. 第二轮发现迁移生成的草稿在未手工修改时无法直接保存；允许迁移草稿首次落盘，同时继续保持普通未修改草稿按钮禁用。
3. 移动端验收发现导航按钮缺少展开状态；补充 `aria-expanded`、动态可访问名称和统一侧栏开关逻辑。
4. 最终并排对照确认页面结构、色彩、间距、面板层级、表格、深色 JSON 编辑器和三栏路由工作区均与原型一致；真实数据数量与原型演示数量不同的部分按实际配置展示。
5. 根据用户反馈统一放大导航、标题、标签、表格、表单、检查面板与说明文字；2560 × 1271 和 390 × 844 下所有可见正文均不低于 11px，基础正文为 14px，移动端菜单为 12px。
6. 修复规则表复选框受通用输入框高度影响的问题，复核尺寸为 18 × 18px；桌面和移动端均无页面级横向溢出。
7. 使用完整 YAML 分别执行失败和成功导入：失败时列出全部不受支持字段且保留当前草稿；成功时拆分为 1 个策略组、2 条规则、1 个规则提供者和 1 个基础字段，并自动重新校验。
8. 验证规则上一行注释导入为备注、备注编辑状态绑定、备注随 YAML 生成并可再次导入；旧配置中的首条和后续规则注释均能回填。

## 功能与交互验收

- 登录：错误密码 API 返回 401；Cookie 包含 HttpOnly、Secure、SameSite；密码显隐与回车提交正常。
- 订阅源：新增、编辑、类型切换、删除、保存、脏状态与两类缓存清理正常。
- 自建节点：JSON 实时解析、无效格式阻断、重复名称阻断、格式化、保存及未知协议字段保留正常。
- 路由配置：旧配置迁移、策略组/规则/规则提供者/YAML 页签、引用保护、校验、草稿保存、确认发布、修订冲突和正式缓存清理正常。
- 完整 YAML 导入：按 `proxy-groups`、`rules`、`rule-providers`、基础字段四区拆分；`proxies` 明确忽略；无法无损表达的字段逐项报错且不会覆盖草稿。
- 规则备注：界面可新增、搜索和编辑；导出为规则上一行注释，导入时从紧邻上一行注释恢复；无 `remark` 的旧 KV 数据兼容。
- 订阅输出：按当前域名、MAGIC 与真实订阅源数量生成两类链接，复制交互正常。
- 原公开端点：magic 校验、流量头、下载文件名、普通/Stash 分流、缓存路径和无配置提示保持兼容。
- 响应式：390 × 844 下页面级横向溢出为 false；订阅表格使用局部横向滚动，侧栏抽屉可打开、切换并关闭。
- 浏览器日志：登录、桌面控制台和移动控制台均无运行时错误。

## 自动化验证

- `pnpm run typecheck`
- `pnpm test`（7 个测试文件，29 个测试）
- `pnpm run test:compat`（1 个兼容测试文件，5 个测试）
- `pnpm run build`（Wrangler dry-run 构建成功）

## 最终结果

final result: passed
