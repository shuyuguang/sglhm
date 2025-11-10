// 文件名: relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { renderChatRoomUI, renderMessageGroup, renderSystemMessage } from './chat-ui.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
import { initializeEmojiSystem } from './chat-emoji.js';
import { initializeHeaderMenu } from './chat-header.js';
import { initializeThemeSystem } from './chat-theme.js';
import { initializeInputArea } from './chat-input-handler.js';
import { initializeImageSender, openImageSender } from './chat-image-sender.js';

const blobUrlManager = {
    cache: new Map(),
    
    async dataUrlToBlobUrl(dataUrl) {
        if (this.cache.has(dataUrl)) {
            return this.cache.get(dataUrl);
        }
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

async function loadHtmlFragments(paths) {
    const fetchPromises = paths.map(path => fetch(path).then(res => res.text()));
    const htmlStrings = await Promise.all(fetchPromises);
    document.body.insertAdjacentHTML('beforeend', htmlStrings.join(''));
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadHtmlFragments(['./chat-header.html', './chat-modals.html']);
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
            diySwitch: document.getElementById('enable-diy-switch'),
            regenerateBtn: document.getElementById('regenerate-btn'),
            continueBtn: document.getElementById('continue-btn'),
            imageActionBtn: document.querySelector('.action-list-item [class*="fa-image"]')?.parentElement,
            linkActionBtn: document.querySelector('.action-list-item [class*="fa-link"]')?.parentElement,
            textPreviewOverlay: document.getElementById('text-preview-overlay'),
            textPreviewContent: document.querySelector('#text-preview-overlay .text-preview-content'),
        };

        // ▼▼▼ 核心修改：从 state 对象中移除 currentChatStyle ▼▼▼
        const state = {
            chatHistory: [],
            emojis: [],
            backgrounds: [],
            activeBackground: null,
            isBgMultiSelectMode: false,
            selectedBgIndices: new Set(),
            currentChatApi: null,
            isDiyEnabled: false,
            visualHistoryStartIndex: 0,
        };
        // ▲▲▲ 修改结束 ▲▲▲
        
        let isAiReplying = false;
        let currentAbortController = null;

        // ▼▼▼ 核心修改：从 dbKeys 对象中移除 styleDbKey ▼▼▼
        const dbKeys = {
            historyKey: `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`,
            selectedApiKey: `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`,
            emojiDbKey: CHAT_DB_KEYS.EMOJIS,
            diyDbKey: `relia-chat-diy-enabled_${charId}`,
            bgDbKey: `relia-chat-global-backgrounds`,
            activeBgDbKey: `relia-chat-active-background_${charId}`,
        };
        // ▲▲▲ 修改结束 ▲▲▲
        
        async function loadAndRenderHistory(loadMore = false) {
            const visualLimit = 50;

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
                const messageGroupElement = renderMessageGroup(messageGroup, originalIndex, user, character);
                elements.chatArea.appendChild(messageGroupElement);
            });

            if (!loadMore) {
                setTimeout(() => elements.chatArea.scrollTop = elements.chatArea.scrollHeight, 0);
            }
        }
        
        function updateButtonStates() {
            if (!elements.input || !elements.respondBtn || !elements.sendBtn) return;
        
            const respondBtnIcon = elements.respondBtn.querySelector('i');
        
            if (isAiReplying) {
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
            } 
            else {
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
            renderSystemMessage, onAiReply,
            getIsAiReplying: () => isAiReplying,
            setIsAiReplying: (value) => { 
                isAiReplying = value; 
                updateButtonStates();
            },
            setAbortController: (controller) => { currentAbortController = controller; },
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
            updateButtonStates();
            elements.input.focus();
        }

        async function onSendEmoji(emoji) {
            const emojiMessage = { sender: 'user', isEmoji: true, name: emoji.name, data: emoji.data };
            await onSendUserMessage(emojiMessage);
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
            const previewBtn = e.target.closest('.text-photo-preview-btn');
            if (previewBtn) {
                const text = previewBtn.dataset.text;
                elements.textPreviewContent.textContent = text;
                elements.textPreviewOverlay.classList.add('active');
                return;
            }

            const pagerButton = e.target.closest('.pager-btn');
            if (pagerButton) {
                const messageGroupContainer = pagerButton.closest('.message-group-container');
                const index = parseInt(messageGroupContainer.dataset.index, 10);
                const action = pagerButton.dataset.action;
                const messageData = state.chatHistory[index];

                if (!messageData) return;

                let changed = false;
                if (action === 'prev' && messageData.activeReplyIndex > 0) {
                    messageData.activeReplyIndex--;
                    changed = true;
                } else if (action === 'next' && messageData.activeReplyIndex < messageData.replyVersions.length - 1) {
                    messageData.activeReplyIndex++;
                    changed = true;
                }

                if (changed) {
                    await dbStorage.setItem(dbKeys.historyKey, state.chatHistory);
                    
                    const oldGroup = elements.chatArea.querySelector(`.message-group-container[data-index="${index}"]`);
                    if (oldGroup) {
                        const newGroup = renderMessageGroup(messageData, index, user, character);
                        oldGroup.replaceWith(newGroup);
                    }
                }
            }
        });
        
        if (elements.textPreviewOverlay) {
            elements.textPreviewOverlay.addEventListener('click', (e) => {
                if (e.target === elements.textPreviewOverlay) {
                    elements.textPreviewOverlay.classList.remove('active');
                }
            });
        }
        
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
        
        initializeHeaderMenu(elements);
        
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
            // ▼▼▼ 核心修改：简化 Promise.all，移除 styleDbKey ▼▼▼
            const [savedHistory, savedApi, savedDiyEnabled, savedBackgrounds, savedActiveBg, savedEmojis] = await Promise.all([
                dbStorage.getItem(dbKeys.historyKey),
                dbStorage.getItem(dbKeys.selectedApiKey),
                dbStorage.getItem(dbKeys.diyDbKey),
                dbStorage.getItem(dbKeys.bgDbKey),
                dbStorage.getItem(dbKeys.activeBgDbKey),
                dbStorage.getItem(dbKeys.emojiDbKey),
            ]);
            
            state.chatHistory = (savedHistory && Array.isArray(savedHistory)) ? savedHistory : [];
            if (savedApi) state.currentChatApi = savedApi;
            state.isDiyEnabled = savedDiyEnabled || false;
            if (elements.diySwitch) elements.diySwitch.checked = state.isDiyEnabled;
            state.backgrounds = savedBackgrounds || [];
            state.emojis = savedEmojis || [];

            const defaultBgColor = '#F8F9FB';
            await setActiveBackground(savedActiveBg || defaultBgColor);
            
            await loadAndRenderHistory();
            renderBackgrounds();
            updateButtonStates();
            updateModelButtonText();
            // ▲▲▲ 修改结束 ▲▲▲
            
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
        if (elements.linkActionBtn) {
            elements.linkActionBtn.addEventListener('click', () => {
                alert('“链接”功能正在重做中，敬请期待！');
            });
        }

    } catch (error) {
        console.error("页面初始化时发生严重错误:", error);
        appContainer.innerHTML = `<p style="text-align: center;">页面加载时发生严重错误。</p>`;
    }

    window.addEventListener('pagehide', () => {
        blobUrlManager.cleanup();
    });
});