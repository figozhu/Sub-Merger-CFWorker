import axios from 'axios';
import { getProxyNodesFromYaml } from './getProxyNodeFromyaml'

async function getSubscribeYaml(subArr: any[], userAgent: string, proxy?: string): Promise<any[]> {
    console.debug("getSubscribeYaml", "订阅源数量=", subArr.length, "使用的UA=", userAgent, "使用的代理=", proxy)
    
    const config: any = {
        headers: {
            'User-Agent': userAgent ? userAgent : 'clash-verge/v1.7.7'
        },
        timeout: 3000
    };

    if (proxy) {
        config.proxy = {
            host: proxy.split(':')[0],
            port: parseInt(proxy.split(':')[1])
        };
    }

    // 使用 Promise.all 并发请求
    const promises = subArr.map(async (oneSub) => {
        try {
            const response = await axios.get(oneSub.subUrl, config);
            if (response.status === 200) {
                const yamlContent = response.data;
                return getProxyNodesFromYaml(yamlContent, oneSub.subName);
            } else {
                console.error(`请求失败,URL: ${oneSub.subUrl}, 状态码: ${response.status}`);
                return [];
            }
        } catch (error) {
            console.error(`获取订阅内容时发生异常, URL: ${oneSub.subUrl}`);
            return [];
        }
    });

    const results = await Promise.all(promises);
    return results.flat();
}

export default getSubscribeYaml;
