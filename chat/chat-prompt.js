// relia-chat/chat-prompt.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// ... (isImageUrl and isBase64 functions remain unchanged)
function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
}

function isBase64(str) {
    if (typeof str !== 'string' || !str) return false;
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return str.length > 50 && str.length % 4 === 0 && base64Regex.test(str);
}


// ▼▼▼ 【核心优化】使用更健壮的解析逻辑 ▼▼▼
function parseAiReply(fullReply, emojis) {
    const messages = [];
    const mainRegex = /\[([\s\S]+?)\]|([^\[\]]+)/g;
    const emojiRegex = /^\[Emoji:\s*(.*?)\s*\]$/;
    
    let match;
    while ((match = mainRegex.exec(fullReply)) !== null) {
        const potentialCardContent = match[1];
        const plainText = match[2];

        if (potentialCardContent && potentialCardContent.includes('Title:') && potentialCardContent.includes('Body text:')) {
            // 尝试解析为链接卡片
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
                    // 处理多行内容
                    if (currentKey === 'body') cardData.body += '\n' + line.trim();
                }
            });

            if (cardData.title && cardData.body) {
                messages.push(cardData);
            } else {
                // 解析失败，作为普通文本处理
                messages.push({ sender: 'character', text: `[${potentialCardContent}]` });
            }

        } else if (plainText && plainText.trim()) {
            // 处理普通文本和表情
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
// ▲▲▲ 优化结束 ▲▲▲

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

// ... (CHAT_STYLES, STYLE_DEFAULT_SETTINGS, and createChatPromptPanel function remain unchanged)
export const CHAT_STYLES = {
    'dialogue': {
        name: '对话体',
        description: '此风格模仿日常对话，不包含动作或环境描述，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: universalStreamHandler,
    },
    'short-chat': {
        name: '短聊体',
        description: '此风格类似社交软件聊天，动作或环境描述会用括号标注，该模式下角色允许扩展内的一切行为如语音、表情包、转账、礼物等。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: universalStreamHandler,
    },
    'novel': {
        name: '小说体',
        description: '此风格以小说或剧本形式输出，包含角色的语言、动作、神态和心理活动。该模式下禁用表情包。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: universalStreamHandler,
    },
    'text-adventure': {
        name: '文游体',
        description: '此风格以文字冒险游戏（MUD/TRPG）的形式进行，包含详细的环境与人物状态描写，并在末尾提供选项引导用户互动。该模式UI特殊。',
        getPromptAddition: () => { /* 此函数当前为空，返回 undefined */ },
        streamHandler: universalStreamHandler,
    }
};

export const STYLE_DEFAULT_SETTINGS = {
    'dialogue': { outputMin: '2', outputMax: '20', visualLimit: '50', memoryLimit: '20' },
    'short-chat': { outputMin: '3', outputMax: '15', visualLimit: '30', memoryLimit: '15' },
    'novel': { outputMin: '2', outputMax: '10', visualLimit: '30', memoryLimit: '15' },
    'text-adventure': { outputMin: '3', outputMax: '15', visualLimit: '30', memoryLimit: '15' }
};

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
    
    async function loadAndDisplaySettings(styleKey) {
        const defaults = STYLE_DEFAULT_SETTINGS[styleKey] || STYLE_DEFAULT_SETTINGS['dialogue'];
        
        const settingsDbKey = `${CHAT_DB_KEYS.CHAT_SETTINGS}_${charId}_${styleKey}`;
        const savedSettings = await dbStorage.getItem(settingsDbKey);
        
        const settings = savedSettings || {};
        const outputLimit = settings.outputLimit || {};

        ui.outputLimitMinInput.value = outputLimit.min || defaults.outputMin;
        ui.outputLimitMaxInput.value = outputLimit.max || defaults.outputMax;
        ui.visualLimitInput.value = settings.visualLimit || defaults.visualLimit;
        ui.memoryLimitInput.value = settings.memoryLimit || defaults.memoryLimit;
    }

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