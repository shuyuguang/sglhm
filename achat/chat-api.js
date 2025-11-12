// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// --- Helper Functions (部分从 chat-prompt.js 移动而来) ---

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
                reader.onloadend = () => {
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
}

function parseAiReply(fullReply, emojis) {
    const messages = [];
    const mainRegex = /\[([\s\S]+?)\]|([^\[\]]+)/g;
    const emojiRegex = /^\[Emoji:\s*(.*?)\s*\]$/;
    // ▼▼▼ 新增：用于匹配图片指令的正则表达式 ▼▼▼
    const imageRegex = /^Image:\s*([\s\S]*?)\s*$/;
    // ▲▲▲ 新增结束 ▲▲▲
    
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
        // ▼▼▼ 新增：解析 AI 发送的图片指令 ▼▼▼
        } else if (potentialCardContent && imageRegex.test(potentialCardContent)) {
            const imageMatch = potentialCardContent.match(imageRegex);
            const imageContent = imageMatch[1];
            if (isImageUrl(imageContent)) {
                // 如果是链接，创建链接图消息
                messages.push({ sender: 'character', type: 'image', data: imageContent });
            } else {
                // 否则，创建文字图消息
                messages.push({ sender: 'character', type: 'text-photo', text: imageContent });
            }
        // ▲▲▲ 新增结束 ▲▲▲
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

async function universalStreamHandler(context) {
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


// --- Core API Logic ---

async function constructSystemPrompt(charProfile, userProfile) {
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

    const emojis = await dbStorage.getItem(CHAT_DB_KEYS.EMOJIS) || [];
    if (emojis.length > 0) {
        const emojiNameList = emojis.map(e => e.name).join(', ');
        prompt += `\n### 工具：发送表情包\n`;
        prompt += `- 你有一个发送表情包的工具。你的可用表情包有：[${emojiNameList}]。\n`;
        prompt += `- **使用规则 (非常重要)**: 当你想发送表情时，必须使用格式 **[Emoji: 表情名称]**，并确保它**单独占据一行**。不要添加任何多余的文字或符号。\n`;
    }

    // ▼▼▼ 新增：教会 AI 如何使用发送图片的工具 ▼▼▼
    prompt += `\n### 工具：发送图片\n`;
    prompt += `- 你可以发送图片，支持两种类型：链接图和文字图。\n`;
    prompt += `- **使用规则 (非常重要)**: 当你想发送图片时，必须使用格式 **[Image: 内容]**，并确保它**单独占据一行**。\n`;
    prompt += `- **链接图**: 如果“内容”是一个有效的图片URL (例如: https://example.com/image.jpg)，它将被渲染成一张图片。\n`;
    prompt += `- **文字图**: 如果“内容”是普通文本，它将被渲染成一个包含这段文字的卡片。\n`;
    // ▲▲▲ 新增结束 ▲▲▲

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

// ... 文件剩余部分保持不变 ...
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
                default: // 兼容旧文本和表情
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
                // ▼▼▼ 新增：格式化AI历史消息中的图片信息 ▼▼▼
                if (part.type === 'image') {
                    return `[Image: ${part.data}]`;
                }
                if (part.type === 'text-photo') {
                    return `[Image: ${part.text}]`;
                }
                // ▲▲▲ 新增结束 ▲▲▲
                return part.text;
            }).join('\n');
            return { role: 'assistant', content };
        }
        return null;
    });

    const formatted = (await Promise.all(formattedPromises)).filter(Boolean);
    return formatted;
}

export function createApiHandler(context) {
    const {
        state, elements, character, user,
        renderSystemMessage, updateButtonStates, onAiReply,
        getIsAiReplying, setIsAiReplying, setAbortController
    } = context;

    async function handleSendMessage(mode = 'new') {
        if (getIsAiReplying()) {
            console.log("AI is already replying. New request blocked.");
            return;
        }

        let historyForApi;
        
        const lastMessage = state.chatHistory[state.chatHistory.length - 1];
        if (!state.currentChatApi) {
            alert('请先点击“选择模型”按钮选择一个牵引仪模型！');
            return;
        }
        if (mode !== 'new' && state.chatHistory.length === 0) {
            alert('还没有聊天记录，无法触发AI。');
            return;
        }
        if (mode === 'new' && lastMessage && lastMessage.sender !== 'user') {
            console.log("AI can only respond after a user message.");
            return;
        }

        setIsAiReplying(true);
        elements.respondBtn.classList.add('blinking');
        updateButtonStates();
        
        if (mode === 'new') {
            renderSystemMessage('...', 'loading', elements.chatArea);
        }

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const systemPrompt = await constructSystemPrompt(character, user);
            let messagesForApi = [{ role: 'system', content: systemPrompt }];

            if (mode === 'regenerate') {
                let lastUserMessageIndex = -1;
                for (let i = state.chatHistory.length - 1; i >= 0; i--) {
                    if (state.chatHistory[i].sender === 'user') {
                        lastUserMessageIndex = i;
                        break;
                    }
                }
                if (lastUserMessageIndex === -1) throw new Error("找不到可供重新生成的用户消息。");
                historyForApi = state.chatHistory.slice(0, lastUserMessageIndex + 1);

            } else if (mode === 'continue') {
                if (lastMessage.sender !== 'character') throw new Error("最后一条消息不是AI的回复，无法继续。");
                historyForApi = state.chatHistory;
                 messagesForApi.push(...await formatChatHistoryForApi(historyForApi));
                 messagesForApi.push({ role: 'user', content: '[继续]' });
                 historyForApi = [];

            } else { // 'new' mode
                historyForApi = state.chatHistory;
            }

            messagesForApi.push(...await formatChatHistoryForApi(historyForApi));

            const endpoint = (state.currentChatApi.baseUrl.replace(/\/$/, '')) + (state.currentChatApi.path || '/v1/chat/completions');
            const payload = { model: state.currentChatApi.model, messages: messagesForApi, stream: true };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.currentChatApi.apiKey}` },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API 请求失败，状态码: ${response.status}`);
            }

            const emojis = await dbStorage.getItem(CHAT_DB_KEYS.EMOJIS) || [];
            const handlerContext = {
                reader: response.body.getReader(),
                decoder: new TextDecoder('utf-8'),
                emojis: emojis
            };

            const replyMessages = await universalStreamHandler(handlerContext);

            if (replyMessages.length > 0) {
                await onAiReply({ mode, data: replyMessages });
            } else {
                 if (mode === 'new') {
                    const thinkingMessage = elements.chatArea.querySelector('.message-row.system.loading');
                    if (thinkingMessage) thinkingMessage.remove();
                 }
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('AI reply cancelled by user.');
                await onAiReply({ mode: 'clear_thinking' });
                renderSystemMessage('AI回复已取消', 'info', elements.chatArea);
            } else {
                console.error('AI 回复生成失败:', error);
                await onAiReply({ mode: 'clear_thinking' });
                renderSystemMessage(`错误: ${error.message}`, 'error', elements.chatArea);
            }
        } finally {
            setIsAiReplying(false);
            setAbortController(null);
            elements.respondBtn.classList.remove('blinking');
            updateButtonStates();
            elements.input.focus();
        }
    }

    return handleSendMessage;
}