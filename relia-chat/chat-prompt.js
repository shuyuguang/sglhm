// relia-chat/chat-prompt.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ======================= 1. 风格定义与逻辑中心 =======================
// 我们将每种风格的描述、示例、Prompt指令、响应处理函数都定义在这里
// 这使得添加新风格或修改现有风格变得非常容易，且无需改动 chat-room.js

/**
 * 默认的流式响应处理器（单条消息）
 * @param {object} context - 从 chat-room.js 传入的上下文对象
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
            const chunk = decoder.decode(value);
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
        
        thinkingBubbleRow.remove();
        if (fullReply) {
            const replyMessage = { text: fullReply, sender: 'character' };
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
 * “对话体”专用的流式响应处理器（支持多条消息）
 * @param {object} context - 从 chat-room.js 传入的上下文对象
 */
// ▼▼▼ 将整个函数替换为以下内容 ▼▼▼
async function dialogueStreamHandler(context) {
    const { reader, decoder, renderMessage, chatHistory, historyKey, chatArea, loadAndRenderHistory } = context;

    let currentBubble = renderMessage({ text: '...', sender: 'character' }, -1);
    let currentBubbleRow = currentBubble.parentElement;
    let messageBuffer = ''; // 用于累积解码后的字符串
    let fullReplyForHistory = [];

    try {
        currentBubble.textContent = ''; // 清空初始的"..."

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 【核心修正 ①】: 使用 stream: true 解码，并将结果持续追加到 buffer
            messageBuffer += decoder.decode(value, { stream: true });

            // 【核心修正 ②】: 用一种更健壮的方式处理 SSE (Server-Sent Events) 数据
            // 我们只处理 buffer 中可以被完整解析的部分
            let boundary;
            while ((boundary = messageBuffer.indexOf('\n\n')) !== -1) {
                const completeChunk = messageBuffer.substring(0, boundary);
                messageBuffer = messageBuffer.substring(boundary + 2); // 从 buffer 中移除已处理的部分

                const lines = completeChunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content;
                            if (content) {
                                // 将获取到的内容追加到当前气泡
                                currentBubble.textContent += content;

                                // 【核心修正 ③】: 在内容追加后，检查是否包含分隔符
                                while (currentBubble.textContent.includes('[split]')) {
                                    const parts = currentBubble.textContent.split('[split]');
                                    const completeMessage = parts.shift().trim();

                                    // 最终确定当前气泡的内容
                                    currentBubble.textContent = completeMessage;
                                    if (completeMessage) {
                                        fullReplyForHistory.push(completeMessage);
                                    }

                                    // 创建一个新的气泡，并将 [split] 后的剩余内容放入
                                    currentBubble = renderMessage({ text: '...', sender: 'character' }, -1);
                                    currentBubble.textContent = parts.join('[split]'); // 放入剩余内容
                                    currentBubbleRow = currentBubble.parentElement;
                                }
                            }
                        } catch (e) {
                            // 忽略无法解析的 JSON，因为我们已经确保了块的完整性
                        }
                    }
                }
            }
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        // 流结束后，处理最后一个气泡和历史记录
        const finalMessage = currentBubble.textContent.trim();
        if (finalMessage) {
            fullReplyForHistory.push(finalMessage);
        } else {
            currentBubbleRow.remove(); // 如果最后一个气泡是空的，就移除它
        }

        if (fullReplyForHistory.length > 0) {
            const newMessages = fullReplyForHistory.map(text => ({ text, sender: 'character' }));
            chatHistory.push(...newMessages);
            await dbStorage.setItem(historyKey, chatHistory);
            await loadAndRenderHistory(); // 重新加载以获得正确的消息索引
        }

    } catch (error) {
        currentBubbleRow?.remove();
        throw error;
    }
}
// ▲▲▲ 替换结束 ▲▲▲


export const CHAT_STYLES = {
    'dialogue': {
        name: '对话体',
        description: '此风格模仿日常对话，不包含动作或环境描述，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        example: '示例：\n"你好，今天天气真不错！"',
        getPromptAddition: () => (
            `- 【重要】为了模仿真人的打字和发送习惯，你可以将一个完整的回复拆分成多条短消息。在每条消息的末尾，使用特殊标记 **[split]** 来表示一次发送。最后一条消息末尾不需要加标记。\n`+
            `- 示例：如果想一次性回复“你好啊！今天天气真不错，不是吗？”，你可以这样构造输出：你好啊！[split]今天天气真不错，不是吗？\n`+
            `- 记住，只有在你觉得需要停顿或分段发送时才使用 [split] 标记。如果一句话就能说完，就不需要使用。`
        ),
        streamHandler: dialogueStreamHandler,
    },
    'short-chat': {
        name: '短聊体',
        description: '此风格类似社交软件聊天，动作或环境描述会用括号标注，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        example: '示例：\n"嘿嘿，是呀~ 天气超棒的。"',
        getPromptAddition: () => ``, // 无额外指令
        streamHandler: defaultStreamHandler,
    },
    'novel': {
        name: '小说体',
        description: '此风格以小说或剧本形式输出，包含角色的语言、动作、神态和心理活动。该模式下禁用表情包。',
        example: '示例：\n他微微一笑，抬头望向湛蓝的天空，轻声说道：“你好，今天天气真不错！”',
        getPromptAddition: () => ``,
        streamHandler: defaultStreamHandler,
    },
    'text-game': {
        name: '文游体',
        description: '此风格类似文字冒险游戏（TRPG），侧重于语言对话和环境描写的互动，该模式下禁用扩展和表情包。',
        example: '示例：\n你看到一个熟悉的身影坐在不远处的长椅上，微风吹拂着他的发梢。他似乎注意到了你，转过头来对你微笑。\n"你好，今天天气真不错！"\n\n> 你会如何回应？\n1. 上前打招呼。\n2. 悄悄离开。',
        getPromptAddition: () => ``,
        streamHandler: defaultStreamHandler,
    }
};


// ======================= 2. UI 面板创建与管理 =======================

export function createChatPromptPanel({ triggerElement, container, onSelect, onSave, charId }) {

    const styleKeys = Object.keys(CHAT_STYLES);
    
    // 动态生成 Tabs 和 Tab-Contents
    const tabsHtml = styleKeys.map((key, index) => 
        `<button class="modal-tab ${index === 0 ? 'active' : ''}" data-tab="${key}">${CHAT_STYLES[key].name}</button>`
    ).join('');

    const tabContentsHtml = styleKeys.map((key, index) => `
        <div class="modal-tab-content ${index === 0 ? 'active' : ''}" id="${key}-content">
            <p class="prompt-description">${CHAT_STYLES[key].description}</p>
            <textarea class="prompt-template-input" readonly>${CHAT_STYLES[key].example}</textarea>
        </div>
    `).join('');

    const panelHtml = `
        <div class="modal-overlay" id="chat-prompt-overlay">
            <div class="modal-panel" id="chat-prompt-panel">
                <div class="modal-tabs">${tabsHtml}</div>
                <div class="modal-content-container">${tabContentsHtml}</div>
                <div class="sheet-footer">
                    <button class="sheet-btn sheet-btn-cancel" id="prompt-cancel-btn">取消</button>
                    <button class="sheet-btn sheet-btn-secondary" id="prompt-save-btn">设为默认</button>
                    <button class="sheet-btn sheet-btn-confirm" id="prompt-select-btn">应用该风格</button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', panelHtml);

    const ui = {
        overlay: document.getElementById('chat-prompt-overlay'),
        panel: document.getElementById('chat-prompt-panel'),
        tabs: document.querySelectorAll('#chat-prompt-panel .modal-tab'),
        tabContents: document.querySelectorAll('#chat-prompt-panel .modal-tab-content'),
        cancelBtn: document.getElementById('prompt-cancel-btn'),
        saveBtn: document.getElementById('prompt-save-btn'),
        selectBtn: document.getElementById('prompt-select-btn'),
    };

    let activeTab = styleKeys[0];
    const dbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`; // 为每个角色单独保存风格

    async function openPanel() {
        const savedStyle = await dbStorage.getItem(dbKey);
        if (savedStyle && CHAT_STYLES[savedStyle]) {
            switchTab(savedStyle);
        }
        ui.overlay.classList.add('active');
    }

    function closePanel() {
        ui.overlay.classList.remove('active');
    }

    function switchTab(targetTabId) {
        activeTab = targetTabId;
        ui.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === targetTabId);
        });
        ui.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${targetTabId}-content`);
        });
    }

    function handleSelect() {
        if (typeof onSelect === 'function') {
            onSelect(CHAT_STYLES[activeTab]); // 将整个风格对象传出去
        }
        closePanel();
    }

    async function handleSave() {
        await dbStorage.setItem(dbKey, activeTab);
        if (typeof onSave === 'function') {
            onSave(CHAT_STYLES[activeTab]);
        }
        alert(`已将“${CHAT_STYLES[activeTab].name}”设为该角色的默认聊天风格。`);
        closePanel();
    }

    if (triggerElement) triggerElement.addEventListener('click', openPanel);
    ui.cancelBtn.addEventListener('click', closePanel);
    ui.saveBtn.addEventListener('click', handleSave);
    ui.selectBtn.addEventListener('click', handleSelect);
    ui.overlay.addEventListener('click', (event) => {
        if (event.target === ui.overlay) closePanel();
    });
    ui.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    return { open: openPanel, close: closePanel };
}