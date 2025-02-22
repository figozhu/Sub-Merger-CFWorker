# Sub-Merger-CFWorker
基于CF Worker的Clash系软件的订阅合并，增加分流配置

优势：
 - 无论订阅地址是否被墙，CF的节点都是可以去拉取的
 - 你的Worker绑一个没被墙的域名，就可以无需代理更新订阅配置了


**注意：**

现在分流配置是我写死的，如果你有不同的需求，请fork了代码，自行修改

关于Clash中流量和有效期的显示：
 - 流量是所有订阅源返回的数据累加起来的
 - 有效期是所有订阅源中返回的最早的到期时间



# 消费降级，性价比机场推荐

原来使用一年200多的机场（每个月才50G流量），现在发现一年12元，13元的机场也挺好用，还有一些稍微贵一些（4块，5块一个月，但大多都有300G、500G的流量）





| 机场名       | 价格                                                  | 注册网址                    | 特色               |
| ------------ | ----------------------------------------------------- | --------------------------- | ------------------ |
| 十元一年     | ￥9.9/年（100G/月），￥299.99/终身（6折券：LYcPG0Ik） | https://wzsd.figozhu.xyz/MXNmTw |                    |
| UNDERWATER | 按用量计费：￥0.12/1G | https://wzsd.figozhu.xyz/wFWR6Y | IP比较纯净，速度较快 |
| 动力港 | ￥8/100G/月 | https://wzsd.figozhu.xyz/EaH25c | 速度很快，节点很多（20个HK，15个SG，15个JP，10个US，5个TW，2个UK，1个土耳其、瑞士、荷兰） |
| 804Cloud     | ￥2/100G/月、￥5/300G/月、￥15/无限/月                | https://wzsd.figozhu.xyz/dhPBJ5 |                    |
| FashSoks     | ￥3.99/500G/月                                        | https://wzsd.figozhu.xyz/RHXYXf |                    |
| Lantau       | ￥9/50G/月、￥92/年（600G/月）                        | https://wzsd.figozhu.xyz/S4NieJ |              |




# 本地开发、调试

1. 安装依赖
```
pnpm install

```


2. 启动本地服务器

```
pnpm run dev
```


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



