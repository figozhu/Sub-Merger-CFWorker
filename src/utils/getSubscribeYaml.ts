import { sendBarkNotification } from '../notify/bark';
import { getProxyNodesFromYaml } from './getProxyNodeFromyaml'

function printAllHeaders(response: Response) {
  console.log("响应头:");
  for (const [key, value] of response.headers.entries()) {
    console.log(`${key}: ${value}`);
  }
}

function parseSubscriptionUserInfo(header: string | null): SubUserInfo {
    console.debug("parseSubscriptionUserInfo", "header=", header)
    const defaultInfo = {
        upload: 0,
        download: 0,
        total: 0,
        expire: 9999999999
    };

    if (!header) {
        return defaultInfo;
    }

    const pairs = header.split(';').map(pair => pair.trim());
    const result = { ...defaultInfo };

    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
        switch (key) {
            case 'upload':
            case 'download':
            case 'total':
            case 'expire':
            result[key] = parseInt(value, 10) || defaultInfo[key];
            break;
        }
        }
    });

    return result;
}

function generateSubscriptionUserInfoString(userInfo: SubUserInfo): string {
  const parts = [
    `upload=${userInfo.upload}`,
    `download=${userInfo.download}`,
    `total=${userInfo.total}`,
    `expire=${userInfo.expire}`
  ];
  return parts.join('; ');
}


function updateTotalUserInfo(totalUserInfo: SubUserInfo, newUserInfo: SubUserInfo) {
    totalUserInfo.upload += newUserInfo.upload
    totalUserInfo.download += newUserInfo.download
    totalUserInfo.total += newUserInfo.total
    totalUserInfo.expire = Math.min(totalUserInfo.expire, newUserInfo.expire)
}

async function getSubscribeYaml(subArr: any[], envConfig: any): Promise<any[]> {
    const userAgent = envConfig.UA
    const barkOpenid = envConfig.NOTIFICATION?.BARK_OPENID
    console.debug("getSubscribeYaml", "订阅源数量=", subArr.length, "使用的UA=", userAgent, "Bark OpenID=", barkOpenid)
    
    const headers = {
        accept: '*/*',
        'accept-encoding': 'br, gzip',
        'User-Agent': userAgent ? userAgent : 'clash-verge/v1.7.7'
    };

    const subUserInfo = {
        upload: 0,
        download: 0,
        total: 0,
        expire: 9999999999,
    }

    // 使用 Promise.all 并发请求
    const promises = subArr.map(async (oneSub) => {
        try {
            const response = await fetch(oneSub.subUrl, {
                method: 'GET',
                headers: headers,
            });

            if (response.ok) {
                const tmpSubUserInfo = parseSubscriptionUserInfo(response.headers.get('subscription-userinfo'))
                updateTotalUserInfo(subUserInfo, tmpSubUserInfo)
                const yamlContent = await response.text();
                console.debug(`getSubscribeYaml: 获取订阅源信息成功，订阅源名称：${oneSub.subName}`)
                return getProxyNodesFromYaml(yamlContent, oneSub.subName);
            } else {
                console.error(`getSubscribeYaml: 请求失败: Name: ${oneSub.subName}, URL: ${oneSub.subUrl}, 状态码: ${response.status}`);
                sendBarkNotification(barkOpenid, 'CF-Sub-Merger: 订阅源更新失败', `订阅源名称：${oneSub.subName}，HTTP响应状态码：${response.status}`)
                return [];
            }
        } catch (error) {
            console.error(`getSubscribeYaml: 获取订阅内容时发生异常: Name: ${oneSub.subName}, URL: ${oneSub.subUrl}`, error);
            sendBarkNotification(barkOpenid, 'CF-Sub-Merger: 订阅源更新失败', `订阅源名称：${oneSub.subName}，错误信息：${error}`)
            return [];
        }
    });

    const results = await Promise.all(promises);
    return [subUserInfo, results.flat()];
}

export {getSubscribeYaml, generateSubscriptionUserInfoString};
