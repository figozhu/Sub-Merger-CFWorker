import { Hono } from 'hono'
import {
  getCookie,
  setCookie,
  deleteCookie,
} from 'hono/cookie'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)

import { SubscriptionType, SubUserInfo, FinalObj } from './types/types.d.ts'

import { generatePasswordHash } from './utils/passwordMgr'
import {getSubscribeYaml, generateSubscriptionUserInfoString} from './utils/getSubscribeYaml'
import generateProxyConfigYaml from './utils/generateProxyConfigYaml'
import { getDefaultYaml } from './data/defaultYmal'
import { filterProxyForStash } from './utils/filterForStash.js'


type Bindings = {
  SUB_MERGER_KV: KVNamespace
  PASSWORD: string
  SALT: string
  TABLENAME: string
  KEY_VERSION: string
  MAGIC: string
  UA: string
  INSTANT_REFRESH_INTERVAL: string
  NOTIFICATION: {
    BARK_OPENID: string
  }
  ONETIME_PATTERN: {
    EXCLUDE_PATTERN: string
    FALLBACK_MATCH_PATTERN: string
    OTHER_MATCH_PATTERN: string
    MEDIA_MATCH_PATTERN: string
    EMBY_MATCH_PATTERN: string
    TELEGRAM_MATCH_PATTERN: string
    STEAM_MATCH_PATTERN: string
    POKER_MATCH_PATTERN: string
    PROXY_MATCH_PATTERN: string
    AI_MATCH_PATTERN: string
    ETHERFI_MATCH_PATTERN: string

    FALLBACK_EXCLUDE_PATTERN: string
    OTHER_EXCLUDE_PATTERN: string
    MEDIA_EXCLUDE_PATTERN: string
    EMBY_EXCLUDE_PATTERN: string
    TELEGRAM_EXCLUDE_PATTERN: string
    STEAM_EXCLUDE_PATTERN: string
    POKER_EXCLUDE_PATTERN: string
    PROXY_EXCLUDE_PATTERN: string
    AI_EXCLUDE_PATTERN: string
    ETHERFI_EXCLUDE_PATTERN: string
  }
  SUBSCRIBE_PATTERN: {
    EXCLUDE_PATTERN: string
    FALLBACK_MATCH_PATTERN: string
    OTHER_MATCH_PATTERN: string
    MEDIA_MATCH_PATTERN: string
    TELEGRAM_MATCH_PATTERN: string
    STEAM_MATCH_PATTERN: string
    POKER_MATCH_PATTERN: string
    PROXY_MATCH_PATTERN: string
    AI_MATCH_PATTERN: string
    ETHERFI_MATCH_PATTERN: string

    FALLBACK_EXCLUDE_PATTERN: string
    OTHER_EXCLUDE_PATTERN: string
    MEDIA_EXCLUDE_PATTERN: string
    TELEGRAM_EXCLUDE_PATTERN: string
    STEAM_EXCLUDE_PATTERN: string
    POKER_EXCLUDE_PATTERN: string
    PROXY_EXCLUDE_PATTERN: string
    AI_EXCLUDE_PATTERN: string
    ETHERFI_EXCLUDE_PATTERN: string
  }
}

const app = new Hono<{ Bindings: Bindings }>()

const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    margin: 0;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    min-height: 100vh;
    padding: 20px;
    color: #2c3e50;
  }
  
  .container {
    background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 16px;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  
  .dashboard-header {
    background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
    color: white;
    padding: 2rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  
  .dashboard-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="white" opacity="0.1"/><circle cx="80" cy="80" r="2" fill="white" opacity="0.1"/><circle cx="40" cy="60" r="1" fill="white" opacity="0.1"/></svg>');
    pointer-events: none;
  }
  
  .dashboard-header h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 300;
    position: relative;
    z-index: 1;
  }
  
  .tabs {
    display: flex;
    background: linear-gradient(to right, #f8f9fa, #e9ecef);
    border-bottom: 1px solid #dee2e6;
    flex-shrink: 0;
  }
  
  .tab {
    flex: 1;
    padding: 1rem 2rem;
    background: none;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    color: #6c757d;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    border-bottom: 3px solid transparent;
  }
  
  .tab:hover {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    color: #1976d2;
    transform: translateY(-1px);
  }
  
  .tab.active {
    color: #1976d2;
    background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
    border-bottom: 3px solid #1976d2;
    font-weight: 600;
  }
  
  .tab-content {
    display: none;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .tab-content.active {
    display: flex;
    flex-direction: column;
  }
  
  .tab-content-inner {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .tab-content-header {
    padding: 2rem 2rem 0 2rem;
    flex-shrink: 0;
    background: white;
    border-bottom: 1px solid #e9ecef;
  }
  
  .form {
    display: flex;
    flex-direction: column;
  }
  
  input[type="password"], input[type="text"], select {
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.3s ease;
    background: white;
  }
  
  input[type="password"]:focus, input[type="text"]:focus, select:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
    transform: translateY(-1px);
  }
  
  button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(25, 118, 210, 0.25);
  }
  
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(25, 118, 210, 0.35);
    background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  }
  
  button:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(25, 118, 210, 0.25);
  }
  
  .error-message {
    color: #d32f2f;
    margin-top: 10px;
    text-align: center;
    display: none;
    padding: 0.75rem;
    background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
    border-radius: 8px;
    border-left: 4px solid #d32f2f;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #e1e5e9;
  }
  
  th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #f0f0f0;
  }
  
  th {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    font-weight: 600;
    color: #495057;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  tr:hover {
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f4f8 100%);
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  .action-buttons {
    display: flex;
    gap: 8px;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  
  .btn-delete {
    background: linear-gradient(135deg, #e57373 0%, #d32f2f 100%);
    color: white;
  }
  
  .btn-delete:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(211, 47, 47, 0.25);
    background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
  }
  
  .btn-add {
    background: linear-gradient(135deg, #66bb6a 0%, #388e3c 100%);
    color: white;
    margin-right: 1rem;
  }
  
  .btn-add:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(56, 142, 60, 0.25);
    background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  }
  
  .btn-save {
    background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
    color: white;
  }
  
  .btn-save:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(25, 118, 210, 0.25);
    background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  }
  
  .btn-copy {
    background: linear-gradient(135deg, #26c6da 0%, #00acc1 100%);
    color: white;
    position: relative;
  }
  
  .btn-copy:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 172, 193, 0.25);
    background: linear-gradient(135deg, #00acc1 0%, #0097a7 100%);
  }
  
  .copy-tooltip {
    position: absolute;
    background: linear-gradient(135deg, #37474f 0%, #263238 100%);
    color: #fff;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .copy-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border: 5px solid;
    border-color: #37474f transparent transparent transparent;
  }
  
  .copy-tooltip.show {
    opacity: 1;
  }
  
  h1, h2, h3 {
    color: #2c3e50;
    margin-bottom: 1.5rem;
  }
  
  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #34495e;
    border-bottom: 2px solid #e8f4f8;
    padding-bottom: 0.5rem;
    margin-bottom: 2rem;
  }
  
  .subscription-url {
    width: 100%;
    min-width: 200px;
  }
  
  #subscriptionsTable {
    table-layout: fixed;
    width: 100%;
  }
  
  #subscriptionsTable th:nth-child(1) { width: 20%; }
  #subscriptionsTable th:nth-child(2) { width: 15%; }
  #subscriptionsTable th:nth-child(3) { width: 50%; }
  #subscriptionsTable th:nth-child(4) { width: 15%; }
  
  #subscriptionsTable td {
    white-space: nowrap;
    overflow: hidden;
  }
  
  #subscriptionsTable input[type="text"],
  #subscriptionsTable select {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    margin-bottom: 0;
  }
  
  .config-textarea {
    width: 100%;
    min-height: 400px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    padding: 1.5rem;
    border: 2px solid #e1e5e9;
    border-radius: 12px;
    resize: vertical;
    background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
    transition: all 0.3s ease;
    line-height: 1.5;
  }
  
  .config-textarea:focus {
    outline: none;
    border-color: #1976d2;
    background: white;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
  }
  
  .config-label {
    display: block;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #34495e;
    font-size: 1rem;
  }
  
  .config-item {
    margin-bottom: 2rem;
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    padding: 1.5rem 2rem;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-top: 1px solid #e9ecef;
    flex-shrink: 0;
    box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .fixed-bottom-buttons {
    position: sticky;
    bottom: 0;
    z-index: 10;
  }
  
  .link-display {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 1rem;
    border-radius: 8px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    word-break: break-all;
    border: 1px solid #d1d5db;
    color: #495057;
  }
  
  .scrollable-content {
    overflow-y: auto;
    flex: 1;
    padding: 2rem;
  }
  
  /* 自定义滚动条 */
  .scrollable-content::-webkit-scrollbar,
  .config-textarea::-webkit-scrollbar {
    width: 8px;
  }
  
  .scrollable-content::-webkit-scrollbar-track,
  .config-textarea::-webkit-scrollbar-track {
    background: #f1f3f4;
    border-radius: 4px;
  }
  
  .scrollable-content::-webkit-scrollbar-thumb,
  .config-textarea::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
    border-radius: 4px;
  }
  
  .scrollable-content::-webkit-scrollbar-thumb:hover,
  .config-textarea::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
  }
  
  @media (max-width: 768px) {
    body {
      padding: 10px;
    }
    
    .container {
      margin: 0;
      border-radius: 12px;
      max-height: 95vh;
    }
    
    .tabs {
      flex-direction: column;
    }
    
    .tab {
      text-align: center;
      padding: 0.75rem;
    }
    
    .dashboard-header {
      padding: 1.5rem;
    }
    
    .dashboard-header h1 {
      font-size: 1.5rem;
    }
    
    .tab-content-inner,
    .scrollable-content {
      padding: 1rem;
    }
    
    .button-group {
      flex-direction: column;
      padding: 1rem;
    }
    
    table {
      font-size: 0.875rem;
    }
    
    th, td {
      padding: 0.5rem;
    }
    
    .config-textarea {
      min-height: 300px;
      padding: 1rem;
    }
  }
`;

app.post('/login', async(c) => {
  const param = await c.req.json();
  console.debug("/login -> req:", param)

  const resultObj = {
    code: 0,
    msg: "success",
  }

  const password = c.env.PASSWORD
  if (password !== param.password) {
    console.warn(`password not match, [${password}] != [${param.password}]`)
    resultObj.code = 1
    resultObj.msg = "password not match"
    return c.json(resultObj, 401)
  }

  // 设置cookie
  const authPass = generatePasswordHash(c.env.PASSWORD, c.env.SALT)
  setCookie(c, 'auth', authPass, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 // 1天有效期
  });

  // 跳转到dashboard页面
  return c.json(resultObj)
})

app.get('/set', async (c) => {
  const valueStr = JSON.stringify({foo: 'bar'})
  await c.env.SUB_MERGER_KV.put('foo', valueStr)
  return c.text(`set succ, foo=${valueStr}`)
})

app.get('/get', async (c) => {
  const result = await c.env.SUB_MERGER_KV.get('foo', 'json')
  console.debug("/get, reuslt=", result)
  await c.env.SUB_MERGER_KV.delete('foo')

  const outputStr = result ? JSON.stringify(result) : ''
  return c.text(`get succ, foo=[${outputStr}]`)
})

// 创建一个中间件来验证用户是否已登录
const authMiddleware = async (c, next) => {
  const authPass = generatePasswordHash(c.env.PASSWORD, c.env.SALT)
  const authCookie = getCookie(c, 'auth')
  if (authCookie !== authPass) {
    // 如果未登录，重定向到首页
    deleteCookie(c, 'auth')
    return c.redirect('/')
  }
  // 如果已登录，继续执行下一个中间件或路由处理器
  await next()
};

// 将中间件应用到需要身份验证的路由
app.use('/dashboard', authMiddleware)
app.use('/api/*', authMiddleware)

async function GetSubYamlWithCache(subType: SubscriptionType, env: Bindings, noCache: boolean = false): Promise<FinalObj> {
  console.debug("GetSubYamlWithCache, subType=", subType, "noCache=", noCache)

  const cacheKey = `${env.TABLENAME}:${env.KEY_VERSION}:cacheObj:${subType}`

  if (!noCache) {
    // 优先从缓存中获取
    console.debug("===== 1. 优先从缓存中获取 ======")
    const subCacheObj = await env.SUB_MERGER_KV.get(cacheKey, "json")
    if (subCacheObj) {
      console.debug("===== 2. 从缓存中获取成功 ======")
      return subCacheObj
    }
  }

  const finalObj: FinalObj = {
    subUserInfo: {
      upload: 0,
        download: 0,
        total: 0,
        expire: 9999999999,
    },
    normalYaml: '',
    stashYaml: '',
  }

  // 没有缓存，或者要求不从缓存获取
  const subData = await env.SUB_MERGER_KV.get(env.TABLENAME, "json")
  if (!subData) {
    // 没有配置订阅源
    finalObj.normalYaml = '# 没有配置订阅源（通用）'
    finalObj.stashYaml = '# 没有配置订阅源（Stash）'
    return finalObj
  }

  const allTarget = subData.filter(sub => sub.subType === subType)
  if (allTarget.length === 0) {
    // 没有匹配类型的订阅源
    finalObj.normalYaml = `# 没有配置该类型的订阅源（通用）：${subType}`
    finalObj.stashYaml = `# 没有配置该类型的订阅源（Stash）：${subType}`
    return finalObj
  }

  const [subuserInfo, totalNode] = await getSubscribeYaml(allTarget, env)
  const {normalYaml, stashYaml} = await generateProxyConfigYaml(totalNode, subType === SubscriptionType.Monthly ? env.SUBSCRIBE_PATTERN : env.ONETIME_PATTERN, env)
  const defaultYaml = await getDefaultYaml(env)
  finalObj.normalYaml = `# 最后更新时间（通用）：${dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')}\n\n` + normalYaml + defaultYaml
  finalObj.stashYaml = `# 最后更新时间（Stash）：${dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')}\n\n` + stashYaml + defaultYaml
  finalObj.subUserInfo = subuserInfo

  // 设置缓存
  await env.SUB_MERGER_KV.put(cacheKey, JSON.stringify(finalObj))

  return finalObj
}

app.get('/onetime/:magic', async (c) => {
  const magic = c.req.param('magic')
  if (magic !== c.env.MAGIC) {
    return c.text('magic not match', 403)
  }

  console.debug(`/onetime -> User-Agent=[${c.req.header('user-agent')}]`)

  const instantRefreshInterval = c.env.INSTANT_REFRESH_INTERVAL ? parseInt(c.env.INSTANT_REFRESH_INTERVAL) : 300
  const currTimeStamp = dayjs().unix()
  const subType = SubscriptionType.TrafficPackage

  // 获取上次访问接口的时间
  const accessKey = `${c.env.TABLENAME}:${c.env.KEY_VERSION}:access:${subType}`
  const lastAccessObj = await c.env.SUB_MERGER_KV.get(accessKey, "json")
  const lastAccessTimeStamp = lastAccessObj?.lastAccessTimeStamp || 0
  const diff = currTimeStamp - lastAccessTimeStamp
  const noCache = diff < instantRefreshInterval

  console.debug("GetSubYamlWithCache, subType=", subType, "noCache=", noCache, "instantRefreshInterval=", instantRefreshInterval, 
    "currTimeStamp=", currTimeStamp, "lastAccessTimeStamp=", lastAccessTimeStamp, "diff=", diff)

  // 获取订阅数据
  const finalObj = await GetSubYamlWithCache(subType, c.env, noCache)

  // 更新访问时间
  const lastAccessStr = JSON.stringify({lastAccessTimeStamp: currTimeStamp})
  await c.env.SUB_MERGER_KV.put(accessKey, lastAccessStr)

  // 设置流量和使用时长信息
  c.header('subscription-userinfo', generateSubscriptionUserInfoString(finalObj.subUserInfo))

  // 设置文件名
  const fileName = encodeURIComponent(`流量包（订阅合并）`)
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`)

  // 检查user-agent是否包含Stash
  const userAgent = c.req.header('user-agent') || '';
  if (userAgent.toLowerCase().includes('stash')) {
    // 如果包含Stash，进行节点过滤
    return c.text(finalObj.stashYaml)
  }

  return c.text(finalObj.normalYaml)
})

app.get('/subscribe/:magic', async (c) => {
  const magic = c.req.param('magic')
  if (magic !== c.env.MAGIC) {
    return c.text('magic not match', 403)
  }
  console.debug(`/subscribe -> User-Agent=[${c.req.header('user-agent')}]`)

  const instantRefreshInterval = c.env.INSTANT_REFRESH_INTERVAL ? parseInt(c.env.INSTANT_REFRESH_INTERVAL) : 300
  const currTimeStamp = dayjs().unix()
  const subType = SubscriptionType.Monthly

  // 获取上次访问接口的时间
  const accessKey = `${c.env.TABLENAME}:${c.env.KEY_VERSION}:access:${subType}`
  const lastAccessObj = await c.env.SUB_MERGER_KV.get(accessKey, "json")
  const lastAccessTimeStamp = lastAccessObj?.lastAccessTimeStamp || 0
  const diff = currTimeStamp - lastAccessTimeStamp
  const noCache = diff < instantRefreshInterval

  console.debug("GetSubYamlWithCache, subType=", subType, "noCache=", noCache, "instantRefreshInterval=", instantRefreshInterval, 
    "currTimeStamp=", currTimeStamp, "lastAccessTimeStamp=", lastAccessTimeStamp, "diff=", diff)

  // 获取订阅数据
  const finalObj = await GetSubYamlWithCache(subType, c.env, noCache)

  // 更新访问时间
  const lastAccessStr = JSON.stringify({lastAccessTimeStamp: currTimeStamp})
  await c.env.SUB_MERGER_KV.put(accessKey, lastAccessStr)

  // 设置流量和使用时长信息
  c.header('subscription-userinfo', generateSubscriptionUserInfoString(finalObj.subUserInfo))

  // 设置文件名
  const fileName = encodeURIComponent(`包年包月（订阅合并)`)
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`)

  // 检查user-agent是否包含Stash
  const userAgent = c.req.header('user-agent') || '';
  if (userAgent.toLowerCase().includes('stash')) {
    // 如果包含Stash，进行节点过滤
    return c.text(finalObj.stashYaml)
  }

  return c.text(finalObj.normalYaml)
})

app.get('/', (c) => { 
  // 检查cookie中的auth状态
  const authPass = generatePasswordHash(c.env.PASSWORD, c.env.SALT)
  const authCookie = getCookie(c, 'auth')
  if (authCookie === authPass) {
    // 如果已经验证通过，直接跳转到dashboard页面
    return c.redirect('/dashboard')
  }

  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>登录</title>
      <style>${globalStyles}</style>
    </head>
    <body>
      <div class="container">
        <form class="form" id="loginForm">
          <input type="password" id="password" placeholder="请输入密码" required>
          <button type="submit">登录</button>
          <div id="errorMessage" class="error-message"></div>
        </form>
      </div>
      <script>
        function showError(message) {
          const errorElement = document.getElementById('errorMessage');
          errorElement.textContent = message;
          errorElement.style.display = 'block';
        }

        function hideError() {
          const errorElement = document.getElementById('errorMessage');
          errorElement.style.display = 'none';
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          hideError();
          const password = document.getElementById('password').value;
          try {
            const response = await fetch('/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password }),
            });
            const data = await response.json();
            if (data.code === 0) {
              window.location.href = '/dashboard';
            } else {
              showError(data.msg);
            }
          } catch (error) {
            console.error('登录出错:', error);
            showError('登录过程中出现错误');
          }
        });
      </script>
    </body>
    </html>
  `)
})


app.get('/dashboard', async (c) => {
  
  const subData = await c.env.SUB_MERGER_KV.get(c.env.TABLENAME, "json")
  const subscriptions = subData || [] //[{subName: '机场1', subType: '包年/包月', subUrl: 'https://example.com/sub1'}, {subName: '机场2', subType: '流量包', subUrl: 'https://example.com/sub2'}]

  const magic = c.env.MAGIC
  const suffix = magic ? `/${magic}` : ''

  // 步骤1: 将subscriptions转换为JavaScript数组字符串
  const subscriptionsScript = `
    <script>
      let subscriptions = ${JSON.stringify(subscriptions)};
    </script>
  `;

  // 步骤2: HTML和主要的JavaScript代码
  const mainHtml = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>订阅管理控制台</title>
    <style>${globalStyles}</style>
  </head>
  <body>
    <div class="container">
      <div class="dashboard-header">
        <h1>🚀 订阅管理控制台</h1>
      </div>
      
      <div class="tabs">
        <button class="tab active" onclick="switchTab('subscriptions')">📋 订阅管理</button>
        <button class="tab" onclick="switchTab('nodes')">🔧 自建节点</button>
        <button class="tab" onclick="switchTab('yaml')">⚙️ YAML配置</button>
        <button class="tab" onclick="switchTab('links')">🔗 订阅链接</button>
      </div>
      
      <!-- 订阅管理标签页 -->
      <div id="subscriptions" class="tab-content active">
        <div class="tab-content-header">
          <h2>订阅源管理</h2>
        </div>
        <div class="tab-content-inner">
          <div style="overflow-x: auto;">
            <table id="subscriptionsTable">
              <thead>
                <tr>
                  <th>机场名称</th>
                  <th>订阅类型</th>
                  <th>订阅链接</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="subscriptionsBody">
              </tbody>
            </table>
          </div>
        </div>
        <div class="button-group fixed-bottom-buttons">
          <button class="btn btn-add" onclick="addRow()">➕ 添加订阅源</button>
          <button class="btn btn-save" onclick="saveChanges()">💾 保存更改</button>
        </div>
      </div>
      
      <!-- 自建节点配置标签页 -->
      <div id="nodes" class="tab-content">
        <div class="tab-content-header">
          <h2>自建节点配置</h2>
        </div>
        <div class="scrollable-content">
          <div class="config-item">
            <label class="config-label" for="selfNodeConfig">
              🖥️ 自建节点配置 (JSON格式)
              <small style="color: #6c757d; font-weight: normal;">配置你的自建代理节点，支持各种协议</small>
            </label>
            <textarea id="selfNodeConfig" class="config-textarea" placeholder="请输入自建节点的JSON配置，例如：
[
  {
    &quot;name&quot;: &quot;自建节点1&quot;,
    &quot;type&quot;: &quot;ss&quot;,
    &quot;server&quot;: &quot;your-server.com&quot;,
    &quot;port&quot;: 8388,
    &quot;cipher&quot;: &quot;aes-256-gcm&quot;,
    &quot;password&quot;: &quot;your-password&quot;
  },
  {
    &quot;name&quot;: &quot;自建节点2&quot;,
    &quot;type&quot;: &quot;vmess&quot;,
    &quot;server&quot;: &quot;your-server2.com&quot;,
    &quot;port&quot;: 443,
    &quot;uuid&quot;: &quot;your-uuid&quot;,
    &quot;alterId&quot;: 0,
    &quot;cipher&quot;: &quot;auto&quot;,
    &quot;network&quot;: &quot;ws&quot;,
    &quot;ws-opts&quot;: {
      &quot;path&quot;: &quot;/path&quot;,
      &quot;headers&quot;: {
        &quot;Host&quot;: &quot;your-server2.com&quot;
      }
    },
    &quot;tls&quot;: true
  }
]"></textarea>
          </div>
        </div>
        <div class="button-group fixed-bottom-buttons">
          <button class="btn btn-save" onclick="saveConfig()">💾 保存节点配置</button>
        </div>
      </div>
      
      <!-- YAML配置标签页 -->
      <div id="yaml" class="tab-content">
        <div class="tab-content-header">
          <h2>默认YAML规则配置</h2>
        </div>
        <div class="scrollable-content">
          <div class="config-item">
            <label class="config-label" for="defaultYamlConfig">
              📝 默认YAML规则配置
              <small style="color: #6c757d; font-weight: normal;">配置DNS、规则提供者和路由规则</small>
            </label>
            <textarea id="defaultYamlConfig" class="config-textarea" placeholder="请输入默认的YAML规则配置，例如：
dns:
  enable: true
  listen: 0.0.0.0:53
  default-nameserver:
    - 119.29.29.29
    - 223.5.5.5
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://1.1.1.1/dns-query
    - https://dns.google/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4

rule-providers:
  reject:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt
    path: ./ruleset/reject.yaml
    interval: 86400

  icloud:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt
    path: ./ruleset/icloud.yaml
    interval: 86400

  apple:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt
    path: ./ruleset/apple.yaml
    interval: 86400

  google:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt
    path: ./ruleset/google.yaml
    interval: 86400

  proxy:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt
    path: ./ruleset/proxy.yaml
    interval: 86400

  direct:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt
    path: ./ruleset/direct.yaml
    interval: 86400

  cncidr:
    type: http
    behavior: ipcidr
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt
    path: ./ruleset/cncidr.yaml
    interval: 86400

rules:
  - RULE-SET,reject,REJECT
  - RULE-SET,icloud,DIRECT
  - RULE-SET,apple,DIRECT
  - RULE-SET,google,节点选择
  - RULE-SET,proxy,节点选择
  - RULE-SET,direct,DIRECT
  - RULE-SET,cncidr,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,节点选择"></textarea>
          </div>
        </div>
        <div class="button-group fixed-bottom-buttons">
          <button class="btn btn-save" onclick="saveConfig()">💾 保存YAML配置</button>
        </div>
      </div>
      
      <!-- 订阅链接标签页 -->
      <div id="links" class="tab-content">
        <div class="tab-content-header">
          <h2>合并后的订阅链接</h2>
        </div>
        <div class="tab-content-inner">
          <table id="mergedSubscriptionsTable">
            <thead>
              <tr>
                <th style="width: 20%;">订阅类型</th>
                <th style="width: 60%;">链接地址</th>
                <th style="width: 20%;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>📅 包年/包月</strong></td>
                <td><div class="link-display" id="subscribeLink"></div></td>
                <td>
                  <button class="btn btn-copy" onclick="copyToClipboard('subscribeLink', this)">
                    📋 复制链接
                    <span class="copy-tooltip">已复制到剪贴板!</span>
                  </button>
                </td>
              </tr>
              <tr>
                <td><strong>📦 流量包</strong></td>
                <td><div class="link-display" id="onetimeLink"></div></td>
                <td>
                  <button class="btn btn-copy" onclick="copyToClipboard('onetimeLink', this)">
                    📋 复制链接
                    <span class="copy-tooltip">已复制到剪贴板!</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <script>
      // 当前活动的标签页
      let currentTab = 'subscriptions';
      
      // 标签页切换功能
      function switchTab(tabName) {
        // 隐藏所有标签页内容
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // 移除所有标签的活动状态
        document.querySelectorAll('.tab').forEach(tab => {
          tab.classList.remove('active');
        });
        
        // 显示选中的标签页内容
        document.getElementById(tabName).classList.add('active');
        
        // 设置对应标签为活动状态
        event.target.classList.add('active');
        
        currentTab = tabName;
      }
      
      function renderTable(newSubscriptions) {
        const currSubData = newSubscriptions || subscriptions
        const tbody = document.getElementById('subscriptionsBody');
        tbody.innerHTML = currSubData.map((sub, index) => 
          '<tr>' +
            '<td><input type="text" value="' + (sub.subName || '') + '" data-field="subName" placeholder="输入机场名称"></td>' +
            '<td>' +
              '<select data-field="subType">' +
                '<option value="包年/包月"' + (sub.subType === '包年/包月' ? ' selected' : '') + '>📅 包年/包月</option>' +
                '<option value="流量包"' + (sub.subType === '流量包' ? ' selected' : '') + '>📦 流量包</option>' +
              '</select>' +
            '</td>' +
            '<td><input type="text" class="subscription-url" value="' + (sub.subUrl || '') + '" data-field="subUrl" placeholder="输入订阅链接URL"></td>' +
            '<td>' +
              '<div class="action-buttons">' +
                '<button class="btn btn-delete" onclick="deleteRow(' + index + ')" title="删除此订阅源">🗑️ 删除</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        ).join('');
      }

      function addRow() {
        subscriptions.push({subName: '', subType: '包年/包月', subUrl: ''});
        const tbody = document.getElementById('subscriptionsBody');
        const newRowIndex = subscriptions.length - 1;
        const newRow = document.createElement('tr');
        newRow.innerHTML = 
          '<td><input type="text" value="" data-field="subName" placeholder="输入机场名称"></td>' +
          '<td>' +
            '<select data-field="subType">' +
              '<option value="包年/包月" selected>📅 包年/包月</option>' +
              '<option value="流量包">📦 流量包</option>' +
            '</select>' +
          '</td>' +
          '<td><input type="text" class="subscription-url" value="" data-field="subUrl" placeholder="输入订阅链接URL"></td>' +
          '<td>' +
            '<div class="action-buttons">' +
              '<button class="btn btn-delete" onclick="deleteRow(' + newRowIndex + ')" title="删除此订阅源">🗑️ 删除</button>' +
            '</div>' +
          '</td>';
        tbody.appendChild(newRow);
      }

      function deleteRow(index) {
        if (confirm('确定要删除这个订阅源吗？')) {
          const table = document.getElementById('subscriptionsTable').getElementsByTagName('tbody')[0];
          const rows = Array.from(table.rows);
          const newSubscriptions = rows.map((row, idx) => {
            const subName = row.querySelector('[data-field="subName"]').value.trim();
            const subType = row.querySelector('[data-field="subType"]').value;
            const subUrl = row.querySelector('[data-field="subUrl"]').value.trim();
            return { subName, subType, subUrl }
          })
          newSubscriptions.splice(index, 1);
          renderTable(newSubscriptions);
        }
      }

      function isValidUrl(string) {
        try {
          new URL(string);
          return true;
        } catch (_) {
          return false;  
        }
      }

      function saveChanges() {
        const table = document.getElementById('subscriptionsTable').getElementsByTagName('tbody')[0];
        const rows = Array.from(table.rows);
        
        if (rows.length === 0) {
          alert('❌ 错误: 至少需要添加一个订阅源才能保存');
          return;
        }

        let isValid = true;
        let errorMessage = '';

        const newSubscriptions = rows.map((row, index) => {
          const subName = row.querySelector('[data-field="subName"]').value.trim();
          const subType = row.querySelector('[data-field="subType"]').value;
          const subUrl = row.querySelector('[data-field="subUrl"]').value.trim();

          if (subName === '') {
            isValid = false;
            errorMessage += '第 ' + (index + 1) + ' 行: 机场名不能为空\\n';
          }

          if (!isValidUrl(subUrl)) {
            isValid = false;
            errorMessage += '第 ' + (index + 1) + ' 行: 订阅链接必须是一个合法的网址\\n';
          }

          if (subType !== '包年/包月' && subType !== '流量包') {
            isValid = false;
            errorMessage += '第 ' + (index + 1) + ' 行: 订阅类型必须是"包年/包月"或"流量包"\\n';
          }

          return { subName, subType, subUrl };
        });

        if (!isValid) {
          alert('❌ 保存失败，请修正以下错误:\\n\\n' + errorMessage);
          return;
        }

        subscriptions = newSubscriptions;

        const saveButton = event.target;
        const originalText = saveButton.textContent;
        saveButton.textContent = '💾 保存中...';
        saveButton.disabled = true;

        fetch('/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscriptions }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.code === 0) {
            alert('✅ 订阅源配置保存成功！');
          } else {
            alert('❌ 保存失败: ' + (data.msg || '未知错误'));
          }
        })
        .catch(error => {
          console.error('保存出错:', error);
          alert('❌ 保存过程中出现网络错误');
        })
        .finally(() => {
          saveButton.textContent = originalText;
          saveButton.disabled = false;
        });
      }

      function updateMergedLinks() {
        const currentUrl = window.location.origin;
        document.getElementById('subscribeLink').textContent = currentUrl + '/subscribe${suffix}';
        document.getElementById('onetimeLink').textContent = currentUrl + '/onetime${suffix}';
      }

      function copyToClipboard(elementId, button) {
        const text = document.getElementById(elementId).textContent;
        navigator.clipboard.writeText(text).then(() => {
          const tooltip = button.querySelector('.copy-tooltip');
          tooltip.classList.add('show');
          setTimeout(() => {
            tooltip.classList.remove('show');
          }, 2000);
        }, (err) => {
          console.error('无法复制文本: ', err);
          // 降级方案：使用传统的复制方法
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            const tooltip = button.querySelector('.copy-tooltip');
            tooltip.classList.add('show');
            setTimeout(() => {
              tooltip.classList.remove('show');
            }, 2000);
          } catch (err) {
            alert('复制失败，请手动复制链接');
          }
          document.body.removeChild(textArea);
        });
      }

      function loadConfig() {
        fetch('/api/config')
          .then(response => response.json())
          .then(data => {
            if (data.code === 0) {
              document.getElementById('selfNodeConfig').value = data.data.selfNodeData || '';
              document.getElementById('defaultYamlConfig').value = data.data.defaultYaml || '';
            } else {
              console.error('加载配置失败:', data.msg);
            }
          })
          .catch(error => {
            console.error('加载配置出错:', error);
          });
      }

      function saveConfig() {
        const selfNodeData = document.getElementById('selfNodeConfig').value.trim();
        const defaultYaml = document.getElementById('defaultYamlConfig').value.trim();

        // 验证自建节点配置是否为有效JSON（如果不为空）
        if (selfNodeData) {
          try {
            const parsed = JSON.parse(selfNodeData);
            if (!Array.isArray(parsed)) {
              alert('❌ 自建节点配置必须是一个JSON数组');
              return;
            }
          } catch (error) {
            alert('❌ 自建节点配置不是有效的JSON格式:\\n\\n' + error.message);
            return;
          }
        }

        const saveButton = event.target;
        const originalText = saveButton.textContent;
        saveButton.textContent = '💾 保存中...';
        saveButton.disabled = true;

        fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ selfNodeData, defaultYaml }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.code === 0) {
            alert('✅ 配置保存成功！缓存已自动清理，新配置将在下次订阅更新时生效。');
          } else {
            alert('❌ 配置保存失败: ' + (data.msg || '未知错误'));
          }
        })
        .catch(error => {
          console.error('保存配置出错:', error);
          alert('❌ 保存配置过程中出现网络错误');
        })
        .finally(() => {
          saveButton.textContent = originalText;
          saveButton.disabled = false;
        });
      }

      // 页面加载完成后初始化
      renderTable();
      updateMergedLinks();
      loadConfig();
    </script>
  </body>
  </html>
`;

  // 组合两部分
  return c.html(subscriptionsScript + mainHtml);
});

app.post('/api/save', async (c) => {
  const param = await c.req.json();
  console.debug("/api/save -> req:", param)

  const resultObj = {
    code: 0,
    msg: "success",
  }

  const subscriptions = param.subscriptions
  if (!subscriptions || subscriptions.length === 0) {
    console.warn("no subscriptions or empty", param)
    resultObj.code = 1
    resultObj.msg = "no subscriptions or empty"
    return c.json(resultObj, 400)
  }

  // 过滤一下字段前后可能存在的空格/回车
  const realSubscriptions = subscriptions.map(sub => {
    sub.subName = sub.subName.trim()
    sub.subType = sub.subType.trim()
    sub.subUrl = sub.subUrl.trim()
    return sub
  })

  await c.env.SUB_MERGER_KV.put(c.env.TABLENAME, JSON.stringify(realSubscriptions));

  return c.json(resultObj, 200);
});

app.get('/api/config', async (c) => {
  const configKey = `${c.env.TABLENAME}:config`
  const config = await c.env.SUB_MERGER_KV.get(configKey, "json")
  
  // 获取默认值作为备用
  const { getDefaultSelfNodeData } = await import('./data/selfNodeData')
  const { getDefaultYamlString } = await import('./data/defaultYmal')
  
  return c.json({
    code: 0,
    data: config || {
      selfNodeData: getDefaultSelfNodeData(),
      defaultYaml: getDefaultYamlString()
    }
  })
});

app.post('/api/config', async (c) => {
  const param = await c.req.json();
  console.debug("/api/config -> req:", param)

  const resultObj = {
    code: 0,
    msg: "success",
  }

  const { selfNodeData, defaultYaml } = param;
  
  if (selfNodeData === undefined || defaultYaml === undefined) {
    resultObj.code = 1
    resultObj.msg = "selfNodeData and defaultYaml are required"
    return c.json(resultObj, 400)
  }

  const config = {
    selfNodeData: selfNodeData.trim(),
    defaultYaml: defaultYaml.trim(),
    updatedAt: new Date().toISOString()
  };

  const configKey = `${c.env.TABLENAME}:config`
  await c.env.SUB_MERGER_KV.put(configKey, JSON.stringify(config));

  // 清理缓存，强制重新生成配置
  const cacheKeys = [
    `${c.env.TABLENAME}:${c.env.KEY_VERSION}:cacheObj:${SubscriptionType.Monthly}`,
    `${c.env.TABLENAME}:${c.env.KEY_VERSION}:cacheObj:${SubscriptionType.TrafficPackage}`
  ];
  
  for (const key of cacheKeys) {
    await c.env.SUB_MERGER_KV.delete(key);
  }

  return c.json(resultObj, 200);
});


// 定时任务
async function scheduled(batch, env: Bindings) {
  console.log("===== scheduled begin =====")
  
  // 不使用缓存获取订阅信息
  let finalYaml = await GetSubYamlWithCache(SubscriptionType.TrafficPackage, env, true)
  finalYaml = await GetSubYamlWithCache(SubscriptionType.Monthly, env, true)

  console.log("===== scheduled end =====")
}

export default {
  fetch: app.fetch,
  scheduled: scheduled,
}
