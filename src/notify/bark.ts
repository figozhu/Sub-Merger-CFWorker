
async function sendBarkNotification(openid: string, title: string, content: string): Promise<void> {
    if (!openid || openid === "") {
        console.debug("no bark openid")
        return
    }
    console.debug(`sendBarkNotification: 发送 Bark 通知，openid: ${openid}, title: ${title}, content: ${content}`)

    const url = `https://api.day.app/${openid}/${encodeURIComponent(title)}/${encodeURIComponent(content)}`;
    console.debug(`sendBarkNotification: 请求 URL: ${url}`)
    try {
        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            console.error(`HTTP 错误! 状态: ${response.status}`);
            return
        }

        const result = await response.json();
        console.debug('Bark 通知发送成功:', result);
    } catch (error) {
        console.error('发送 Bark 通知时出错:', error);
    }
}

export { sendBarkNotification };
