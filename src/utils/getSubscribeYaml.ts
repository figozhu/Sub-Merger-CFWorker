import { sendBarkNotification } from '../notify/bark';
import { getProxyNodesFromYaml } from './getProxyNodeFromyaml'
import type { SubUserInfo } from '../types/types'

/**
 * 解析订阅响应中的流量信息头。
 * @param header `subscription-userinfo` 响应头；缺失时使用安全默认值。
 * @returns 规范化的上传、下载、总量和到期时间。
 */
function parseSubscriptionUserInfo(header: string | null): SubUserInfo {
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

/**
 * 将一个订阅源的流量信息累加到汇总对象。
 * @param totalUserInfo 可变的汇总对象。
 * @param newUserInfo 新订阅源的流量信息。
 * @returns 无返回值；函数直接更新汇总对象。
 */
function updateTotalUserInfo(totalUserInfo: SubUserInfo, newUserInfo: SubUserInfo) {
    totalUserInfo.upload += newUserInfo.upload
    totalUserInfo.download += newUserInfo.download
    totalUserInfo.total += newUserInfo.total
    totalUserInfo.expire = Math.min(totalUserInfo.expire, newUserInfo.expire)
}

/**
 * 并发拉取并解析同一类型的全部订阅源。
 * 日志仅记录订阅名称与状态，不输出完整订阅 URL、节点密钥或 Bark OpenID。
 * @param subArr 已保存的订阅源数组。
 * @param envConfig Worker 运行环境与请求 User-Agent 配置。
 * @returns 流量汇总与扁平化节点数组。
 */
async function getSubscribeYaml(subArr: any[], envConfig: any): Promise<any[]> {
    const userAgent = envConfig.UA
    const barkOpenid = envConfig.NOTIFICATION?.BARK_OPENID
    
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
                return getProxyNodesFromYaml(yamlContent, oneSub.subName);
            } else {
                console.error(`getSubscribeYaml: 请求失败: Name: ${oneSub.subName}, 状态码: ${response.status}`);
                sendBarkNotification(barkOpenid, 'CF-Sub-Merger: 订阅源更新失败', `订阅源名称：${oneSub.subName}，HTTP响应状态码：${response.status}`)
                return [];
            }
        } catch (error) {
            console.error(`getSubscribeYaml: 获取订阅内容时发生异常: Name: ${oneSub.subName}`);
            // 外部异常可能包含带凭据的订阅地址，因此通知只发送可公开的订阅名称。
            sendBarkNotification(barkOpenid, 'CF-Sub-Merger: 订阅源更新失败', `订阅源名称：${oneSub.subName}，订阅源请求异常`)
            return [];
        }
    });

    const results = await Promise.all(promises);
    return [subUserInfo, results.flat()];
}

export {getSubscribeYaml, generateSubscriptionUserInfoString};
