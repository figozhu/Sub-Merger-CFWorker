
// 可以在下面放你自建的节点
const selfNodeArr: any[] = [



]

// 默认的自建节点数据，作为备用
export function getDefaultSelfNodeData(): string {
  return JSON.stringify(selfNodeArr, null, 2);
}

/**
 * 为运行时自建节点名称追加来源后缀。
 * 原始 KV 数据永远不写入后缀；已经带后缀的异常旧数据也不会被重复追加。
 * @param nodes 从默认值或 KV 解析出的节点数组。
 * @returns 深拷贝后的运行时节点数组。
 */
function appendSelfNodeSuffix(nodes: any[]): any[] {
    const clonedNodes = JSON.parse(JSON.stringify(nodes));
    clonedNodes.forEach((node: any) => {
      if (node && typeof node.name === 'string' && !node.name.endsWith('【自建】')) {
        node.name = `${node.name}【自建】`;
      }
    });
    return clonedNodes;
}

/**
 * 读取用于订阅生成的自建节点。
 * 读取优先级为新版独立键、旧版 config 键、代码默认值；合法空数组不会触发回退。
 * @param env Worker 运行环境；单元测试未提供环境时直接使用代码默认值。
 * @returns 追加一次 `【自建】` 后缀的节点数组。
 */
export async function getSelfNodeData(env?: any): Promise<any[]> {
    if (!env) {
        return appendSelfNodeSuffix(selfNodeArr);
    }

    try {
        // 新版页面独立保存自建节点，存在该键时（包括 []）必须优先使用。
        const selfNodesKey = `${env.TABLENAME}:self-nodes`;
        const selfNodesDocument = await env.SUB_MERGER_KV.get(selfNodesKey, "json") as { raw?: unknown } | null;
        if (selfNodesDocument && typeof selfNodesDocument.raw === 'string') {
            const customNodes = JSON.parse(selfNodesDocument.raw);
            if (Array.isArray(customNodes)) return appendSelfNodeSuffix(customNodes);
        }

        // 兼容升级前由 /api/config 写入的合并配置对象。
        const configKey = `${env.TABLENAME}:config`
        const config = await env.SUB_MERGER_KV.get(configKey, "json")
        
        if (config && typeof config.selfNodeData === 'string') {
            const customNodes = JSON.parse(config.selfNodeData);
            if (Array.isArray(customNodes)) return appendSelfNodeSuffix(customNodes);
        }
    } catch (error) {
        console.error('获取自建节点配置失败，使用默认配置:', error);
    }

    return appendSelfNodeSuffix(selfNodeArr);
}
