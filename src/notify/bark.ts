
async function sendBarkNotification(openid: string, title: string, content: string): Promise<void> {
    if (!openid || openid === "") {
        return
    }

    const url = `https://api.day.app/${openid}/${encodeURIComponent(title)}/${encodeURIComponent(content)}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
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
