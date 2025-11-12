// 文件名: sw.js

// ▼▼▼ 核心修复：从本地加载 Dexie 库 ▼▼▼
importScripts('./common/dexie.min.js');
// ▲▲▲ 修复结束 ▲▲▲

// 定义数据库连接
const db = new Dexie('ReliaDB');
db.version(1).stores({
    profiles: 'id',
    users: 'id',
    apiConfigs: 'id',
    appState: 'key',
    chatHistory: 'key',
    misc: 'key',
});

// Service Worker 安装时触发
self.addEventListener('install', event => {
    console.log('Service Worker installing.');
    self.skipWaiting();
});

// Service Worker 激活时触发
self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
    event.waitUntil(self.clients.claim());
});

// 监听从页面发送来的消息
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FETCH_AI_REPLY') {
        const { payload } = event.data;
        event.waitUntil(handleAiFetch(payload, event.source.id));
    }
});

/**
 * 核心函数：在后台处理 AI 请求
 * @param {object} payload - 从页面传递过来的所有数据
 * @param {string} clientId - 发起请求的客户端ID，用于事后通知
 */
async function handleAiFetch(payload, clientId) {
    const { character, user, chatHistory, currentChatApi, charId, emojis, mode } = payload;
    const historyKey = `relia-chat-history_${charId}`;

    try {
        const systemPrompt = await constructSystemPrompt(character, user, emojis);
        let messagesForApi = [{ role: 'system', content: systemPrompt }];
        let historyForApi;

        if (mode === 'regenerate') {
            let lastUserMessageIndex = -1;
            for (let i = chatHistory.length - 1; i >= 0; i--) {
                if (chatHistory[i].sender === 'user') {
                    lastUserMessageIndex = i;
                    break;
                }
            }
            if (lastUserMessageIndex === -1) throw new Error("No user message found to regenerate from.");
            historyForApi = chatHistory.slice(0, lastUserMessageIndex + 1);

        } else if (mode === 'continue') {
            const lastMessage = chatHistory[chatHistory.length - 1];
            if (!lastMessage || lastMessage.sender !== 'character') throw new Error("Last message is not from AI, cannot continue.");
            historyForApi = chatHistory;
            messagesForApi.push(...await formatChatHistoryForApi(historyForApi));
            messagesForApi.push({ role: 'user', content: '[继续]' });
            historyForApi = []; 

        } else { 
            historyForApi = chatHistory;
        }

        messagesForApi.push(...await formatChatHistoryForApi(historyForApi));

        const endpoint = (currentChatApi.baseUrl.replace(/\/$/, '')) + (currentChatApi.path || '/v1/chat/completions');
        const apiPayload = { model: currentChatApi.model, messages: messagesForApi, stream: true };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentChatApi.apiKey}` },
            body: JSON.stringify(apiPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const replyMessages = await universalStreamHandler(response.body, emojis);

        if (replyMessages && replyMessages.length > 0) {
            const currentDbHistory = await db.chatHistory.get(historyKey) || [];
            let historyWithoutThinking = currentDbHistory.filter(msg => !(msg.sender === 'system' && msg.type === 'loading'));
            let newHistory;

            if (mode === 'regenerate') {
                const lastCharMessageForRegen = historyWithoutThinking.slice().reverse().find(m => m.sender === 'character');
                if (lastCharMessageForRegen) {
                    lastCharMessageForRegen.replyVersions.push(replyMessages);
                    lastCharMessageForRegen.activeReplyIndex = lastCharMessageForRegen.replyVersions.length - 1;
                }
                newHistory = historyWithoutThinking;
            } else if (mode === 'continue') {
                const lastCharMessageForCont = historyWithoutThinking[historyWithoutThinking.length - 1];
                 if (lastCharMessageForCont && lastCharMessageForCont.sender === 'character') {
                    const currentReply = lastCharMessageForCont.replyVersions[lastCharMessageForCont.activeReplyIndex];
                    const combinedReply = [...currentReply, ...replyMessages];
                    lastCharMessageForCont.replyVersions[lastCharMessageForCont.activeReplyIndex] = combinedReply;
                }
                newHistory = historyWithoutThinking;
            } else { 
                newHistory = [
                    ...historyWithoutThinking,
                    { sender: 'character', replyVersions: [replyMessages], activeReplyIndex: 0 }
                ];
            }

            await db.chatHistory.put(newHistory, historyKey);
            notifyClient(clientId, { type: 'AI_REPLY_COMPLETED', charId });
        } else {
            const currentDbHistory = await db.chatHistory.get(historyKey) || [];
            const historyWithoutThinking = currentDbHistory.filter(msg => !(msg.sender === 'system' && msg.type === 'loading'));
            await db.chatHistory.put(historyWithoutThinking, historyKey);
            notifyClient(clientId, { type: 'AI_REPLY_COMPLETED', charId });
        }

    } catch (error) {
        console.error('Service Worker AI fetch error:', error);
        const currentDbHistory = await db.chatHistory.get(historyKey) || [];
        const historyWithoutThinking = currentDbHistory.filter(msg => !(msg.sender === 'system' && msg.type === 'loading'));
        const errorHistory = [...historyWithoutThinking, { sender: 'system', type: 'error', text: `AI 响应错误: ${error.message}` }];
        await db.chatHistory.put(errorHistory, historyKey);
        notifyClient(clientId, { type: 'AI_REPLY_FAILED', charId, error: error.message });
    }
}

async function notifyClient(clientId, message) {
    if (!clientId) {
        const allClients = await self.clients.matchAll();
        for (const client of allClients) {
            client.postMessage(message);
        }
        return;
    }
    const client = await self.clients.get(clientId);
    if (client) {
        client.postMessage(message);
    }
}

// ==================================================================
// ▼▼▼ 以下所有函数为 AI 响应处理逻辑，已同步最新版本 ▼▼▼
// ==================================================================

function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.toLowerCase().startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
}

function isBase64(str) {
    if (typeof str !== 'string' || !str) return false;
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return str.length > 50 && str.length % 4 === 0 && base64Regex.test(str);
}

function blobUrlToDataUrl(blobUrl) {
    return new Promise((resolve, reject) => {
        fetch(blobUrl)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => { resolve(reader.result); };
                reader.onerror = reject;
                // ▼▼▼ 隐藏BUG修复：之前这里错误地写成了 file ▼▼▼
                reader.readAsDataURL(blob);
                // ▲▲▲ 修复结束 ▲▲▲
            })
            .catch(reject);
    });
}

function parseAiReply(fullReply, emojis) {
    const messages = [];
    const mainRegex = /\[([\s\S]+?)\]|([^\[\]]+)/g;
    const emojiRegex = /^\[Emoji:\s*(.*?)\s*\]$/;
    const imageRegex = /^Image:\s*([\s\S]*?)\s*$/;
    
    let match;
    while ((match = mainRegex.exec(fullReply)) !== null) {
        const potentialCardContent = match[1];
        const plainText = match[2];

        if (potentialCardContent && potentialCardContent.includes('Title:') && potentialCardContent.includes('Body text:')) {
            const lines = potentialCardContent.split('\n');
            const cardData = { sender: 'character', type: 'link', image: null };
            let currentKey = '';
            
            lines.forEach(line => {
                if (line.startsWith('Title:')) {
                    currentKey = 'title';
                    cardData.title = line.substring(6).trim();
                } else if (line.startsWith('Body text:')) {
                    currentKey = 'body';
                    cardData.body = line.substring(10).trim();
                } else if (line.startsWith('Source:')) {
                    currentKey = 'source';
                    cardData.source = line.substring(7).trim();
                } else if (line.startsWith('Illustration:')) {
                    currentKey = 'illustration';
                    const illustrationText = line.substring(13).trim();
                    if (isBase64(illustrationText)) {
                        cardData.image = { type: 'image', data: `data:image/jpeg;base64,${illustrationText}` };
                    } else {
                        cardData.image = { type: 'text-photo', text: illustrationText };
                    }
                } else if (currentKey) {
                    if (currentKey === 'body') cardData.body += '\n' + line.trim();
                }
            });

            if (cardData.title && cardData.body) {
                messages.push(cardData);
            } else {
                messages.push({ sender: 'character', text: `[${potentialCardContent}]` });
            }
        } else if (potentialCardContent && imageRegex.test(potentialCardContent)) {
            const imageMatch = potentialCardContent.match(imageRegex);
            const imageContent = imageMatch[1];
            if (isImageUrl(imageContent)) {
                messages.push({ sender: 'character', type: 'image', data: imageContent });
            } else {
                messages.push({ sender: 'character', type: 'text-photo', text: imageContent });
            }
        } else if (plainText && plainText.trim()) {
            plainText.split(/(\r\n|\n|\r)/).forEach(part => {
                const trimmedPart = part.trim();
                if (!trimmedPart) return;

                const emojiMatch = trimmedPart.match(emojiRegex);
                if (emojiMatch && emojiMatch[1]) {
                    const foundEmoji = emojis.find(e => e.name === emojiMatch[1]);
                    if (foundEmoji) messages.push({ sender: 'character', isEmoji: true, data: foundEmoji.data, name: foundEmoji.name });
                } else {
                    messages.push({ sender: 'character', text: trimmedPart });
                }
            });
        }
    }
    return messages;
}

async function universalStreamHandler(body, emojis) {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
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

async function constructSystemPrompt(charProfile, userProfile, emojis) {
    let prompt = `你正在扮演一个角色，你需要严格按照以下设定进行对话。\n\n`;
    prompt += `### 角色设定\n`;
    prompt += `- 名字: ${charProfile.name || '未命名'}\n`;
    if (charProfile.gender) prompt += `- 性别: ${charProfile.gender}\n`;
    if (charProfile.age) prompt += `- 年龄: ${charProfile.age}\n`;
    if (charProfile.race) prompt += `- 种族: ${charProfile.race}\n`;
    if (charProfile.occupation) prompt += `- 职业: ${charProfile.occupation}\n`;
    if (charProfile.bio) prompt += `- 简介: ${charProfile.bio}\n`;
    if (charProfile.customSections && charProfile.customSections.length > 0) {
        charProfile.customSections.forEach(section => {
            const itemsWithContent = section.items.filter(item => item.value?.trim());
            if (itemsWithContent.length > 0) {
                prompt += `\n#### ${section.title}\n`;
                itemsWithContent.forEach(item => {
                    prompt += `- ${item.title}: ${item.value}\n`;
                });
            }
        });
    }
    prompt += `\n### 对话者信息\n`;
    prompt += `- 对方名字: ${userProfile.name || 'User'}\n`;

    if (emojis && emojis.length > 0) {
        const emojiNameList = emojis.map(e => e.name).join(', ');
        prompt += `\n### 工具：发送表情包\n`;
        prompt += `- 你有一个发送表情包的工具。你的可用表情包有：[${emojiNameList}]。\n`;
        prompt += `- **使用规则 (非常重要)**: 当你想发送表情时，必须使用格式 **[Emoji: 表情名称]**，并确保它**单独占据一行**。不要添加任何多余的文字或符号。\n`;
    }

    prompt += `\n### 工具：发送图片\n`;
    prompt += `- 你可以发送图片，支持两种类型：链接图和文字图。\n`;
    prompt += `- **使用规则 (非常重要)**: 当你想发送图片时，必须使用格式 **[Image: 内容]**，并确保它**单独占据一行**。\n`;
    prompt += `- **链接图**: 如果“内容”是一个有效的图片URL (例如: https://example.com/image.jpg)，它将被渲染成一张图片。\n`;
    prompt += `- **文字图**: 如果“内容”是普通文本，它将被渲染成一个包含这段文字的卡片。\n`;

    prompt += `\n### 工具：发送链接卡片\n`;
    prompt += `- 你还可以发送链接卡片来分享结构化的信息，例如分享文章、推荐地点等。\n`;
    prompt += `- **使用规则 (非常重要)**: 当你想发送链接卡片时，必须严格使用以下格式，并确保它**单独占据一段**:\n`;
    prompt += "```\n[Title: 卡片标题\nBody text: 卡片正文内容\nSource: 卡片来源 (可选)\nIllustration: 对配图的文字描述 (可选，例如 '一只正在打哈欠的猫')]\n```\n";
    prompt += `- **注意**: \`Title\` 和 \`Body text\` 是必填项。\`Source\` 和 \`Illustration\` 是可选项。\`Illustration\` 字段应该是一段简短的**文字描述**，而不是图片数据或链接。\n`;

    prompt += `\n### 扮演要求\n`;
    prompt += `- 你必须完全沉浸在 **${charProfile.name}** 的角色中，用TA的身份、口吻、性格和知识进行回复。\n`;
    prompt += `- 不要暴露你是AI模型或程序，不要提及“扮演”或“角色设定”。\n`;
    
    return prompt;
}

async function formatChatHistoryForApi(history) {
    const formattedPromises = history.map(async (msg) => {
        if (msg.sender === 'user') {
            let content;
            switch(msg.type) {
                case 'text-photo':
                    content = `[Photo: ${msg.text}]`;
                    return { role: 'user', content: content };
                case 'image':
                    let imageUrlForApi = msg.data;
                    if (imageUrlForApi.startsWith('blob:')) {
                        imageUrlForApi = await blobUrlToDataUrl(imageUrlForApi);
                    }
                    content = [
                        { type: 'text', text: '用户发送了一张图片。' },
                        { type: 'image_url', image_url: { url: imageUrlForApi } }
                    ];
                    return { role: 'user', content: content };
                case 'link':
                    content = `[Title: ${msg.title}\nBody text: ${msg.body}`;
                    if (msg.source) {
                        content += `\nSource: ${msg.source}`;
                    }

                    if (msg.image) {
                        if (msg.image.type === 'text-photo') {
                            content += `\nIllustration: ${msg.image.text}`;
                        } else if (msg.image.type === 'image') {
                            let imageData = msg.image.data;
                            if (imageData.startsWith('blob:')) {
                                imageData = await blobUrlToDataUrl(imageData);
                            }
                            const base64String = imageData.substring(imageData.indexOf(',') + 1);
                            content += `\nIllustration: ${base64String}`;
                        }
                    }
                    content += ']';
                    return { role: 'user', content: content };
                default:
                    content = msg.isEmoji ? `[Emoji: ${msg.name}]` : msg.text;
                    return { role: 'user', content: content };
            }
        } else if (msg.sender === 'character') {
            const activeVersion = msg.replyVersions[msg.activeReplyIndex];
            const content = activeVersion.map(part => {
                if (part.isEmoji) {
                    return `[Emoji: ${part.name}]`;
                }
                if (part.type === 'link') {
                    let linkContent = `[Title: ${part.title}\nBody text: ${part.body}`;
                    if (part.source) linkContent += `\nSource: ${part.source}`;
                    if (part.image) {
                        if (part.image.type === 'text-photo') {
                            linkContent += `\nIllustration: ${part.image.text}`;
                        } else if (part.image.type === 'image' && part.image.data) {
                             const base64String = part.image.data.substring(part.image.data.indexOf(',') + 1);
                             linkContent += `\nIllustration: ${base64String}`;
                        }
                    }
                    linkContent += ']';
                    return linkContent;
                }
                if (part.type === 'image') {
                    return `[Image: ${part.data}]`;
                }
                if (part.type === 'text-photo') {
                    return `[Image: ${part.text}]`;
                }
                return part.text;
            }).join('\n');
            return { role: 'assistant', content };
        }
        return null;
    });

    const formatted = (await Promise.all(formattedPromises)).filter(Boolean);
    return formatted;
}