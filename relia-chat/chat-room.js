// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { API_DB_KEYS, ALL_BUILT_IN_API_DEFINITIONS } from '../config/api.config.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
// ▼▼▼ 修改：导入 CHAT_STYLES 和 createChatPromptPanel ▼▼▼
import { CHAT_STYLES, createChatPromptPanel } from './chat-prompt.js';
// ▲▲▲ 修改结束 ▲▲▲


document.addEventListener('DOMContentLoaded', async () => {
    // --- 1 & 2. 获取数据和生成HTML (无变化) ---
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
    
    let character = allChars ? allChars.find(c => c.id === charId) : null;

    if (!character) {
        document.body.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
        return;
    }
    const currentUser = allUsers ? allUsers.find(u => u.id === currentUserId) : null;
    const user = currentUser || { name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };
    
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
                <a id="options-btn" class="chat-header-btn options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></a>
            </header>
            <main class="chat-messages" id="chat-messages-area"></main>
            <footer class="chat-input-area" id="chat-input-area">
                <div class="chat-input-main" id="chat-input-main">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                        <div class="send-buttons-container" id="send-buttons-container">
                            <button id="select-model-btn" class="send-action-btn model-select-btn">
                                <span id="selected-model-name">选择模型</span>
                            </button>
                            <button id="respond-btn" class="send-action-btn">响应</button>
                            <button id="send-btn" class="send-action-btn primary">发送</button>
                        </div>
                    </div>
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <button id="prompt-btn"><i class="fa-solid fa-bolt"></i></button>
                        <button id="inspiration-btn"><i class="fa-regular fa-lightbulb"></i></button>
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                    </div>
                </div>
                <div class="chat-actions-bar">
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-camera"></i></button><span>拍照</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-microphone"></i></button><span>音频</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-palette"></i></button><span>主题</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-save"></i></button><span>存档</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>                    <div class="action-item"><button class="action-btn" id="edit-settings-btn"><i class="fa-solid fa-pencil"></i></button><span>编辑</span></div>
                    <div class="action-item"><button class="action-btn" id="search-history-btn"><i class="fa-solid fa-magnifying-glass"></i></button><span>记录</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-money-bill-transfer"></i></button><span>转账</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-sack-dollar"></i></button><span>收款</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-gift"></i></button><span>礼物</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-phone"></i></button><span>通话</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-location-dot"></i></button><span>位置</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>听歌</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-calendar-check"></i></button><span>打卡</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-link"></i></button><span>接龙</span></div>
                </div>
                <div class="emoji-picker-bar">
                    <div class="emoji-placeholder">表情面板功能待开发...</div>
                </div>
            </footer>
        </div>
`;
    document.body.insertAdjacentHTML('afterbegin', pageHtml);

    // --- 3. 获取DOM元素和定义变量 (无变化) ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    const sendButtonsContainer = document.getElementById('send-buttons-container');
    const sendBtn = document.getElementById('send-btn');
    const respondBtn = document.getElementById('respond-btn');
    const selectModelBtn = document.getElementById('select-model-btn');
    const selectedModelName = document.getElementById('selected-model-name');
    const modelSelectorOverlay = document.getElementById('model-selector-overlay');
    const modelListContainer = document.getElementById('model-list-container');
    const closeModelSelectorBtn = document.getElementById('close-model-selector-btn');
    const promptBtn = document.getElementById('prompt-btn');
    const inspirationBtn = document.getElementById('inspiration-btn');
    const optionsBtn = document.getElementById('options-btn');
    const editSettingsBtn = document.getElementById('edit-settings-btn');
    const searchHistoryBtn = document.getElementById('search-history-btn');
    
    let currentChatApi = null;
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    const selectedApiKey = `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`;
    // ▼▼▼ 新增：用于存储当前聊天风格的状态变量 ▼▼▼
    let currentChatStyle = CHAT_STYLES['dialogue']; // 默认使用对话体
    const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;
    // ▲▲▲ 新增结束 ▲▲▲

    let chatHistory = [];
    
    let chatEditor = null;
    const onProfileUpdate = async (updatedProfile) => {
        console.log('角色设定已在聊天室中更新:', updatedProfile);
        character = updatedProfile; 
        const allCharacterProfiles = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
        const charIndex = allCharacterProfiles.findIndex(c => c.id === character.id);
        if (charIndex !== -1) {
            allCharacterProfiles[charIndex] = character;
            await dbStorage.setItem(PROFILE_DB_KEYS.CHAR_PROFILES, allCharacterProfiles);
        }
        document.querySelector('.char-info-name').textContent = character.name || '未命名';
        document.querySelector('.char-info-avatar').src = character.avatar;
        chatEditor?.updateProfile(character);
    };

    if(character) {
        chatEditor = createChatEditor(character, onProfileUpdate);
    }

    // --- 4. 核心功能函数 (有修改) ---
    
    // ▼▼▼ 修改：constructSystemPrompt 现在会根据当前风格动态添加指令 ▼▼▼
    function constructSystemPrompt(charProfile, userProfile) {
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
        prompt += `\n### 扮演要求\n`;
        prompt += `- 你必须完全沉浸在 **${charProfile.name}** 的角色中，用TA的身份、口吻、性格和知识进行回复。\n`;
        prompt += `- 不要暴露你是AI模型或程序，不要提及“扮演”或“角色设定”。\n`;
        prompt += `- 你的回复应该是自然的、符合角色的，就像TA真的在和 **${userProfile.name}** 聊天一样。\n`;
        
        // 动态添加风格指令
        if (currentChatStyle && typeof currentChatStyle.getPromptAddition === 'function') {
            const stylePrompt = currentChatStyle.getPromptAddition();
            if (stylePrompt) {
                prompt += stylePrompt;
            }
        }
        return prompt;
    }
    function formatChatHistoryForApi(history) { /* (无变化) */ 
        return history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    // [修正] renderMessage 函数
    function renderMessage({ text, sender }, index) { 
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        messageRow.dataset.index = index;

        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = (sender === 'user') ? user.avatar : character.avatar;
        
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        
        // [修正] 移除之前的 if/else 判断，统一添加顺序。
        // CSS 中的 flex-direction: row-reverse 会自动处理用户消息的视觉顺序。
        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);

        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
        return bubble; // 返回 bubble 元素本身
    }

    function renderSystemMessage(text, type = 'loading') { /* (无变化) */ 
        const messageRow = document.createElement('div');
        messageRow.className = `message-row system ${type}`;
        messageRow.innerHTML = `<div class="chat-bubble system">${text}</div>`;
        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
        return messageRow;
    }
    async function loadAndRenderHistory() { /* (无变化) */ 
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory;
            chatArea.innerHTML = '';
            chatHistory.forEach((message, index) => renderMessage(message, index));
        }
    }
    function updateButtonStates() { /* (无变化) */ 
        const hasText = input.value.trim() !== '';
        sendBtn.disabled = !hasText;
        respondBtn.disabled = false;
    }

    // [修正] handleSendMessage 函数
    async function handleSendMessage(shouldTriggerReply) {
        const text = input.value.trim();
        if (text !== '') {
            const userMessage = { text, sender: 'user' };
            chatHistory.push(userMessage);
            renderMessage(userMessage, chatHistory.length - 1);
            await dbStorage.setItem(historyKey, chatHistory);
            
            input.value = '';
            input.style.height = '';
            updateButtonStates();
            input.focus();
        } 
        else if (!shouldTriggerReply) {
            return;
        }

        if (shouldTriggerReply) {
            if (chatHistory.length === 0 || !currentChatApi) {
                alert(chatHistory.length === 0 ? '还没有聊天记录，请先说点什么吧！' : '请先点击“选择模型”按钮选择一个牵引仪模型！');
                return;
            }
            sendBtn.disabled = true;
            respondBtn.disabled = true;
            
            const systemPrompt = constructSystemPrompt(character, user);
            const historyForApi = formatChatHistoryForApi(chatHistory);
            const messages = [ { role: 'system', content: systemPrompt }, ...historyForApi ];
            const endpoint = (currentChatApi.baseUrl.replace(/\/$/, '')) + (currentChatApi.path || '/v1/chat/completions');
            const payload = { model: currentChatApi.model, messages: messages, stream: true };
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentChatApi.apiKey}` },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || `API 请求失败，状态码: ${response.status}`);
                }
                
                // 将响应处理委托给当前风格的处理器
                const handlerContext = {
                    reader: response.body.getReader(),
                    decoder: new TextDecoder('utf-8'),
                    renderMessage,
                    chatHistory,
                    historyKey,
                    chatArea,
                    loadAndRenderHistory // 传递这个函数，以便多消息处理器可以刷新列表
                };
                await currentChatStyle.streamHandler(handlerContext);

            } catch (error) {
                console.error('AI 回复生成失败:', error);
                renderSystemMessage(`错误: ${error.message}`, 'error');
            } finally {
                updateButtonStates();
                input.focus();
            }
        }
    }
    
    // ... 从 updateModelButtonText 到 collapseInputLayout 的所有函数保持不变 ...
    function updateModelButtonText() {
        if (currentChatApi) {
            selectedModelName.textContent = currentChatApi.model;
            selectModelBtn.classList.add('active');
        } else {
            selectedModelName.textContent = '选择模型';
            selectModelBtn.classList.remove('active');
        }
    }
    const closeModelSelector = () => { modelSelectorOverlay?.classList.remove('active'); };
    async function openModelSelector() {
        try {
            const [userConfigs, builtInData, builtInStates] = await Promise.all([
                dbStorage.getItem(API_DB_KEYS.CONFIGS).then(res => res || []),
                dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA).then(res => res || {}),
                dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES).then(res => res || {})
            ]);
            let availableModels = [];
            userConfigs.filter(api => api.enabled && Array.isArray(api.model) && api.model.length > 0).forEach(api => {
                api.model.forEach(modelName => {
                    availableModels.push({ id: `${api.id}-${modelName}`, apiKey: api.apiKey, baseUrl: api.baseUrl, path: api.path, model: modelName, apiName: api.name });
                });
            });
            Object.keys(builtInStates).forEach(apiId => {
                const userData = builtInData[apiId];
                if (builtInStates[apiId]?.enabled && userData && Array.isArray(userData.model) && userData.model.length > 0) {
                    const staticData = ALL_BUILT_IN_API_DEFINITIONS[apiId];
                    if (staticData) {
                        userData.model.forEach(modelName => {
                            availableModels.push({ id: `${apiId}-${modelName}`, apiKey: userData.apiKey, baseUrl: staticData.baseUrl, path: staticData.path, model: modelName, apiName: staticData.name });
                        });
                    }
                }
            });
            renderModelList(availableModels);
            modelSelectorOverlay.classList.add('active');
        } catch (error) {
            console.error("打开模型选择器失败:", error);
            alert("加载模型列表失败，请检查控制台获取更多信息。");
        }
    }
    
    // ▼▼▼ 修正点：在这里添加一行代码 ▼▼▼
    function renderModelList(models) {
        // 在函数开头，将完整的模型列表数据存储到 DOM 元素的 dataset 中
        modelListContainer.dataset.models = JSON.stringify(models);

        if (models.length === 0) {
            modelListContainer.innerHTML = `<p class="no-models-message">没有可用的模型<br>请先到“牵引仪”页面启用并选择模型</p>`;
            return;
        }
        modelListContainer.innerHTML = models.map(m => `
            <div class="model-item ${currentChatApi?.id === m.id ? 'active' : ''}" data-model-info='${JSON.stringify(m)}'>
                <div class="model-info"><div class="model-item-name">${m.model}</div><div class="model-item-api">${m.apiName}</div></div><i class="fa-solid fa-check"></i>
            </div>
        `).join('');
    }
    // ▲▲▲ 修正结束 ▲▲▲

    const expandInputLayout = () => { 
        if (!chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.add('input-focused');
            sendButtonsContainer.classList.add('visible');
            updateButtonStates();
        }
    };
    const collapseInputLayout = () => { 
        if (chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.remove('input-focused');
            sendButtonsContainer.classList.remove('visible');
        }
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    };

    // --- 5. 绑定事件 (有修改) ---
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight) + 'px';
        updateButtonStates();
    });
    if (sendBtn) sendBtn.addEventListener('click', () => handleSendMessage(false));
    if (respondBtn) respondBtn.addEventListener('click', () => handleSendMessage(true));
    if (actionsToggleBtn) actionsToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('emoji-expanded'); chatInputArea.classList.toggle('actions-expanded'); });
    if (emojiToggleBtn) emojiToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('actions-expanded'); chatInputArea.classList.toggle('emoji-expanded'); });
    if (selectModelBtn) selectModelBtn.addEventListener('click', openModelSelector);
    if (promptBtn) { promptBtn.addEventListener('click', () => { alert('“快捷指令（闪电）”功能待开发'); }); }
    if (inspirationBtn) { inspirationBtn.addEventListener('click', () => { alert('“灵感（灯泡）”功能待开发'); }); }
    
    // ▼▼▼ 修改：为三点按钮绑定新的面板打开功能 ▼▼▼
    if (optionsBtn) {
        createChatPromptPanel({
            triggerElement: optionsBtn,
            container: document.body,
            charId: charId, // 传入角色ID以便保存默认风格
            onSelect: (styleObject) => {
                console.log('已应用风格:', styleObject.name);
                currentChatStyle = styleObject;
            },
            onSave: (styleObject) => {
                console.log('已保存默认风格:', styleObject.name);
                currentChatStyle = styleObject;
            }
        });
    }

    if (editSettingsBtn) { editSettingsBtn.addEventListener('click', () => chatEditor ? chatEditor.open() : alert('编辑器初始化失败！')); }
    if (searchHistoryBtn) { searchHistoryBtn.addEventListener('click', () => { alert('“聊天记录”功能待开发'); }); }
    if (modelSelectorOverlay) { modelSelectorOverlay.addEventListener('click', (e) => { if (e.target === modelSelectorOverlay) closeModelSelector(); }); }
    if (closeModelSelectorBtn) { closeModelSelectorBtn.addEventListener('click', closeModelSelector); }
    if (modelListContainer) {
        modelListContainer.addEventListener('click', async (e) => {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelInfo = JSON.parse(item.dataset.modelInfo);
                if (currentChatApi && currentChatApi.id === modelInfo.id) {
                    currentChatApi = null;
                } else {
                    currentChatApi = modelInfo;
                }
                await dbStorage.setItem(selectedApiKey, currentChatApi);
                // 重新渲染列表以更新激活状态。现在这行代码可以正常工作了。
                const models = JSON.parse(item.closest('.model-list-container').dataset.models || '[]');
                renderModelList(models);
                updateModelButtonText();
                setTimeout(closeModelSelector, 200);
            }
        });
    }
    input.addEventListener('focus', () => { expandInputLayout(); chatInputArea.classList.remove('actions-expanded', 'emoji-expanded'); });
    document.addEventListener('click', (event) => { if (!chatInputArea.contains(event.target)) { collapseInputLayout(); } });

    // --- 6. 初始化页面 (有修改) ---
    async function initializeChatState() {
        // ▼▼▼ 新增：初始化时加载保存的聊天风格 ▼▼▼
        const savedStyleKey = await dbStorage.getItem(styleDbKey);
        if (savedStyleKey && CHAT_STYLES[savedStyleKey]) {
            currentChatStyle = CHAT_STYLES[savedStyleKey];
            console.log(`已加载角色 ${character.name} 的默认风格: ${currentChatStyle.name}`);
        }
        // ▲▲▲ 新增结束 ▲▲▲

        const savedApi = await dbStorage.getItem(selectedApiKey);
        if (savedApi) {
            currentChatApi = savedApi;
        }
        await loadAndRenderHistory();
        updateButtonStates();
        updateModelButtonText();
        const getChatHistory = () => chatHistory;
        const updateChatHistory = async (newHistory) => {
            chatHistory = newHistory;
            await dbStorage.setItem(historyKey, chatHistory);
            await loadAndRenderHistory();
        };
        initializeMessageMenu(chatArea, getChatHistory, updateChatHistory);
    }
    await initializeChatState();
});