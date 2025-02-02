export function getDefaultYaml(): string {
  return `
#---------------------------------------------------#
## 自定义Clash配置 
#---------------------------------------------------#


mixed-port: 7890
allow-lan: false
mode: Rule
log-level: info
external-controller: 127.0.0.1:60000
dns:
    enable: true
    ipv6: false
    default-nameserver: [223.5.5.5, 119.29.29.29]
    enhanced-mode: fake-ip
    fake-ip-range: 198.18.0.1/16
    use-hosts: true
    nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query']
    fallback: ['https://doh.dns.sb/dns-query', 'https://dns.cloudflare.com/dns-query', 'https://dns.twnic.tw/dns-query', 'tls://8.8.4.4:853']
    fallback-filter: { geoip: true, ipcidr: [240.0.0.0/4, 0.0.0.0/32] }

# MARK: 规则集
rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./RuleSet/reject.yaml
    interval: 86400
  Youtube:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/YouTube/YouTube.yaml"
    path: ./RuleSet/Youtube.yaml
    interval: 86400
  Google:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Google/Google.yaml"
    path: ./RuleSet/Google.yaml
    interval: 86400
  GitHub:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/GitHub/GitHub.yaml"
    path: ./RuleSet/GitHub.yaml
    interval: 86400
  OpenAI:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/OpenAI/OpenAI.yaml"
    path: ./RuleSet/OpenAI.yaml
    interval: 86400
  Claude:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Claude/Claude.yaml"
    path: ./RuleSet/Claude.yaml
    interval: 86400
  Apple:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Apple/Apple.yaml"
    path: ./RuleSet/Apple.yaml
    interval: 86400
  Twitter:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Twitter/Twitter.yaml"
    path: ./RuleSet/Twitter.yaml
    interval: 86400
  Telegram:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Telegram/Telegram.yaml"
    path: ./RuleSet/Telegram.yaml
    interval: 86400
  Steam:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/Steam/Steam.yaml"
    path: ./RuleSet/Steam.yaml
    interval: 86400
  SteamCN:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@release/rule/Clash/SteamCN/SteamCN.yaml"
    path: ./RuleSet/SteamCN.yaml
    interval: 86400
  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./RuleSet/proxy.yaml
    interval: 86400
  direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./RuleSet/direct.yaml
    interval: 86400
  private:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./RuleSet/private.yaml
    interval: 86400
  gfw:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./RuleSet/gfw.yaml
    interval: 86400
  greatfire:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/greatfire.txt"
    path: ./RuleSet/greatfire.yaml
    interval: 86400
  tld-not-cn:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt"
    path: ./RuleSet/tld-not-cn.yaml
    interval: 86400
  cncidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./RuleSet/cncidr.yaml
    interval: 86400
  lancidr:
     type: http
     behavior: ipcidr
     url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt"
     path: ./RuleSet/lancidr.yaml
     interval: 86400

# MARK: 路由规则
rules:

  # 进程
  
  # ClubGG
  - PROCESS-NAME,ClubGG.exe,GameSteam
  - PROCESS-NAME,ClubGG,GameSteam
  - DOMAIN-KEYWORD,clubgg,GameSteam

  # GGPoker
  - PROCESS-NAME,GGnet.exe,GameSteam

  - PROCESS-NAME,v2ray,DIRECT
  - PROCESS-NAME,xray,DIRECT
  - PROCESS-NAME,naive,DIRECT
  - PROCESS-NAME,trojan,DIRECT
  - PROCESS-NAME,trojan-go,DIRECT
  - PROCESS-NAME,ss-local,DIRECT
  - PROCESS-NAME,privoxy,DIRECT
  - PROCESS-NAME,leaf,DIRECT
  - PROCESS-NAME,v2ray.exe,DIRECT
  - PROCESS-NAME,xray.exe,DIRECT
  - PROCESS-NAME,naive.exe,DIRECT
  - PROCESS-NAME,trojan.exe,DIRECT
  - PROCESS-NAME,trojan-go.exe,DIRECT
  - PROCESS-NAME,ss-local.exe,DIRECT
  - PROCESS-NAME,privoxy.exe,DIRECT
  - PROCESS-NAME,leaf.exe,DIRECT
  - PROCESS-NAME,Surge,DIRECT
  - PROCESS-NAME,Surge 2,DIRECT
  - PROCESS-NAME,Surge 3,DIRECT
  - PROCESS-NAME,Surge 4,DIRECT
  - PROCESS-NAME,Surge%202,DIRECT
  - PROCESS-NAME,Surge%203,DIRECT
  - PROCESS-NAME,Surge%204,DIRECT
  - PROCESS-NAME,xllite,DIRECT
  - PROCESS-NAME,Thunder,DIRECT
  - PROCESS-NAME,ThunderVIP,DIRECT
  - PROCESS-NAME,DownloadService,DIRECT
  - PROCESS-NAME,DownloadSDKServer,DIRECT
  - PROCESS-NAME,qBittorrent,DIRECT
  - PROCESS-NAME,Transmission,DIRECT
  - PROCESS-NAME,fdm,DIRECT
  - PROCESS-NAME,aria2c,DIRECT
  - PROCESS-NAME,Folx,DIRECT
  - PROCESS-NAME,NetTransport,DIRECT
  - PROCESS-NAME,uTorrent,DIRECT
  - PROCESS-NAME,WebTorrent,DIRECT
  - PROCESS-NAME,aria2c.exe,DIRECT
  - PROCESS-NAME,BitComet.exe,DIRECT
  - PROCESS-NAME,fdm.exe,DIRECT
  - PROCESS-NAME,NetTransport.exe,DIRECT
  - PROCESS-NAME,qbittorrent.exe,DIRECT
  - PROCESS-NAME,xllite.exe,DIRECT
  - PROCESS-NAME,Thunder.exe,DIRECT
  - PROCESS-NAME,ThunderVIP.exe,DIRECT
  - PROCESS-NAME,DownloadService.exe,DIRECT
  - PROCESS-NAME,DownloadSDKServer.exe,DIRECT
  - PROCESS-NAME,transmission-daemon.exe,DIRECT
  - PROCESS-NAME,transmission-qt.exe,DIRECT
  - PROCESS-NAME,uTorrent.exe,DIRECT
  - PROCESS-NAME,WebTorrent.exe,DIRECT
  - DOMAIN,clash.razord.top,DIRECT
  - DOMAIN,yacd.haishan.me,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,direct,DIRECT

  # EMBY公益服
  - DOMAIN-SUFFIX,123456.al,EMBY
  - DOMAIN-SUFFIX,cherrytv.one,EMBY
  - DOMAIN-SUFFIX,daumcdn.net,EMBY
  - DOMAIN-SUFFIX,alphatvapp.top,EMBY
  - DOMAIN-SUFFIX,misty.cx,EMBY
  - DOMAIN-SUFFIX,emby.wtf,EMBY
  - DOMAIN-SUFFIX,term.wtf,EMBY
  - DOMAIN-SUFFIX,emby.69yun69.com,EMBY
  

  # 规则匹配
  - DOMAIN-SUFFIX,bing.com,其它流量
  - DOMAIN-SUFFIX,a-nomad.com,直接连接
  - DOMAIN-SUFFIX,api2d.net,直接连接
  - DOMAIN-SUFFIX,appstorrent.ru,其它流量

  - RULE-SET,OpenAI,其它流量
  - RULE-SET,Claude,其它流量
  - RULE-SET,Google,其它流量
  - RULE-SET,GitHub,其它流量
  - RULE-SET,Apple,直接连接
  - RULE-SET,Youtube,MediaYouTube
  - RULE-SET,Twitter,MediaTwitter
  - RULE-SET,Telegram,MediaTelegram
  - RULE-SET,SteamCN,直接连接
  - RULE-SET,Steam,GameSteam

  
  - RULE-SET,proxy,其它流量
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,其它流量

`;
}
