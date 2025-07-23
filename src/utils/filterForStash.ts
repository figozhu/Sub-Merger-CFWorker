
/**
 * stash不支持包含以下内容的节点
 * flow: xtls-rprx-vision
 * cipher: 2022-blake3-aes-256-gcm
 */
export function filterProxyForStash(proxy: any) : boolean {
  // if (proxy.flow && proxy.flow === 'xtls-rprx-vision') {
  //   return false
  // }

  // if (proxy.cipher && (proxy.cipher === '2022-blake3-aes-256-gcm' || proxy.cipher === '2022-blake3-aes-128-gcm')) {
  //   return false
  // }

  return true
}
