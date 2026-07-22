/** 管理台支持的两类订阅源。枚举值同时作为 KV 缓存键的一部分。 */
export enum SubscriptionType {
  Monthly = '包年/包月',
  TrafficPackage = '流量包',
}

/** Clash 客户端识别的订阅流量与到期信息。 */
export interface SubUserInfo {
  upload: number
  download: number
  total: number
  expire: number
}

/** 正式缓存中保存的两类客户端 YAML 与流量信息。 */
export interface FinalObj {
  subUserInfo: SubUserInfo
  normalYaml: string
  stashYaml: string
}
