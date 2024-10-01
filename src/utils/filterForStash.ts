import YAML from 'yaml';

/**
 * stash不支持包含以下内容的节点
 * flow: xtls-rprx-vision
 */
export function filterProxyForStash(proxy: any) : boolean {
  if (proxy.flow && proxy.flow === 'xtls-rprx-vision') {
    return false
  }

  return true
}
