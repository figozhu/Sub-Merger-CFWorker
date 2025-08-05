
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

function uniqueNodesArr(nodeNameArr: string[]) {
  return Array.from(new Set(nodeNameArr))
}

interface IProxyYamlInfo {
  normalYaml: string;
  stashYaml: string;
}

async function generateProxyConfigYaml(totalNode: any[], envConfig: Record<string, string>, env?: any) : Promise<IProxyYamlInfo> {
  // console.debug('generateProxyConfigYaml: envConfig', envConfig)

  const selfNodes = await getSelfNodeData(env);
  const mergeNodes = selfNodes.concat(totalNode);
  const totalAndSelfNodes = selfNodes.length > 0 ? [{name: '自建节点'}, ...selfNodes, ...totalNode] : totalNode;
  // console.debug('generateProxyConfigYaml: selfNodes', selfNodes);
  // console.debug('generateProxyConfigYaml: mergeNodes', mergeNodes);

  const bMergeFlag = true;  // proxy-groups 中是否合并自建节点
  const realTotalNode = bMergeFlag ? mergeNodes : totalNode;
  // console.debug('generateProxyConfigYaml: realTotalNode', realTotalNode);

 
  const allowNodes = filterNodes(realTotalNode, envConfig.EXCLUDE_PATTERN || '', true);
  let otherNodes = filterNodes(totalNode, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodes = filterNodes(otherNodes, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let youtubeNodes = filterNodes(totalAndSelfNodes, envConfig.YOUTUBE_MATCH_PATTERN || '', false);
  youtubeNodes = filterNodes(youtubeNodes, envConfig.YOUTUBE_EXCLUDE_PATTERN || '', true);
  let embyNodes = filterNodes(totalAndSelfNodes, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodes = filterNodes(embyNodes, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let twitterNodes = filterNodes(totalAndSelfNodes, envConfig.TWITTER_MATCH_PATTERN || '', false);
  twitterNodes = filterNodes(twitterNodes, envConfig.TWITTER_EXCLUDE_PATTERN || '', true);
  let telegramNodes = filterNodes(allowNodes, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodes = filterNodes(telegramNodes, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodes = filterNodes(allowNodes, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodes = filterNodes(steamNodes, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let pokerNodes = filterNodes(allowNodes, envConfig.POKER_MATCH_PATTERN || '', false);
  pokerNodes = filterNodes(pokerNodes, envConfig.POKER_EXCLUDE_PATTERN || '', true);
  let fallbackNodes = filterNodes(allowNodes, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodes = filterNodes(fallbackNodes, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

  const allowNodesForStash = filterNodesForStash(realTotalNode, envConfig.EXCLUDE_PATTERN || '', true);
  let otherNodesForStash = filterNodes(totalNode, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodesForStash = filterNodes(otherNodesForStash, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let youtubeNodesForStash = filterNodes(totalAndSelfNodes, envConfig.YOUTUBE_MATCH_PATTERN || '', false);
  youtubeNodesForStash = filterNodes(youtubeNodesForStash, envConfig.YOUTUBE_EXCLUDE_PATTERN || '', true);
  let embyNodesForStash = filterNodes(totalAndSelfNodes, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodesForStash = filterNodes(embyNodesForStash, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let twitterNodesForStash = filterNodes(totalAndSelfNodes, envConfig.TWITTER_MATCH_PATTERN || '', false);
  twitterNodesForStash = filterNodes(twitterNodesForStash, envConfig.TWITTER_EXCLUDE_PATTERN || '', true);
  let telegramNodesForStash = filterNodes(allowNodesForStash, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodesForStash = filterNodes(telegramNodesForStash, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodesForStash = filterNodes(allowNodesForStash, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodesForStash = filterNodes(steamNodesForStash, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let pokerNodesForStash = filterNodes(allowNodesForStash, envConfig.POKER_MATCH_PATTERN || '', false);
  pokerNodesForStash = filterNodes(pokerNodesForStash, envConfig.POKER_EXCLUDE_PATTERN || '', true);
  let fallbackNodesForStash = filterNodes(allowNodesForStash, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodesForStash = filterNodes(allowNodesForStash, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

  // 生成 proxy-groups 配置
  const proxyGroups = [
    {
        name: '其它流量',
        type: 'select',
        proxies: selfNodes.length > 0 ? ['自建节点', '机场节点'] : uniqueNodesArr(otherNodes.map((node: any) => node.name)),
    },
    {
      name: 'MediaTelegram',
      type: 'select',
      proxies: uniqueNodesArr(telegramNodes.map((node: any) => node.name)),
    },
    {
      name: 'PokerClient',
      type: 'select',
      proxies: uniqueNodesArr(['直接连接', ...pokerNodes.map((node: any) => node.name)]),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: uniqueNodesArr(steamNodes.map((node: any) => node.name)),
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: uniqueNodesArr(youtubeNodes.map((node: any) => node.name)),
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: uniqueNodesArr(twitterNodes.map((node: any) => node.name)),
    },
    {
      name: 'EMBY',
      type: 'select',
      proxies: uniqueNodesArr(embyNodes.map((node: any) => node.name)),
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: uniqueNodesArr(fallbackNodes.map((node: any) => node.name)),
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
      proxies: uniqueNodesArr(otherNodes.map((node: any) => node.name)),
    })
  }

  const proxyGroupsForStash = [
    {
      name: '其它流量',
      type: 'select',
      proxies: selfNodes.length > 0 ? ['自建节点', '机场节点'] : uniqueNodesArr(otherNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'MediaTelegram',
      type: 'select',
      proxies: uniqueNodesArr(telegramNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'PokerClient',
      type: 'select',
      proxies: uniqueNodesArr(['直接连接', ...pokerNodesForStash.map((node: any) => node.name)]),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: uniqueNodesArr(steamNodesForStash.map((node: any) => node.name)),
    },
    {
        name: 'MediaYouTube',
        type: 'select',
        proxies: uniqueNodesArr(youtubeNodesForStash.map((node: any) => node.name)),
    },
    {
        name: 'MediaTwitter',
        type: 'select',
        proxies: uniqueNodesArr(twitterNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'EMBY',
      type: 'select',
      proxies: uniqueNodesArr(embyNodesForStash.map((node: any) => node.name)),
    },
    {
      name: '故障转移',
      type: 'fallback',
      proxies: uniqueNodesArr(fallbackNodesForStash.map((node: any) => node.name)),
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
      proxies: uniqueNodesArr(otherNodesForStash.map((node: any) => node.name)),
    })
  }

  // 创建完整的配置对象
  const config = {
    proxies : bMergeFlag ? allowNodes : selfNodes.concat(allowNodes),
    'proxy-groups': proxyGroups,
  };

  const configForStash = {
    proxies : bMergeFlag ? allowNodesForStash : selfNodes.concat(allowNodesForStash),
    'proxy-groups': proxyGroupsForStash,
  };

  const proxyYamlObj: IProxyYamlInfo = {
    normalYaml: YAML.stringify(config),
    stashYaml: YAML.stringify(configForStash),
  }

  return proxyYamlObj;
}

export default generateProxyConfigYaml;
