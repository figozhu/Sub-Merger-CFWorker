# Sub-Merger-CFWorker

将多个机场订阅、自建代理和 Tailscale 节点合并到一份订阅，在网页中统一管理节点与分流规则。部署在 Cloudflare Workers 上，无需维护服务器。

## 功能亮点

- **Cloudflare 代拉订阅**：由 Cloudflare 节点获取各机场的订阅，本地客户端只需访问合并后的订阅地址；机场需允许 Cloudflare 出口访问。
- **自定义域名，直连更新**：为 Worker 绑定一个本地可直接访问的域名，即可在不开代理时更新合并订阅。
- **机场与自建节点一起用**：把多个机场和自己的节点放进同一份配置，按地区、用途或服务分组。也可以只使用自建节点。
- **支持 Tailscale 节点**：将 Tailnet 中的设备或出口节点纳入分流，与机场、其他自建代理搭配使用；客户端需支持 Mihomo 的 `tailscale` 节点类型。
- **网页配置分流**：管理策略组、节点筛选、规则集和分流顺序，支持手动选择、自动测速、故障转移与负载均衡。
- **区分套餐类型**：包年/包月与流量包分别生成订阅链接，自建节点可与两类机场搭配。
- **更新失败保留节点**：定时获取机场订阅；临时失败时沿用上次成功的节点和流量信息，恢复后自动更新。
- **先预览，再发布**：支持导入 Clash YAML、保存草稿、检查配置和预览完整输出。发布后，客户端更新订阅即可使用。
- **集中查看诊断**：查看订阅拉取错误与客户端访问记录，也可以单独诊断某个机场。

## 消费降级，性价比机场推荐

原来使用一年200多的机场（每个月才50G流量），现在发现一年12元，13元的机场也挺好用，还有一些稍微贵一些（4块，5块一个月，但大多都有300G、500G的流量）

| 机场名       | 价格                                                  | 注册网址                    | 特色               |
| ------------ | ----------------------------------------------------- | --------------------------- | ------------------ |
| 【强烈推荐】SOS加速器     | ￥50/一次性（150G/100Mbps），￥19.7/70G/50Mbps/月，￥39.7/300G/300Mbps/月 | [SOS加速器网址](https://www.sosjsq.com/index.php#/register?code=mmjIjIBx) | 有一次性流量包，价格稍微有点高，但速度是真快，39.7那档说是300Mbps，我实测能到500Mbps |
| 69云     | ￥16.8/一次性（50G），￥6.9/100G/月 | [69云网址](https://69yun69.com/auth/register?code=fobiQj) | 有一次性流量包，每天签到可以增加流量 |
| 网际快车     | ￥6.8/一次性（20G），￥24/60G/天【1800G/月】 | [网际快车网址](https://wjkc66.vip?c=BFQCSK) | 有一次性流量包，每天签到可以增加流量 |
| 宝可梦星云 | ￥19.9/180G/月，￥39.9/211G/一次性 | [宝可梦网址](https://love.52pokemon.cc/register?code=TWFWZ7Vd) | 有一次性流量包，每个月有免费的包月体验套餐，有IPLC线路 |

## 开始使用

部署完成后，打开 Worker 地址并使用管理密码登录。

1. 在 **订阅源** 添加机场的 Clash YAML 订阅地址，选择套餐类型并保存。
2. 在 **自建节点** 添加自己的节点，保存 JSON 配置。
3. 在 **路由配置** 调整策略组成员和分流规则，预览、校验后点击 **发布**。
4. 在 **订阅输出** 复制对应套餐的链接，导入客户端。

机场节点会标注来源名称，自建节点会标注 `【自建】`，方便在客户端中区分。

## 自建节点与 Tailscale

自建节点使用 **JSON 数组**，每个节点需要一个不重复的 `name`。可添加 Shadowsocks、VMess、VLESS、Trojan、Hysteria2、Tailscale 等客户端支持的节点类型。

各协议字段见 [Mihomo 节点配置文档](https://wiki.metacubex.one/en/config/proxies/)。文档示例使用 YAML；将 `proxies` 下的节点列表转换为 JSON 数组后粘贴，无需保留外层 `proxies` 字段。

例如，将一个 Tailscale 节点加入订阅：

```json
[
  {
    "name": "我的 Tailnet",
    "type": "tailscale",
    "hostname": "mihomo-device",
    "auth-key": "替换为你的 Tailscale Auth Key",
    "accept-routes": true,
    "udp": true
  }
]
```

保存后，新建一个 Tailscale 策略组，在 **成员与检测** 中选择仅自建节点，并按名称筛选该节点。将需要访问 Tailnet 的域名或网段指向这个策略组，相关规则放在默认的私有网络直连规则之前。需要通过 Tailscale 访问公网时，可配置 `exit-node`；详细字段见 [Tailscale 节点文档](https://wiki.metacubex.one/en/config/proxies/tailscale/)。

Tailscale 连接由客户端建立。请使用支持该节点类型的 Mihomo 内核；通用订阅或 Stash 输出并不代表客户端支持其中的所有协议。

## 分流规则

### 默认分流

初始配置包含 **直连** 和 **代理** 两个策略组：私有网络及中国大陆地址直连，其余走代理。代理组自动收集当前套餐类型的机场节点与自建节点。

| 流量 | 策略 |
| --- | --- |
| 私有网络域名、局域网及保留 IP | 直连 |
| 国内直连域名、中国大陆 IP | 直连 |
| 其他流量 | 代理 |

默认规则集来自 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)，由客户端每天更新。可以按自己的网络环境调整策略组和规则。

### 添加服务规则集

[blackmatrix7 Clash 规则目录](https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Clash/README.md) 按服务和用途整理规则集，包含 YouTube、Telegram、流媒体、广告拦截等分类。

1. 在目录中打开所需规则的说明页，复制 **Clash YAML 规则文件**的下载地址。
2. 在 **规则提供者** 新增规则集，填写名称、下载地址、更新间隔，并按来源说明选择行为模式（`classical`、`domain` 或 `ipcidr`）。
3. 在目标策略组的 **分流规则** 中添加 `RULE-SET`，选择刚新增的规则集。
4. 检查规则顺序，预览、校验并发布。

规则从上到下匹配，具体服务的规则应放在宽泛规则之前，最终 `MATCH` 保持在末尾。规则目录的网页地址用于查阅；下载地址需填写所选规则文件的链接。

### 编辑与发布

- 选择策略组后，可在 **分流规则** 中新增、复制、移动、停用或删除规则，并添加备注。
- 切换 **全局顺序** 可查看所有策略组规则的匹配顺序。
- **保存草稿** 留存当前修改；**发布** 将配置用于订阅输出。
- **导入 YAML** 可导入策略组、规则提供者、分流规则及基础配置。订阅节点请在 **订阅源** 或 **自建节点** 中添加。
- DNS、TUN、profile 等基础选项在 **YAML 模板** 中编辑。

## 订阅更新与诊断

默认每小时刷新机场数据。某个机场更新失败时，会继续使用它上次成功获取的节点和流量信息，其他机场照常更新。成功数据会持续保留，直到该机场再次获取成功。

在客户端中显示的流量是对应套餐内各机场的合计，到期时间取其中最早值。使用历史数据时，流量和到期时间也沿用上次成功获取的值。

订阅源页面可设置全局 **User-Agent**，留空使用 `Clash.Meta`。如果机场在本地可用、合并订阅却获取失败，可到 **错误日志** 中选择该机场并运行诊断，查看 HTTP 状态、节点数和错误原因，也可临时指定 User-Agent 进行比较。日志保留 7 天。

## 部署

需要 Cloudflare 账号、Workers KV、Node.js 和 pnpm。

1. 下载本仓库并运行 `pnpm install`。
2. 在 Cloudflare 创建 KV 命名空间，将 `wrangler.toml.template` 复制为 `wrangler.toml`。
3. 填写 KV 命名空间 ID，保留绑定名 `SUB_MERGER_KV`，并修改管理密码、盐值和订阅链接标识。
4. 运行 `pnpm exec wrangler login` 登录 Cloudflare，再运行 `pnpm run deploy` 部署。
5. 打开部署后的 Worker 地址，按「开始使用」完成配置。也可以为 Worker 绑定自己的域名。

### 配置项

| 配置项 | 用途 |
| --- | --- |
| `PASSWORD` | 控制台管理密码 |
| `SALT` | 登录凭据的盐值，请替换模板默认值 |
| `MAGIC` | 订阅链接的访问标识，请使用不易猜测的字符串 |
| `TABLENAME` | 配置存储前缀 |
| `KEY_VERSION` | 订阅输出缓存版本，通常保持默认值 |
| `INSTANT_REFRESH_INTERVAL` | 连续请求触发即时刷新的时间窗口，默认 300 秒 |
| `NOTIFICATION.BARK_OPENID` | 可选，接收订阅更新失败通知 |
| `SUBSCRIBE_PATTERN.EXCLUDE_PATTERN` | 包年/包月订阅的节点排除规则 |
| `ONETIME_PATTERN.EXCLUDE_PATTERN` | 流量包订阅的节点排除规则 |

默认每小时执行一次定时刷新，可在 `wrangler.toml` 的 `triggers.crons` 中调整。两次拉取同类订阅的间隔小于即时刷新窗口时，会重新请求机场；其他请求优先使用已生成的订阅。

## 常见问题

**可以只用机场，或只用自建节点吗？**

可以。两类来源都不是必填项；默认代理组会收集当前可用的节点。

**支持哪些订阅格式和客户端？**

机场需提供 Clash YAML，暂不支持直接导入 Base64 或节点分享链接。输出适用于 Clash/Mihomo 配置体系，并会根据客户端标识提供通用或 Stash 配置；具体节点协议与字段仍需客户端支持。

**为什么机场在本地能更新，Worker 却失败？**

机场可能限制 Cloudflare 出口，或根据 User-Agent 返回不同内容。先查看诊断结果，确认地址有效、返回 Clash YAML，再检查机场是否允许 Cloudflare 访问。

**一个节点都没有时会怎样？**

没有可用成员的策略组会从订阅输出中移除；默认配置中需要走代理的流量会被拒绝。添加可用节点后，代理组会恢复。

**保存分流规则后，客户端为何没有变化？**

保存草稿后还需要发布，再在客户端更新订阅。机场和自建节点则在各自页面保存后，更新客户端订阅即可。

## 本地开发

```bash
pnpm install
pnpm run dev
pnpm run typecheck
pnpm run test
pnpm run build
```

## 相关资源

- [Mihomo 节点配置文档](https://wiki.metacubex.one/en/config/proxies/)
- [Tailscale 节点配置文档](https://wiki.metacubex.one/en/config/proxies/tailscale/)
- [blackmatrix7 Clash 规则目录](https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Clash/README.md)
