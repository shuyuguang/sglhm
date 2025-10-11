// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 获取角色ID和数据 ---
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        document.body.innerHTML = '<p>错误：未指定角色ID。</p>';
        return;
    }

    const [allChars, allUsers, currentUserId] = await Promise.all([
        dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
    ]);

    const character = allChars ? allChars.find(c => c.id === charId) : null;
    if (!character) {
        document.body.innerHTML = `<p>错误：找不到ID为 ${charId} 的角色。</p>`;
        return;
    }
    
    const currentUser = allUsers ? allUsers.find(u => u.id === currentUserId) : null;
    const user = currentUser || { name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

    // --- 2. 动态生成页面HTML ---
    const pageHtml = `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="char-info">
                    <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar">
                    <div class="char-info-text">
                        <span class="char-info-name">${character.name || '未命名'}</span>
                        <span class="char-info-status" id="char-info-status">在线</span>
                    </div>
                </div>
                <button class="chat-header-btn options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </header>
            <main class="chat-messages" id="chat-messages-area"></main>
            <footer class="chat-input-area" id="chat-input-area">
                <div class="chat-input-main" id="chat-input-main">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                        <div class="send-buttons-container" id="send-buttons-container">
                            <button id="respond-btn" class="send-action-btn" title="让AI扮演你进行回复">响应</button>
                            <button id="send-btn" class="send-action-btn primary">发送</button>
                        </div>
                    </div>
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <button id="model-select-btn" class="model-select-btn" title="选择对话模型"><i class="fa-solid fa-link"></i></button>
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                    </div>
                </div>
                <div class="chat-actions-bar">
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-camera"></i></button><span>拍照</span></div>
                </div>
                <div class="emoji-picker-bar"><div class="emoji-placeholder">表情面板功能待开发...</div></div>
            </footer>
        </div>
        <div class="modal-overlay" id="model-select-overlay">
            <div class="bottom-sheet" id="model-select-sheet">
                <div class="bottom-sheet-header-flex">
                    <h4 class="bottom-sheet-title-main">选择模型</h4>
                    <button class="sheet-close-btn" id="close-model-select-btn">&times;</button>
                </div>
                <div class="sheet-body-list" id="model-select-list-container"></div>
            </div>
        </div>
    `;
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 ---
    const ui = {
        chatArea: document.getElementById('chat-messages-area'),
        input: document.getElementById('chat-input'),
        optionsBtn: document.querySelector('.options-btn'),
        chatInputArea: document.getElementById('chat-input-area'),
        actionsToggleBtn: document.getElementById('actions-toggle-btn'),
        emojiToggleBtn: document.getElementById('emoji-toggle-btn'),
        sendButtonsContainer: document.getElementById('send-buttons-container'),
        sendBtn: document.getElementById('send-btn'),
        respondBtn: document.getElementById('respond-btn'),
        modelSelectBtn: document.getElementById('model-select-btn'),
        modelSelectOverlay: document.getElementById('model-select-overlay'),
        closeModelSelectBtn: document.getElementById('close-model-select-btn'),
        modelListContainer: document.getElementById('model-select-list-container'),
        statusText: document.getElementById('char-info-status'),
    };
    
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];
    let isGenerating = false; // 防止在生成回复时重复发送

    // --- 4. 核心功能函数 ---

    function renderMessage({ text, sender, isStreaming = false }) {
        if (isStreaming && sender === 'character') {
            let lastBubble = ui.chatArea.querySelector('.chat-bubble.character:last-of-type');
            if (lastBubble && lastBubble.dataset.streaming === 'true') {
                lastBubble.textContent += text;
                ui.chatArea.scrollTop = ui.chatArea.scrollHeight;
                return lastBubble;
            }
        }

        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = (sender === 'user') ? user.avatar : character.avatar;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        if (isStreaming) bubble.dataset.streaming = 'true';
        
        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        ui.chatArea.appendChild(messageRow);
        ui.chatArea.scrollTop = ui.chatArea.scrollHeight;
        return bubble;
    }
    
    async function loadAndRenderHistory() {
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory)) {
            chatHistory = savedHistory;
            chatHistory.forEach(message => renderMessage(message));
        }
    }

    /**
     * 查找指定模型ID对应的API配置
     * @param {string} modelId - 模型的唯一ID
     * @returns {Promise<object|null>} - 包含apiKey, baseUrl, path等的配置对象，或null
     */
    async function findApiConfigForModel(modelId) {
        const allConfigs = await dbStorage.getItem(API_DB_KEYS.CONFIGS) || [];
        const builtInData = await dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA) || {};

        // 查找自定义配置
        for (const config of allConfigs) {
            if (config.model && config.model.includes(modelId)) {
                return {
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                    path: config.path || '/v1/chat/completions'
                };
            }
        }
        // 查找内置配置
        for (const builtInId in builtInData) {
            const data = builtInData[builtInId];
            if (data.model && data.model.includes(modelId)) {
                const staticConfig = (await import('../pages/api-room-builtin.js')).BUILT_IN_API_DEFINITIONS[builtInId];
                if (staticConfig) {
                    return {
                        apiKey: data.apiKey,
                        baseUrl: staticConfig.baseUrl,
                        path: staticConfig.path
                    };
                }
            }
        }
        return null;
    }
    
    /**
     * 构建包含角色设定的 System Prompt
     * @returns {string} - 格式化后的系统提示
     */
    function buildSystemPrompt() {
        let prompt = `You are now in a role-playing conversation. Your character profile is as follows:\n`;
        prompt += `Name: ${character.name}\n`;
        if (character.gender) prompt += `Gender: ${character.gender}\n`;
        if (character.age) prompt += `Age: ${character.age}\n`;
        if (character.race) prompt += `Race: ${character.race}\n`;
        if (character.occupation) prompt += `Occupation: ${character.occupation}\n`;
        if (character.bio) prompt += `Bio: ${character.bio}\n`;

        if (character.customSections && character.customSections.length > 0) {
            character.customSections.forEach(section => {
                prompt += `\n[${section.title}]\n`;
                section.items.forEach(item => {
                    if(item.value) prompt += `${item.title}: ${item.value}\n`;
                });
            });
        }
        prompt += `\nPlease respond as this character, keeping your replies concise, engaging, and in character. The user you are talking to is named "${user.name}".`;
        return prompt;
    }

    async function handleSendMessage() {
        if (isGenerating) return;
        const text = ui.input.value.trim();
        if (text === '') return;

        const activeModelId = await dbStorage.getItem(API_DB_KEYS.GLOBAL_ACTIVE_MODEL_ID);
        if (!activeModelId) {
            alert('请先点击输入框左下角的“🔗”按钮选择一个对话模型。');
            return;
        }

        const apiConfig = await findApiConfigForModel(activeModelId);
        if (!apiConfig || !apiConfig.apiKey || !apiConfig.baseUrl) {
            alert(`找不到模型 ${activeModelId} 的有效API配置，请检查牵引仪设置。`);
            return;
        }

        isGenerating = true;
        ui.statusText.textContent = '对方正在输入...';
        ui.sendBtn.disabled = true;
        ui.respondBtn.disabled = true;

        // 1. 渲染并保存用户消息
        const userMessage = { role: 'user', content: text };
        renderMessage({ text: userMessage.content, sender: 'user' });
        chatHistory.push(userMessage);

        // 2. 清空输入框并重置状态
        ui.input.value = '';
        ui.input.style.height = '';
        ui.sendButtonsContainer.classList.remove('visible');

        // 3. 构建API请求
        const systemPrompt = buildSystemPrompt();
        const messages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory
        ];
        
        const endpoint = apiConfig.baseUrl.replace(/\/$/, '') + apiConfig.path;
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: activeModelId,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API请求失败 (HTTP ${response.status}): ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullReply = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));
                
                for (const line of lines) {
                    const jsonStr = line.replace('data: ', '');
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices[0].delta.content;
                        if (delta) {
                            fullReply += delta;
                            renderMessage({ text: delta, sender: 'character', isStreaming: true });
                        }
                    } catch (e) {
                        // JSON解析错误，可能收到了不完整的块，忽略
                    }
                }
            }
            
            if (fullReply) {
                chatHistory.push({ role: 'assistant', content: fullReply });
                await dbStorage.setItem(historyKey, chatHistory);
            }

        } catch (error) {
            console.error('API调用出错:', error);
            renderMessage({ text: `抱歉，我好像出错了: ${error.message}`, sender: 'character' });
        } finally {
            isGenerating = false;
            ui.statusText.textContent = '在线';
            ui.sendBtn.disabled = false;
            ui.respondBtn.disabled = false;
        }
    }

    // --- 5. 模型选择面板逻辑 ---
    async function openModelSelector() {
        ui.modelListContainer.innerHTML = '<p class="no-models-message">正在加载可用模型...</p>';
        ui.modelSelectOverlay.classList.add('active');

        const [userConfigs, builtInStates, builtInData, activeModelId] = await Promise.all([
            dbStorage.getItem(API_DB_KEYS.CONFIGS) || [],
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES) || {},
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA) || {},
            dbStorage.getItem(API_DB_KEYS.GLOBAL_ACTIVE_MODEL_ID)
        ]);

        let availableModels = [];

        // 处理用户自定义配置
        userConfigs.filter(c => c.enabled && c.model && c.model.length > 0).forEach(c => {
            c.model.forEach(modelId => {
                availableModels.push({
                    id: modelId,
                    provider: c.provider,
                    providerName: c.name
                });
            });
        });

        // 处理内置配置
        for (const id in builtInStates) {
            if (builtInStates[id].enabled) {
                const data = builtInData[id];
                if (data && data.model && data.model.length > 0) {
                    const staticConfig = (await import('../pages/api-room-builtin.js')).BUILT_IN_API_DEFINITIONS[id];
                    data.model.forEach(modelId => {
                        availableModels.push({
                            id: modelId,
                            provider: 'built-in',
                            providerName: staticConfig.name
                        });
                    });
                }
            }
        }
        
        if (availableModels.length === 0) {
            ui.modelListContainer.innerHTML = '<p class="no-models-message">没有已启用并选择了模型的牵引仪。<br>请先前往“牵引仪”页面进行配置。</p>';
            return;
        }

        const providerIcons = { openai: 'OA', google: 'G', claude: 'C', 'built-in': 'BI' };
        ui.modelListContainer.innerHTML = availableModels.map(model => `
            <div class="model-item ${model.id === activeModelId ? 'selected' : ''}" data-model-id="${model.id}">
                <div class="provider-icon provider-${model.provider}">${providerIcons[model.provider] || '?'}</div>
                <div class="model-info">
                    <div class="model-name">${model.id}</div>
                    <div class="provider-name">${model.providerName}</div>
                </div>
                <i class="fa-solid fa-check"></i>
            </div>
        `).join('');
    }

    function closeModelSelector() {
        ui.modelSelectOverlay.classList.remove('active');
    }

    // --- 6. 绑定事件 ---
    ui.input.addEventListener('input', () => {
        ui.sendButtonsContainer.classList.toggle('visible', ui.input.value.trim() !== '');
        ui.input.style.height = 'auto';
        ui.input.style.height = `${ui.input.scrollHeight}px`;
    });

    ui.sendBtn.addEventListener('click', handleSendMessage);
    ui.respondBtn.addEventListener('click', () => alert('“响应”功能（让AI扮演你回复）待开发。'));
    ui.optionsBtn.addEventListener('click', () => window.location.href = `./chat-setting.html?id=${charId}`);
    
    ui.modelSelectBtn.addEventListener('click', openModelSelector);
    ui.closeModelSelectBtn.addEventListener('click', closeModelSelector);
    ui.modelSelectOverlay.addEventListener('click', e => e.target === ui.modelSelectOverlay && closeModelSelector());

    ui.modelListContainer.addEventListener('click', async (e) => {
        const item = e.target.closest('.model-item');
        if (!item) return;
        const modelId = item.dataset.modelId;
        await dbStorage.setItem(API_DB_KEYS.GLOBAL_ACTIVE_MODEL_ID, modelId);
        
        ui.modelListContainer.querySelectorAll('.model-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        setTimeout(closeModelSelector, 300); // 延迟关闭，给用户选择的视觉反馈
    });

    // 输入框展开/折叠逻辑
    const expandInputLayout = () => ui.chatInputArea.classList.add('input-focused');
    const collapseInputLayout = () => {
        ui.chatInputArea.classList.remove('input-focused', 'actions-expanded', 'emoji-expanded');
    };
    ui.input.addEventListener('focus', () => {
        expandInputLayout();
        ui.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    });
    document.addEventListener('click', (e) => {
        if (!ui.chatInputArea.contains(e.target)) collapseInputLayout();
    });
    ui.actionsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.chatInputArea.classList.remove('emoji-expanded');
        ui.chatInputArea.classList.toggle('actions-expanded');
    });
    ui.emojiToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.chatInputArea.classList.remove('actions-expanded');
        ui.chatInputArea.classList.toggle('emoji-expanded');
    });

    // --- 7. 初始化页面 ---
    await loadAndRenderHistory();
});