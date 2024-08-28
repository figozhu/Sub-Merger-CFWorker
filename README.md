# Sub-Merger-CFWorker
订阅合并（基于CF Worker）


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
| PROXY | 请求订阅时使用的代理（可选） |
| EXCLUDE_PATTERN | 排除节点的正则表达式 |
| OTHER_PATTERN | 其他类型节点的正则表达式 |
| YOUTUBE_PATTERN | YouTube节点的正则表达式 |
| TWITTER_PATTERN | Twitter节点的正则表达式 |
| TELEGRAM_PATTERN | Telegram节点的正则表达式 |
| STEAM_PATTERN | Steam节点的正则表达式 |
| INSTANT_REFRESH_INTERVAL | 获取订阅内容不使用缓存的请求间隔（秒） |


