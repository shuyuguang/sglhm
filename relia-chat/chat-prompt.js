// relia-chat/chat-prompt.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ======================= 1. 风格定义与逻辑中心 =======================
// (此部分无变化)

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
        throw error;
    }
}

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
            const cleanFullStream = rawStreamBuffer.replace(/\(thought[\s\S]*?\)/g, '');
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
            currentBubbleRow?.remove();
        }
        if (fullReplyForHistory.length > 0) {
            const lastMsgIndex = chatHistory.length -1;
            if(lastMsgIndex >= 0 && chatHistory[lastMsgIndex].text === '...' && chatHistory[lastMsgIndex].sender === 'character') {
                 chatHistory.pop();
            }
            const newMessages = fullReplyForHistory.map(text => ({ text, sender: 'character' }));
            chatHistory.push(...newMessages);
            await dbStorage.setItem(historyKey, chatHistory);
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
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: dialogueStreamHandler,
    },
    'short-chat': {
        name: '短聊体',
        description: '此风格类似社交软件聊天，动作或环境描述会用括号标注，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: defaultStreamHandler,
    },
    'novel': {
        name: '小说体',
        description: '此风格以小说或剧本形式输出，包含角色的语言、动作、神态和心理活动。该模式下禁用表情包。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: defaultStreamHandler,
    },
    'text-adventure': {
        name: '文游体',
        description: '此风格以文字冒险游戏（MUD/TRPG）的形式进行，包含详细的环境与人物状态描写，并在末尾提供选项引导用户互动。该模式UI特殊。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: defaultStreamHandler,
    }
};


// ======================= 2. UI 面板创建与管理 (已修改) =======================

export function createChatPromptPanel({ triggerElement, container, onSave, charId }) {

    const styleKeys = Object.keys(CHAT_STYLES);
    
    const styleButtonsHtml = styleKeys.map(key => 
        `<button class="style-button" data-style="${key}">${CHAT_STYLES[key].name}</button>`
    ).join('');

    // ▼▼▼ 修改：更新HTML，移除示例框，增加新设置项 ▼▼▼
    const panelHtml = `
        <div class="modal-overlay" id="chat-prompt-overlay">
            <div class="modal-panel" id="chat-prompt-panel">
                <div class="modal-header">
                    <h3 class="modal-title">聊天风格面板</h3>
                </div>
                <div class="modal-content-container">
                    <div class="style-buttons-container">${styleButtonsHtml}</div>
                    <div class="style-details-container">
                        <div class="style-card" id="style-card">
                            <div class="style-card-header" id="style-card-header">
                                <span class="style-card-title">注意事项</span>
                                <i class="fa-solid fa-chevron-down"></i>
                            </div>
                            <div class="style-card-content">
                                <p class="prompt-description" id="style-description"></p>
                            </div>
                        </div>
                    </div>
                    <div class="style-settings-container">
                        <div class="style-setting-item">
                            <label for="output-limit-input">输出条数限制</label>
                            <input type="number" id="output-limit-input" min="1" max="99" placeholder="1">
                        </div>
                        <div class="style-setting-item">
                            <label for="visual-limit-input">视觉上下文限制</label>
                            <input type="number" id="visual-limit-input" min="1" max="99" placeholder="1">
                        </div>
                        <div class="style-setting-item">
                            <label for="memory-limit-input">记忆轮数限制</label>
                            <input type="number" id="memory-limit-input" min="1" max="99" placeholder="10">
                        </div>
                    </div>
                </div>
                <div class="sheet-footer">
                    <button class="sheet-btn sheet-btn-cancel" id="prompt-cancel-btn">取消</button>
                    <button class="sheet-btn sheet-btn-confirm" id="prompt-save-btn">保存</button>
                </div>
            </div>
        </div>
    `;
    // ▲▲▲ 修改结束 ▲▲▲

    container.insertAdjacentHTML('beforeend', panelHtml);

    // ▼▼▼ 修改：更新UI元素引用 ▼▼▼
    const ui = {
        overlay: document.getElementById('chat-prompt-overlay'),
        panel: document.getElementById('chat-prompt-panel'),
        styleButtons: document.querySelectorAll('#chat-prompt-panel .style-button'),
        styleCard: document.getElementById('style-card'),
        styleCardHeader: document.getElementById('style-card-header'),
        styleDescription: document.getElementById('style-description'),
        cancelBtn: document.getElementById('prompt-cancel-btn'),
        saveBtn: document.getElementById('prompt-save-btn'),
        outputLimitInput: document.getElementById('output-limit-input'),
        visualLimitInput: document.getElementById('visual-limit-input'),
        memoryLimitInput: document.getElementById('memory-limit-input'),
    };
    // ▲▲▲ 修改结束 ▲▲▲

    let activeStyle = styleKeys[0];
    const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;
    // ▼▼▼ 新增：为新设置项定义数据库键 ▼▼▼
    const settingsDbKey = `${CHAT_DB_KEYS.CHAT_SETTINGS}_${charId}`;
    // ▲▲▲ 新增结束 ▲▲▲

    function updatePanelDetails(styleKey) {
        const style = CHAT_STYLES[styleKey];
        if (style) {
            ui.styleDescription.textContent = style.description;
        }
    }
    
    function setActiveStyle(targetStyleKey) {
        activeStyle = targetStyleKey;
        ui.styleButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.style === targetStyleKey);
        });
        updatePanelDetails(targetStyleKey);
        ui.styleCard.classList.remove('expanded');
    }
    
    // ▼▼▼ 修改：打开面板时加载风格和设置 ▼▼▼
    async function openPanel() {
        const [savedStyle, savedSettings] = await Promise.all([
            dbStorage.getItem(styleDbKey),
            dbStorage.getItem(settingsDbKey)
        ]);

        const styleToActivate = (savedStyle && CHAT_STYLES[savedStyle]) ? savedStyle : styleKeys[0];
        setActiveStyle(styleToActivate);

        if (savedSettings) {
            ui.outputLimitInput.value = savedSettings.outputLimit || '';
            ui.visualLimitInput.value = savedSettings.visualLimit || '';
            ui.memoryLimitInput.value = savedSettings.memoryLimit || '';
        }

        ui.overlay.classList.add('active');
    }
    // ▲▲▲ 修改结束 ▲▲▲

    function closePanel() {
        ui.overlay.classList.remove('active');
    }

    // ▼▼▼ 修改：保存时同时保存风格和设置 ▼▼▼
    async function handleSave() {
        const settingsToSave = {
            outputLimit: ui.outputLimitInput.value,
            visualLimit: ui.visualLimitInput.value,
            memoryLimit: ui.memoryLimitInput.value,
        };

        await Promise.all([
            dbStorage.setItem(styleDbKey, activeStyle),
            dbStorage.setItem(settingsDbKey, settingsToSave)
        ]);
        
        if (typeof onSave === 'function') {
            onSave(CHAT_STYLES[activeStyle]);
        }
        closePanel();
    }
    // ▲▲▲ 修改结束 ▲▲▲

    if (triggerElement) triggerElement.addEventListener('click', openPanel);
    ui.cancelBtn.addEventListener('click', closePanel);
    ui.saveBtn.addEventListener('click', handleSave);
    ui.overlay.addEventListener('click', (event) => {
        if (event.target === ui.overlay) closePanel();
    });
    ui.styleButtons.forEach(button => {
        button.addEventListener('click', () => setActiveStyle(button.dataset.style));
    });

    ui.styleCardHeader.addEventListener('click', () => {
        ui.styleCard.classList.toggle('expanded');
    });

    // ▼▼▼ 新增：为数字输入框添加简单的值范围校验 ▼▼▼
    [ui.outputLimitInput, ui.visualLimitInput, ui.memoryLimitInput].forEach(input => {
        input.addEventListener('input', () => {
            // 确保值不超过最大值
            if (parseInt(input.value, 10) > 99) {
                input.value = 99;
            }
        });
        input.addEventListener('blur', () => {
            // 确保离开时值不小于最小值（如果已填写）
            if (input.value !== '' && parseInt(input.value, 10) < 1) {
                input.value = 1;
            }
        });
    });
    // ▲▲▲ 新增结束 ▲▲▲

    return { open: openPanel, close: closePanel };
}