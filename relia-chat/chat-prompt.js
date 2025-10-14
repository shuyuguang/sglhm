// relia-chat/chat-prompt.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ======================= 1. 风格定义与逻辑中心 =======================
// 我们将每种风格的描述、示例、Prompt指令、响应处理函数都定义在这里
// 这使得添加新风格或修改现有风格变得非常容易，且无需改动 chat-room.js

/**
 * 默认的流式响应处理器（单条消息）
 * (此函数无变化)
 */
async function defaultStreamHandler(context) {
    const { reader, decoder, renderMessage, chatHistory, historyKey, chatArea } = context;
    
    const thinkingBubble = renderMessage({ text: '...', sender: 'character' }, -1);
    const thinkingBubbleRow = thinkingBubble.parentElement;
    let fullReply = '';

    try {
        thinkingBubble.textContent = '';
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
                            thinkingBubble.textContent = fullReply;
                            chatArea.scrollTop = chatArea.scrollHeight;
                        }
                    } catch (e) { /* 忽略解析错误 */ }
                }
            }
        }
        
        // ▼▼▼ 修改点1：在最终显示前，同样过滤掉可能存在的 thought 内容 ▼▼▼
        const cleanReply = fullReply.replace(/\(thought[\s\S]*?\)/g, '').trim();

        thinkingBubbleRow.remove();
        if (cleanReply) {
            const replyMessage = { text: cleanReply, sender: 'character' };
            chatHistory.push(replyMessage);
            await dbStorage.setItem(historyKey, chatHistory);
            renderMessage(replyMessage, chatHistory.length - 1);
        }
    } catch (error) {
        thinkingBubbleRow.remove();
        throw error; // 将错误抛出，由调用者处理
    }
}

/**
 * [V4 最终版] “对话体”专用的流式响应处理器
 * 支持解析并隐藏 (thought ...) 思维链
 */
async function dialogueStreamHandler(context) {
    const { reader, decoder, renderMessage, chatHistory, historyKey, chatArea, loadAndRenderHistory } = context;

    let currentBubble = renderMessage({ text: '...', sender: 'character' }, -1);
    let currentBubbleRow = currentBubble.parentElement;
    
    let rawStreamBuffer = '';
    const fullReplyForHistory = [];

    try {
        currentBubble.textContent = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });

            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content;
                        if (content) {
                            rawStreamBuffer += content;
                        }
                    } catch (e) { /* 忽略不完整的JSON */ }
                }
            }

            // ▼▼▼ 修改点2：核心逻辑 - 过滤掉 (thought ...) 内容 ▼▼▼
            // 使用正则表达式将所有 (thought ...) 结构替换为空字符串
            const cleanFullStream = rawStreamBuffer.replace(/\(thought[\s\S]*?\)/g, '');
            // ▲▲▲ 修改结束 ▲▲▲

            const messageParts = cleanFullStream.split('[split]');

            for (let i = fullReplyForHistory.length; i < messageParts.length - 1; i++) {
                const completedMessage = messageParts[i].trim();
                
                if (completedMessage) {
                    currentBubble.textContent = completedMessage;
                    fullReplyForHistory.push(completedMessage);
                    
                    currentBubble = renderMessage({ text: '...', sender: 'character' }, -1);
                    currentBubble.textContent = '';
                    currentBubbleRow = currentBubble.parentElement;
                }
            }

            const currentlyStreamingMsg = messageParts[messageParts.length - 1].trimStart();
            currentBubble.textContent = currentlyStreamingMsg;
            chatArea.scrollTop = chatArea.scrollHeight;
        }
        
        const finalMessage = currentBubble.textContent.trim();
        if (finalMessage) {
            fullReplyForHistory.push(finalMessage);
        } else {
            // 如果最后一条消息是空的（比如只有 thought），则移除占位的气泡
            currentBubbleRow?.remove();
        }

        if (fullReplyForHistory.length > 0) {
            // 从历史记录中移除初始的 "..." 占位符（如果存在）
            const lastMsgIndex = chatHistory.length -1;
            if(lastMsgIndex >= 0 && chatHistory[lastMsgIndex].text === '...' && chatHistory[lastMsgIndex].sender === 'character') {
                 chatHistory.pop();
            }

            const newMessages = fullReplyForHistory.map(text => ({ text, sender: 'character' }));
            chatHistory.push(...newMessages);
            await dbStorage.setItem(historyKey, chatHistory);
            // 重新渲染整个历史，确保UI与数据同步
            await loadAndRenderHistory();
        }

    } catch (error) {
        currentBubbleRow?.remove();
        throw error;
    }
}


export const CHAT_STYLES = {
    'dialogue': {
        name: '对话体',
        description: '此风格模仿日常对话，不包含动作或环境描述，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        example: '示例：\n"你好，今天天气真不错！"',
        // ▼▼▼ 修改点3：更新 Prompt 指令 ▼▼▼
        getPromptAddition: () => (
            `- 【重要】在开始回复前，你可以在心中进行思考和规划，将这部分内容放在 **(thought ...)** 结构中。这个结构里的所有内容都不会被用户看到。思考结束后，再输出实际的对话内容。\n`+
            `- 【重要】为了模仿真人的打字和发送习惯，你可以将一个完整的回复拆分成多条短消息。在每条消息的末尾，使用特殊标记 **[split]** 来表示一次发送。最后一条消息末尾不需要加标记。\n`+
            `- 示例1 (单条消息): (thought The user said hi, I should reply friendly.)你好啊！\n`+
            `- 示例2 (多条消息): (thought User在叫我, 我应该积极回应, 表示我在. 用小洛的口吻, 可以亲切一点.)在的呀！[split]User, 有什么事嘛？😊`
        ),
        // ▲▲▲ 修改结束 ▲▲▲
        streamHandler: dialogueStreamHandler,
    },
    'short-chat': {
        name: '短聊体',
        description: '此风格类似社交软件聊天，动作或环境描述会用括号标注，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        example: '示例：\n"嘿嘿，是呀~ 天气超棒的。"',
        getPromptAddition: () => (
            `- 【重要】在开始回复前，你可以在心中进行思考和规划，将这部分内容放在 **(thought ...)** 结构中。这个结构里的所有内容都不会被用户看到。思考结束后，再输出实际的对话内容。`
        ),
        streamHandler: defaultStreamHandler, // 使用默认处理器
    },
    'novel': {
        name: '小说体',
        description: '此风格以小说或剧本形式输出，包含角色的语言、动作、神态和心理活动。该模式下禁用表情包。',
        example: '示例：\n他微微一笑，抬头望向湛蓝的天空，轻声说道：“你好，今天天气真不错！”',
        getPromptAddition: () => (
            `- 【重要】在开始回复前，你可以在心中进行思考和规划，将这部分内容放在 **(thought ...)** 结构中。这个结构里的所有内容都不会被用户看到。思考结束后，再输出实际的对话内容。`
        ),
        streamHandler: defaultStreamHandler, // 使用默认处理器
    }
};


// ======================= 2. UI 面板创建与管理 (无变化) =======================

export function createChatPromptPanel({ triggerElement, container, onSave, charId }) {

    const styleKeys = Object.keys(CHAT_STYLES);
    
    const styleButtonsHtml = styleKeys.map(key => 
        `<button class="style-button" data-style="${key}">${CHAT_STYLES[key].name}</button>`
    ).join('');

    const panelHtml = `
        <div class="modal-overlay" id="chat-prompt-overlay">
            <div class="modal-panel" id="chat-prompt-panel">
                <div class="modal-header">
                    <h3 class="modal-title">聊天风格面板</h3>
                </div>
                <div class="modal-content-container">
                    <div class="style-buttons-container">${styleButtonsHtml}</div>
                    <div class="style-details-container">
                        <p class="prompt-description" id="style-description"></p>
                        <textarea class="prompt-template-input" id="style-example" readonly></textarea>
                    </div>
                </div>
                <div class.sheet-footer">
                    <button class="sheet-btn sheet-btn-cancel" id="prompt-cancel-btn">取消</button>
                    <button class="sheet-btn sheet-btn-confirm" id="prompt-save-btn">保存</button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', panelHtml);

    const ui = {
        overlay: document.getElementById('chat-prompt-overlay'),
        panel: document.getElementById('chat-prompt-panel'),
        styleButtons: document.querySelectorAll('#chat-prompt-panel .style-button'),
        styleDescription: document.getElementById('style-description'),
        styleExample: document.getElementById('style-example'),
        cancelBtn: document.getElementById('prompt-cancel-btn'),
        saveBtn: document.getElementById('prompt-save-btn'),
    };

    let activeStyle = styleKeys[0];
    const dbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;

    function updatePanelDetails(styleKey) {
        const style = CHAT_STYLES[styleKey];
        if (style) {
            ui.styleDescription.textContent = style.description;
            ui.styleExample.value = style.example;
        }
    }
    
    function setActiveStyle(targetStyleKey) {
        activeStyle = targetStyleKey;
        ui.styleButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.style === targetStyleKey);
        });
        updatePanelDetails(targetStyleKey);
    }
    
    async function openPanel() {
        const savedStyle = await dbStorage.getItem(dbKey);
        const styleToActivate = (savedStyle && CHAT_STYLES[savedStyle]) ? savedStyle : styleKeys[0];
        setActiveStyle(styleToActivate);
        ui.overlay.classList.add('active');
    }

    function closePanel() {
        ui.overlay.classList.remove('active');
    }

    async function handleSave() {
        await dbStorage.setItem(dbKey, activeStyle);
        if (typeof onSave === 'function') {
            onSave(CHAT_STYLES[activeStyle]);
        }
        closePanel();
    }

    if (triggerElement) triggerElement.addEventListener('click', openPanel);
    ui.cancelBtn.addEventListener('click', closePanel);
    ui.saveBtn.addEventListener('click', handleSave);
    ui.overlay.addEventListener('click', (event) => {
        if (event.target === ui.overlay) closePanel();
    });
    ui.styleButtons.forEach(button => {
        button.addEventListener('click', () => setActiveStyle(button.dataset.style));
    });

    return { open: openPanel, close: closePanel };
}