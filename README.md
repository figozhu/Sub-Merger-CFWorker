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
| EXCLUDE_PATTERN | 排除节点的正则表达式 |
| OTHER_PATTERN | 其他类型节点的正则表达式 |
| YOUTUBE_PATTERN | YouTube节点的正则表达式 |
| TWITTER_PATTERN | Twitter节点的正则表达式 |
| TELEGRAM_PATTERN | Telegram节点的正则表达式 |
| STEAM_PATTERN | Steam节点的正则表达式 |
| INSTANT_REFRESH_INTERVAL | 获取订阅内容不使用缓存的请求间隔（秒） |


