// 文件名: achat/chat-room-spa.js

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';

import { renderChatRoomUI, renderMessageGroup, renderSystemMessage } from './chat-ui.js';
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
import { initializeEmojiSystem } from './chat-emoji.js';
import { initializeHeaderMenu } from './chat-header.js';
import { initializeThemeSystem } from './chat-theme.js';
import { initializeInputArea } from './chat-input-handler.js';
import { initializeImageSender, openImageSender } from './chat-image-sender.js';
import { initializeLinkSender, openLinkSender } from './chat-link-sender.js';

let currentChatSession = null;

const blobUrlManager = {
    cache: new Map(),
    async dataUrlToBlobUrl(dataUrl) {
        if (this.cache.has(dataUrl)) return this.cache.get(dataUrl);
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            this.cache.set(dataUrl, blobUrl);
            return blobUrl;
        } catch (error) {
            console.error("Data URL to Blob URL conversion failed:", error);
            return dataUrl;
        }
    },
    cleanup() {
        for (const blobUrl of this.cache.values()) {
            URL.revokeObjectURL(blobUrl);
        }
        this.cache.clear();
        console.log("Blob URLs cleaned up.");
    }
};

export async function initializeAndOpenChatRoom(charId) {
    if (currentChatSession) {
        console.warn("A chat session is already active. Please close it first.");
        return;
    }

    const chatRoomContainer = document.getElementById('chat-room-container');
    if (!charId) {
        chatRoomContainer.innerHTML = '<p>错误：未指定角色ID。</p>';
        return;
    }
    
    // 显示加载状态
    chatRoomContainer.innerHTML = '<div class="loading-spinner"></div>';
    document.body.classList.add('chat-active');
    
    try {
        const [rawAllChars, rawAllUsers, currentUserId] = await Promise.all([
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
            dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
        ]);

        const allChars = rawAllChars || [];
        const allUsers = rawAllUsers || [];

        let character = allChars.find(c => c.id === charId);
        if (!character) { throw new Error(`找不到ID为 ${charId} 的角色。`); }
        let user = allUsers.find(u => u.id === currentUserId) || { id: 'default-user-1', name: 'User', avatar: 'https://i.postimg.cc/Yq19VCkN/afelotus.jpg' };
        
        chatRoomContainer.innerHTML = renderChatRoomUI(character);
        
        // ▼▼▼ 将所有变量封装到 session 对象中 ▼▼▼
        currentChatSession = {
            elements: {
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
                diySwitch: document.getElementById('enable-diy-switch'),
                regenerateBtn: document.getElementById('regenerate-btn'),
                continueBtn: document.getElementById('continue-btn'),
                imageActionBtn: document.querySelector('.action-list-item [class*="fa-image"]')?.parentElement,
                linkActionBtn: document.querySelector('.action-list-item [class*="fa-link"]')?.parentElement,
                textPreviewOverlay: document.getElementById('text-preview-overlay'),
                textPreviewContent: document.querySelector('#text-preview-overlay .text-preview-content'),
                backBtn: document.getElementById('chat-back-btn'), // 新增返回按钮
            },
            state: {
                chatHistory: [],
                memories: [],
                emojis: [],
                backgrounds: [],
                activeBackground: null,
                isBgMultiSelectMode: false,
                selectedBgIndices: new Set(),
                currentChatApi: null,
                isDiyEnabled: false,
            },
            isAiReplying: false,
            currentAbortController: null,
            character,
            user,
            dbKeys: {
                historyKey: `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`,
                selectedApiKey: `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`,
                memoryDbKey: `relia-chat-memory_${charId}`,
                emojiDbKey: CHAT_DB_KEYS.EMOJIS,
                diyDbKey: `relia-chat-diy-enabled_${charId}`,
                bgDbKey: `relia-chat-global-backgrounds`,
                activeBgDbKey: `relia-chat-active-background_${charId}`,
            },
            eventListeners: [] // 用于存储需要清理的事件
        };
        
        const { elements, state, dbKeys } = currentChatSession;
        // ▲▲▲ session 对象结束 ▲▲▲

        const onProfileUpdate = async (updatedProfile) => {
            currentChatSession.character = updatedProfile;
            const allCharacterProfiles = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
            const charIndex = allCharacterProfiles.findIndex(c => c.id === currentChatSession.character.id);
            if (charIndex !== -1) allCharacterProfiles[charIndex] = currentChatSession.character;
            await dbStorage.setItem(PROFILE_DB_KEYS.CHAR_PROFILES, allCharacterProfiles);
            document.querySelector('.char-info-name').textContent = currentChatSession.character.name || '未命名';
            document.querySelector('.char-info-avatar').src = currentChatSession.character.avatar;
            if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = currentChatSession.character.avatar;
            if (elements.charProfileEditName) elements.charProfileEditName.textContent = currentChatSession.character.name;
            await loadAndRenderHistory();
            chatEditor?.updateProfile(currentChatSession.character);
        };

        const onUserUpdate = async (updatedUser) => {
            currentChatSession.user = updatedUser;
            const userIndex = allUsers.findIndex(u => u.id === currentChatSession.user.id);
            if (userIndex !== -1) allUsers[userIndex] = currentChatSession.user; else allUsers.push(currentChatSession.user);
            await dbStorage.setItem(PROFILE_DB_KEYS.USER_PROFILES, allUsers);
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = currentChatSession.user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = currentChatSession.user.name;
            await loadAndRenderHistory();
            userEditor?.updateProfile(currentChatSession.user);
        };
        
        let chatEditor = createChatEditor(currentChatSession.character, onProfileUpdate);
        let userEditor = createChatEditor(currentChatSession.user, onUserUpdate, 'user-');
        
        if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = currentChatSession.character.avatar;
        if (elements.charProfileEditName) elements.charProfileEditName.textContent = currentChatSession.character.name;
        if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = currentChatSession.user.avatar;
        if (elements.userProfileEditName) elements.userProfileEditName.textContent = currentChatSession.user.name;
        
        async function loadAndRenderHistory() {
            const processedMessages = await Promise.all(state.chatHistory.map(async (msg) => {
                if (msg.sender === 'user' && msg.type === 'image' && msg.data.startsWith('data:')) {
                    const blobUrl = await blobUrlManager.dataUrlToBlobUrl(msg.data);
                    return { ...msg, renderData: blobUrl };
                }
                if (msg.sender === 'user' && msg.type === 'link' && msg.image?.type === 'image' && msg.image.data.startsWith('data:')) {
                    const blobUrl = await blobUrlManager.dataUrlToBlobUrl(msg.image.data);
                    const newMsg = JSON.parse(JSON.stringify(msg));
                    newMsg.image.renderData = blobUrl;
                    return newMsg;
                }
                return msg;
            }));

            elements.chatArea.innerHTML = '';

            processedMessages.forEach((messageGroup, index) => {
                const messageGroupElement = renderMessageGroup(messageGroup, index, currentChatSession.user, currentChatSession.character);
                elements.chatArea.appendChild(messageGroupElement);
            });

            setTimeout(() => elements.chatArea.scrollTop = elements.chatArea.scrollHeight, 0);
        }
        
        function updateButtonStates() {
            if (!elements.input || !elements.respondBtn || !elements.sendBtn) return;
            const respondBtnIcon = elements.respondBtn.querySelector('i');
            if (currentChatSession.isAiReplying) {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
                if (respondBtnIcon) respondBtnIcon.className = 'fa-solid fa-stop';
                elements.respondBtn.classList.add('blinking');
                return;
            }
            if (respondBtnIcon) respondBtnIcon.className = 'fa-regular fa-paper-plane';
            elements.respondBtn.classList.remove('blinking');
            const hasText = elements.input.value.trim() !== '';
            if (hasText) {
                elements.respondBtn.style.display = 'none';
                elements.sendBtn.style.display = 'flex';
            } else {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
            }
        }
        
        const onAiReply = async (action) => {
            const { mode, data: replyMessages } = action;
            let shouldReRender = false;
            const thinkingMessage = elements.chatArea.querySelector('.message-row.system.loading');
            if (thinkingMessage) thinkingMessage.remove();
            
            switch (mode) {
                case 'new': if (replyMessages?.length > 0) { state.chatHistory.push({ sender: 'character', replyVersions: [replyMessages], activeReplyIndex: 0 }); shouldReRender = true; } break;
                case 'regenerate': const lastCharMsg = state.chatHistory.slice().reverse().find(m => m.sender === 'character'); if (lastCharMsg && replyMessages?.length > 0) { lastCharMsg.replyVersions.push(replyMessages); lastCharMsg.activeReplyIndex = lastCharMsg.replyVersions.length - 1; shouldReRender = true; } break;
                case 'continue': const lastMsg = state.chatHistory[state.chatHistory.length - 1]; if (lastMsg?.sender === 'character' && replyMessages?.length > 0) { const currentReply = lastMsg.replyVersions[lastMsg.activeReplyIndex]; lastMsg.replyVersions[lastMsg.activeReplyIndex] = [...currentReply, ...replyMessages]; shouldReRender = true; } break;
                case 'ui_update': case 'clear_thinking': shouldReRender = true; break;
            }
            
            if (shouldReRender) {
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            }
        };

        const triggerAiResponse = createApiHandler({
            state, elements, character: currentChatSession.character, user: currentChatSession.user,
            renderSystemMessage, updateButtonStates, onAiReply,
            getIsAiReplying: () => currentChatSession.isAiReplying,
            setIsAiReplying: (value) => { currentChatSession.isAiReplying = value; updateButtonStates(); },
            setAbortController: (controller) => { currentChatSession.currentAbortController = controller; }
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
            await onSendUserMessage({ text, sender: 'user' });
            elements.input.value = '';
            elements.input.style.height = 'auto';
            updateButtonStates();
            elements.input.focus();
        }

        async function onSendEmoji(emoji) {
            await onSendUserMessage({ sender: 'user', isEmoji: true, name: emoji.name, data: emoji.data });
        }
        
        // --- 绑定事件，并记录下来以便清理 ---
        const addListener = (element, event, handler) => {
            if (element) {
                element.addEventListener(event, handler);
                currentChatSession.eventListeners.push({ element, event, handler });
            }
        };

        addListener(elements.backBtn, 'click', closeChatRoom);
        addListener(elements.sendBtn, 'click', handleUserSend);
        addListener(elements.respondBtn, 'click', () => {
            if (currentChatSession.isAiReplying) {
                currentChatSession.currentAbortController?.abort();
            } else {
                triggerAiResponse('new');
            }
        });
        addListener(elements.regenerateBtn, 'click', () => triggerAiResponse('regenerate'));
        addListener(elements.continueBtn, 'click', () => triggerAiResponse('continue'));
        addListener(elements.chatArea, 'click', async (e) => {
            if (e.target.closest('.is-image-message a')) e.preventDefault();
            const previewBtn = e.target.closest('.text-photo-preview-btn');
            if (previewBtn) {
                elements.textPreviewContent.textContent = previewBtn.dataset.text;
                elements.textPreviewOverlay.classList.add('active');
                return;
            }
            const pagerButton = e.target.closest('.pager-btn');
            if (pagerButton) {
                const msgContainer = pagerButton.closest('.message-group-container');
                const index = parseInt(msgContainer.dataset.index, 10);
                const action = pagerButton.dataset.action;
                const msgData = state.chatHistory[index];
                if (!msgData) return;
                let changed = false;
                if (action === 'prev' && msgData.activeReplyIndex > 0) { msgData.activeReplyIndex--; changed = true; }
                else if (action === 'next' && msgData.activeReplyIndex < msgData.replyVersions.length - 1) { msgData.activeReplyIndex++; changed = true; }
                if (changed) {
                    await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                    const oldGroup = elements.chatArea.querySelector(`.message-group-container[data-index="${index}"]`);
                    if (oldGroup) oldGroup.replaceWith(renderMessageGroup(msgData, index, currentChatSession.user, currentChatSession.character));
                }
            }
        });
        addListener(elements.textPreviewOverlay, 'click', (e) => {
            if (e.target === elements.textPreviewOverlay) elements.textPreviewOverlay.classList.remove('active');
        });
        if (elements.imageActionBtn) addListener(elements.imageActionBtn, 'click', openImageSender);
        if (elements.linkActionBtn) addListener(elements.linkActionBtn, 'click', openLinkSender);
        // --- 事件绑定结束 ---

        const { renderMemoryCards } = initializeMemorySystem({ ...elements, addMemoryBtn: document.getElementById('add-memory-btn'), memoryCardsContainer: document.getElementById('memory-cards-container'), memoryEditorOverlay: document.getElementById('memory-editor-overlay'), memoryEditorTitle: document.getElementById('memory-editor-title'), memoryEditorTextarea: document.getElementById('memory-editor-textarea'), memoryEditorConfirmBtn: document.getElementById('memory-editor-confirm-btn'), memoryEditorCancelBtn: document.getElementById('memory-editor-cancel-btn'), memoryEditorDeleteBtn: document.getElementById('memory-editor-delete-btn'), memoryEditorCloseBtn: document.getElementById('memory-editor-close-btn'), }, state, dbKeys.memoryDbKey);
        initializeModelSelector({ ...elements, selectModelBtn: document.getElementById('select-model-btn'), selectedModelName: document.getElementById('selected-model-name'), modelSelectorOverlay: document.getElementById('model-selector-overlay'), modelListContainer: document.getElementById('model-list-container'), closeModelSelectorBtn: document.getElementById('close-model-selector-btn'), }, state, dbKeys.selectedApiKey);
        initializeHeaderMenu(elements, { chatEditor, userEditor });
        const { renderBackgrounds, setActiveBackground } = initializeThemeSystem({ ...elements, themeContentPane: document.getElementById('menu-content-theme'), bgThumbnailsContainer: document.getElementById('bg-thumbnails-container'), multiSelectBgBtn: document.getElementById('multi-select-bg-btn'), deleteSelectedBgBtn: document.getElementById('delete-selected-bg-btn'), addBgFromLocalBtn: document.getElementById('add-bg-from-local-btn'), bgUploadInput: document.getElementById('bg-upload-input'), addBgFromUrlBtn: document.getElementById('add-bg-from-url-btn'), bgUrlPromptOverlay: document.getElementById('bg-url-prompt-overlay'), bgUrlInput: document.getElementById('bg-url-input'), cancelBgUrlBtn: document.getElementById('cancel-bg-url-btn'), confirmBgUrlBtn: document.getElementById('confirm-bg-url-btn'), }, state, { bgDbKey: dbKeys.bgDbKey, activeBgDbKey: dbKeys.activeBgDbKey });
        initializeInputArea(elements, updateButtonStates, state, dbKeys.diyDbKey, dbStorage);
        
        async function initializeChatState() {
            const [savedHistory, savedApi, savedDiy, savedBgs, savedActiveBg, savedEmojis] = await Promise.all([
                dbStorage.getItem(dbKeys.historyKey), dbStorage.getItem(dbKeys.selectedApiKey),
                dbStorage.getItem(dbKeys.diyDbKey), dbStorage.getItem(dbKeys.bgDbKey),
                dbStorage.getItem(dbKeys.activeBgDbKey), dbStorage.getItem(dbKeys.emojiDbKey),
            ]);
            state.chatHistory = savedHistory || [];
            if (savedApi) state.currentChatApi = savedApi;
            state.isDiyEnabled = savedDiy || false;
            if (elements.diySwitch) elements.diySwitch.checked = state.isDiyEnabled;
            state.backgrounds = savedBgs || [];
            state.emojis = savedEmojis || [];
            await setActiveBackground(savedActiveBg || null);
            await loadAndRenderHistory();
            await renderMemoryCards();
            renderBackgrounds();
            updateButtonStates();
            updateModelButtonText();
            
            const getChatHistory = () => state.chatHistory;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                await loadAndRenderHistory();
                updateButtonStates();
            };
            
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory, () => state.emojis);
            initializeEmojiSystem({ ...elements, emojiPickerBar: document.querySelector('.emoji-picker-bar'), emojiManagementGridContainer: document.getElementById('emoji-management-container'), emojiUploadInput: document.getElementById('emoji-upload-input'), webEmojiModal: document.getElementById('web-emoji-modal'), webEmojiUrlInput: document.getElementById('web-emoji-url-input'), confirmWebEmojiBtn: document.getElementById('confirm-web-emoji-btn'), cancelWebEmojiBtn: document.getElementById('cancel-web-emoji-btn'), }, state, onSendEmoji);
            initializeImageSender(elements, onSendUserMessage);
            initializeLinkSender(elements, onSendUserMessage);
        }
        await initializeChatState();

    } catch (error) {
        console.error("页面初始化时发生严重错误:", error);
        chatRoomContainer.innerHTML = `<p style="text-align: center;">页面加载时发生严重错误: ${error.message}</p><button id="force-close-btn">返回</button>`;
        document.getElementById('force-close-btn').onclick = closeChatRoom;
    }
}

export function closeChatRoom() {
    if (!currentChatSession) return;
    
    // 清理事件监听器
    currentChatSession.eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });

    // 终止正在进行的AI响应
    currentChatSession.currentAbortController?.abort();
    
    // 清理Blob URLs
    blobUrlManager.cleanup();

    // 隐藏UI
    document.body.classList.remove('chat-active');
    const chatRoomContainer = document.getElementById('chat-room-container');
    chatRoomContainer.innerHTML = '';
    
    // 销毁会话
    currentChatSession = null;
    
    // SPA模式下，还需要通知主应用刷新聊天列表预览
    const refreshEvent = new CustomEvent('refreshChatList');
    document.dispatchEvent(refreshEvent);
}