const defaultYamlString = `
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
  listen: ':53'
  enhanced-mode: 'fake-ip'
  fake-ip-range: '198.18.0.1/16'
  fake-ip-filter-mode: 'blacklist'
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
    - 'time.*.com'
    - '+.market.xiaomi.com'
    - 'localhost.ptlogin2.qq.com'
    - '*.msftncsi.com'
    - 'www.msftconnecttest.com'
  default-nameserver:
    - 'system'
    - '223.6.6.6'
    - '8.8.8.8'
    - '2400:3200::1'
    - '2001:4860:4860::8888'
  nameserver:
    - '8.8.8.8'
    - 'https://doh.pub/dns-query'
    - 'https://dns.alidns.com/dns-query'
  direct-nameserver-follow-policy: false
  fallback-filter:
    geoip: true
    geoip-code: 'CN'
    ipcidr:
      - '240.0.0.0/4'
      - '0.0.0.0/32'
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'
  fallback: []
  proxy-server-nameserver:
    - 'https://doh.pub/dns-query'
    - 'https://dns.alidns.com/dns-query'
    - 'tls://223.5.5.5'
  direct-nameserver: []


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
  - PROCESS-NAME,ClubGG.exe,DIRECT
  - PROCESS-NAME,ClubGG,DIRECT
  - DOMAIN-SUFFIX,api.clubgg.com,DIRECT,no-resolve
  - DOMAIN-SUFFIX,api2.clubgg.com,DIRECT,no-resolve
  - DOMAIN-SUFFIX,games.clubgg.com,DIRECT,no-resolve
  - DOMAIN-SUFFIX,rum-api.clubgg.com,DIRECT,no-resolve
  - DOMAIN-SUFFIX,apigw-client.good-game-service.com,DIRECT,no-resolve

  # GGPoker
  - PROCESS-NAME,GGnet.exe,PokerClient

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
  - DOMAIN,clash.razord.top,DIRECT,no-resolve
  - DOMAIN,yacd.haishan.me,DIRECT,no-resolve
  - RULE-SET,private,DIRECT,no-resolve
  - RULE-SET,reject,REJECT,no-resolve
  - RULE-SET,direct,DIRECT,no-resolve

  # EMBY公益服
  - DOMAIN-SUFFIX,123456.al,EMBY,no-resolve
  - DOMAIN-SUFFIX,cherrytv.one,EMBY,no-resolve
  - DOMAIN-SUFFIX,daumcdn.net,EMBY,no-resolve
  - DOMAIN-SUFFIX,aop4.204cloud.com,直接连接,no-resolve
  - DOMAIN-SUFFIX,alphatvop.alphatvapp.top,EMBY,no-resolve
  - DOMAIN-SUFFIX,misty.cx,EMBY,no-resolve
  - DOMAIN-SUFFIX,emby.wtf,EMBY,no-resolve
  - DOMAIN-SUFFIX,term.wtf,EMBY,no-resolve
  - DOMAIN-SUFFIX,emby1.69yun69.com,EMBY,no-resolve
  

  # 规则匹配
  - DOMAIN-SUFFIX,chzhshch.org,直接连接,no-resolve
  - DOMAIN-SUFFIX,figozhu.xyz,直接连接,no-resolve
  - DOMAIN-SUFFIX,tu-zi.com,直接连接,no-resolve
  - DOMAIN-SUFFIX,one.api4gpt.com,直接连接,no-resolve
  - DOMAIN-SUFFIX,anyrouter.top,直接连接,no-resolve
  - DOMAIN-SUFFIX,immersivetranslate.com,直接连接,no-resolve
  - DOMAIN-SUFFIX,filesystem.site,直接连接,no-resolve
  - DOMAIN-SUFFIX,bing.com,其它流量,no-resolve
  - DOMAIN-SUFFIX,a-nomad.com,直接连接,no-resolve
  - DOMAIN-SUFFIX,api2d.net,直接连接,no-resolve
  - DOMAIN-SUFFIX,appstorrent.ru,其它流量,no-resolve

  - RULE-SET,Youtube,MediaYouTube,no-resolve
  - RULE-SET,Twitter,MediaTwitter,no-resolve
  - RULE-SET,Telegram,MediaTelegram,no-resolve
  - RULE-SET,SteamCN,直接连接,no-resolve
  - RULE-SET,Steam,GameSteam,no-resolve

  
  - GEOIP,LAN,DIRECT,no-resolve
  - GEOIP,CN,DIRECT,no-resolve
  - RULE-SET,proxy,其它流量,no-resolve
  - MATCH,其它流量

`;

// 默认的YAML配置，作为备用
export function getDefaultYamlString(): string {
  return defaultYamlString;
}

export async function getDefaultYaml(env?: any): Promise<string> {
    if (!env) {
        // 如果没有环境变量，使用默认数据
        return defaultYamlString;
    }

    try {
        // 尝试从KV存储获取动态配置
        const configKey = `${env.TABLENAME}:config`
        const config = await env.SUB_MERGER_KV.get(configKey, "json")
        
        if (config && config.defaultYaml && config.defaultYaml.trim()) {
            return config.defaultYaml;
        }
    } catch (error) {
        console.error('获取默认YAML配置失败，使用默认配置:', error);
    }

    // 回退到默认配置
    return defaultYamlString;
}
