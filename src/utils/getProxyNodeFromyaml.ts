import YAML from 'yaml';

/**
 * 从YAML字符串中解析代理节点
 * @param yamlString YAML格式的字符串
 * @param subName 可选的订阅名称
 * @returns 解析出的代理节点数组
 */
export function getProxyNodesFromYaml(yamlString: string, subName?: string): any[] {
  try {
    // 解析YAML字符串
    const parsedYaml = YAML.parse(yamlString);

    // 检查并获取代理节点
    let proxies: any[] = [];
    if (parsedYaml && Array.isArray(parsedYaml.proxies)) {
      proxies = parsedYaml.proxies;
    } else if (parsedYaml && Array.isArray(parsedYaml.Proxy)) {
      proxies = parsedYaml.Proxy;
    } else {
      console.warn('未找到有效的代理节点');
      return [];
    }

    // 如果提供了subName且不为空,修改代理节点的名称
    if (subName && subName.trim() !== '') {
      proxies = proxies.map(proxy => ({
        ...proxy,
        name: `${proxy.name}【${subName}】`
      }));
    }

    return proxies;
  } catch (error) {
    console.error('解析YAML时出错:', error);
    return [];
  }
}
