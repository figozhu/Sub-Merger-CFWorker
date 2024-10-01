
import YAML from 'yaml'
import { filterProxyForStash } from './filterForStash';

function filterNodes(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name))
}

function filterNodesForStash(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name)).filter(node => filterProxyForStash(node))
}


interface IProxyYamlInfo {
  normalYaml: string;
  stashYaml: string;
}

function generateProxyConfigYaml(totalNode: any[], envConfig: Record<string, string>) : IProxyYamlInfo {
  console.debug('envConfig', envConfig)
 
  const allowNodes = filterNodes(totalNode, envConfig.EXCLUDE_PATTERN || '', true);
  const otherNodes = filterNodes(allowNodes, envConfig.OTHER_PATTERN || '', false);
  const youtubeNodes = filterNodes(allowNodes, envConfig.YOUTUBE_PATTERN || '', false);
  const twitterNodes = filterNodes(allowNodes, envConfig.TWITTER_PATTERN || '', false);
  const telegramNodes = filterNodes(allowNodes, envConfig.TELEGRAM_PATTERN || '', false);
  const steamNodes = filterNodes(allowNodes, envConfig.STEAM_PATTERN || '', false);
  const fallbackNodes = filterNodes(allowNodes, envConfig.FALLBACK_PATTERN || '', false);

  const allowNodesForStash = filterNodesForStash(totalNode, envConfig.EXCLUDE_PATTERN || '', true);
  const otherNodesForStash = filterNodesForStash(allowNodes, envConfig.OTHER_PATTERN || '', false);
  const youtubeNodesForStash = filterNodesForStash(allowNodes, envConfig.YOUTUBE_PATTERN || '', false);
  const twitterNodesForStash = filterNodesForStash(allowNodes, envConfig.TWITTER_PATTERN || '', false);
  const telegramNodesForStash = filterNodesForStash(allowNodes, envConfig.TELEGRAM_PATTERN || '', false);
  const steamNodesForStash = filterNodesForStash(allowNodes, envConfig.STEAM_PATTERN || '', false);
  const fallbackNodesForStash = filterNodesForStash(allowNodes, envConfig.FALLBACK_PATTERN || '', false);

  // 生成 proxy-groups 配置
  const proxyGroups = [
    {
        name: '其它流量',
        type: 'select',
        proxies: otherNodes.map((node: any) => node.name),
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
      name: 'MediaTelegram',
      type: 'select',
      proxies: telegramNodes.map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
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

  const proxyGroupsForStash = [
    {
        name: '其它流量',
        type: 'select',
        proxies: otherNodesForStash.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: steamNodesForStash.map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
    },
    {
      name: 'MediaTelegram',
      type: 'select',
      proxies: telegramNodesForStash.map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: youtubeNodesForStash.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: twitterNodesForStash.map((node: any) => node.name),
        url: 'http://www.google.com/generate_204',
        interval: 1800,
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: fallbackNodesForStash.map((node: any) => node.name),
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

  const configForStash = {
    proxies : allowNodesForStash,
    'proxy-groups': proxyGroupsForStash,
  };

  const proxyYamlObj: IProxyYamlInfo = {
    normalYaml: YAML.stringify(config),
    stashYaml: YAML.stringify(configForStash),
  }

  return proxyYamlObj;
}

export default generateProxyConfigYaml;
