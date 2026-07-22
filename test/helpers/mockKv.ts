/**
 * 内存 KVNamespace 测试替身。
 * 只实现业务代码使用的 get/put/delete，并记录删除键用于缓存失效断言。
 */
export class MockKV {
  readonly values = new Map<string, string>()
  readonly deleted: string[] = []

  /** 按 Cloudflare KV 的 text/json 模式读取数据。 */
  async get<T = string>(key: string, type?: string): Promise<T | string | null> {
    const value = this.values.get(key)
    if (value == null) return null
    return (type === 'json' ? JSON.parse(value) : value) as T
  }

  /** 写入字符串值。 */
  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  /** 删除值并记录删除顺序。 */
  async delete(key: string): Promise<void> {
    this.values.delete(key)
    this.deleted.push(key)
  }
}

/** 创建覆盖 API 和生成器所需字段的测试环境。 */
export function createTestEnv(kv = new MockKV()): any {
  const emptyPatterns = {
    EXCLUDE_PATTERN: '', OTHER_MATCH_PATTERN: '', OTHER_EXCLUDE_PATTERN: '',
    PROXY_MATCH_PATTERN: '', PROXY_EXCLUDE_PATTERN: '', AI_MATCH_PATTERN: '', AI_EXCLUDE_PATTERN: '',
    TELEGRAM_MATCH_PATTERN: '', TELEGRAM_EXCLUDE_PATTERN: '', WHATSAPP_MATCH_PATTERN: '', WHATSAPP_EXCLUDE_PATTERN: '',
    MEDIA_MATCH_PATTERN: '', MEDIA_EXCLUDE_PATTERN: '', POKER_MATCH_PATTERN: '', POKER_EXCLUDE_PATTERN: '',
    BINANCE_MATCH_PATTERN: '', BINANCE_EXCLUDE_PATTERN: '', ETHERFI_MATCH_PATTERN: '', ETHERFI_EXCLUDE_PATTERN: '',
    STEAM_MATCH_PATTERN: '', STEAM_EXCLUDE_PATTERN: '', EMBY_MATCH_PATTERN: '', EMBY_EXCLUDE_PATTERN: '',
    FALLBACK_MATCH_PATTERN: '', FALLBACK_EXCLUDE_PATTERN: '',
  }
  return {
    SUB_MERGER_KV: kv,
    PASSWORD: 'test-password', SALT: 'test-salt', TABLENAME: 'test-sub', KEY_VERSION: '1',
    MAGIC: 'magic-key', UA: 'test-agent', INSTANT_REFRESH_INTERVAL: '300', NOTIFICATION: {},
    SUBSCRIBE_PATTERN: { ...emptyPatterns }, ONETIME_PATTERN: { ...emptyPatterns },
  }
}
