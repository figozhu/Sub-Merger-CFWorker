
// 可以在下面放你自建的节点
const selfNodeArr = [



]

// 默认的自建节点数据，作为备用
export function getDefaultSelfNodeData(): string {
  return JSON.stringify(selfNodeArr, null, 2);
}

export async function getSelfNodeData(env?: any): Promise<any[]> {
    if (!env) {
        // 如果没有环境变量，使用默认数据
        if (selfNodeArr.length === 0) {
            return [];
        }
        const newNodeArr = JSON.parse(JSON.stringify(selfNodeArr));
        newNodeArr.forEach(node => {
          node.name = node.name + '【自建】';
        });
        return newNodeArr;
    }

    try {
        // 尝试从KV存储获取动态配置
        const configKey = `${env.TABLENAME}:config`
        const config = await env.SUB_MERGER_KV.get(configKey, "json")
        
        if (config && config.selfNodeData && config.selfNodeData.trim()) {
            const customNodes = JSON.parse(config.selfNodeData);
            if (Array.isArray(customNodes) && customNodes.length > 0) {
                // 把name加上自建，返回
                const newNodeArr = JSON.parse(JSON.stringify(customNodes));
                newNodeArr.forEach(node => {
                  node.name = node.name + '【自建】';
                });
                return newNodeArr;
            }
        }
    } catch (error) {
        console.error('获取自建节点配置失败，使用默认配置:', error);
    }

    // 回退到默认配置
    if (selfNodeArr.length === 0) {
        return [];
    }

    const newNodeArr = JSON.parse(JSON.stringify(selfNodeArr));
    newNodeArr.forEach(node => {
      node.name = node.name + '【自建】';
    });
    return newNodeArr;
}


