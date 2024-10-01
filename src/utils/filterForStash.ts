import YAML from 'yaml';

/**
 * stash不支持包含以下内容的节点
 * flow: xtls-rprx-vision
 */
export function filterProxyForStash(yamlString: string) : string {
  try {
    // 解析YAML字符串
    const parsedYaml = YAML.parse(yamlString);

    // 检查并获取代理节点
    if (parsedYaml && Array.isArray(parsedYaml.proxies)) {
      // 过滤掉包含 flow: xtls-rprx-vision 的节点
      parsedYaml.proxies = parsedYaml.proxies.filter(proxy => 
        !(proxy.flow && proxy.flow === 'xtls-rprx-vision')
      );

      // 将过滤后的YAML对象转回字符串
      return YAML.stringify(parsedYaml);
    } else {
      console.warn('未找到有效的代理节点');
      return yamlString;
    }
  } catch (error) {
    console.error('处理YAML时出错:', error);
    return yamlString;
  }
}
