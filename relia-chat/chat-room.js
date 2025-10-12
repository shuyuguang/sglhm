// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { API_DB_KEYS, ALL_BUILT_IN_API_DEFINITIONS } from '../config/api.config.js';
import { PROFILE_DB_KEYS, GENDER_OPTIONS, LONG_PRESS_DURATION } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';


document.addEventListener('DOMContentLoaded', async () => {
    // --- 1 & 2. 获取数据和生成HTML (部分修改) ---
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
    const user = currentUser || { name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };
    
    const pageHtml = `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="char-info">
                    <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar" title="编辑角色档案">
                    <div class="char-info-text">
                        <span class="char-info-name">${character.name || '未命名'}</span>
                        <span class="char-info-status">在线</span>
                    </div>
                </div>
                <a href="./chat-setting.html?id=${charId}" class="chat-header-btn options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></a>
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
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-money-bill-transfer"></i></button><span>转账</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-gift"></i></button><span>礼物</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-phone"></i></button><span>通话</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-location-dot"></i></button><span>位置</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-save"></i></button><span>存档</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-file"></i></button><span>文件</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>音乐</span></div>
                </div>
                <div class="emoji-picker-bar">
                    <div class="emoji-placeholder">表情面板功能待开发...</div>
                </div>
            </footer>
        </div>
`;
    document.body.insertAdjacentHTML('afterbegin', pageHtml);

    // --- 3. 获取DOM元素和定义变量 (部分修改) ---
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
    let currentChatApi = null;
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // --- Profile 编辑器集成逻辑 (无变化) ---
    let profileEditor; 
    function getProfileEditorDOMElements() {
        return {
            globalHelpBtn: document.getElementById('global-help-btn'),
            globalHelpTooltip: document.getElementById('global-help-tooltip'),
            modalOverlay: document.getElementById('edit-modal-overlay'),
            closeModalButton: document.getElementById('close-modal-btn'),
            saveButton: document.getElementById('save-btn'),
            helpButton: document.getElementById('help-btn'),
            helpTooltip: document.getElementById('help-tooltip'),
            modalSidebar: document.querySelector('.modal-sidebar'),
            modalMainContent: document.querySelector('.modal-main-content'),
            addSectionBtn: document.getElementById('add-section-btn'),
            namePromptOverlay: document.getElementById('name-prompt-overlay'),
            namePromptTitle: document.querySelector('#name-prompt-overlay h4'),
            newSectionNameInput: document.getElementById('new-section-name-input'),
            confirmPromptBtn: document.getElementById('confirm-prompt-btn'),
            cancelPromptBtn: document.getElementById('cancel-prompt-btn'),
            sidebarNavList: document.querySelector('.sidebar-nav-list'),
            avatarUrlInput: document.getElementById('edit-avatar-url'),
            bannerUrlInput: document.getElementById('edit-banner-url'),
            avatarPreviewImg: document.getElementById('avatar-preview-img'),
            bannerPreviewImg: document.getElementById('banner-preview-img'),
            avatarUploadInput: document.getElementById('avatar-upload-input'),
            bannerUploadInput: document.getElementById('banner-upload-input'),
            cropperOverlay: document.getElementById('cropper-overlay'),
            cropperImage: document.getElementById('cropper-image'),
            confirmCropBtn: document.getElementById('confirm-crop-btn'),
            cancelCropBtn: document.getElementById('cancel-crop-btn'),
            customSectionOptionsOverlay: document.getElementById('custom-section-options-overlay'),
            customSectionOptionsSheet: document.getElementById('custom-section-options-sheet'),
            cancelOptionsSheetBtn: document.getElementById('cancel-options-sheet-btn'),
            addSectionSheetOverlay: document.getElementById('add-section-sheet-overlay'),
            presetTagsContainer: document.getElementById('preset-tags-container'),
            cancelAddSheetBtn: document.getElementById('cancel-add-sheet-btn'),
            subEditorPanel: document.getElementById('sub-editor-panel'),
            sepTitle: document.getElementById('sep-title'),
            sepTextarea: document.getElementById('sep-textarea'),
            sepBackBtn: document.getElementById('sep-back-btn'),
            sepSaveBtn: document.getElementById('sep-save-btn'),
            editAgeTrigger: document.getElementById('edit-age-trigger'),
            editBioTrigger: document.getElementById('edit-bio-trigger'),
            editRaceTrigger: document.getElementById('edit-race-trigger'),
            editOccupationTrigger: document.getElementById('edit-occupation-trigger'),
            itemEditorPanel: document.getElementById('item-editor-panel'),
            itemEditorTitleHeader: document.getElementById('item-editor-title-header'),
            itemEditorTitleInput: document.getElementById('item-editor-title-input'),
            itemEditorValueTextarea: document.getElementById('item-editor-value-textarea'),
            itemEditorBackBtn: document.getElementById('item-editor-back-btn'),
            itemEditorSaveBtn: document.getElementById('item-editor-save-btn'),
            switcherSettingsModal: document.getElementById('switcher-settings-modal-overlay'),
            settingsUserList: document.getElementById('settings-user-list'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            settingsImportBtn: document.getElementById('settings-import-btn'),
            settingsExportBtn: document.getElementById('settings-export-btn'),
            settingsMultiSelectBtn: document.getElementById('settings-multi-select-btn'),
            settingsDeleteBtn: document.getElementById('settings-delete-btn'),
            editGenderTrigger: document.getElementById('edit-gender-trigger'),
            usernameLabel: document.getElementById('username-label'),
            switcherSettingsTitle: document.getElementById('switcher-settings-title'),
            addRelationshipBtn: document.getElementById('add-relationship-btn'),
            relationshipItemsContainer: document.getElementById('relationship-items-container'),
            characterSelectorOverlay: document.getElementById('character-selector-overlay'),
            cancelCharSelectorBtn: document.getElementById('cancel-char-selector-btn'),
            charSearchInput: document.getElementById('char-search-input'),
            charSelectorList: document.getElementById('char-selector-list'),
            confirmCharSelectionBtn: document.getElementById('confirm-char-selection-btn'),
            relationshipTypeOverlay: document.getElementById('relationship-type-overlay'),
            cancelRelTypeBtn: document.getElementById('cancel-rel-type-btn'),
            relationshipTypeOptions: document.getElementById('relationship-type-options'),
            confirmRelTypeBtn: document.getElementById('confirm-rel-type-btn'),
        };
    }
    async function setupProfileEditor() {
        const elements = getProfileEditorDOMElements();
        const db = new Dexie('userSettingsDB');
        db.version(1).stores({ keyValueStore: 'key' });
        const state = {
            elements: elements, uiStyle: 'YDM', renderSwitcher: () => {},
            onProfileSave: (savedProfile) => {
                const charInfoAvatar = document.querySelector('.char-info-avatar');
                const charInfoName = document.querySelector('.char-info-name');
                if (charInfoAvatar) charInfoAvatar.src = savedProfile.avatar;
                if (charInfoName) charInfoName.textContent = savedProfile.name;
            },
            profileData: [], presetContentStore: {}, currentProfileId: null, currentMode: 'TA',
            activeCustomPane: null, currentPromptAction: null, elementBeingEdited: null,
            longPressTimer: null, isLongPress: false, currentSaveCallback: null,
            currentItemEditingContext: {}, croppingContext: {}, selectedProfileIds: [],
            isMultiSelectMode: false, selectedCharForRel: null, selectedRelationshipTypes: [],
        };
        const ui = createUiManager(elements, state, { GENDER_OPTIONS });
        const data = createDataManager(db, state, ui);
        const events = createEventManager(elements, state, ui, data, { LONG_PRESS_DURATION, GENDER_OPTIONS });
        events.bindSharedEvents();
        state.profileData = await data.dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
        state.presetContentStore = await data.dbStorage.getItem(PROFILE_DB_KEYS.PRESETS) || {};
        const presetContainer = state.elements.presetTagsContainer;
        if (presetContainer) {
            presetContainer.querySelectorAll('.preset-tag:not(.preset-tag-custom)').forEach(tag => tag.remove());
            Object.keys(state.presetContentStore).forEach(name => {
                const newTag = document.createElement('button');
                newTag.className = 'preset-tag';
                newTag.dataset.presetName = name;
                newTag.textContent = name;
                presetContainer.appendChild(newTag);
            });
        }
        profileEditor = { state, ui, data, events };
    }

    // --- 4. 核心功能函数 (无变化) ---
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
        prompt += `- 你的回复应该是自然的、符合角色的，就像TA真的在和 **${userProfile.name}** 聊天一样。`;
        return prompt;
    }
    function formatChatHistoryForApi(history) { 
        return history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }
    function renderMessage({ text, sender }) { 
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
            chatHistory.forEach(message => renderMessage(message));
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
            renderMessage(userMessage);
            chatHistory.push(userMessage);
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
            if (chatHistory.length === 0) {
                alert('还没有聊天记录，请先说点什么吧！');
                return;
            }
            if (!currentChatApi) {
                alert('请先点击“选择模型”按钮选择一个牵引仪模型！');
                return;
            }
            sendBtn.disabled = true;
            respondBtn.disabled = true;
            const systemPrompt = constructSystemPrompt(character, user);
            const historyForApi = formatChatHistoryForApi(chatHistory);
            const messages = [ { role: 'system', content: systemPrompt }, ...historyForApi ];
            const endpoint = (currentChatApi.baseUrl.replace(/\/$/, '')) + (currentChatApi.path || '/v1/chat/completions');
            const payload = { model: currentChatApi.model, messages: messages, stream: true };
            const thinkingBubble = renderMessage({ text: '...', sender: 'character' });
            let fullReply = '';
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
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
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
                if (fullReply) {
                    const replyMessage = { text: fullReply, sender: 'character' };
                    chatHistory.push(replyMessage);
                    await dbStorage.setItem(historyKey, chatHistory);
                }
            } catch (error) {
                console.error('AI 回复生成失败:', error);
                renderSystemMessage(`错误: ${error.message}`, 'error');
                thinkingBubble.remove();
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

    const closeModelSelector = () => {
        modelSelectorOverlay?.classList.remove('active');
    };

    // ▼▼▼ 修改：这是主要修复点 ▼▼▼
    async function openModelSelector() {
        try {
            const [userConfigs, builtInData, builtInStates] = await Promise.all([
                dbStorage.getItem(API_DB_KEYS.CONFIGS) || [],
                dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA) || {},
                dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES) || {}
            ]);

            let availableModels = [];

            // 处理用户自定义的 API
            userConfigs
                .filter(api => api.enabled && Array.isArray(api.model) && api.model.length > 0)
                .forEach(api => {
                    api.model.forEach(modelName => {
                        availableModels.push({
                            id: `${api.id}-${modelName}`, apiKey: api.apiKey,
                            baseUrl: api.baseUrl, path: api.path,
                            model: modelName, apiName: api.name,
                        });
                    });
                });

            // 处理内置的 API
            Object.keys(builtInStates)
                .forEach(apiId => {
                    const userData = builtInData[apiId];
                    // 确保 userData 和 userData.model 都是有效的
                    if (builtInStates[apiId]?.enabled && userData && Array.isArray(userData.model) && userData.model.length > 0) {
                        const staticData = ALL_BUILT_IN_API_DEFINITIONS[apiId];
                        if (staticData) {
                            userData.model.forEach(modelName => {
                                availableModels.push({
                                    id: `${apiId}-${modelName}`, apiKey: userData.apiKey,
                                    baseUrl: staticData.baseUrl, path: staticData.path,
                                    model: modelName, apiName: staticData.name,
                                });
                            });
                        }
                    }
                });
            
            renderModelList(availableModels);
            modelSelectorOverlay.classList.add('active'); // 现在这行代码可以安全执行了

        } catch (error) {
            console.error("打开模型选择器失败:", error);
            alert("加载模型列表失败，请检查控制台获取更多信息。");
        }
    }
    // ▲▲▲ 修改结束 ▲▲▲

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

    // --- 5. 绑定事件 (无变化) ---
    input.addEventListener('input', () => {
        if (input.value.trim() === '') {
            input.style.height = '';
        } else {
            input.style.height = 'auto';
            input.style.height = (input.scrollHeight) + 'px';
        }
        updateButtonStates();
    });
    if (sendBtn) sendBtn.addEventListener('click', () => handleSendMessage(false));
    if (respondBtn) respondBtn.addEventListener('click', () => handleSendMessage(true));
    if (actionsToggleBtn) actionsToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('emoji-expanded'); chatInputArea.classList.toggle('actions-expanded'); });
    if (emojiToggleBtn) emojiToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('actions-expanded'); chatInputArea.classList.toggle('emoji-expanded'); });
    if (selectModelBtn) selectModelBtn.addEventListener('click', openModelSelector);
    if (promptBtn) { promptBtn.addEventListener('click', () => { alert('“快捷指令（闪电）”功能待开发'); }); }
    if (inspirationBtn) { inspirationBtn.addEventListener('click', () => { alert('“灵感（灯泡）”功能待开发'); }); }
    if (modelSelectorOverlay) { 
        modelSelectorOverlay.addEventListener('click', (e) => { 
            if (e.target === modelSelectorOverlay) { 
                closeModelSelector(); 
            } 
        }); 
    }
    if (closeModelSelectorBtn) {
        closeModelSelectorBtn.addEventListener('click', closeModelSelector);
    }
    if (modelListContainer) {
        modelListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelInfo = JSON.parse(item.dataset.modelInfo);
                if (currentChatApi && currentChatApi.id === modelInfo.id) {
                    currentChatApi = null;
                    item.classList.remove('active');
                } else {
                    currentChatApi = modelInfo;
                    const currentActive = modelListContainer.querySelector('.model-item.active');
                    if (currentActive) currentActive.classList.remove('active');
                    item.classList.add('active');
                }
                console.log('当前选择的API:', currentChatApi);
                updateModelButtonText();
                setTimeout(() => modelSelectorOverlay.classList.remove('active'), 200);
            }
        });
    }
    input.addEventListener('focus', () => { expandInputLayout(); chatInputArea.classList.remove('actions-expanded', 'emoji-expanded'); });
    document.addEventListener('click', (event) => { if (!chatInputArea.contains(event.target)) { collapseInputLayout(); } });
    const charAvatarInHeader = document.querySelector('.char-info-avatar');
    if (charAvatarInHeader) {
        charAvatarInHeader.addEventListener('click', async () => {
            if (!profileEditor) {
                console.error("Profile Editor尚未初始化！");
                return;
            }
            await profileEditor.data.loadProfileData(charId);
            profileEditor.ui.openModal();
        });
    }

    // --- 6. 初始化页面 (无变化) ---
    await loadAndRenderHistory();
    updateButtonStates();
    updateModelButtonText();
    await setupProfileEditor();
});