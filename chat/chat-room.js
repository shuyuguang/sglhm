// 文件名: relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES, STYLE_DEFAULT_SETTINGS } from './chat-prompt.js';

// ▼▼▼ 核心修改：引入新的渲染函数 ▼▼▼
import { renderChatRoomUI, renderMessageGroup, renderSystemMessage } from './chat-ui.js';
// ▲▲▲ 修改结束 ▲▲▲
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
import { initializeEmojiSystem } from './chat-emoji.js';
import { initializeHeaderMenu } from './chat-header.js';
import { initializeThemeSystem } from './chat-theme.js';
import { initializeInputArea } from './chat-input-handler.js';

async function loadHtmlFragments(paths) {
    const fetchPromises = paths.map(path => fetch(path).then(res => res.text()));
    const htmlStrings = await Promise.all(fetchPromises);
    document.body.insertAdjacentHTML('beforeend', htmlStrings.join(''));
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadHtmlFragments(['./chat-header.html', './chat-modals.html', './chat-editor-panels.html']);
    } catch (error) {
        console.error("加载HTML片段失败:", error);
        document.body.innerHTML = '页面组件加载失败，请检查网络或联系管理员。';
        return;
    }

    const appContainer = document.getElementById('app-container');
    if (!appContainer) { console.error("#app-container not found!"); return; }

    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');
    if (!charId) { appContainer.innerHTML = '<p>错误：未指定角色ID。</p>'; return; }

    try {
        const [rawAllChars, rawAllUsers, currentUserId] = await Promise.all([
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
        ]);

        const allChars = rawAllChars || [];
        const allUsers = rawAllUsers || [];

        let character = allChars.find(c => c.id === charId);
        if (!character) { appContainer.innerHTML = `<p>错误：找不到ID为 ${charId} 的角色。</p>`; return; }
        let user = allUsers.find(u => u.id === currentUserId) || { id: 'default-user-1', name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

        appContainer.innerHTML = renderChatRoomUI(character);
        
        const elements = {
            chatArea: document.getElementById('chat-messages-area'),
            input: document.getElementById('chat-input'),
            chatInputArea: document.getElementById('chat-input-area'),
            sendBtn: document.getElementById('send-btn'),
            respondBtn: document.getElementById('respond-btn'),
            actionsToggleBtn: document.getElementById('actions-toggle-btn'),
            emojiToggleBtn: document.getElementById('emoji-toggle-btn'),
            actionsMenu: document.getElementById('actions-menu'),
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
            styleOutputMin: document.getElementById('style-output-min'),
            styleOutputMax: document.getElementById('style-output-max'),
            styleVisualLimit: document.getElementById('style-visual-limit'),
            styleMemoryLimit: document.getElementById('style-memory-limit'),
            interactionModeCapsule: document.getElementById('interaction-mode-capsule'),
            interactionModeSheetOverlay: document.getElementById('interaction-mode-sheet-overlay'),
            interactionModeList: document.getElementById('interaction-mode-list'),
            interactionModeCancelBtn: document.getElementById('interaction-mode-cancel-btn'),
            selectedInteractionModeName: document.getElementById('selected-interaction-mode-name'),
            diySwitch: document.getElementById('enable-diy-switch'),
            // ▼▼▼ 核心修改：获取新按钮 ▼▼▼
            regenerateBtn: document.getElementById('regenerate-btn'),
            continueBtn: document.getElementById('continue-btn'),
            // ▲▲▲ 修改结束 ▲▲▲
        };

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
            styleSettings: {},
            visualHistoryStartIndex: 0,
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
            await loadAndRenderHistory(); // Re-render to update avatars
            chatEditor?.updateProfile(character);
        };

        const onUserUpdate = async (updatedUser) => {
            user = updatedUser;
            const userIndex = allUsers.findIndex(u => u.id === user.id);
            if (userIndex !== -1) allUsers[userIndex] = user; else allUsers.push(user);
            await dbStorage.setItem(PROFILE_DB_KEYS.USER_PROFILES, allUsers);
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
            await loadAndRenderHistory(); // Re-render to update avatars
            userEditor?.updateProfile(user);
        };
        
        if (character) { chatEditor = createChatEditor(character, onProfileUpdate); }
        if (user) { userEditor = createChatEditor(user, onUserUpdate, 'user-'); }
        if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = character.avatar;
        if (elements.charProfileEditName) elements.charProfileEditName.textContent = character.name;
        if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
        if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
        
        async function loadAndRenderHistory(loadMore = false) {
            // ... (此函数内容不变)
            const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle) || 'dialogue';
            const settings = state.styleSettings[currentStyleKey] || STYLE_DEFAULT_SETTINGS[currentStyleKey];
            const visualLimit = parseInt(settings.visualLimit, 10) || 50;

            if (!loadMore) {
                state.visualHistoryStartIndex = Math.max(0, state.chatHistory.length - visualLimit);
            } else {
                state.visualHistoryStartIndex = Math.max(0, state.visualHistoryStartIndex - visualLimit);
            }
            
            const messagesToRender = state.chatHistory.slice(state.visualHistoryStartIndex);
            
            elements.chatArea.innerHTML = '';

            if (state.visualHistoryStartIndex > 0) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.textContent = '加载历史消息';
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.onclick = () => loadAndRenderHistory(true);
                elements.chatArea.appendChild(loadMoreBtn);
            }
            // ▼▼▼ 核心修改：使用新的渲染函数 ▼▼▼
            messagesToRender.forEach((messageGroup, index) => {
                const originalIndex = state.visualHistoryStartIndex + index;
                renderMessageGroup(messageGroup, originalIndex, user, character, elements.chatArea);
            });
            // ▲▲▲ 修改结束 ▲▲▲

            if (!loadMore) {
                setTimeout(() => elements.chatArea.scrollTop = elements.chatArea.scrollHeight, 0);
            }
        }
        
        function updateButtonStates() {
             // ... (此函数内容不变)
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
        
        /**
         * ▼▼▼ 核心修改：重构 onAiReply 以处理不同模式的数据更新 ▼▼▼
         * @param {object} action - { mode, data }
         */
        const onAiReply = async (action) => {
            const { mode, data: replyMessages } = action;
            let shouldReRender = false;

            // 清理旧的 "思考中..." 系统消息
            const thinkingMessage = elements.chatArea.querySelector('.message-row.system.loading');
            if (thinkingMessage) thinkingMessage.remove();
            
            switch (mode) {
                case 'new':
                    if (replyMessages && replyMessages.length > 0) {
                        state.chatHistory.push({
                            sender: 'character',
                            replyVersions: [replyMessages],
                            activeReplyIndex: 0
                        });
                        shouldReRender = true;
                    }
                    break;
                case 'regenerate':
                    const lastCharMessageForRegen = state.chatHistory.slice().reverse().find(m => m.sender === 'character');
                    if (lastCharMessageForRegen && replyMessages && replyMessages.length > 0) {
                        lastCharMessageForRegen.replyVersions.push(replyMessages);
                        lastCharMessageForRegen.activeReplyIndex = lastCharMessageForRegen.replyVersions.length - 1;
                        shouldReRender = true;
                    }
                    break;
                case 'continue':
                    const lastCharMessageForCont = state.chatHistory[state.chatHistory.length - 1];
                    if (lastCharMessageForCont && lastCharMessageForCont.sender === 'character' && replyMessages && replyMessages.length > 0) {
                        // 替换当前活动版本的回复为更长的版本
                        lastCharMessageForCont.replyVersions[lastCharMessageForCont.activeReplyIndex] = replyMessages;
                         shouldReRender = true;
                    }
                    break;
                case 'ui_update': // 仅UI更新，如用户发送消息后
                case 'clear_thinking': // 仅清理UI
                    shouldReRender = true;
                    break;
            }
            
            if (shouldReRender) {
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
            }
        };
        
        const handleSendMessage = createApiHandler({
            state, elements, character, user, historyKey: dbKeys.historyKey, dbStorage,
            renderSystemMessage, updateButtonStates, onAiReply,
            getIsAiReplying: () => isAiReplying,
            setIsAiReplying: (value) => { isAiReplying = value; },
            setAbortController: (controller) => { currentAbortController = controller; },
            getStyleSettings: () => {
                const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle) || 'dialogue';
                return state.styleSettings[currentStyleKey];
            }
        });

        async function onSendEmoji(emoji) {
            // ... (此函数内容不变)
            const emojiMessage = { sender: 'user', isEmoji: true, name: emoji.name, data: emoji.data };
            state.chatHistory.push(emojiMessage);
            await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
            await loadAndRenderHistory();
            updateButtonStates();
        }

        function initializeInteractionModeAndStyle() {
             // ... (此函数内容不变)
            const updateInteractionModeUI = () => {
                const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle);
                if (currentStyleKey && elements.selectedInteractionModeName && elements.interactionModeList) {
                    elements.selectedInteractionModeName.textContent = CHAT_STYLES[currentStyleKey].name;
                    elements.interactionModeList.querySelectorAll('.action-button').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.style === currentStyleKey);
                    });
                }
            };

            const updateStyleSettingsPanelUI = () => {
                const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle);
                if (currentStyleKey && state.styleSettings[currentStyleKey]) {
                    const settings = state.styleSettings[currentStyleKey];
                    elements.styleOutputMin.value = settings.outputMin;
                    elements.styleOutputMax.value = settings.outputMax;
                    elements.styleVisualLimit.value = settings.visualLimit;
                    elements.styleMemoryLimit.value = settings.memoryLimit;
                }
            };
            
            updateInteractionModeUI();
            updateStyleSettingsPanelUI();

            elements.interactionModeCapsule?.addEventListener('click', () => {
                elements.interactionModeSheetOverlay.classList.add('active');
            });
            elements.interactionModeCancelBtn?.addEventListener('click', () => {
                elements.interactionModeSheetOverlay.classList.remove('active');
            });
            elements.interactionModeSheetOverlay?.addEventListener('click', (e) => {
                if (e.target === elements.interactionModeSheetOverlay) {
                    elements.interactionModeSheetOverlay.classList.remove('active');
                }
            });
            elements.interactionModeList?.addEventListener('click', async (e) => {
                const button = e.target.closest('.action-button');
                if (!button) return;

                const newStyleKey = button.dataset.style;
                if (newStyleKey && CHAT_STYLES[newStyleKey]) {
                    state.currentChatStyle = CHAT_STYLES[newStyleKey];
                    await dbStorage.setItem(dbKeys.styleDbKey, newStyleKey);
                    updateInteractionModeUI();
                    updateStyleSettingsPanelUI();
                    await loadAndRenderHistory();
                    elements.interactionModeSheetOverlay.classList.remove('active');
                }
            });

            [elements.styleOutputMin, elements.styleOutputMax, elements.styleVisualLimit, elements.styleMemoryLimit].forEach(input => {
                input?.addEventListener('input', async (e) => {
                    const key = e.target.id.replace('style-', '');
                    const value = e.target.value;
                    const currentStyleKey = Object.keys(CHAT_STYLES).find(k => CHAT_STYLES[k] === state.currentChatStyle);
                    
                    if (currentStyleKey && state.styleSettings[currentStyleKey]) {
                        state.styleSettings[currentStyleKey][key] = value;
                        await dbStorage.setItem(dbKeys.styleSettingsDbKey, state.styleSettings);
                        if (key === 'visualLimit') {
                           await loadAndRenderHistory();
                        }
                    }
                });
            });
        }
        
        // --- 6. 事件绑定与模块初始化 ---
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', () => handleSendMessage('new'));
        if (elements.respondBtn) {
            elements.respondBtn.addEventListener('click', () => {
                if (isAiReplying) currentAbortController?.abort();
                else handleSendMessage('new');
            });
        }

        // ▼▼▼ 核心修改：为新功能按钮绑定事件 ▼▼▼
        if (elements.regenerateBtn) {
            elements.regenerateBtn.addEventListener('click', () => handleSendMessage('regenerate'));
        }
        if (elements.continueBtn) {
            elements.continueBtn.addEventListener('click', () => handleSendMessage('continue'));
        }
        // ▲▲▲ 修改结束 ▲▲▲

        // ▼▼▼ 核心修改：为分页器添加事件委托 ▼▼▼
        elements.chatArea.addEventListener('click', async (e) => {
            const pagerButton = e.target.closest('.pager-btn');
            if (!pagerButton) return;

            const messageGroup = pagerButton.closest('.message-group-container');
            const index = parseInt(messageGroup.dataset.index, 10);
            const action = pagerButton.dataset.action;
            
            const messageData = state.chatHistory[index];
            if (!messageData) return;

            if (action === 'prev' && messageData.activeReplyIndex > 0) {
                messageData.activeReplyIndex--;
            } else if (action === 'next' && messageData.activeReplyIndex < messageData.replyVersions.length - 1) {
                messageData.activeReplyIndex++;
            }

            await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
            await loadAndRenderHistory();
        });
        // ▲▲▲ 修改结束 ▲▲▲

        const { renderMemoryCards } = initializeMemorySystem(/* ... */);
        initializeModelSelector(/* ... */);
        initializeHeaderMenu(elements, { chatEditor, userEditor });
        const { renderBackgrounds, setActiveBackground } = initializeThemeSystem(/* ... */);
        initializeInputArea(elements, updateButtonStates, state, dbKeys.diyDbKey, dbStorage);
        
        async function initializeChatState() {
            // ... (此函数内容不变)
            const [savedHistory, savedStyleKey, savedApi, savedDiyEnabled, savedBackgrounds, savedActiveBg, savedStyleSettings] = await Promise.all([
                dbStorage.getItem(dbKeys.historyKey),
                dbStorage.getItem(dbKeys.styleDbKey),
                dbStorage.getItem(dbKeys.selectedApiKey),
                dbStorage.getItem(dbKeys.diyDbKey),
                dbStorage.getItem(dbKeys.bgDbKey),
                dbStorage.getItem(dbKeys.activeBgDbKey),
                dbStorage.getItem(dbKeys.styleSettingsDbKey),
            ]);
            
            state.chatHistory = (savedHistory && Array.isArray(savedHistory)) ? savedHistory : [];
            state.currentChatStyle = (savedStyleKey && CHAT_STYLES[savedStyleKey]) ? CHAT_STYLES[savedStyleKey] : CHAT_STYLES['short-chat'];
            if (savedApi) state.currentChatApi = savedApi;
            state.isDiyEnabled = savedDiyEnabled || false;
            if (elements.diySwitch) elements.diySwitch.checked = state.isDiyEnabled;
            state.backgrounds = savedBackgrounds || [];
            
            const finalSettings = {};
            const savedSettings = savedStyleSettings || {};
            Object.keys(STYLE_DEFAULT_SETTINGS).forEach(key => {
                finalSettings[key] = {
                    ...STYLE_DEFAULT_SETTINGS[key],
                    ...(savedSettings[key] || {})
                };
            });
            state.styleSettings = finalSettings;

            const defaultBgColor = '#F8F9FB';
            await setActiveBackground(savedActiveBg || defaultBgColor);
            
            await loadAndRenderHistory();
            await renderMemoryCards();
            renderBackgrounds();
            updateButtonStates();
            updateModelButtonText();
            
            initializeInteractionModeAndStyle();

            const getChatHistory = () => state.chatHistory;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            };
            
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory);
            
            initializeEmojiSystem(/* ... */);
        }
        await initializeChatState();

    } catch (error) {
        console.error("页面初始化时发生严重错误:", error);
        appContainer.innerHTML = `<p style="text-align: center;">页面加载时发生严重错误。</p>`;
    }
});