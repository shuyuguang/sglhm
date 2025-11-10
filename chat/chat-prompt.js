// relia-chat/chat-prompt.js


/**
 * 解析AI的完整回复字符串，将其分解为消息对象数组（文本或表情包）。
 * @param {string} fullReply - AI返回的完整文本。
 * @param {Array} emojis - 可用的表情包列表。
 * @returns {Array} - 消息对象数组。
 */
function parseAiReply(fullReply, emojis) {
    const messages = [];
    const emojiRegex = /^\[Emoji:\s*(.*?)\s*\]$/;
    
    // 按行分割回复
    const lines = fullReply.split(/(\r\n|\n|\r)/);

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return; // 跳过空行

        const emojiMatch = trimmedLine.match(emojiRegex);
        if (emojiMatch && emojiMatch[1]) {
            const foundEmoji = emojis.find(e => e.name === emojiMatch[1]);
            if (foundEmoji) {
                messages.push({ sender: 'character', isEmoji: true, data: foundEmoji.data, name: foundEmoji.name });
            } else {
                // 如果找不到对应的表情，当作普通文本处理
                messages.push({ sender: 'character', text: trimmedLine });
            }
        } else {
            messages.push({ sender: 'character', text: trimmedLine });
        }
    });

    return messages;
}

/**
 * 通用的流式数据处理器，处理来自API的SSE流。
 * @param {object} context - 包含 reader, decoder, emojis 的上下文对象。
 * @returns {Promise<Array>} - 解析后的消息对象数组。
 */
export async function universalStreamHandler(context) {
    const { reader, decoder, emojis } = context;
    let fullReply = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content;
                        if (content) {
                            fullReply += content;
                        }
                    } catch (e) { /* 忽略解析错误 */ }
                }
            }
        }
        
        const cleanReply = fullReply.replace(/\(thought[\s\S]*?\)/g, '').trim();
        return parseAiReply(cleanReply, emojis);

    } catch (error) {
        console.error("Stream handling error:", error);
        return [{ sender: 'character', text: `抱歉，处理回复时出错: ${error.message}` }];
    }
}
