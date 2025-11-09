// 文件名: relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES, STYLE_DEFAULT_SETTINGS } from './chat-prompt.js';

import { renderChatRoomUI, renderMessageGroup, renderSystemMessage } from './chat-ui.js';
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
import { initializeEmojiSystem } from './chat-emoji.js';
import { initializeHeaderMenu } from './chat-header.js';
import { initializeThemeSystem } from './chat-theme.js';
import { initializeInputArea } from './chat-input-handler.js';
import { initializeImageSender, openImageSender } from './chat-image-sender.js';

// ▼▼▼ [新增] Blob URL 管理器，解决Base64超长链接问题 ▼▼▼
const blobUrlManager = {
    cache: new Map(), // 使用 Map 来缓存 Data URL -> Blob URL 的转换结果
    
    // 将 Data URL 转换为 Blob URL
    async dataUrlToBlobUrl(dataUrl) {
        if (this.cache.has(dataUrl)) {
            return this.cache.get(dataUrl);
        }
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            this.cache.set(dataUrl, blobUrl); // 缓存结果
            return blobUrl;
        } catch (error) {
            console.error("Data URL to Blob URL conversion failed:", error);
            return dataUrl; // 转换失败则返回原始URL
        }
    },
    
    // 清理所有创建的 Blob URL，防止内存泄漏
    cleanup() {
        for (const blobUrl of this.cache.values()) {
            URL.revokeObjectURL(blobUrl);
        }
        this.cache.clear();
        console.log("Blob URLs cleaned up.");
    }
};
// ▲▲▲ [新增] 结束 ▲▲▲

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
            regenerateBtn: document.getElementById('regenerate-btn'),
            continueBtn: document.getElementById('continue-btn'),
            imageActionBtn: document.querySelector('.action-list-item [class*="fa-image"]')?.parentElement,
            textPreviewOverlay: document.getElementById('text-preview-overlay'),
            textPreviewContent: document.querySelector('#text-preview-overlay .text-preview-content'),
        };

        const state = {
            chatHistory: [],
            memories: [],
            emojis: [],
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
            emojiDbKey: CHAT_DB_KEYS.EMOJIS,
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
            await loadAndRenderHistory();
            chatEditor?.updateProfile(character);
        };

        const onUserUpdate = async (updatedUser) => {
            user = updatedUser;
            const userIndex = allUsers.findIndex(u => u.id === user.id);
            if (userIndex !== -1) allUsers[userIndex] = user; else allUsers.push(user);
            await dbStorage.setItem(PROFILE_DB_KEYS.USER_PROFILES, allUsers);
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
            await loadAndRenderHistory();
            userEditor?.updateProfile(user);
        };
        
        if (character) { chatEditor = createChatEditor(character, onProfileUpdate); }
        if (user) { userEditor = createChatEditor(user, onUserUpdate, 'user-'); }
        if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = character.avatar;
        if (elements.charProfileEditName) elements.charProfileEditName.textContent = character.name;
        if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
        if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
        
        async function loadAndRenderHistory(loadMore = false) {
            const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle) || 'dialogue';
            const settings = state.styleSettings[currentStyleKey] || STYLE_DEFAULT_SETTINGS[currentStyleKey];
            const visualLimit = parseInt(settings.visualLimit, 10) || 50;

            if (!loadMore) {
                state.visualHistoryStartIndex = Math.max(0, state.chatHistory.length - visualLimit);
            } else {
                state.visualHistoryStartIndex = Math.max(0, state.visualHistoryStartIndex - visualLimit);
            }
            
            const messagesToRender = state.chatHistory.slice(state.visualHistoryStartIndex);
            
            const processedMessages = await Promise.all(messagesToRender.map(async (msg) => {
                if (msg.sender === 'user' && msg.type === 'image' && msg.data.startsWith('data:')) {
                    const blobUrl = await blobUrlManager.dataUrlToBlobUrl(msg.data);
                    return { ...msg, renderData: blobUrl };
                }
                return msg;
            }));

            elements.chatArea.innerHTML = '';

            if (state.visualHistoryStartIndex > 0) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.textContent = '加载历史消息';
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.onclick = () => loadAndRenderHistory(true);
                elements.chatArea.appendChild(loadMoreBtn);
            }

            processedMessages.forEach((messageGroup, index) => {
                const originalIndex = state.visualHistoryStartIndex + index;
                renderMessageGroup(messageGroup, originalIndex, user, character, elements.chatArea);
            });

            if (!loadMore) {
                setTimeout(() => elements.chatArea.scrollTop = elements.chatArea.scrollHeight, 0);
            }
        }
        
        // ▼▼▼ 核心修改：重写按钮状态更新逻辑 ▼▼▼
        function updateButtonStates() {
            if (!elements.input || !elements.respondBtn || !elements.sendBtn) return;
        
            const respondBtnIcon = elements.respondBtn.querySelector('i');
        
            // 最高优先级：检查AI是否正在回复
            if (isAiReplying) {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
                elements.respondBtn.disabled = false; // 允许点击以中断
                if (respondBtnIcon) {
                    respondBtnIcon.className = 'fa-solid fa-stop'; // 改为停止图标
                }
                return; // 结束函数
            }
        
            // 如果AI未回复，恢复响应按钮的默认图标
            if (respondBtnIcon) {
                respondBtnIcon.className = 'fa-regular fa-paper-plane';
            }
        
            // 核心规则：根据输入框是否有文本来决定显示哪个按钮
            const hasText = elements.input.value.trim() !== '';
        
            if (hasText) {
                // 有文本，显示“发送”按钮
                elements.respondBtn.style.display = 'none';
                elements.sendBtn.style.display = 'flex';
                elements.sendBtn.disabled = false;
            } else {
                // 无文本，显示“响应”按钮
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
                // 仅在完全没有聊天记录时禁用“响应”按钮
                elements.respondBtn.disabled = state.chatHistory.length === 0;
            }
        }
        // ▲▲▲ 修改结束 ▲▲▲
        
        const onAiReply = async (action) => {
            const { mode, data: replyMessages } = action;
            let shouldReRender = false;

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
                        const currentReply = lastCharMessageForCont.replyVersions[lastCharMessageForCont.activeReplyIndex];
                        const combinedReply = [...currentReply, ...replyMessages];
                        lastCharMessageForCont.replyVersions[lastCharMessageForCont.activeReplyIndex] = combinedReply;
                         shouldReRender = true;
                    }
                    break;
                case 'ui_update':
                case 'clear_thinking':
                    shouldReRender = true;
                    break;
            }
            
            if (shouldReRender) {
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            }
        };

        const triggerAiResponse = createApiHandler({
            state, elements, character, user,
            renderSystemMessage, updateButtonStates, onAiReply,
            getIsAiReplying: () => isAiReplying,
            setIsAiReplying: (value) => { isAiReplying = value; },
            setAbortController: (controller) => { currentAbortController = controller; },
            getStyleSettings: () => {
                const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle) || 'dialogue';
                return state.styleSettings[currentStyleKey];
            }
        });

        async function onSendUserMessage(message) {
            state.chatHistory.push(message);
            await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
            await loadAndRenderHistory();
            updateButtonStates();
        }

        async function handleUserSend() {
            const text = elements.input.value.trim();
            if (text === '') return;
            const userMessage = { text, sender: 'user' };
            await onSendUserMessage(userMessage);
            elements.input.value = '';
            elements.input.style.height = 'auto';
            elements.input.focus();
        }

        async function onSendEmoji(emoji) {
            const emojiMessage = { sender: 'user', isEmoji: true, name: emoji.name, data: emoji.data };
            await onSendUserMessage(emojiMessage);
        }

        function initializeInteractionModeAndStyle() {
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

            elements.interactionModeCapsule?.addEventListener('click', () => elements.interactionModeSheetOverlay.classList.add('active'));
            elements.interactionModeCancelBtn?.addEventListener('click', () => elements.interactionModeSheetOverlay.classList.remove('active'));
            elements.interactionModeSheetOverlay?.addEventListener('click', (e) => {
                if (e.target === elements.interactionModeSheetOverlay) elements.interactionModeSheetOverlay.classList.remove('active');
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
                        if (key === 'visualLimit') await loadAndRenderHistory();
                    }
                });
            });
        }
        
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', handleUserSend);
        if (elements.respondBtn) {
            elements.respondBtn.addEventListener('click', () => {
                if (isAiReplying) {
                    currentAbortController?.abort();
                } else {
                    triggerAiResponse('new');
                }
            });
        }
        if (elements.regenerateBtn) elements.regenerateBtn.addEventListener('click', () => triggerAiResponse('regenerate'));
        if (elements.continueBtn) elements.continueBtn.addEventListener('click', () => triggerAiResponse('continue'));

        elements.chatArea.addEventListener('click', async (e) => {
            const imageLink = e.target.closest('.is-image-message a');
            if (imageLink) {
                e.preventDefault(); 
            }

            const previewBtn = e.target.closest('.text-photo-preview-btn');
            if (previewBtn) {
                const text = previewBtn.dataset.text;
                elements.textPreviewContent.textContent = text;
                elements.textPreviewOverlay.classList.add('active');
                return; 
            }

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
        
        if (elements.textPreviewOverlay) {
            elements.textPreviewOverlay.addEventListener('click', (e) => {
                if (e.target === elements.textPreviewOverlay) {
                    elements.textPreviewOverlay.classList.remove('active');
                }
            });
        }

        const { renderMemoryCards } = initializeMemorySystem(
            { ...elements, ...{
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
        
        async function initializeChatState() {
            const [savedHistory, savedStyleKey, savedApi, savedDiyEnabled, savedBackgrounds, savedActiveBg, savedStyleSettings, savedEmojis] = await Promise.all([
                dbStorage.getItem(dbKeys.historyKey),
                dbStorage.getItem(dbKeys.styleDbKey),
                dbStorage.getItem(dbKeys.selectedApiKey),
                dbStorage.getItem(dbKeys.diyDbKey),
                dbStorage.getItem(dbKeys.bgDbKey),
                dbStorage.getItem(dbKeys.activeBgDbKey),
                dbStorage.getItem(dbKeys.styleSettingsDbKey),
                dbStorage.getItem(dbKeys.emojiDbKey),
            ]);
            
            state.chatHistory = (savedHistory && Array.isArray(savedHistory)) ? savedHistory : [];
            state.currentChatStyle = (savedStyleKey && CHAT_STYLES[savedStyleKey]) ? CHAT_STYLES[savedStyleKey] : CHAT_STYLES['short-chat'];
            if (savedApi) state.currentChatApi = savedApi;
            state.isDiyEnabled = savedDiyEnabled || false;
            if (elements.diySwitch) elements.diySwitch.checked = state.isDiyEnabled;
            state.backgrounds = savedBackgrounds || [];
            state.emojis = savedEmojis || [];
            
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
            const getEmojis = () => state.emojis;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            };
            
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory, getEmojis);
            
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
        
            initializeImageSender(elements, onSendUserMessage);
        }
        await initializeChatState();

        if (elements.imageActionBtn) {
            elements.imageActionBtn.addEventListener('click', openImageSender);
        }

    } catch (error) {
        console.error("页面初始化时发生严重错误:", error);
        appContainer.innerHTML = `<p style="text-align: center;">页面加载时发生严重错误。</p>`;
    }

    // ▼▼▼ [新增] 页面卸载时清理 Blob URL ▼▼▼
    window.addEventListener('unload', () => {
        blobUrlManager.cleanup();
    });
    // ▲▲▲ [新增] 结束 ▲▲▲
});