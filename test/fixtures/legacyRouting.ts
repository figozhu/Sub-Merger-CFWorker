/**
 * 固定的历史路由夹具，独立于新安装默认值。
 * 用保留域名代表旧配置的 hosts、服务规则集、直接节点目标和组引用，验证升级不丢配置。
 */
export const legacyDefaultYaml = `
mixed-port: 7890
hosts:
  internal.example: 192.0.2.1
rule-providers:
  legacy-service:
    type: http
    behavior: domain
    url: https://example.com/legacy.yaml
    path: ./RuleSet/legacy.yaml
    interval: 86400
rules:
  # 历史自定义直连规则
  - DOMAIN-SUFFIX,internal.example,直接连接
  - RULE-SET,legacy-service,海外AI
  - DOMAIN-SUFFIX,chat.example,IM-Telegram
  - DOMAIN-SUFFIX,home.example,SELF-JP【自建】
  - GEOIP,CN,DIRECT,no-resolve
  - MATCH,其它流量
`
