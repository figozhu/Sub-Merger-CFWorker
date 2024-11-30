
import YAML from 'yaml'
import { filterProxyForStash } from './filterForStash';
import { getSelfNodeData } from '../data/selfNodeData';

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

  const selfNodes = getSelfNodeData();
 
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
        proxies: selfNodes.length > 0 ? ['自建节点', '机场节点'] : otherNodes.map((node: any) => node.name),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: steamNodes.map((node: any) => node.name),
    },
    {
      name: 'MediaTelegram',
      type: 'select',
      proxies: telegramNodes.map((node: any) => node.name),
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: youtubeNodes.map((node: any) => node.name),
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: twitterNodes.map((node: any) => node.name),
    },
    {
      name: 'EMBY',
      type: 'select',
      proxies: embyNodes.map((node: any) => node.name),
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: selfNodes.concat(fallbackNodes).map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
    },
    {
        name: '直接连接',
        type: 'select',
        proxies: ['DIRECT'],
    },
  ];

  if (selfNodes.length > 0) {
    proxyGroups.splice(1, 0, {
      name: '自建节点',
      type: 'select',
      proxies: selfNodes.map((node: any) => node.name),
    },
    {
      name: '机场节点',
      type: 'select',
      proxies: otherNodes.map((node: any) => node.name),
    })
  }

  const proxyGroupsForStash = [
    {
      name: '其它流量',
      type: 'select',
      proxies: selfNodes.length > 0 ? ['自建节点', '机场节点'] : otherNodesForStash.map((node: any) => node.name),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: steamNodesForStash.map((node: any) => node.name),
    },
    {
      name: 'MediaTelegram',
      type: 'select',
      proxies: telegramNodesForStash.map((node: any) => node.name),
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: youtubeNodesForStash.map((node: any) => node.name),
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: twitterNodesForStash.map((node: any) => node.name),
    },
    {
      name: 'EMBY',
      type: 'select',
      proxies: embyNodesForStash.map((node: any) => node.name),
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: selfNodes.concat(fallbackNodesForStash).map((node: any) => node.name),
      url: 'http://www.google.com/generate_204',
      interval: 1800,
    },
    {
        name: '直接连接',
        type: 'select',
        proxies: ['DIRECT'],
    },
  ];

  if (selfNodes.length > 0) {
    proxyGroupsForStash.splice(1, 0,     {
      name: '自建节点',
      type: 'select',
      proxies: selfNodes.map((node: any) => node.name),
    },
    {
      name: '机场节点',
      type: 'select',
      proxies: otherNodesForStash.map((node: any) => node.name),
    })
  }

  // 创建完整的配置对象
  const config = {
    proxies : selfNodes.concat(allowNodes),
    'proxy-groups': proxyGroups,
  };

  const configForStash = {
    proxies : selfNodes.concat(allowNodesForStash),
    'proxy-groups': proxyGroupsForStash,
  };

  const proxyYamlObj: IProxyYamlInfo = {
    normalYaml: YAML.stringify(config),
    stashYaml: YAML.stringify(configForStash),
  }

  return proxyYamlObj;
}

export default generateProxyConfigYaml;
