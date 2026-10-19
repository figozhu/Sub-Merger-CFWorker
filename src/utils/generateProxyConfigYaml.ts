
import YAML from 'yaml'
import { filterProxyForStash } from './filterForStash';
import { getSelfNodeData } from '../data/selfNodeData';
import { pruneEmptyProxyGroups } from './pruneEmptyProxyGroups';

/**
 * 按旧版正则筛选节点，空正则保持原节点池。
 * @param nodes 待筛选节点。@param pattern 名称正则。@param exclude 是否反选。
 * @returns 保持来源顺序的筛选结果。
 */
function filterNodes(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  if (pattern === "") {
    return nodes;
  }
  const regex = new RegExp(pattern);
  return nodes.filter(node => exclude ? !regex.test(node.name) : regex.test(node.name))
}

/**
 * 在正则筛选之后应用 Stash 兼容过滤，空正则也必须执行客户端过滤。
 * @param nodes 原始节点池。@param pattern 名称正则。@param exclude 是否反选。
 * @returns 本次 Stash YAML 真正可用的节点池，供空组判断共用。
 */
function filterNodesForStash(nodes: any[], pattern: string, exclude: boolean = false): any[] {
  return filterNodes(nodes, pattern, exclude).filter(node => filterProxyForStash(node))
}

/** @param nodeNameArr 按成员顺序收集的名称。@returns 保留首次出现位置的去重结果。 */
function uniqueNodesArr(nodeNameArr: string[]) {
  return Array.from(new Set(nodeNameArr))
}

interface IProxyYamlInfo {
  normalYaml: string;
  stashYaml: string;
  /** 裁剪前的组名，完整模板合并后据此修复下载代理和链式代理引用。 */
  groupNames: string[];
}

/**
 * 沿用旧版分组与正则，分别生成通用/Stash 节点段，并递归移除本次无有效成员的组。
 * @param totalNode 当前类型的订阅节点，允许为空。
 * @param envConfig 当前类型的正则配置。
 * @param env 用于读取新旧 KV 自建节点的环境；缺省读取代码默认节点。
 * @returns 不包含基础模板的两类节点 YAML，完整规则在合并模板后统一修复。
 */
async function generateProxyConfigYaml(totalNode: any[], envConfig: Record<string, string>, env?: any) : Promise<IProxyYamlInfo> {
  // console.debug('generateProxyConfigYaml: envConfig', envConfig)

  const selfNodes = await getSelfNodeData(env);
  const mergeNodes = selfNodes.concat(totalNode);

  // console.debug('generateProxyConfigYaml: selfNodes', selfNodes);
  // console.debug('generateProxyConfigYaml: mergeNodes', mergeNodes);

  const bMergeFlag = true;  // proxy-groups 中是否合并自建节点
  const realTotalNode = bMergeFlag ? mergeNodes : totalNode;
  // console.debug('generateProxyConfigYaml: realTotalNode', realTotalNode);

 
  const allowNodes = filterNodes(realTotalNode, envConfig.EXCLUDE_PATTERN || '', true);
  const totalAndSelfNodes = selfNodes.length > 0 ? [{name: '自建节点'}, ...selfNodes, ...allowNodes] : allowNodes;

  let otherNodes = filterNodes(allowNodes, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodes = filterNodes(otherNodes, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let proxyNodes = filterNodes(allowNodes, envConfig.PROXY_MATCH_PATTERN || '', false);
  proxyNodes = filterNodes(proxyNodes, envConfig.PROXY_EXCLUDE_PATTERN || '', true);
  let binanceNodes = filterNodes(allowNodes, envConfig.BINANCE_MATCH_PATTERN || '', false);
  binanceNodes = filterNodes(binanceNodes, envConfig.BINANCE_EXCLUDE_PATTERN || '', true);
  let mediaNodes = filterNodes(allowNodes, envConfig.MEDIA_MATCH_PATTERN || '', false);
  mediaNodes = filterNodes(mediaNodes, envConfig.MEDIA_EXCLUDE_PATTERN || '', true);
  let embyNodes = filterNodes(allowNodes, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodes = filterNodes(embyNodes, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let aiNodes = filterNodes(allowNodes, envConfig.AI_MATCH_PATTERN || '', false);
  aiNodes = filterNodes(aiNodes, envConfig.AI_EXCLUDE_PATTERN || '', true);
  let whatsappNodes = filterNodes(allowNodes, envConfig.WHATSAPP_MATCH_PATTERN || '', false);
  whatsappNodes = filterNodes(whatsappNodes, envConfig.WHATSAPP_EXCLUDE_PATTERN || '', true);
  let telegramNodes = filterNodes(allowNodes, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodes = filterNodes(telegramNodes, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodes = filterNodes(allowNodes, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodes = filterNodes(steamNodes, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let pokerNodes = filterNodes(allowNodes, envConfig.POKER_MATCH_PATTERN || '', false);
  pokerNodes = filterNodes(pokerNodes, envConfig.POKER_EXCLUDE_PATTERN || '', true);
  let etherfiNodes = filterNodes(allowNodes, envConfig.ETHERFI_MATCH_PATTERN || '', false);
  etherfiNodes = filterNodes(etherfiNodes, envConfig.ETHERFI_EXCLUDE_PATTERN || '', true);
  let fallbackNodes = filterNodes(allowNodes, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodes = filterNodes(fallbackNodes, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

  const allowNodesForStash = filterNodesForStash(realTotalNode, envConfig.EXCLUDE_PATTERN || '', true);
  let otherNodesForStash = filterNodes(allowNodesForStash, envConfig.OTHER_MATCH_PATTERN || '', false);
  otherNodesForStash = filterNodes(otherNodesForStash, envConfig.OTHER_EXCLUDE_PATTERN || '', true);
  let proxyNodesForStash = filterNodes(allowNodesForStash, envConfig.PROXY_MATCH_PATTERN || '', false);
  proxyNodesForStash = filterNodes(proxyNodesForStash, envConfig.PROXY_EXCLUDE_PATTERN || '', true);
  let binanceNodesForStash = filterNodes(allowNodesForStash, envConfig.BINANCE_MATCH_PATTERN || '', false);
  binanceNodesForStash = filterNodes(binanceNodesForStash, envConfig.BINANCE_EXCLUDE_PATTERN || '', true);
  let mediaNodesForStash = filterNodes(allowNodesForStash, envConfig.MEDIA_MATCH_PATTERN || '', false);
  mediaNodesForStash = filterNodes(mediaNodesForStash, envConfig.MEDIA_EXCLUDE_PATTERN || '', true);
  let embyNodesForStash = filterNodes(allowNodesForStash, envConfig.EMBY_MATCH_PATTERN || '', false);
  embyNodesForStash = filterNodes(embyNodesForStash, envConfig.EMBY_EXCLUDE_PATTERN || '', true);
  let whatsappNodesForStash = filterNodes(allowNodesForStash, envConfig.WHATSAPP_MATCH_PATTERN || '', false);
  whatsappNodesForStash = filterNodes(whatsappNodesForStash, envConfig.WHATSAPP_EXCLUDE_PATTERN || '', true);
  let aiNodesForStash = filterNodes(allowNodesForStash, envConfig.AI_MATCH_PATTERN || '', false);
  aiNodesForStash = filterNodes(aiNodesForStash, envConfig.AI_EXCLUDE_PATTERN || '', true);
  let telegramNodesForStash = filterNodes(allowNodesForStash, envConfig.TELEGRAM_MATCH_PATTERN || '', false);
  telegramNodesForStash = filterNodes(telegramNodesForStash, envConfig.TELEGRAM_EXCLUDE_PATTERN || '', true);
  let steamNodesForStash = filterNodes(allowNodesForStash, envConfig.STEAM_MATCH_PATTERN || '', false);
  steamNodesForStash = filterNodes(steamNodesForStash, envConfig.STEAM_EXCLUDE_PATTERN || '', true);
  let pokerNodesForStash = filterNodes(allowNodesForStash, envConfig.POKER_MATCH_PATTERN || '', false);
  pokerNodesForStash = filterNodes(pokerNodesForStash, envConfig.POKER_EXCLUDE_PATTERN || '', true);
  let etherfiNodesForStash = filterNodes(allowNodesForStash, envConfig.ETHERFI_MATCH_PATTERN || '', false);
  etherfiNodesForStash = filterNodes(etherfiNodesForStash, envConfig.ETHERFI_EXCLUDE_PATTERN || '', true);
  let fallbackNodesForStash = filterNodes(allowNodesForStash, envConfig.FALLBACK_MATCH_PATTERN || '', false);
  fallbackNodesForStash = filterNodes(fallbackNodesForStash, envConfig.FALLBACK_EXCLUDE_PATTERN || '', true);

  // 生成 proxy-groups 配置
  const proxyGroups = [
    {
        name: '其它流量',
        type: 'select',
        proxies: selfNodes.length > 0 ? ['自建节点', '中转代理', '海外AI'] : uniqueNodesArr(otherNodes.map((node: any) => node.name)),
    },
    {
        name: '中转代理',
        type: 'select',
        proxies: uniqueNodesArr(proxyNodes.map((node: any) => node.name)),
    },
    {
      name: '海外AI',
      type: 'select',
      proxies: uniqueNodesArr(aiNodes.map((node: any) => node.name)),
    },
    {
      name: 'IM-Telegram',
      type: 'select',
      proxies: uniqueNodesArr(['其它流量', ...telegramNodes.map((node: any) => node.name)]),
    },
    {
      name: 'IM-WhatsApp',
      type: 'select',
      proxies: uniqueNodesArr(['其它流量', ...whatsappNodes.map((node: any) => node.name)]),
    },
    {
      name: '海外媒体',
      type: 'select',
      proxies: uniqueNodesArr(['其它流量', ...mediaNodes.map((node: any) => node.name)]),
    },
    {
      name: 'PokerClient',
      type: 'select',
      proxies: uniqueNodesArr(['直接连接', ...pokerNodes.map((node: any) => node.name)]),
    },
    {
      name: '币安',
      type: 'select',
      proxies: uniqueNodesArr(binanceNodes.map((node: any) => node.name)),
    },
    {
      name: 'EtherFi',
      type: 'select',
      proxies: uniqueNodesArr(etherfiNodes.map((node: any) => node.name)),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: uniqueNodesArr(steamNodes.map((node: any) => node.name)),
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
      proxies: selfNodes.length > 0 ? ['自建节点', '中转代理', '海外AI'] : uniqueNodesArr(otherNodesForStash.map((node: any) => node.name)),
    },
    {
        name: '中转代理',
        type: 'select',
        proxies: uniqueNodesArr(proxyNodesForStash.map((node: any) => node.name)),
    },
    {
      name: '海外AI',
      type: 'select',
      proxies: uniqueNodesArr(aiNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'IM-Telegram',
      type: 'select',
      proxies: uniqueNodesArr(['其它流量', ...telegramNodesForStash.map((node: any) => node.name)]),
    },
    {
      name: 'IM-WhatsApp',
      type: 'select',
      proxies: uniqueNodesArr(['其它流量', ...whatsappNodesForStash.map((node: any) => node.name)]),
    },
    {
        name: '海外媒体',
        type: 'select',
        proxies: uniqueNodesArr(['其它流量', ...mediaNodesForStash.map((node: any) => node.name)]),
    },
    {
      name: 'PokerClient',
      type: 'select',
      proxies: uniqueNodesArr(['直接连接', ...pokerNodesForStash.map((node: any) => node.name)]),
    },
    {
      name: '币安',
      type: 'select',
      proxies: uniqueNodesArr(binanceNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'EtherFi',
      type: 'select',
      proxies: uniqueNodesArr(etherfiNodesForStash.map((node: any) => node.name)),
    },
    {
      name: 'GameSteam',
      type: 'select',
      proxies: uniqueNodesArr(steamNodesForStash.map((node: any) => node.name)),
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
    'proxy-groups': pruneEmptyProxyGroups(proxyGroups, allowNodes.map(node => node.name)).groups,
  };

  const configForStash = {
    proxies : bMergeFlag ? allowNodesForStash : selfNodes.concat(allowNodesForStash),
    'proxy-groups': pruneEmptyProxyGroups(proxyGroupsForStash, allowNodesForStash.map(node => node.name)).groups,
  };

  const proxyYamlObj: IProxyYamlInfo = {
    normalYaml: YAML.stringify(config),
    stashYaml: YAML.stringify(configForStash),
    groupNames: proxyGroups.map(group => group.name),
  }

  return proxyYamlObj;
}

export default generateProxyConfigYaml;
