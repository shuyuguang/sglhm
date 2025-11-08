// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js'; // [新增] 引入 db
import { CHAT_DB_KEYS } from '../config/chat.config.js'; // [新增] 引入配置

// [新增] 辅助函数，用于判断字符串是否为图片URL
function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    // 修正：确保URL以http开头，避免误判
    return url.toLowerCase().startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
}

/**
 * 【已修复】更新System Prompt，使其支持表情包
 * @param {object} charProfile 
 * @param {object} userProfile 
 * @param {object} currentChatStyle 
 * @returns {Promise<string>}
 */
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

    // ======================== [核心修改] ========================
    // 注入新的、更清晰的表情包工具指令
    const emojis = await dbStorage.getItem(CHAT_DB_KEYS.EMOJIS) || [];
    if (emojis.length > 0) {
        // 只把表情包的名称给AI看
        const emojiNameList = emojis.map(e => e.name).join(', ');
        prompt += `\n### 工具：发送表情包\n`;
        prompt += `- 你有一个发送表情包的工具。你的可用表情包有：[${emojiNameList}]。\n`;
        prompt += `- **使用规则 (非常重要)**: 当你想发送表情时，必须使用格式 **[Emoji: 表情名称]**，并确保它**单独占据一行**。不要添加任何多余的文字或符号。\n`;
        prompt += `- **正确示例**: \n你好呀！\n[Emoji: 猫猫]\n今天天气真好。\n`;
        prompt += `- **错误示例**: \n我发一个表情[Emoji: 猫猫]\n`;
    }
    // ==========================================================

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
            elements.sendBtn.disabled = true;
            elements.respondBtn.disabled = true;
            
            const thinkingMessage = { text: '...', sender: 'character' };
            state.chatHistory.push(thinkingMessage);
            renderMessage(thinkingMessage, state.chatHistory.length - 1, user, character, elements.chatArea);

            // 【核心修复】使用 await 调用异步的 constructSystemPrompt
            const systemPrompt = await constructSystemPrompt(character, user, state.currentChatStyle);
            
            // ======================== [核心修改] ========================
            // 1. 在这里获取一次表情列表
            const emojis = await dbStorage.getItem(CHAT_DB_KEYS.EMOJIS) || [];

            // 2. 将表情列表加入到传递给 streamHandler 的上下文中
            const handlerContext = {
                reader: response.body.getReader(),
                decoder: new TextDecoder('utf-8'),
                emojis: emojis // <-- 把表情列表传进去
            };
            
            // 3. 调用 streamHandler
            const replyMessages = await state.currentChatStyle.streamHandler(handlerContext);
            // ==========================================================

            if (replyMessages.length > 0) {
                await onAiReply(replyMessages);
            } else {
                // 如果AI回复为空（例如，只回复了一个无法识别的表情），也需要清掉“输入中”状态
                await onAiReply([]);
            }


            } catch (error) {
                console.error('AI 回复生成失败:', error);
                await onAiReply([]);
                renderSystemMessage(`错误: ${error.message}`, 'error', elements.chatArea);
            } finally {
                updateButtonStates();
                elements.input.focus();
            }
        }
    }

    return handleSendMessage;
}