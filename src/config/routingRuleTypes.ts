/**
 * Mihomo 官方路由规则目录，供类型、浏览器选项、导入与校验共同使用。
 * example 是匹配内容提示，不会自动覆盖用户输入；destinationIp 表示可使用 src/no-resolve。
 * 来源：https://wiki.metacubex.one/config/rules/
 */
export const ROUTING_RULE_DEFINITIONS = [
  { type: 'DOMAIN', category: '域名', label: '完整域名', example: 'example.com' },
  { type: 'DOMAIN-SUFFIX', category: '域名', label: '域名后缀', example: 'example.com' },
  { type: 'DOMAIN-KEYWORD', category: '域名', label: '域名关键字', example: 'google' },
  { type: 'DOMAIN-WILDCARD', category: '域名', label: '域名通配符', example: '*.example.com' },
  { type: 'DOMAIN-REGEX', category: '域名', label: '域名正则', example: '^abc.*com$' },
  { type: 'GEOSITE', category: '域名', label: '域名集合', example: 'youtube' },
  { type: 'IP-CIDR', category: 'IP', label: '目标 IP 网段', example: '192.168.0.0/16', destinationIp: true },
  { type: 'IP-CIDR6', category: 'IP', label: '目标 IPv6 网段（IP-CIDR 别名）', example: '2001:db8::/32', destinationIp: true },
  { type: 'IP-SUFFIX', category: 'IP', label: '目标 IP 后缀', example: '8.8.8.8/24', destinationIp: true },
  { type: 'IP-ASN', category: 'IP', label: '目标 IP 自治系统号', example: '13335', destinationIp: true },
  { type: 'GEOIP', category: 'IP', label: '目标 IP 国家代码', example: 'CN', destinationIp: true },
  { type: 'SRC-GEOIP', category: '来源 IP', label: '来源 IP 国家代码', example: 'CN' },
  { type: 'SRC-IP-ASN', category: '来源 IP', label: '来源 IP 自治系统号', example: '9808' },
  { type: 'SRC-IP-CIDR', category: '来源 IP', label: '来源 IP 网段', example: '192.168.1.0/24' },
  { type: 'SRC-IP-SUFFIX', category: '来源 IP', label: '来源 IP 后缀', example: '192.168.1.201/8' },
  { type: 'DST-PORT', category: '端口与入站', label: '目标端口', example: '80/443/8000-9000' },
  { type: 'SRC-PORT', category: '端口与入站', label: '来源端口', example: '45000-45999（多个范围用 / 分隔）' },
  { type: 'IN-PORT', category: '端口与入站', label: '入站端口', example: '7890/7891' },
  { type: 'IN-TYPE', category: '端口与入站', label: '入站类型', example: 'SOCKS/HTTP' },
  { type: 'IN-USER', category: '端口与入站', label: '入站用户名', example: 'user1/user2' },
  { type: 'IN-NAME', category: '端口与入站', label: '入站名称', example: 'ss' },
  { type: 'REMATCH-NAME', category: '端口与入站', label: '重新匹配名称', example: 'rematch1' },
  { type: 'PROCESS-PATH', category: '进程', label: '完整进程路径', example: '/usr/bin/wget' },
  { type: 'PROCESS-PATH-WILDCARD', category: '进程', label: '进程路径通配符', example: '/usr/*/wget' },
  { type: 'PROCESS-PATH-REGEX', category: '进程', label: '进程路径正则', example: '.*bin/wget' },
  { type: 'PROCESS-NAME', category: '进程', label: '进程名', example: 'chrome.exe' },
  { type: 'PROCESS-NAME-WILDCARD', category: '进程', label: '进程名通配符', example: '*telegram*' },
  { type: 'PROCESS-NAME-REGEX', category: '进程', label: '进程名正则', example: '(?i)telegram' },
  { type: 'UID', category: '进程', label: 'Linux 用户 ID', example: '1000/1001-1003' },
  { type: 'NETWORK', category: '网络', label: '传输协议', example: 'tcp 或 udp' },
  { type: 'DSCP', category: '网络', label: 'DSCP 标记（tproxy UDP）', example: '4/8-12' },
  { type: 'RULE-SET', category: '集合与逻辑', label: '规则集合', example: '', destinationIp: true },
  { type: 'AND', category: '集合与逻辑', label: '同时满足', example: '((DOMAIN,example.com),(NETWORK,UDP))' },
  { type: 'OR', category: '集合与逻辑', label: '满足任一', example: '((NETWORK,UDP),(DOMAIN,example.com))' },
  { type: 'NOT', category: '集合与逻辑', label: '条件取反', example: '((DOMAIN,example.com))' },
  { type: 'SUB-RULE', category: '集合与逻辑', label: '跳转子规则', example: '(NETWORK,tcp)' },
  { type: 'MATCH', category: '集合与逻辑', label: '最终兜底', example: '' },
] as const

/** 支持列表由同一目录派生，避免界面可选但服务端拒绝。 */
export const SUPPORTED_RULE_TYPES: ReadonlySet<string> = new Set(ROUTING_RULE_DEFINITIONS.map((rule) => rule.type))

/**
 * Mihomo 对这七类规则将最后一个逗号之后的内容作为目标，中间整体作为匹配内容。
 * 因而正则量词中的逗号、嵌套逻辑都必须保留，且不能在最外层追加选项。
 * 来源：MetaCubeX/mihomo 的 rules/common/base.go（ParseRulePayload）。
 */
export const COMMA_PAYLOAD_RULE_TYPES: ReadonlySet<string> = new Set([
  'AND', 'OR', 'NOT', 'SUB-RULE', 'DOMAIN-REGEX', 'PROCESS-NAME-REGEX', 'PROCESS-PATH-REGEX',
])

/** 支持目标 IP 附加参数的规则；RULE-SET 的实际效果还取决于其 behavior。 */
export const DESTINATION_IP_RULE_TYPES: ReadonlySet<string> = new Set(
  ROUTING_RULE_DEFINITIONS.filter((rule) => 'destinationIp' in rule).map((rule) => rule.type),
)
