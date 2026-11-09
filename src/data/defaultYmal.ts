import type { RoutingStoreEnv } from '../config/routingConfig'

/**
 * 新安装使用的通用模板：私有网络与中国大陆地址直连，其余流量交给代理组。
 * 仅保留实际引用的公开规则集；个人域名、固定 hosts、专用出口和节点不进入默认值。
 * 策略组由 defaultRouting.ts 创建，此处不包含节点或 proxy-groups 字段。
 */
const defaultYamlString = `
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
  fake-ip-filter-mode: blacklist
  prefer-h3: false
  respect-rules: false
  use-hosts: false
  use-system-hosts: false
  ipv6: true
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - '*.arpa'
    - 'time.*.com'
    - 'ntp.*.com'
    - '+.market.xiaomi.com'
    - 'localhost.ptlogin2.qq.com'
    - '*.msftncsi.com'
    - 'www.msftconnecttest.com'
  default-nameserver:
    - system
    - 223.6.6.6
    - 8.8.8.8
    - '2400:3200::1'
    - '2001:4860:4860::8888'
  nameserver:
    - 8.8.8.8
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  proxy-server-nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
    - tls://223.5.5.5
  direct-nameserver:
    - system
  direct-nameserver-follow-policy: false

# 通用规则集：私有域名、局域网地址、国内直连域名与中国大陆 IP。
rule-providers:
  private:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt
    path: ./RuleSet/private.yaml
    interval: 86400
  lancidr:
    type: http
    behavior: ipcidr
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt
    path: ./RuleSet/lancidr.yaml
    interval: 86400
  direct:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt
    path: ./RuleSet/direct.yaml
    interval: 86400
  cncidr:
    type: http
    behavior: ipcidr
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt
    path: ./RuleSet/cncidr.yaml
    interval: 86400

rules:
  # 私有网络专用域名直连
  - RULE-SET,private,直连
  # 局域网与保留地址直连，不为 IP 规则额外触发 DNS 查询
  - RULE-SET,lancidr,直连,no-resolve
  # 国内可直连域名
  - RULE-SET,direct,直连
  # 中国大陆 IP 直连，不为 IP 规则额外触发 DNS 查询
  - RULE-SET,cncidr,直连,no-resolve
  # 其余流量统一走代理
  - MATCH,代理
`

/**
 * 返回通用默认 YAML；调用方不能通过修改返回值污染后续请求。
 * @returns 不含节点和策略组的默认 YAML 字符串。
 */
export function getDefaultYamlString(): string {
  return defaultYamlString
}

/**
 * 读取管理员在旧版配置接口保存的模板，用于区分旧配置迁移与新安装。
 * 缺失、空白或非字符串均视为未配置；KV 读取失败向上传递，避免误判成新安装。
 * @param env 当前部署的 KV 绑定和键前缀。
 * @returns 已保存的原始 YAML 及可选生成模式，或未配置时的 null。
 */
export async function getStoredDefaultYaml(env: RoutingStoreEnv): Promise<StoredYamlDocument | null> {
  const config = await env.SUB_MERGER_KV.get<{ defaultYaml?: unknown; routingMode?: unknown }>(`${env.TABLENAME}:config`, 'json')
  if (typeof config?.defaultYaml !== 'string' || !config.defaultYaml.trim()) return null
  return {
    yaml: config.defaultYaml,
    routingMode: config.routingMode === 'default' || config.routingMode === 'legacy' ? config.routingMode : undefined,
  }
}

/** 旧模板及其生成模式；历史记录没有 routingMode，新写入记录显式保存以避免文本编辑改变分组。 */
export interface StoredYamlDocument {
  yaml: string
  routingMode?: 'default' | 'legacy'
}

/**
 * 返回旧配置接口可读取的当前模板，未保存时使用通用默认值。
 * @param env 可选的 Worker 环境；省略时直接读取代码默认值。
 * @returns 已保存模板或通用默认 YAML。
 */
export async function getDefaultYaml(env?: RoutingStoreEnv): Promise<string> {
  return env ? (await getStoredDefaultYaml(env))?.yaml ?? defaultYamlString : defaultYamlString
}
