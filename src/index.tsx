import { Hono } from 'hono'
import {
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
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
  ONETIME_PATTERN: {
    EXCLUDE_PATTERN: string
    FALLBACK_MATCH_PATTERN: string
    OTHER_MATCH_PATTERN: string
    YOUTUBE_MATCH_PATTERN: string
    TWITTER_MATCH_PATTERN: string
    TELEGRAM_MATCH_PATTERN: string
    STEAM_MATCH_PATTERN: string
    FALLBACK_EXCLUDE_PATTERN: string
    OTHER_EXCLUDE_PATTERN: string
    YOUTUBE_EXCLUDE_PATTERN: string
    TWITTER_EXCLUDE_PATTERN: string
    TELEGRAM_EXCLUDE_PATTERN: string
    STEAM_EXCLUDE_PATTERN: string
  }
  SUBSCRIBE_PATTERN: {
    EXCLUDE_PATTERN: string
    FALLBACK_MATCH_PATTERN: string
    OTHER_MATCH_PATTERN: string
    YOUTUBE_MATCH_PATTERN: string
    TWITTER_MATCH_PATTERN: string
    TELEGRAM_MATCH_PATTERN: string
    STEAM_MATCH_PATTERN: string
    FALLBACK_EXCLUDE_PATTERN: string
    OTHER_EXCLUDE_PATTERN: string
    YOUTUBE_EXCLUDE_PATTERN: string
    TWITTER_EXCLUDE_PATTERN: string
    TELEGRAM_EXCLUDE_PATTERN: string
    STEAM_EXCLUDE_PATTERN: string
  }
}

const app = new Hono<{ Bindings: Bindings }>()

const globalStyles = `
  body {
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    background-color: #f0f2f5;
  }
  .container {
    background-color: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 800px;
    width: 100%;
  }
  .form {
    display: flex;
    flex-direction: column;
  }
  input[type="password"], input[type="text"] {
    padding: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  button {
    padding: 0.5rem 1rem;
    background-color: #1890ff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  button:hover {
    background-color: #40a9ff;
  }
  .error-message {
    color: #f44336;
    margin-top: 10px;
    text-align: center;
    display: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  th {
    background-color: #f2f2f2;
  }
  .action-buttons {
    display: flex;
    gap: 5px;
  }
  .btn {
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  .btn-delete {
    background-color: #ff6b6b;
    color: white;
  }
  .btn-delete:hover {
    background-color: #ff4757;
  }
  .btn-add {
    background-color: #6bcd69;
    color: white;
  }
  .btn-add:hover {
    background-color: #5cb85c;
  }
  .btn-save {
    background-color: #3498db;
    color: white;
  }
  .btn-save:hover {
    background-color: #2980b9;
  }
  .btn-copy {
    background-color: #4CAF50;
    color: white;
    position: relative;
  }
  .btn-copy:hover {
    background-color: #45a049;
  }
  
  #mergedSubscriptionsTable {
    margin-top: 2rem;
  }

  .copy-tooltip {
    position: absolute;
    background-color: #333;
    color: #fff;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .copy-tooltip.show {
    opacity: 1;
  }

  h1, h2 {
    color: #333;
    margin-bottom: 1rem;
  }

  .section-divider {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 2rem 0;
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
    padding: 5px;
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
    console.debug("优先从缓存中获取")
    const subCacheObj = await env.SUB_MERGER_KV.get(cacheKey, "json")
    if (subCacheObj) {
      console.debug("从缓存中获取成功")
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

  const [subuserInfo, totalNode] = await getSubscribeYaml(allTarget, env.UA)
  const {normalYaml, stashYaml} = generateProxyConfigYaml(totalNode, subType === SubscriptionType.Monthly ? env.SUBSCRIBE_PATTERN : env.ONETIME_PATTERN)
  const defaultYaml = getDefaultYaml()
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

  c.header('subscription-userinfo', generateSubscriptionUserInfoString(finalObj.subUserInfo))

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

  c.header('subscription-userinfo', generateSubscriptionUserInfoString(finalObj.subUserInfo))

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
    <title>订阅管理</title>
    <style>${globalStyles}</style>
  </head>
  <body>
    <div class="container">
      <h1>订阅管理</h1>
      <div style="overflow-x: auto;">
        <table id="subscriptionsTable">
          <thead>
            <tr>
              <th>机场名</th>
              <th>订阅类型</th>
              <th>订阅链接</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="subscriptionsBody">
          </tbody>
        </table>
      </div>
      <button class="btn btn-add" onclick="addRow()">添加新行</button>
      <button class="btn btn-save" onclick="saveChanges()">保存更改</button>
      
      <hr class="section-divider">
      
      <h2>合并后的订阅链接</h2>
      <table id="mergedSubscriptionsTable">
        <thead>
          <tr>
            <th>订阅类型</th>
            <th>链接</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>包年/包月</td>
            <td id="subscribeLink"></td>
            <td>
              <button class="btn btn-copy" onclick="copyToClipboard('subscribeLink', this)">
                复制
                <span class="copy-tooltip">已复制!</span>
              </button>
            </td>
          </tr>
          <tr>
            <td>流量包</td>
            <td id="onetimeLink"></td>
            <td>
              <button class="btn btn-copy" onclick="copyToClipboard('onetimeLink', this)">
                复制
                <span class="copy-tooltip">已复制!</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <script>
      function renderTable(newSubscriptions) {
        const currSubData = newSubscriptions || subscriptions
        const tbody = document.getElementById('subscriptionsBody');
        tbody.innerHTML = currSubData.map((sub, index) => 
          '<tr>' +
            '<td><input type="text" value="' + (sub.subName || '') + '" data-field="subName"></td>' +
            '<td>' +
              '<select data-field="subType">' +
                '<option value="包年/包月"' + (sub.subType === '包年/包月' ? ' selected' : '') + '>包年/包月</option>' +
                '<option value="流量包"' + (sub.subType === '流量包' ? ' selected' : '') + '>流量包</option>' +
              '</select>' +
            '</td>' +
            '<td><input type="text" class="subscription-url" value="' + (sub.subUrl || '') + '" data-field="subUrl"></td>' +
            '<td>' +
              '<div class="action-buttons">' +
                '<button class="btn btn-delete" onclick="deleteRow(' + index + ')">删除</button>' +
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
          '<td><input type="text" value="" data-field="subName"></td>' +
          '<td>' +
            '<select data-field="subType">' +
              '<option value="包年/包月" selected>包年/包月</option>' +
              '<option value="流量包">流量包</option>' +
            '</select>' +
          '</td>' +
          '<td><input type="text" class="subscription-url" value="" data-field="subUrl"></td>' +
          '<td>' +
            '<div class="action-buttons">' +
              '<button class="btn btn-delete" onclick="deleteRow(' + newRowIndex + ')">删除</button>' +
            '</div>' +
          '</td>';
        tbody.appendChild(newRow);
      }

      function deleteRow(index) {
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
          alert('错误: 至少需要添加一行数据才能保存');
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
          alert('保存失败,请修正以下错误:\\n' + errorMessage);
          return;
        }

        subscriptions = newSubscriptions;

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
            alert('保存成功');
          } else {
            alert('保存失败: ' + (data.msg || '未知错误'));
          }
        })
        .catch(error => {
          console.error('保存出错:', error);
          alert('保存过程中出现错误');
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
        });
      }

      renderTable();
      updateMergedLinks();
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
