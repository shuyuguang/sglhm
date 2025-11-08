// 文件名: relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES } from './chat-prompt.js';

// 引入拆分后的模块
import { renderChatRoomUI, renderMessage, renderSystemMessage } from './chat-ui.js';
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
import { initializeEmojiSystem } from './chat-emoji.js';
// ▼▼▼ 引入新增的模块 ▼▼▼
import { initializeHeaderMenu } from './chat-header.js';
import { initializeThemeSystem } from './chat-theme.js';
import { initializeInputArea } from './chat-input-handler.js';
// ▲▲▲ 引入结束 ▲▲▲

/**
 * 异步加载HTML片段并注入到页面中
 * @param {string[]} paths - HTML文件路径数组
 */
async function loadHtmlFragments(paths) {
    const fetchPromises = paths.map(path => fetch(path).then(res => res.text()));
    const htmlStrings = await Promise.all(fetchPromises);
    document.body.insertAdjacentHTML('beforeend', htmlStrings.join(''));
}

document.addEventListener('DOMContentLoaded', async () => {
    // ▼▼▼ 核心修改：在执行任何操作前，先加载所有HTML片段 ▼▼▼
    try {
        await loadHtmlFragments([
            './chat-header.html',
            './chat-modals.html',
            './chat-editor-panels.html'
        ]);
    } catch (error) {
        console.error("加载HTML片段失败:", error);
        document.body.innerHTML = '页面组件加载失败，请检查网络或联系管理员。';
        return;
    }
    // ▲▲▲ 修改结束 ▲▲▲

    const appContainer = document.getElementById('app-container');
    if (!appContainer) {
        console.error("#app-container not found!");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');
    if (!charId) {
        appContainer.innerHTML = '<p style="text-align: center;">错误：未指定角色ID。</p>';
        return;
    }

    try {
        // --- 1. 数据加载 ---
        const [rawAllChars, rawAllUsers, currentUserId] = await Promise.all([
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
        ]);

        const allChars = rawAllChars || [];
        const allUsers = rawAllUsers || [];

        let character = allChars.find(c => c.id === charId);
        if (!character) {
            appContainer.innerHTML = `<p style="text-align: center;">错误：找不到ID为 ${charId} 的角色。</p>`;
            return;
        }
        let user = allUsers.find(u => u.id === currentUserId) || { id: 'default-user-1', name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

        // --- 2. 渲染UI并获取共享元素 ---
        appContainer.innerHTML = renderChatRoomUI(character);
        
        const elements = {
            chatArea: document.getElementById('chat-messages-area'),
            input: document.getElementById('chat-input'),
            chatInputArea: document.getElementById('chat-input-area'),
            sendBtn: document.getElementById('send-btn'),
            respondBtn: document.getElementById('respond-btn'),
            // 各模块所需的元素引用
            // (注意：为保持简洁，新模块会在其内部自行获取所需元素)
            actionsToggleBtn: document.getElementById('actions-toggle-btn'),
            emojiToggleBtn: document.getElementById('emoji-toggle-btn'),
            actionsMenu: document.getElementById('actions-menu'),
            diySwitch: document.getElementById('enable-diy-switch'),
            menuBtn: document.getElementById('menu-btn'),
            headerContentPanel: document.getElementById('header-content-panel'),
            headerTabsPanel: document.getElementById('header-tabs-panel'),
            headerMenuOverlay: document.getElementById('header-menu-overlay'),
            editUserProfileTrigger: document.getElementById('edit-user-profile-trigger'),
            editCharProfileTrigger: document.getElementById('edit-char-profile-trigger'),
            userProfileEditAvatar: document.getElementById('user-profile-edit-avatar'),
            userProfileEditName: document.getElementById('user-profile-edit-name'),
            charProfileEditAvatar: document.getElementById('char-profile-edit-avatar'),
            charProfileEditName: document.getElementById('char-profile-edit-name'),
        };

        // --- 3. 状态管理 ---
        const state = {
            chatHistory: [],
            memories: [],
            backgrounds: [],
            activeBackground: null,
            isBgMultiSelectMode: false,
            selectedBgIndices: new Set(),
            currentChatApi: null,
            currentChatStyle: CHAT_STYLES['dialogue'],
            isDiyEnabled: false,
        };
        
        let isAiReplying = false;
        let currentAbortController = null;

        const dbKeys = {
            historyKey: `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`,
            selectedApiKey: `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`,
            styleDbKey: `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`,
            memoryDbKey: `relia-chat-memory_${charId}`,
            diyDbKey: `relia-chat-diy-enabled_${charId}`,
            bgDbKey: `relia-chat-global-backgrounds`,
            activeBgDbKey: `relia-chat-active-background_${charId}`,
            styleSettingsDbKey: `relia-chat-style-settings_${charId}`,
        };

        // --- 4. 模块初始化 (编辑器部分) ---
        let chatEditor = null;
        let userEditor = null;

        const onProfileUpdate = async (updatedProfile) => {
            character = updatedProfile;
            const allCharacterProfiles = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
            const charIndex = allCharacterProfiles.findIndex(c => c.id === character.id);
            if (charIndex !== -1) allCharacterProfiles[charIndex] = character;
            await dbStorage.setItem(PROFILE_DB_KEYS.CHAR_PROFILES, allCharacterProfiles);
            document.querySelector('.char-info-name').textContent = character.name || '未命名';
            document.querySelector('.char-info-avatar').src = character.avatar;
            if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = character.avatar;
            if (elements.charProfileEditName) elements.charProfileEditName.textContent = character.name;
            elements.chatArea.querySelectorAll('.message-row.character .message-avatar').forEach(avatarEl => avatarEl.src = character.avatar);
            chatEditor?.updateProfile(character);
        };

        const onUserUpdate = async (updatedUser) => {
            user = updatedUser;
            const userIndex = allUsers.findIndex(u => u.id === user.id);
            if (userIndex !== -1) allUsers[userIndex] = user; else allUsers.push(user);
            await dbStorage.setItem(PROFILE_DB_KEYS.USER_PROFILES, allUsers);
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
            elements.chatArea.querySelectorAll('.message-row.user .message-avatar').forEach(avatarEl => avatarEl.src = user.avatar);
            userEditor?.updateProfile(user);
        };
        
        if (character) {
            chatEditor = createChatEditor(character, onProfileUpdate);
            if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = character.avatar;
            if (elements.charProfileEditName) elements.charProfileEditName.textContent = character.name;
        }
        if (user) {
            userEditor = createChatEditor(user, onUserUpdate, 'user-');
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
        }
        
        // --- 5. 核心功能函数 ---
        async function loadAndRenderHistory() {
            const savedHistory = await dbStorage.getItem(dbKeys.historyKey);
            state.chatHistory = (savedHistory && Array.isArray(savedHistory)) ? savedHistory : [];
            elements.chatArea.innerHTML = '';
            state.chatHistory.forEach((message, index) => renderMessage(message, index, user, character, elements.chatArea));
        }
        
        function updateButtonStates() {
            if (!elements.input || !elements.respondBtn || !elements.sendBtn) return;
            const hasText = elements.input.value.trim() !== '';

            if (isAiReplying) {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
                elements.respondBtn.disabled = false;
                elements.sendBtn.disabled = true;
                return;
            }

            if (hasText) {
                elements.respondBtn.style.display = 'none';
                elements.sendBtn.style.display = 'flex';
                elements.sendBtn.disabled = false;
            } else {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
                elements.respondBtn.disabled = false;
            }
        }
        
        const onAiReply = async (replyMessages) => {
            const thinkingMessageIndex = state.chatHistory.findIndex(msg => msg.text === '...' && msg.sender === 'character');
            if (thinkingMessageIndex > -1) state.chatHistory.splice(thinkingMessageIndex, 1);
            if (replyMessages && replyMessages.length > 0) state.chatHistory.push(...replyMessages);
            await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
            await loadAndRenderHistory();
        };
        
        const handleSendMessage = createApiHandler({
            state, elements, character, user, historyKey: dbKeys.historyKey, dbStorage,
            renderMessage, renderSystemMessage, updateButtonStates, onAiReply,
            getIsAiReplying: () => isAiReplying,
            setIsAiReplying: (value) => { isAiReplying = value; },
            setAbortController: (controller) => { currentAbortController = controller; }
        });

        async function onSendEmoji(emoji) {
            const emojiMessage = { sender: 'user', isEmoji: true, name: emoji.name, data: emoji.data };
            state.chatHistory.push(emojiMessage);
            await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
            renderMessage(emojiMessage, state.chatHistory.length - 1, user, character, elements.chatArea);
            updateButtonStates();
        }

        function updateInteractionModeUI() {
            // 这部分逻辑与互动模式选择器紧密相关，保留在这里
            const interactionModeCapsule = document.getElementById('interaction-mode-capsule');
            const selectedInteractionModeName = document.getElementById('selected-interaction-mode-name');
            const interactionModeList = document.getElementById('interaction-mode-list');
            if (!interactionModeCapsule || !selectedInteractionModeName || !interactionModeList) return;

            const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle);
            if (currentStyleKey) {
                selectedInteractionModeName.textContent = CHAT_STYLES[currentStyleKey].name;
                interactionModeList.querySelectorAll('.action-button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.style === currentStyleKey);
                });
            }
        }
        
        // --- 6. 事件绑定与模块初始化 ---
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', () => handleSendMessage(false));
        if (elements.respondBtn) {
            elements.respondBtn.addEventListener('click', () => {
                if (isAiReplying) {
                    currentAbortController?.abort();
                } else {
                    handleSendMessage(true);
                }
            });
        }
        
        const { renderMemoryCards } = initializeMemorySystem(
            { ...elements, ...{ // 传递模块所需的特定元素
                addMemoryBtn: document.getElementById('add-memory-btn'),
                memoryCardsContainer: document.getElementById('memory-cards-container'),
                memoryEditorOverlay: document.getElementById('memory-editor-overlay'),
                memoryEditorTitle: document.getElementById('memory-editor-title'),
                memoryEditorTextarea: document.getElementById('memory-editor-textarea'),
                memoryEditorConfirmBtn: document.getElementById('memory-editor-confirm-btn'),
                memoryEditorCancelBtn: document.getElementById('memory-editor-cancel-btn'),
                memoryEditorDeleteBtn: document.getElementById('memory-editor-delete-btn'),
                memoryEditorCloseBtn: document.getElementById('memory-editor-close-btn'),
            }},
            state,
            dbKeys.memoryDbKey
        );

        initializeModelSelector(
            { ...elements, ...{
                selectModelBtn: document.getElementById('select-model-btn'),
                selectedModelName: document.getElementById('selected-model-name'),
                modelSelectorOverlay: document.getElementById('model-selector-overlay'),
                modelListContainer: document.getElementById('model-list-container'),
                closeModelSelectorBtn: document.getElementById('close-model-selector-btn'),
            }},
            state,
            dbKeys.selectedApiKey
        );

        initializeHeaderMenu(elements, { chatEditor, userEditor });
        
        const { renderBackgrounds, setActiveBackground } = initializeThemeSystem(
            { ...elements, ...{
                themeContentPane: document.getElementById('menu-content-theme'),
                bgThumbnailsContainer: document.getElementById('bg-thumbnails-container'),
                multiSelectBgBtn: document.getElementById('multi-select-bg-btn'),
                deleteSelectedBgBtn: document.getElementById('delete-selected-bg-btn'),
                addBgFromLocalBtn: document.getElementById('add-bg-from-local-btn'),
                bgUploadInput: document.getElementById('bg-upload-input'),
                addBgFromUrlBtn: document.getElementById('add-bg-from-url-btn'),
                bgUrlPromptOverlay: document.getElementById('bg-url-prompt-overlay'),
                bgUrlInput: document.getElementById('bg-url-input'),
                cancelBgUrlBtn: document.getElementById('cancel-bg-url-btn'),
                confirmBgUrlBtn: document.getElementById('confirm-bg-url-btn'),
            }},
            state,
            { bgDbKey: dbKeys.bgDbKey, activeBgDbKey: dbKeys.activeBgDbKey }
        );

        initializeInputArea(elements, updateButtonStates, state, dbKeys.diyDbKey, dbStorage);

        // --- 7. 页面状态初始化 ---
        async function initializeChatState() {
            const [savedStyleKey, savedApi, savedDiyEnabled, savedBackgrounds, savedActiveBg] = await Promise.all([
                dbStorage.getItem(dbKeys.styleDbKey),
                dbStorage.getItem(dbKeys.selectedApiKey),
                dbStorage.getItem(dbKeys.diyDbKey),
                dbStorage.getItem(dbKeys.bgDbKey),
                dbStorage.getItem(dbKeys.activeBgDbKey),
            ]);

            state.currentChatStyle = (savedStyleKey && CHAT_STYLES[savedStyleKey]) ? CHAT_STYLES[savedStyleKey] : CHAT_STYLES['short-chat'];
            if (savedApi) state.currentChatApi = savedApi;
            state.isDiyEnabled = savedDiyEnabled || false;
            if (elements.diySwitch) elements.diySwitch.checked = state.isDiyEnabled;
            state.backgrounds = savedBackgrounds || [];
            
            const defaultBgColor = '#F8F9FB';
            await setActiveBackground(savedActiveBg || defaultBgColor);
            
            await loadAndRenderHistory();
            await renderMemoryCards();
            renderBackgrounds();
            updateButtonStates();
            updateModelButtonText();
            updateInteractionModeUI();

            const getChatHistory = () => state.chatHistory;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            };
            
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory);
            
            initializeEmojiSystem(
                { ...elements, ...{
                    emojiPickerBar: document.querySelector('.emoji-picker-bar'),
                    emojiManagementGridContainer: document.getElementById('emoji-management-container'),
                    emojiUploadInput: document.getElementById('emoji-upload-input'),
                    webEmojiModal: document.getElementById('web-emoji-modal'),
                    webEmojiUrlInput: document.getElementById('web-emoji-url-input'),
                    confirmWebEmojiBtn: document.getElementById('confirm-web-emoji-btn'),
                    cancelWebEmojiBtn: document.getElementById('cancel-web-emoji-btn'),
                }},
                state, 
                onSendEmoji
            );
        }
        await initializeChatState();

    } catch (error) {
        console.error("页面初始化时发生严重错误:", error);
        appContainer.innerHTML = `<p style="text-align: center;">页面加载时发生严重错误，请查看控制台。</p>`;
    }
});