
// 可以在下面放你自建的节点
const selfNodeArr = [
 
]

export function getSelfNodeData(): any[] {
    if (selfNodeArr.length === 0) {
        return [];
    }

    // 把name加上自建，返回
    const newNodeArr = JSON.parse(JSON.stringify(selfNodeArr));
    newNodeArr.forEach(node => {
      node.name = node.name + '【自建】';
    });
    return newNodeArr;
}


