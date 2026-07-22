# Sub-Merger-CFWorker
基于CF Worker的Clash系软件的订阅合并，增加分流配置

优势：
 - 无论订阅地址是否被墙，CF的节点都是可以去拉取的
 - 你的Worker绑一个没被墙的域名，就可以无需代理更新订阅配置了


新版控制台支持在网页中维护订阅源、自建节点、策略组、规则提供者、路由规则和基础 YAML 模板。首次部署不会自动改变现有订阅输出；管理员需要在“路由配置”中检查迁移草稿并主动发布，新动态生成器才会生效。

关于Clash中流量和有效期的显示：
 - 流量是所有订阅源返回的数据累加起来的
 - 有效期是所有订阅源中返回的最早的到期时间



# 消费降级，性价比机场推荐

原来使用一年200多的机场（每个月才50G流量），现在发现一年12元，13元的机场也挺好用，还有一些稍微贵一些（4块，5块一个月，但大多都有300G、500G的流量）





| 机场名       | 价格                                                  | 注册网址                    | 特色               |
| ------------ | ----------------------------------------------------- | --------------------------- | ------------------ |
| 【强烈推荐】SOS加速器     | ￥50/一次性（150G/100Mbps），￥19.7/70G/50Mbps/月，￥39.7/300G/300Mbps/月 | [SOS加速器网址](https://www.sosjsq.com/index.php#/register?code=mmjIjIBx) | 有一次性流量包，价格稍微有点高，但速度是真快，39.7那档说是300Mbps，我实测能到500Mbps |
| 69云     | ￥16.8/一次性（50G），￥6.9/100G/月 | [69云网址](https://69yun69.com/auth/register?code=fobiQj) | 有一次性流量包，每天签到可以增加流量 |
| 网际快车     | ￥6.8/一次性（20G），￥24/60G/天【1800G/月】 | [网际快车网址](https://wjkc66.vip?c=BFQCSK) | 有一次性流量包，每天签到可以增加流量 |
| 宝可梦星云 | ￥19.9/180G/月，￥39.9/211G/一次性 | [宝可梦网址](https://love.52pokemon.cc/register?code=TWFWZ7Vd) | 有一次性流量包，每个月有免费的包月体验套餐，有IPLC线路 |




# 本地开发、调试

1. 安装依赖
```
pnpm install

```


2. 启动本地服务器

```
pnpm run dev
```

3. 运行质量检查

```bash
pnpm run typecheck
pnpm run test
pnpm run test:compat
pnpm run build
```

## 新版控制台与 KV

新版控制台继续保留 `${TABLENAME}` 作为订阅源数组，并新增以下独立键：

| KV 键 | 用途 |
| --- | --- |
| `${TABLENAME}:self-nodes` | 自建节点原始 JSON 与更新时间 |
| `${TABLENAME}:routing:draft` | 最近保存的路由草稿；不影响正式订阅 |
| `${TABLENAME}:routing:published` | 当前已发布路由配置与修订号 |
| `${TABLENAME}:config` | 升级期兼容旧自建节点和默认 YAML |

保存订阅源、保存自建节点或发布路由配置后，会清除包年包月和流量包的两个现有缓存键。保存草稿、校验和完整输出预览不会清理正式缓存。

### 完整 YAML 导入与规则备注

- “导入 YAML”会把一份完整配置拆分为策略组（`proxy-groups`）、路由规则（`rules`）、规则提供者（`rule-providers`）和其余基础 YAML。节点列表（`proxies`）不由路由配置维护，导入时会忽略。
- 导入采用完整校验：当前可视化模型无法无损表达的策略组或规则提供者字段会逐项提示，存在错误时不会覆盖当前草稿。
- 路由规则的“备注”会导出为该规则上一行的 YAML 注释；导入时，该规则紧邻上一行的注释会回填到备注字段。旧 KV 数据没有 `remark` 字段时仍可正常读取。

### 迁移步骤

1. 部署新代码，但暂不发布路由配置；公开订阅端点仍走旧硬编码生成器。
2. 登录控制台并进入“路由配置”，系统会从旧 `defaultYaml`、硬编码策略组和两套环境正则生成内存迁移草稿。
3. 检查通用/Stash、包年包月/流量包四种完整输出，完成服务端校验。
4. 保存草稿并主动发布。发布成功后修订号递增，动态生成器开始生效。

### 回退方法

删除或停用 `${TABLENAME}:routing:published` 键即可立即回到旧生成路径。该操作不会删除草稿、订阅源、`${TABLENAME}:config` 或新版自建节点数据。建议保留旧路径至少一个完整发布和定时刷新周期。

### 已知限制

- 完整输出预览会实时拉取已保存订阅源，耗时取决于上游响应。
- 自动测试会验证 Stash YAML 结构和当前过滤行为，但最终客户端兼容仍建议在真实 Stash 设备上导入一次。
- 本仓库不包含 Mihomo/Clash 二进制，因此本地测试不会执行 `mihomo -t`。


# 部署到CF

1. 把`wrangler.toml.template`复制为`wrangler.toml`，并修改其中的配置


2. 推送到CF
```
pnpm run deploy
```

# 定时任务
默认1小时更新一次，保存到缓存中

通过合并地址拉取时，访问间隔在5分钟之外的，自动读取缓存；在5分钟之内的，强制重新从订阅源拉取


# DB说明

## KV
使用了KV，绑定名必须是`SUB_MERGER_KV`


# 环境变量说明


| 变量名 | 说明 |
|--------|------|
| PASSWORD | 登录密码 |
| SALT | 密码加密盐值 |
| TABLENAME | KV存储表名（前缀） |
| MAGIC | 订阅链接中的魔法字符串 |
| UA | 请求订阅时使用的User-Agent |
| BARK_OPENID | Bark 通知的 openid |
| EXCLUDE_PATTERN | 排除节点的正则表达式 |
| OTHER_MATCH_PATTERN | 需要的其他类型节点的正则表达式 |
| FALLBACK_MATCH_PATTERN | 需要的Fallback节点的正则表达式 |
| YOUTUBE_MATCH_PATTERN | 需要的YouTube节点的正则表达式 |
| EMBY_MATCH_PATTERN | 需要的EMBY节点的正则表达式 |
| TWITTER_MATCH_PATTERN | 需要的Twitter节点的正则表达式 |
| TELEGRAM_MATCH_PATTERN | 需要的Telegram节点的正则表达式 |
| STEAM_MATCH_PATTERN | 需要的Steam节点的正则表达式 |
| OTHER_EXCLUDE_PATTERN | 排除的其他类型节点的正则表达式 |
| FALLBACK_EXCLUDE_PATTERN | 排除的Fallback节点的正则表达式 |
| YOUTUBE_EXCLUDE_PATTERN | 排除的YouTube节点的正则表达式 |
| EMBY_EXCLUDE_PATTERN | 排除的EMBY节点的正则表达式 |
| TWITTER_EXCLUDE_PATTERN | 排除的Twitter节点的正则表达式 |
| TELEGRAM_EXCLUDE_PATTERN | 排除的Telegram节点的正则表达式 |
| STEAM_EXCLUDE_PATTERN | 排除的Steam节点的正则表达式 |
| INSTANT_REFRESH_INTERVAL | 获取订阅内容不使用缓存的请求间隔（秒） |

