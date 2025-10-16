// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { API_DB_KEYS, ALL_BUILT_IN_API_DEFINITIONS } from '../config/api.config.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES, createChatPromptPanel } from './chat-prompt.js';


document.addEventListener('DOMContentLoaded', async () => {
    console.log("Chat Room script started."); // 1. 脚本是否开始执行？

    const appContainer = document.getElementById('app-container');
    if (!appContainer) {
        console.error("#app-container not found!"); // 2. 容器元素是否存在？
        document.body.innerText = '关键DOM元素 #app-container 未找到，页面无法加载。';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');
    console.log("Character ID from URL:", charId); // 3. 是否成功获取到 charId？
    
    if (!charId) {
        appContainer.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
        return;
    }
    
    try { // 使用 try...catch 包裹数据获取，捕获任何可能的错误
        const [rawAllChars, rawAllUsers, currentUserId] = await Promise.all([
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
        ]);
        
        console.log("Data from DB:", { rawAllChars, rawAllUsers, currentUserId }); // 4. 从数据库获取的数据是什么？

        const allChars = rawAllChars || [];
        const allUsers = rawAllUsers || [];
        
        let character = allChars.find(c => c.id === charId);
        console.log("Found character:", character); // 5. 是否找到了对应的角色？

        if (!character) {
            appContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
            return;
        }

        console.log("Character found, preparing to render UI..."); // 6. 准备渲染UI

        const currentUser = allUsers.find(u => u.id === currentUserId);
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
                    <!-- ▼▼▼ 新增的三横杠菜单按钮 ▼▼▼ -->
                    <button class="chat-header-btn" id="menu-btn"><i class="fa-solid fa-bars"></i></button>
                    <!-- ▲▲▲ 新增结束 ▲▲▲ -->
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
                        <div class="action-item"><button class="action-btn" id="workbench-btn"><i class="fa-solid fa-briefcase"></i></button><span>工作台</span></div>
                        <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>                    <div class="action-item"><button class="action-btn" id="edit-settings-btn"><i class="fa-solid fa-pencil"></i></button><span>编辑</span></div>
                        <div class="action-item"><button class="action-btn" id="search-history-btn"><i class="fa-solid fa-brain"></i></button><span>数据</span></div>
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
        appContainer.innerHTML = pageHtml;
        console.log("UI rendered successfully."); // 7. UI是否成功渲染？

        // --- 3. 获取DOM元素和定义变量 ---
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
        const editSettingsBtn = document.getElementById('edit-settings-btn');
        const searchHistoryBtn = document.getElementById('search-history-btn');
        const workbenchBtn = document.getElementById('workbench-btn');
        // ▼▼▼ 新增：获取顶部菜单相关元素 ▼▼▼
        const menuBtn = document.getElementById('menu-btn');
        const headerMenu = document.getElementById('header-menu');
        const headerMenuOverlay = document.getElementById('header-menu-overlay');
        // ▲▲▲ 新增结束 ▲▲▲
        
        let currentChatApi = null;

        // ▼▼▼ 修复点：在这里重新添加被误删的变量定义 ▼▼▼
        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
        const selectedApiKey = `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`;
        let currentChatStyle = CHAT_STYLES['dialogue']; // 默认使用对话体
        const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;

        let chatHistory = [];
        // ▲▲▲ 修复结束 ▲▲▲
        
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

        // --- 4. 核心功能函数 ---
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
            
            if (currentChatStyle && typeof currentChatStyle.getPromptAddition === 'function') {
                const stylePrompt = currentChatStyle.getPromptAddition();
                if (stylePrompt) {
                    prompt += stylePrompt;
                }
            }
            return prompt;
        }
        function formatChatHistoryForApi(history) { 
            return history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));
        }

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
            
            messageRow.appendChild(avatar);
            messageRow.appendChild(bubble);

            chatArea.appendChild(messageRow);
            chatArea.scrollTop = chatArea.scrollHeight;
            return bubble;
        }

        function renderSystemMessage(text, type = 'loading') { 
            const messageRow = document.createElement('div');
            messageRow.className = `message-row system ${type}`;
            messageRow.innerHTML = `<div class="chat-bubble system">${text}</div>`;
            chatArea.appendChild(messageRow);
            chatArea.scrollTop = chatArea.scrollHeight;
            return messageRow;
        }
        async function loadAndRenderHistory() { 
            const savedHistory = await dbStorage.getItem(historyKey);
            if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
                chatHistory = savedHistory;
                chatArea.innerHTML = '';
                chatHistory.forEach((message, index) => renderMessage(message, index));
            } else {
                // 如果没有历史记录，确保聊天区域是空的
                chatArea.innerHTML = '';
                chatHistory = [];
            }
        }
        function updateButtonStates() { 
            const hasText = input.value.trim() !== '';
            sendBtn.disabled = !hasText;
            respondBtn.disabled = false;
        }

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
                    
                    const handlerContext = {
                        reader: response.body.getReader(),
                        decoder: new TextDecoder('utf-8'),
                        renderMessage,
                        chatHistory,
                        historyKey,
                        chatArea,
                        loadAndRenderHistory
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
        
        function renderModelList(models) {
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

        // --- 5. 绑定事件 ---
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
        
        if (workbenchBtn) {
            createChatPromptPanel({
                triggerElement: workbenchBtn,
                container: document.body,
                charId: charId,
                onSave: (styleObject) => {
                    console.log('已保存默认风格:', styleObject.name);
                    currentChatStyle = styleObject;
                }
            });
        }
        // ▼▼▼ 修改：为顶部菜单绑定事件 ▼▼▼
        if (menuBtn && headerMenu && headerMenuOverlay) {
            const menuMemoryBtn = document.getElementById('menu-memory-btn');
            const menuStyleBtn = document.getElementById('menu-style-btn');
            const menuEditBtn = document.getElementById('menu-edit-btn');
            const menuModelBtn = document.getElementById('menu-model-btn');
            const menuThemeBtn = document.getElementById('menu-theme-btn');
        
            const toggleMenu = () => {
                headerMenu.classList.toggle('active');
                headerMenuOverlay.classList.toggle('active');
            };
        
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMenu();
            });
        
            headerMenuOverlay.addEventListener('click', toggleMenu);
        
            const handleMenuClick = (targetButton, isNotImplemented = false) => {
                toggleMenu();
                // 使用短暂延迟确保菜单关闭动画不影响点击事件
                setTimeout(() => {
                    if (isNotImplemented) {
                        alert('该功能待开发');
                    } else if (targetButton) {
                        targetButton.click();
                    }
                }, 50);
            };
        
            if (menuMemoryBtn) menuMemoryBtn.addEventListener('click', (e) => { e.preventDefault(); handleMenuClick(searchHistoryBtn); });
            if (menuStyleBtn) menuStyleBtn.addEventListener('click', (e) => { e.preventDefault(); handleMenuClick(workbenchBtn); });
            if (menuEditBtn) menuEditBtn.addEventListener('click', (e) => { e.preventDefault(); handleMenuClick(editSettingsBtn); });
            if (menuModelBtn) menuModelBtn.addEventListener('click', (e) => { e.preventDefault(); handleMenuClick(selectModelBtn); });
            if (menuThemeBtn) menuThemeBtn.addEventListener('click', (e) => { e.preventDefault(); handleMenuClick(null, true); });
        }
        // ▲▲▲ 修改结束 ▲▲▲

        if (editSettingsBtn) { editSettingsBtn.addEventListener('click', () => chatEditor ? chatEditor.open() : alert('编辑器初始化失败！')); }
        if (searchHistoryBtn) { searchHistoryBtn.addEventListener('click', () => { alert('“记忆库”功能待开发'); }); }
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
                    const models = JSON.parse(item.closest('.model-list-container').dataset.models || '[]');
                    renderModelList(models);
                    updateModelButtonText();
                    setTimeout(closeModelSelector, 200);
                }
            });
        }
        input.addEventListener('focus', () => { expandInputLayout(); chatInputArea.classList.remove('actions-expanded', 'emoji-expanded'); });
        document.addEventListener('click', (event) => { if (!chatInputArea.contains(event.target)) { collapseInputLayout(); } });

        // --- 6. 初始化页面 ---
        async function initializeChatState() {
            const savedStyleKey = await dbStorage.getItem(styleDbKey);
            if (savedStyleKey && CHAT_STYLES[savedStyleKey]) {
                currentChatStyle = CHAT_STYLES[savedStyleKey];
                console.log(`已加载角色 ${character.name} 的默认风格: ${currentChatStyle.name}`);
            }

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

    } catch (error) {
        console.error("An error occurred during page initialization:", error); // 捕获并打印未知错误
        appContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">页面加载时发生严重错误，请查看控制台。</p>`;
    }
});