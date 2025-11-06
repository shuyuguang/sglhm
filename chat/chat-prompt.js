// relia-chat/chat-prompt.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ======================= 1. 风格定义与逻辑中心 =======================

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

// ▼▼▼ 新增：为每种风格定义不同的默认设置 ▼▼▼
const STYLE_DEFAULT_SETTINGS = {
    'dialogue': {
        outputMin: '2',
        outputMax: '20',
        visualLimit: '50',
        memoryLimit: '20'
    },
    'short-chat': {
        outputMin: '2',
        outputMax: '10',
        visualLimit: '30',
        memoryLimit: '15'
    },
    'novel': {
        outputMin: '2',
        outputMax: '10',
        visualLimit: '30',
        memoryLimit: '15'
    },
    'text-adventure': {
        outputMin: '3',
        outputMax: '15',
        visualLimit: '30',
        memoryLimit: '10'
    }
};
// ▲▲▲ 新增结束 ▲▲▲

// ======================= 2. UI 面板创建与管理 (已修改) =======================

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
                            <label>输出条数限制</label>
                            <div class="min-max-input-container">
                                <input type="number" id="output-limit-min-input" min="1" max="99">
                                <span>-</span>
                                <input type="number" id="output-limit-max-input" min="1" max="99">
                            </div>
                        </div>
                        <div class="style-setting-item">
                            <label for="visual-limit-input">视觉上下文限制</label>
                            <input type="number" id="visual-limit-input" min="30" max="99">
                        </div>
                        <div class="style-setting-item">
                            <label for="memory-limit-input">记忆轮数限制</label>
                            <input type="number" id="memory-limit-input" min="10" max="99">
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

    container.insertAdjacentHTML('beforeend', panelHtml);

    const ui = {
        overlay: document.getElementById('chat-prompt-overlay'),
        panel: document.getElementById('chat-prompt-panel'),
        styleButtons: document.querySelectorAll('#chat-prompt-panel .style-button'),
        styleCard: document.getElementById('style-card'),
        styleCardHeader: document.getElementById('style-card-header'),
        styleDescription: document.getElementById('style-description'),
        cancelBtn: document.getElementById('prompt-cancel-btn'),
        saveBtn: document.getElementById('prompt-save-btn'),
        outputLimitMinInput: document.getElementById('output-limit-min-input'),
        outputLimitMaxInput: document.getElementById('output-limit-max-input'),
        visualLimitInput: document.getElementById('visual-limit-input'),
        memoryLimitInput: document.getElementById('memory-limit-input'),
    };

    let activeStyle = styleKeys[0];
    const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;

    function updatePanelDetails(styleKey) {
        const style = CHAT_STYLES[styleKey];
        if (style) {
            ui.styleDescription.textContent = style.description;
        }
    }
    
    // ▼▼▼ 修改：此函数现在会根据风格加载对应的默认值 ▼▼▼
    async function loadAndDisplaySettings(styleKey) {
        // 1. 获取该风格的专属默认值，如果找不到则用对话体作为后备
        const defaults = STYLE_DEFAULT_SETTINGS[styleKey] || STYLE_DEFAULT_SETTINGS['dialogue'];
        
        // 2. 从数据库加载用户保存的设置
        const settingsDbKey = `${CHAT_DB_KEYS.CHAT_SETTINGS}_${charId}_${styleKey}`;
        const savedSettings = await dbStorage.getItem(settingsDbKey);
        
        const settings = savedSettings || {};
        const outputLimit = settings.outputLimit || {};

        // 3. 更新UI：优先使用保存值，否则使用该风格的默认值
        ui.outputLimitMinInput.value = outputLimit.min || defaults.outputMin;
        ui.outputLimitMaxInput.value = outputLimit.max || defaults.outputMax;
        ui.visualLimitInput.value = settings.visualLimit || defaults.visualLimit;
        ui.memoryLimitInput.value = settings.memoryLimit || defaults.memoryLimit;
    }
    // ▲▲▲ 修改结束 ▲▲▲

    async function setActiveStyle(targetStyleKey) {
        activeStyle = targetStyleKey;
        ui.styleButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.style === targetStyleKey);
        });
        updatePanelDetails(targetStyleKey);
        await loadAndDisplaySettings(targetStyleKey);
        ui.styleCard.classList.remove('expanded');
    }
    
    async function openPanel() {
        const savedStyle = await dbStorage.getItem(styleDbKey);
        const styleToActivate = (savedStyle && CHAT_STYLES[savedStyle]) ? savedStyle : styleKeys[0];
        await setActiveStyle(styleToActivate);
        ui.overlay.classList.add('active');
    }

    function closePanel() {
        ui.overlay.classList.remove('active');
    }

    async function handleSave() {
        const settingsDbKey = `${CHAT_DB_KEYS.CHAT_SETTINGS}_${charId}_${activeStyle}`;
        const settingsToSave = {
            outputLimit: {
                min: ui.outputLimitMinInput.value,
                max: ui.outputLimitMaxInput.value,
            },
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

    [ui.outputLimitMinInput, ui.outputLimitMaxInput, ui.visualLimitInput, ui.memoryLimitInput].forEach(input => {
        input.addEventListener('input', () => {
            const max = parseInt(input.max, 10);
            if (parseInt(input.value, 10) > max) {
                input.value = max;
            }
        });
        input.addEventListener('blur', () => {
            const min = parseInt(input.min, 10);
            if (input.value !== '' && parseInt(input.value, 10) < min) {
                input.value = min;
            }
        });
    });

    return { open: openPanel, close: closePanel };
}