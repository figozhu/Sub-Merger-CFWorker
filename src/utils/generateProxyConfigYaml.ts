
import YAML from 'yaml'
import { filterProxyForStash } from './filterForStash';

function filterNodes(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  if (pattern === "") {
    return nodes;
  }
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name))
}

function filterNodesForStash(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  if (pattern === "") {
    return nodes;
  }
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name)).filter(node => filterProxyForStash(node))
}


interface IProxyYamlInfo {
  normalYaml: string;
  stashYaml: string;
}

function generateProxyConfigYaml(totalNode: any[], envConfig: Record<string, string>) : IProxyYamlInfo {
  // console.debug('generateProxyConfigYaml: envConfig', envConfig)
 
  const allowNodes = filterNodes(totalNode, envConfig.EXCLUDE_PATTERN || '', true);
  let otherNodes = filterNodes(allowNodes, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodes = filterNodes(otherNodes, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let youtubeNodes = filterNodes(allowNodes, envConfig.YOUTUBE_MATCH_PATTERN || '', false);
  youtubeNodes = filterNodes(youtubeNodes, envConfig.YOUTUBE_EXCLUDE_PATTERN || '', true);
  let embyNodes = filterNodes(allowNodes, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodes = filterNodes(embyNodes, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let twitterNodes = filterNodes(allowNodes, envConfig.TWITTER_MATCH_PATTERN || '', false);
  twitterNodes = filterNodes(twitterNodes, envConfig.TWITTER_EXCLUDE_PATTERN || '', true);
  let telegramNodes = filterNodes(allowNodes, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodes = filterNodes(telegramNodes, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodes = filterNodes(allowNodes, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodes = filterNodes(steamNodes, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let fallbackNodes = filterNodes(allowNodes, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodes = filterNodes(fallbackNodes, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

  const allowNodesForStash = filterNodesForStash(totalNode, envConfig.EXCLUDE_PATTERN || '', true);
  let otherNodesForStash = filterNodes(allowNodesForStash, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodesForStash = filterNodes(otherNodesForStash, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let youtubeNodesForStash = filterNodes(allowNodesForStash, envConfig.YOUTUBE_MATCH_PATTERN || '', false);
  youtubeNodesForStash = filterNodes(youtubeNodesForStash, envConfig.YOUTUBE_EXCLUDE_PATTERN || '', true);
  let embyNodesForStash = filterNodes(allowNodesForStash, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodesForStash = filterNodes(embyNodesForStash, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let twitterNodesForStash = filterNodes(allowNodesForStash, envConfig.TWITTER_MATCH_PATTERN || '', false);
  twitterNodesForStash = filterNodes(twitterNodesForStash, envConfig.TWITTER_EXCLUDE_PATTERN || '', true);
  let telegramNodesForStash = filterNodes(allowNodesForStash, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodesForStash = filterNodes(telegramNodesForStash, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodesForStash = filterNodes(allowNodesForStash, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodesForStash = filterNodes(steamNodesForStash, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let fallbackNodesForStash = filterNodes(allowNodesForStash, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodesForStash = filterNodes(allowNodesForStash, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

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
      name: 'EMBY',
      type: 'select',
      proxies: embyNodes.map((node: any) => node.name),
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
      name: 'EMBY',
      type: 'select',
      proxies: embyNodesForStash.map((node: any) => node.name),
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
