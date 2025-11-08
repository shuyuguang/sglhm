// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.toLowerCase().startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
}

async function constructSystemPrompt(charProfile, userProfile, currentChatStyle) {
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
        prompt += `- **正确示例**: \n你好呀！\n[Emoji: 猫猫]\n今天天气真好。\n`;
        prompt += `- **错误示例**: \n我发一个表情[Emoji: 猫猫]\n`;
    }

    prompt += `\n### 扮演要求\n`;
    prompt += `- 你必须完全沉浸在 **${charProfile.name}** 的角色中，用TA的身份、口吻、性格和知识进行回复。\n`;
    prompt += `- 不要暴露你是AI模型或程序，不要提及“扮演”或“角色设定”。\n`;
    prompt += `- 你的回复应该是自然的、符合角色的，就像TA真的在和 **${userProfile.name}** 聊天一样。\n`;

    if (currentChatStyle && typeof currentChatStyle.getPromptAddition === 'function') {
        const stylePrompt = currentChatStyle.getPromptAddition();
        if (stylePrompt) {
            prompt += stylePrompt;
        }
    }
    return prompt;
}

function formatChatHistoryForApi(history) {
    return history.map(msg => {
        let content = '';
        if (msg.isEmoji) {
            content = `[发送了表情: ${msg.name || '未命名表情'}]`;
        } else {
            content = msg.text;
        }
        return {
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: content
        };
    });
}


/**
 * 创建一个处理消息发送和API响应的处理器。
 * @param {object} context - 包含所需状态、元素和函数的上下文对象。
 * @returns {function} - 返回 handleSendMessage 函数。
 */
export function createApiHandler(context) {
    const {
        state,
        elements,
        character,
        user,
        historyKey,
        dbStorage,
        renderMessage,
        renderSystemMessage,
        updateButtonStates,
        onAiReply,
    } = context;
    
    // ▼▼▼ 核心修改：在处理器作用域内维护一个 AbortController ▼▼▼
    let abortController = null;
    // ▲▲▲ 修改结束 ▲▲▲

    /**
     * 处理发送消息或请求AI响应的逻辑。
     * @param {boolean} shouldTriggerReply - 是否应请求AI响应。
     */
    async function handleSendMessage(shouldTriggerReply) {
        const text = elements.input.value.trim();
        if (text !== '') {
            const userMessage = { text, sender: 'user' };
            state.chatHistory.push(userMessage);
            renderMessage(userMessage, state.chatHistory.length - 1, user, character, elements.chatArea);
            await dbStorage.setItem(historyKey, state.chatHistory);

            elements.input.value = '';
            elements.input.style.height = '';
            updateButtonStates();
            elements.input.focus();
        } else if (!shouldTriggerReply) {
            return;
        }

        if (shouldTriggerReply) {
            if (state.chatHistory.length === 0 || !state.currentChatApi) {
                alert(state.chatHistory.length === 0 ? '还没有聊天记录，请先说点什么吧！' : '请先点击“选择模型”按钮选择一个牵引仪模型！');
                return;
            }

            // ▼▼▼ 核心修改：切换按钮状态为“思考中” ▼▼▼
            elements.sendBtn.style.display = 'none';
            elements.respondBtn.style.display = 'none';
            elements.thinkingBtn.style.display = 'flex';
            
            // 创建一个新的 AbortController 用于本次请求
            abortController = new AbortController();
            
            // 为“思考中”按钮绑定取消事件
            elements.thinkingBtn.onclick = () => {
                if (abortController) {
                    abortController.abort(); // 中断 fetch 请求
                    console.log('API request aborted by user.');
                }
            };
            // ▲▲▲ 修改结束 ▲▲▲

            const thinkingMessage = { text: '...', sender: 'character' };
            state.chatHistory.push(thinkingMessage);
            renderMessage(thinkingMessage, state.chatHistory.length - 1, user, character, elements.chatArea);

            try {
                const systemPrompt = await constructSystemPrompt(character, user, state.currentChatStyle);
                
                const historyForApi = formatChatHistoryForApi(state.chatHistory.slice(0, -1));
                const messages = [{ role: 'system', content: systemPrompt }, ...historyForApi];
                const endpoint = (state.currentChatApi.baseUrl.replace(/\/$/, '')) + (state.currentChatApi.path || '/v1/chat/completions');
                const payload = { model: state.currentChatApi.model, messages: messages, stream: true };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.currentChatApi.apiKey}` },
                    body: JSON.stringify(payload),
                    signal: abortController.signal // 关键：将 signal 传递给 fetch
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
                    await onAiReply(replyMessages);
                } else {
                    await onAiReply([]);
                }

            } catch (error) {
                // ▼▼▼ 核心修改：优雅地处理中断错误 ▼▼▼
                if (error.name === 'AbortError') {
                    // 如果是用户主动中断，则静默处理，只清理UI
                    await onAiReply([]); // 清理掉 "..." 消息
                    renderSystemMessage('回复已取消', 'info', elements.chatArea);
                } else {
                    // 其他错误正常报告
                    console.error('AI 回复生成失败:', error);
                    await onAiReply([]);
                    renderSystemMessage(`错误: ${error.message}`, 'error', elements.chatArea);
                }
                // ▲▲▲ 修改结束 ▲▲▲
            } finally {
                // ▼▼▼ 核心修改：恢复按钮的最终状态 ▼▼▼
                elements.thinkingBtn.style.display = 'none';
                elements.thinkingBtn.onclick = null; // 移除事件监听
                abortController = null; // 清理控制器
                updateButtonStates(); // 恢复 发送/响应 按钮
                elements.input.focus();
                // ▲▲▲ 修改结束 ▲▲▲
            }
        }
    }

    return handleSendMessage;
}