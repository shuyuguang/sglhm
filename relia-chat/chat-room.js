// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
// ▼▼▼ 新增：导入 API 数据库键 ▼▼▼
import { API_DB_KEYS } from '../config/api.config.js';
// ▲▲▲ 新增结束 ▲▲▲

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 获取角色ID和数据 (无变化) ---
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        document.body.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
        return;
    }

    const [allChars, allUsers, currentUserId] = await Promise.all([
        dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
    ]);

    const character = allChars ? allChars.find(c => c.id === charId) : null;
    if (!character) {
        document.body.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
        return;
    }
    
    const currentUser = allUsers ? allUsers.find(u => u.id === currentUserId) : null;
    const user = currentUser || { avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

    // --- 2. 动态生成页面HTML (有修改) ---
    // ▼▼▼ 新增：模型选择面板的 HTML 结构 ▼▼▼
    const modelSelectorHtml = `
        <div class="bottom-sheet-overlay" id="model-selector-overlay">
            <div class="bottom-sheet">
                <div class="bottom-sheet-header">选择牵引仪模型</div>
                <div class="model-list-container" id="model-list-container">
                    <!-- 模型列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
    // ▲▲▲ 新增结束 ▲▲▲

    const pageHtml = `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="char-info">
                    <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar">
                    <div class="char-info-text">
                        <span class="char-info-name">${character.name || '未命名'}</span>
                        <span class="char-info-status">在线</span>
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
                            <button id="respond-btn" class="send-action-btn">响应</button>
                            <button id="send-btn" class="send-action-btn primary">发送</button>
                        </div>
                    </div>
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <!-- ▼▼▼ 新增：模型切换按钮 ▼▼▼ -->
                        <button id="model-toggle-btn"><i class="fa-solid fa-link"></i></button>
                        <!-- ▲▲▲ 新增结束 ▲▲▲ -->
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                    </div>
                </div>
                <div class="chat-actions-bar">
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-camera"></i></button><span>拍照</span></div>
                </div>
                <div class="emoji-picker-bar">
                    <div class="emoji-placeholder">表情面板功能待开发...</div>
                </div>
            </footer>
        </div>
        ${modelSelectorHtml} <!-- 将新面板注入页面 -->
    `;
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 (有修改) ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    const optionsBtn = document.querySelector('.options-btn');
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    const sendButtonsContainer = document.getElementById('send-buttons-container');
    const sendBtn = document.getElementById('send-btn');
    const respondBtn = document.getElementById('respond-btn');
    
    // ▼▼▼ 新增：获取模型选择器相关元素和状态变量 ▼▼▼
    const modelToggleBtn = document.getElementById('model-toggle-btn');
    const modelSelectorOverlay = document.getElementById('model-selector-overlay');
    const modelListContainer = document.getElementById('model-list-container');
    let currentChatApi = null; // { apiId, apiKey, baseUrl, path, model, apiName }
    // ▲▲▲ 新增结束 ▲▲▲
    
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // --- 4. 核心功能函数 (有修改) ---
    function renderMessage({ text, sender }) { /* ... (此函数无变化) ... */
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = (sender === 'user') ? user.avatar : character.avatar;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    async function loadAndRenderHistory() { /* ... (此函数无变化) ... */
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory;
            chatHistory.forEach(message => renderMessage(message));
        } else {
            renderMessage({ text: '发送示例内容', sender: 'user' });
            renderMessage({ text: '回复示例内容', sender: 'character' });
        }
    }

    async function handleSendMessage(actionType = 'send') {
        const text = input.value.trim();
        if (text === '') return;

        // ▼▼▼ 修改：输出当前选择的模型信息 ▼▼▼
        if (currentChatApi) {
            console.log(`使用模型: ${currentChatApi.model} (来自: ${currentChatApi.apiName})`);
            console.log(`动作: ${actionType}, 内容: ${text}`);
            // 在这里，你可以准备调用真正的API了
            // API所需信息:
            // Endpoint: currentChatApi.baseUrl + (currentChatApi.path || '')
            // API Key: currentChatApi.apiKey
            // Model: currentChatApi.model
            // Profile: character 对象
            // Message: text
        } else {
            console.warn("未选择任何API模型，将使用模拟回复。");
        }
        // ▲▲▲ 修改结束 ▲▲▲

        const userMessage = { text, sender: 'user' };
        renderMessage(userMessage);
        chatHistory.push(userMessage);
        await dbStorage.setItem(historyKey, chatHistory);
        input.value = '';
        input.style.height = '';
        sendButtonsContainer.classList.remove('visible');
        input.focus();

        setTimeout(async () => {
            const replyText = currentChatApi 
                ? `[${currentChatApi.model}]收到你的[${actionType}]消息: "${text}"`
                : `收到你的[${actionType}]消息: "${text}"`;
            const replyMessage = { text: replyText, sender: 'character' };
            renderMessage(replyMessage);
            chatHistory.push(replyMessage);
            await dbStorage.setItem(historyKey, chatHistory);
        }, 800);
    }
    
    // ▼▼▼ 新增：打开和渲染模型选择器的函数 ▼▼▼
    async function openModelSelector() {
        const [userConfigs, builtInData, builtInStates] = await Promise.all([
            dbStorage.getItem(API_DB_KEYS.CONFIGS) || [],
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA) || {},
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES) || {}
        ]);

        let availableModels = [];

        // 1. 处理用户自定义的 API
        userConfigs
            .filter(api => api.enabled && api.model?.length > 0)
            .forEach(api => {
                api.model.forEach(modelName => {
                    availableModels.push({
                        id: `${api.id}-${modelName}`,
                        apiId: api.id,
                        apiKey: api.apiKey,
                        baseUrl: api.baseUrl,
                        path: api.path,
                        model: modelName,
                        apiName: api.name,
                    });
                });
            });
        
        // 2. 处理内置的 API
        Object.keys(builtInStates)
            .filter(apiId => builtInStates[apiId]?.enabled && builtInData[apiId]?.model?.length > 0)
            .forEach(apiId => {
                const apiData = builtInData[apiId];
                apiData.model.forEach(modelName => {
                     availableModels.push({
                        id: `${apiId}-${modelName}`,
                        apiId: apiId,
                        apiKey: apiData.apiKey,
                        // BaseURL和Path需要从一个静态定义获取，但为了简化，我们暂时留空
                        // 在实际API调用时再补全
                        baseUrl: '', 
                        path: '',
                        model: modelName,
                        apiName: apiId.replace('built-in-', ''), // 简单显示名称
                    });
                });
            });

        renderModelList(availableModels);
        modelSelectorOverlay.classList.add('active');
    }

    function renderModelList(models) {
        if (models.length === 0) {
            modelListContainer.innerHTML = `<p class="no-models-message">没有可用的模型<br>请先到“牵引仪”页面启用并选择模型</p>`;
            return;
        }

        modelListContainer.innerHTML = models.map(m => `
            <div class="model-item ${currentChatApi?.id === m.id ? 'active' : ''}" data-model-info='${JSON.stringify(m)}'>
                <div class="model-info">
                    <div class="model-item-name">${m.model}</div>
                    <div class="model-item-api">${m.apiName}</div>
                </div>
                <i class="fa-solid fa-check"></i>
            </div>
        `).join('');
    }
    // ▲▲▲ 新增结束 ▲▲▲

    // --- 5. 绑定事件 (有修改) ---
    input.addEventListener('input', () => { /* ... (此函数无变化) ... */
        if (input.value.trim() === '') {
            input.style.height = '';
            sendButtonsContainer.classList.remove('visible');
        } else {
            input.style.height = 'auto';
            input.style.height = (input.scrollHeight) + 'px';
            sendButtonsContainer.classList.add('visible');
        }
    });

    if (sendBtn) sendBtn.addEventListener('click', () => handleSendMessage('发送'));
    if (respondBtn) respondBtn.addEventListener('click', () => handleSendMessage('响应'));
    if (optionsBtn) optionsBtn.addEventListener('click', () => { window.location.href = `./chat-setting.html?id=${charId}`; });
    if (actionsToggleBtn) actionsToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('emoji-expanded'); chatInputArea.classList.toggle('actions-expanded'); });
    if (emojiToggleBtn) emojiToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('actions-expanded'); chatInputArea.classList.toggle('emoji-expanded'); });

    // ▼▼▼ 新增：为模型选择器绑定事件 ▼▼▼
    if (modelToggleBtn) {
        modelToggleBtn.addEventListener('click', openModelSelector);
    }
    if (modelSelectorOverlay) {
        modelSelectorOverlay.addEventListener('click', (e) => {
            if (e.target === modelSelectorOverlay) {
                modelSelectorOverlay.classList.remove('active');
            }
        });
    }
    if (modelListContainer) {
        modelListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelInfo = JSON.parse(item.dataset.modelInfo);
                // 如果再次点击已选中的，则取消选择
                if (currentChatApi && currentChatApi.id === modelInfo.id) {
                    currentChatApi = null;
                    item.classList.remove('active');
                } else {
                    currentChatApi = modelInfo;
                    // 更新UI，移除旧的active，添加新的
                    const currentActive = modelListContainer.querySelector('.model-item.active');
                    if (currentActive) currentActive.classList.remove('active');
                    item.classList.add('active');
                }
                console.log('当前选择的API:', currentChatApi);
                setTimeout(() => modelSelectorOverlay.classList.remove('active'), 200); // 稍作延迟关闭
            }
        });
    }
    // ▲▲▲ 新增结束 ▲▲▲

    const expandInputLayout = () => { /* ... (此函数无变化) ... */
        if (!chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.add('input-focused');
        }
    };

    const collapseInputLayout = () => { /* ... (此函数无变化) ... */
        if (chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.remove('input-focused');
        }
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    };
    
    input.addEventListener('focus', () => {
        expandInputLayout();
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    });

    document.addEventListener('click', (event) => {
        if (!chatInputArea.contains(event.target)) {
            collapseInputLayout();
        }
    });

    // --- 6. 初始化页面 (无变化) ---
    await loadAndRenderHistory();
});