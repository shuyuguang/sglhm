// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.toLowerCase().startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
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

// ▼▼▼ 核心修改：在系统提示中加入链接卡片的说明 ▼▼▼
async function constructSystemPrompt(charProfile, userProfile, currentChatStyle, styleSettings) {
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
    
    prompt += `\n### 工具使用规则 (非常重要)\n`;
    if (emojis.length > 0) {
        const emojiNameList = emojis.map(e => e.name).join(', ');
        prompt += `#### 1. 发送表情包\n`;
        prompt += `- 你的可用表情包有：[${emojiNameList}]。\n`;
        prompt += `- **使用格式**: 当你想发送表情时，必须使用 **[Emoji: 表情名称]**，并确保它**单独占据一行**。\n`;
    }
    
    prompt += `#### 2. 发送链接卡片\n`;
    prompt += `- 当你需要分享一个网址时，必须使用链接卡片格式。\n`;
    prompt += `- **使用格式**: **[Link: 链接URL | 标题 | 描述 | 图片URL]**，并确保它**单独占据一行**。\n`;
    prompt += `- **格式说明**:\n`;
    prompt += `  - **链接URL**: 必须是完整的 http/https 链接。\n`;
    prompt += `  - **标题**: 卡片的标题，简洁明了。\n`;
    prompt += `  - **描述**: 对链接内容的简短介绍。\n`;
    prompt += `  - **图片URL**: (可选) 用于卡片预览的图片链接。如果提供，必须是完整的图片URL。\n`;
    prompt += `- **示例**: [Link: https://www.bilibili.com | B站 | 一个有趣的视频网站 | https://.../cover.jpg]\n`;


    prompt += `\n### 扮演要求\n`;
    prompt += `- 你必须完全沉浸在 **${charProfile.name}** 的角色中，用TA的身份、口吻、性格和知识进行回复。\n`;
    prompt += `- 不要暴露你是AI模型或程序，不要提及“扮演”或“角色设定”。\n`;
    
    prompt += `\n### 对话风格与限制\n`;
    prompt += `- 你的回复应该遵循 **${currentChatStyle.name}** 风格。\n`;
    if (styleSettings && styleSettings.outputMin && styleSettings.outputMax) {
        prompt += `- 你的回复应该包含最少 **${styleSettings.outputMin}** 条、最多 **${styleSettings.outputMax}** 条消息，每条消息单独占一行。\n`;
    }

    if (currentChatStyle && typeof currentChatStyle.getPromptAddition === 'function') {
        const stylePrompt = currentChatStyle.getPromptAddition();
        if (stylePrompt) {
            prompt += stylePrompt;
        }
    }
    return prompt;
}
// ▲▲▲ 修改结束 ▲▲▲


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
                // ▼▼▼ 新增：处理用户发送的链接消息 ▼▼▼
                case 'link':
                    content = `[Link: ${msg.url} | ${msg.title} | ${msg.description} | ${msg.image}]`;
                    return { role: 'user', content: content };
                // ▲▲▲ 新增结束 ▲▲▲
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
                // ▼▼▼ 新增：处理AI回复的链接消息 ▼▼▼
                if (part.type === 'link') {
                    return `[Link: ${part.url} | ${part.title} | ${part.description} | ${part.image}]`;
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
        getIsAiReplying, setIsAiReplying, setAbortController, getStyleSettings
    } = context;

    async function handleSendMessage(mode = 'new') {
        if (getIsAiReplying()) {
            console.log("AI is already replying. New request blocked.");
            return;
        }

        let historyForApi;
        const currentStyleSettings = getStyleSettings();
        const memoryLimit = parseInt(currentStyleSettings.memoryLimit, 10) || 15;
        const memoryInMsgCount = memoryLimit * 2;
        
        const lastMessage = state.chatHistory[state.chatHistory.length - 1];
        if (!state.currentChatApi) {
            alert('请先点击“选择模型”按钮选择一个牵引仪模型！');
            return;
        }
        if (mode !== 'new' && !lastMessage) {
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
            const systemPrompt = await constructSystemPrompt(character, user, state.currentChatStyle, currentStyleSettings);
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

            } else {
                historyForApi = state.chatHistory;
            }

            const recentHistory = historyForApi.slice(-memoryInMsgCount);
            messagesForApi.push(...await formatChatHistoryForApi(recentHistory));

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

            const replyMessages = await state.currentChatStyle.streamHandler(handlerContext);

            if (replyMessages.length > 0) {
                await onAiReply({ mode, data: replyMessages });
            } else {
                await onAiReply({ mode: 'clear_thinking' });
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