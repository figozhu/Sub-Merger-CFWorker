import { Bindings } from 'hono/types';
import YAML from 'yaml'

function filterNodes(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name))
}


function generateProxyConfigYaml(totalNode: any[], envConfig: Record<string, string>) {
  console.debug('envConfig', envConfig)
 
  const allowNodes = filterNodes(totalNode, envConfig.EXCLUDE_PATTERN || '', true);
  const otherNodes = filterNodes(allowNodes, envConfig.OTHER_PATTERN || '', false);
  const youtubeNodes = filterNodes(allowNodes, envConfig.YOUTUBE_PATTERN || '', false);
  const twitterNodes = filterNodes(allowNodes, envConfig.TWITTER_PATTERN || '', false);
  const telegramNodes = filterNodes(allowNodes, envConfig.TELEGRAM_PATTERN || '', false);
  const steamNodes = filterNodes(allowNodes, envConfig.STEAM_PATTERN || '', false);
  const fallbackNodes = filterNodes(allowNodes, envConfig.FALLBACK_PATTERN || '', false);

  // 生成 proxy-groups 配置
  const proxyGroups = [
    {
        name: '其它流量',
        type: 'select',
        proxies: otherNodes.map((node: any) => node.name),
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: youtubeNodes.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: twitterNodes.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
        name: 'MediaTelegram',
        type: 'select',
        proxies: telegramNodes.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
        name: 'GameSteam',
        type: 'select',
        proxies: steamNodes.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: fallbackNodes.map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
  },
    {
        name: '直接连接',
        type: 'select',
        proxies: ['DIRECT'],
    },
  ];

  // 创建完整的配置对象
  const config = {
    proxies : allowNodes,
    'proxy-groups': proxyGroups,
  };

  // 将配置对象转换为 YAML 字符串
  const yamlString = YAML.stringify(config);

  return yamlString;
}

export default generateProxyConfigYaml;
