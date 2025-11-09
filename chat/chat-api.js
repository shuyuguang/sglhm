// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ... (isImageUrl and blobUrlToDataUrl functions remain unchanged)
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
    if (emojis.length > 0) {
        const emojiNameList = emojis.map(e => e.name).join(', ');
        prompt += `\n### 工具：发送表情包\n`;
        prompt += `- 你有一个发送表情包的工具。你的可用表情包有：[${emojiNameList}]。\n`;
        prompt += `- **使用规则 (非常重要)**: 当你想发送表情时，必须使用格式 **[Emoji: 表情名称]**，并确保它**单独占据一行**。不要添加任何多余的文字或符号。\n`;
    }

    // ▼▼▼ 【核心新增】明确告知AI如何使用链接卡片 ▼▼▼
    prompt += `\n### 工具：发送链接卡片\n`;
    prompt += `- 你还可以发送链接卡片来分享结构化的信息，例如分享文章、推荐地点等。\n`;
    prompt += `- **使用规则 (非常重要)**: 当你想发送链接卡片时，必须严格使用以下格式，并确保它**单独占据一段**:\n`;
    prompt += "```\n[Title: 卡片标题\nBody text: 卡片正文内容\nSource: 卡片来源 (可选)\nIllustration: 对配图的文字描述 (可选，例如 '一只正在打哈欠的猫')]\n```\n";
    prompt += `- **注意**: \`Title\` 和 \`Body text\` 是必填项。\`Source\` 和 \`Illustration\` 是可选项。\`Illustration\` 字段应该是一段简短的**文字描述**，而不是图片数据或链接。\n`;
    // ▲▲▲ 新增结束 ▲▲▲

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

// ... (formatChatHistoryForApi and createApiHandler functions remain unchanged)
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

            } else { // 'new' mode
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