
/**
 * 发送已有配置启用的订阅失败通知，未配置时直接返回。
 * @param openid 可选 Bark 标识，禁止进入日志。
 * @param title 通知标题。
 * @param content 不含原始异常和订阅凭据的通知文本。
 * @returns 通知结束后完成；失败不阻断订阅请求，最多等待 5 秒。
 */
async function sendBarkNotification(openid: string | undefined, title: string, content: string): Promise<void> {
    if (!openid || openid === "") {
        return
    }

    const url = `https://api.day.app/${openid}/${encodeURIComponent(title)}/${encodeURIComponent(content)}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            console.error(`HTTP 错误! 状态: ${response.status}`);
            return
        }

        await response.json();
    } catch {
        // 不记录 OpenID、通知正文或完整请求地址，避免凭据进入 Worker 日志。
        console.error('发送 Bark 通知时发生网络异常');
    }
}

export { sendBarkNotification };
