// 文件名: relia-chat/chat-room.js (已按您的要求修改)

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES } from './chat-prompt.js'; // 移除了 createChatPromptPanel 的导入

// 导入新模块
import { renderChatRoomUI, renderMessage, renderSystemMessage } from './chat-ui.js';
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';
// [新增] 引入表情包系统
import { initializeEmojiSystem } from './chat-emoji.js';


document.addEventListener('DOMContentLoaded', async () => {
    console.log("Chat Room script started.");

    const appContainer = document.getElementById('app-container');
    if (!appContainer) {
        console.error("#app-container not found!");
        document.body.innerText = '关键DOM元素 #app-container 未找到，页面无法加载。';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');
    if (!charId) {
        appContainer.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
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
            appContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
            return;
        }
        let user = allUsers.find(u => u.id === currentUserId) || { id: 'default-user-1', name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

        // --- 2. 渲染UI并获取元素 ---
        appContainer.innerHTML = renderChatRoomUI(character);
        
        const elements = {
            chatArea: document.getElementById('chat-messages-area'),
            input: document.getElementById('chat-input'),
            chatInputArea: document.getElementById('chat-input-area'),
            actionsToggleBtn: document.getElementById('actions-toggle-btn'),
            emojiToggleBtn: document.getElementById('emoji-toggle-btn'),
            sendButtonsContainer: document.getElementById('send-buttons-container'),
            sendBtn: document.getElementById('send-btn'),
            respondBtn: document.getElementById('respond-btn'),
            selectModelBtn: document.getElementById('select-model-btn'),
            selectedModelName: document.getElementById('selected-model-name'),
            modelSelectorOverlay: document.getElementById('model-selector-overlay'),
            modelListContainer: document.getElementById('model-list-container'),
            closeModelSelectorBtn: document.getElementById('close-model-selector-btn'),
            editSettingsBtn: document.getElementById('edit-settings-btn'),
            searchHistoryBtn: document.getElementById('search-history-btn'),
            menuBtn: document.getElementById('menu-btn'),
            headerContentPanel: document.getElementById('header-content-panel'),
            headerTabsPanel: document.getElementById('header-tabs-panel'),
            headerMenuOverlay: document.getElementById('header-menu-overlay'),
            actionsMenu: document.getElementById('actions-menu'),
            addMemoryBtn: document.getElementById('add-memory-btn'),
            memoryCardsContainer: document.getElementById('memory-cards-container'),
            memoryEditorOverlay: document.getElementById('memory-editor-overlay'),
            memoryEditorTitle: document.getElementById('memory-editor-title'),
            memoryEditorTextarea: document.getElementById('memory-editor-textarea'),
            memoryEditorConfirmBtn: document.getElementById('memory-editor-confirm-btn'),
            memoryEditorCancelBtn: document.getElementById('memory-editor-cancel-btn'),
            memoryEditorDeleteBtn: document.getElementById('memory-editor-delete-btn'),
            memoryEditorCloseBtn: document.getElementById('memory-editor-close-btn'),
            editUserProfileTrigger: document.getElementById('edit-user-profile-trigger'),
            editCharProfileTrigger: document.getElementById('edit-char-profile-trigger'),
            userProfileEditAvatar: document.getElementById('user-profile-edit-avatar'),
            userProfileEditName: document.getElementById('user-profile-edit-name'),
            charProfileEditAvatar: document.getElementById('char-profile-edit-avatar'),
            charProfileEditName: document.getElementById('char-profile-edit-name'),
            diySwitch: document.getElementById('enable-diy-switch'),
            interactionModeCapsule: document.getElementById('interaction-mode-capsule'),
            selectedInteractionModeName: document.getElementById('selected-interaction-mode-name'),
            interactionModeSheetOverlay: document.getElementById('interaction-mode-sheet-overlay'),
            interactionModeList: document.getElementById('interaction-mode-list'),
            interactionModeCancelBtn: document.getElementById('interaction-mode-cancel-btn'),
            addBgFromLocalBtn: document.getElementById('add-bg-from-local-btn'),
            addBgFromUrlBtn: document.getElementById('add-bg-from-url-btn'),
            bgUploadInput: document.getElementById('bg-upload-input'),
            bgThumbnailsContainer: document.getElementById('bg-thumbnails-container'),
            bgUrlPromptOverlay: document.getElementById('bg-url-prompt-overlay'),
            bgUrlInput: document.getElementById('bg-url-input'),
            cancelBgUrlBtn: document.getElementById('cancel-bg-url-btn'),
            confirmBgUrlBtn: document.getElementById('confirm-bg-url-btn'),
            themeContentPane: document.getElementById('menu-content-theme'),
            multiSelectBgBtn: document.getElementById('multi-select-bg-btn'),
            deleteSelectedBgBtn: document.getElementById('delete-selected-bg-btn'),
            styleOutputMin: document.getElementById('style-output-min'),
            styleOutputMax: document.getElementById('style-output-max'),
            styleVisualLimit: document.getElementById('style-visual-limit'),
            styleMemoryLimit: document.getElementById('style-memory-limit'),
            // [新增] 表情包相关元素
            emojiPickerBar: document.querySelector('.emoji-picker-bar'),
            emojiManagementGridContainer: document.getElementById('emoji-management-container'),
            emojiUploadInput: document.getElementById('emoji-upload-input'),
            webEmojiModal: document.getElementById('web-emoji-modal'),
            webEmojiUrlInput: document.getElementById('web-emoji-url-input'),
            confirmWebEmojiBtn: document.getElementById('confirm-web-emoji-btn'),
            cancelWebEmojiBtn: document.getElementById('cancel-web-emoji-btn'),
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
        
        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
        const selectedApiKey = `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`;
        const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;
        const memoryDbKey = `relia-chat-memory_${charId}`;
        const diyDbKey = `relia-chat-diy-enabled_${charId}`;
        const bgDbKey = `relia-chat-global-backgrounds`;
        const activeBgDbKey = `relia-chat-active-background_${charId}`;
        const styleSettingsDbKey = `relia-chat-style-settings_${charId}`;


        // --- 4. 模块初始化 ---
        let chatEditor = null;
        let userEditor = null;

        const onProfileUpdate = async (updatedProfile) => {
            character = updatedProfile;
            const allCharacterProfiles = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
            const charIndex = allCharacterProfiles.findIndex(c => c.id === character.id);
            if (charIndex !== -1) {
                allCharacterProfiles[charIndex] = character;
                await dbStorage.setItem(PROFILE_DB_KEYS.CHAR_PROFILES, allCharacterProfiles);
            }
            document.querySelector('.char-info-name').textContent = character.name || '未命名';
            document.querySelector('.char-info-avatar').src = character.avatar;
            if (elements.charProfileEditAvatar) elements.charProfileEditAvatar.src = character.avatar;
            if (elements.charProfileEditName) elements.charProfileEditName.textContent = character.name;
            
            elements.chatArea.querySelectorAll('.message-row.character .message-avatar').forEach(avatarEl => {
                avatarEl.src = character.avatar;
            });
            
            chatEditor?.updateProfile(character);
        };

        const onUserUpdate = async (updatedUser) => {
            user = updatedUser;
            const userIndex = allUsers.findIndex(u => u.id === user.id);
            if (userIndex !== -1) allUsers[userIndex] = user;
            else allUsers.push(user);
            await dbStorage.setItem(PROFILE_DB_KEYS.USER_PROFILES, allUsers);
            if (elements.userProfileEditAvatar) elements.userProfileEditAvatar.src = user.avatar;
            if (elements.userProfileEditName) elements.userProfileEditName.textContent = user.name;
            
            elements.chatArea.querySelectorAll('.message-row.user .message-avatar').forEach(avatarEl => {
                avatarEl.src = user.avatar;
            });

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

        const { renderMemoryCards } = initializeMemorySystem(elements, state, memoryDbKey);
        initializeModelSelector(elements, state, selectedApiKey);
        
        // --- 5. 核心功能函数 ---
        async function loadAndRenderHistory() {
            const savedHistory = await dbStorage.getItem(historyKey);
            state.chatHistory = (savedHistory && Array.isArray(savedHistory)) ? savedHistory : [];
            elements.chatArea.innerHTML = '';
            state.chatHistory.forEach((message, index) => renderMessage(message, index, user, character, elements.chatArea));
        }
        
        function updateButtonStates() {
            const hasText = elements.input.value.trim() !== '';
            if (hasText) {
                elements.respondBtn.style.display = 'none';
                elements.sendBtn.style.display = 'flex';
            } else {
                elements.respondBtn.style.display = 'flex';
                elements.sendBtn.style.display = 'none';
            }
            elements.respondBtn.disabled = false;
        }

        const handleSendMessage = createApiHandler({
            state, elements, character, user, historyKey, dbStorage,
            renderMessage, renderSystemMessage, loadAndRenderHistory, updateButtonStates
        });

        // [新增] 发送表情的回调函数
        async function onSendEmoji(emoji) {
            const emojiMessage = {
                sender: 'user',
                isEmoji: true,
                data: emoji.data // 存储图片URL或Base64
            };
            state.chatHistory.push(emojiMessage);
            await dbStorage.setItem(historyKey, state.chatHistory);
            renderMessage(emojiMessage, state.chatHistory.length - 1, user, character, elements.chatArea);
            
            // 可选：发送表情后自动收起面板
            // elements.chatInputArea.classList.remove('emoji-expanded');
        }

        function updateInteractionModeUI() {
            const currentStyleKey = Object.keys(CHAT_STYLES).find(key => CHAT_STYLES[key] === state.currentChatStyle);
            if (currentStyleKey) {
                elements.selectedInteractionModeName.textContent = CHAT_STYLES[currentStyleKey].name;
                if (elements.interactionModeList) {
                    elements.interactionModeList.querySelectorAll('.action-button').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.style === currentStyleKey);
                    });
                }
            }
        }
        
        function renderBackgrounds() {
            elements.bgThumbnailsContainer.innerHTML = '';
            const defaultBgColor = '#F8F9FB';

            const defaultItem = document.createElement('div');
            defaultItem.className = 'bg-thumbnail-item';
            defaultItem.dataset.defaultBg = 'true'; 
            if (defaultBgColor === state.activeBackground) {
                defaultItem.classList.add('active');
            }
            if (state.isBgMultiSelectMode) {
                defaultItem.classList.add('disabled');
            }

            const colorPreview = document.createElement('div');
            colorPreview.className = 'bg-default-preview';
            colorPreview.style.backgroundColor = defaultBgColor;
            
            defaultItem.appendChild(colorPreview);
            elements.bgThumbnailsContainer.appendChild(defaultItem);

            state.backgrounds.forEach((bgUrl, index) => {
                const item = document.createElement('div');
                item.className = 'bg-thumbnail-item';
                item.dataset.index = index;
                if (bgUrl === state.activeBackground) {
                    item.classList.add('active');
                }
                if (state.isBgMultiSelectMode && state.selectedBgIndices.has(index)) {
                    item.classList.add('selected');
                }
                
                const img = document.createElement('img');
                img.src = bgUrl;
                img.alt = `背景 ${index + 1}`;
                
                const overlay = document.createElement('div');
                overlay.className = 'selection-overlay';
                overlay.innerHTML = '<i class="fa-solid fa-circle-check"></i>';

                item.appendChild(img);
                item.appendChild(overlay);
                elements.bgThumbnailsContainer.appendChild(item);
            });
        }

        async function setActiveBackground(bgUrl) {
            state.activeBackground = bgUrl;
            const container = document.querySelector('.chat-container');
            if (container) {
                if (bgUrl && bgUrl.startsWith('#')) {
                    container.style.backgroundImage = '';
                    container.style.backgroundColor = bgUrl;
                    container.classList.remove('has-background');
                } else if (bgUrl) {
                    container.style.backgroundColor = '';
                    container.style.backgroundImage = `url('${bgUrl}')`;
                    container.classList.add('has-background');
                } else {
                    container.style.backgroundImage = '';
                    container.style.backgroundColor = ''; 
                    container.classList.remove('has-background');
                }
            }
            await dbStorage.setItem(activeBgDbKey, bgUrl);
            renderBackgrounds();
        }

        function enterBgMultiSelectMode() {
            state.isBgMultiSelectMode = true;
            state.selectedBgIndices.clear();
            elements.themeContentPane.classList.add('multi-select-mode');
            renderBackgrounds();
        }

        function exitBgMultiSelectMode() {
            state.isBgMultiSelectMode = false;
            state.selectedBgIndices.clear();
            elements.themeContentPane.classList.remove('multi-select-mode');
            renderBackgrounds();
        }

        async function saveStyleSettings() {
            const settings = {
                outputMin: elements.styleOutputMin.value,
                outputMax: elements.styleOutputMax.value,
                visualLimit: elements.styleVisualLimit.value,
                memoryLimit: elements.styleMemoryLimit.value,
            };
            await dbStorage.setItem(styleSettingsDbKey, settings);
            console.log('Style settings saved:', settings);
        }

        // --- 6. 绑定事件 ---
        elements.input.addEventListener('input', () => {
            elements.input.style.height = 'auto';
            elements.input.style.height = (elements.input.scrollHeight) + 'px';
            updateButtonStates();
        });
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', () => handleSendMessage(false));
        if (elements.respondBtn) elements.respondBtn.addEventListener('click', () => handleSendMessage(true));

        if (elements.actionsToggleBtn && elements.actionsMenu) {
            const tabs = elements.actionsMenu.querySelector('.actions-menu-tabs');
            const contentContainer = elements.actionsMenu.querySelector('#actions-menu-content');
            elements.actionsToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.chatInputArea.classList.remove('emoji-expanded');
                elements.chatInputArea.classList.toggle('actions-expanded');
            });
            if (tabs && contentContainer) {
                tabs.addEventListener('click', (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;
                    e.preventDefault();
                    const targetId = link.dataset.target;
                    tabs.querySelectorAll('a.active').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    contentContainer.querySelectorAll('.actions-menu-pane.active').forEach(p => p.classList.remove('active'));
                    document.getElementById(targetId)?.classList.add('active');
                });
            }
        }
        
        if (elements.diySwitch) {
            elements.diySwitch.addEventListener('change', async () => {
                state.isDiyEnabled = elements.diySwitch.checked;
                await dbStorage.setItem(diyDbKey, state.isDiyEnabled);
                console.log(`DIY mode set to: ${state.isDiyEnabled}`);
            });
        }
        
        const closeInteractionModeSheet = () => {
            elements.interactionModeSheetOverlay.classList.remove('active');
        };
        
        if (elements.interactionModeCapsule) {
            elements.interactionModeCapsule.addEventListener('click', () => {
                elements.interactionModeSheetOverlay.classList.add('active');
            });
        }

        if (elements.interactionModeSheetOverlay) {
            elements.interactionModeSheetOverlay.addEventListener('click', (e) => {
                if (e.target === elements.interactionModeSheetOverlay) {
                    closeInteractionModeSheet();
                }
            });
        }

        if (elements.interactionModeCancelBtn) {
            elements.interactionModeCancelBtn.addEventListener('click', closeInteractionModeSheet);
        }

        if (elements.interactionModeList) {
            elements.interactionModeList.addEventListener('click', async (e) => {
                const button = e.target.closest('.action-button');
                if (!button) return;

                const selectedStyleKey = button.dataset.style;
                if (CHAT_STYLES[selectedStyleKey]) {
                    state.currentChatStyle = CHAT_STYLES[selectedStyleKey];
                    await dbStorage.setItem(styleDbKey, selectedStyleKey);
                    updateInteractionModeUI();
                    console.log(`Interaction mode changed to: ${state.currentChatStyle.name}`);
                    setTimeout(closeInteractionModeSheet, 200);
                }
            });
        }

        if (elements.menuBtn && elements.headerContentPanel && elements.headerTabsPanel && elements.headerMenuOverlay) {
            const menuList = elements.headerTabsPanel.querySelector('.header-menu-list');
            const secondaryContentContainer = elements.headerContentPanel;
            const toggleMenu = () => {
                elements.headerContentPanel.classList.toggle('active');
                elements.headerTabsPanel.classList.toggle('active');
                elements.headerMenuOverlay.classList.toggle('active');
            };
            elements.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
            elements.headerMenuOverlay.addEventListener('click', toggleMenu);
            if (menuList && secondaryContentContainer) {
                menuList.addEventListener('click', (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;
                    e.preventDefault();
                    const targetId = link.dataset.target;
                    menuList.querySelectorAll('a.active').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    secondaryContentContainer.querySelectorAll('.secondary-content-pane.active').forEach(p => p.classList.remove('active'));
                    document.getElementById(targetId)?.classList.add('active');
                });
            }

            if (elements.editUserProfileTrigger) {
                elements.editUserProfileTrigger.addEventListener('click', () => {
                    if (userEditor) { userEditor.open(); toggleMenu(); } 
                    else { alert('用户编辑器初始化失败！'); }
                });
            }
            if (elements.editCharProfileTrigger) {
                elements.editCharProfileTrigger.addEventListener('click', () => {
                    if (chatEditor) { chatEditor.open(); toggleMenu(); } 
                    else { alert('角色编辑器初始化失败！'); }
                });
            }
        }

        if (elements.editSettingsBtn) elements.editSettingsBtn.addEventListener('click', () => chatEditor ? chatEditor.open() : alert('编辑器初始化失败！'));
        if (elements.searchHistoryBtn) elements.searchHistoryBtn.addEventListener('click', () => alert('“数据”功能待开发'));
        
        elements.input.addEventListener('focus', () => {
            elements.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
        });
        document.addEventListener('click', (event) => {
            if (!elements.chatInputArea.contains(event.target)) {
                 elements.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
            }
        });

        if (elements.addBgFromLocalBtn && elements.bgUploadInput) {
            elements.addBgFromLocalBtn.addEventListener('click', () => {
                elements.bgUploadInput.click();
            });

            elements.bgUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const newBgUrl = event.target.result;
                        state.backgrounds.push(newBgUrl);
                        await dbStorage.setItem(bgDbKey, state.backgrounds);
                        renderBackgrounds();
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }

        if (elements.addBgFromUrlBtn && elements.bgUrlPromptOverlay) {
            elements.addBgFromUrlBtn.addEventListener('click', () => {
                elements.bgUrlInput.value = '';
                elements.bgUrlPromptOverlay.classList.add('active');
                elements.bgUrlInput.focus();
            });

            elements.cancelBgUrlBtn.addEventListener('click', () => {
                elements.bgUrlPromptOverlay.classList.remove('active');
            });
            
            elements.bgUrlPromptOverlay.addEventListener('click', (e) => {
                 if (e.target === elements.bgUrlPromptOverlay) {
                     elements.bgUrlPromptOverlay.classList.remove('active');
                 }
            });

            elements.confirmBgUrlBtn.addEventListener('click', async () => {
                const newBgUrl = elements.bgUrlInput.value.trim();
                if (newBgUrl) {
                    state.backgrounds.push(newBgUrl);
                    await dbStorage.setItem(bgDbKey, state.backgrounds);
                    renderBackgrounds();
                    elements.bgUrlPromptOverlay.classList.remove('active');
                } else {
                    alert('请输入有效的URL');
                }
            });
        }
        
        if (elements.bgThumbnailsContainer) {
            elements.bgThumbnailsContainer.addEventListener('click', (e) => {
                const item = e.target.closest('.bg-thumbnail-item');
                if (!item) return;

                if (item.dataset.defaultBg === 'true') {
                    const defaultBgColor = '#F8F9FB';
                    if (state.activeBackground === defaultBgColor) {
                        setActiveBackground(null);
                    } else {
                        setActiveBackground(defaultBgColor);
                    }
                    return;
                }

                const index = parseInt(item.dataset.index, 10);
                if (isNaN(index)) return;
                
                if (state.isBgMultiSelectMode) {
                    if (state.selectedBgIndices.has(index)) {
                        state.selectedBgIndices.delete(index);
                        item.classList.remove('selected');
                    } else {
                        state.selectedBgIndices.add(index);
                        item.classList.add('selected');
                    }
                } else {
                    const clickedBgUrl = state.backgrounds[index];
                    if (clickedBgUrl === state.activeBackground) {
                        setActiveBackground(null);
                    } else {
                        setActiveBackground(clickedBgUrl);
                    }
                }
            });
        }

        if (elements.multiSelectBgBtn) {
            elements.multiSelectBgBtn.addEventListener('click', () => {
                if (state.isBgMultiSelectMode) {
                    exitBgMultiSelectMode();
                } else {
                    enterBgMultiSelectMode();
                }
            });
        }
        
        if (elements.deleteSelectedBgBtn) {
            elements.deleteSelectedBgBtn.addEventListener('click', async () => {
                if (!state.isBgMultiSelectMode || state.selectedBgIndices.size === 0) {
                    return;
                }

                if (confirm(`确定要删除选中的 ${state.selectedBgIndices.size} 个背景吗？`)) {
                    const newBackgrounds = state.backgrounds.filter((_, index) => !state.selectedBgIndices.has(index));
                    
                    const activeBgWasDeleted = state.activeBackground && Array.from(state.selectedBgIndices).some(selectedIndex => state.backgrounds[selectedIndex] === state.activeBackground);

                    state.backgrounds = newBackgrounds;
                    await dbStorage.setItem(bgDbKey, state.backgrounds);

                    if (activeBgWasDeleted) {
                        await setActiveBackground(null);
                    }
                    
                    exitBgMultiSelectMode();
                }
            });
        }

        [
            elements.styleOutputMin,
            elements.styleOutputMax,
            elements.styleVisualLimit,
            elements.styleMemoryLimit
        ].forEach(input => {
            if (input) {
                input.addEventListener('input', saveStyleSettings);
            }
        });

        // --- 7. 初始化页面 ---
        async function initializeChatState() {
            const [savedStyleKey, savedApi, savedDiyEnabled, savedBackgrounds, savedActiveBg, savedStyleSettings] = await Promise.all([
                dbStorage.getItem(styleDbKey),
                dbStorage.getItem(selectedApiKey),
                dbStorage.getItem(diyDbKey),
                dbStorage.getItem(bgDbKey),
                dbStorage.getItem(activeBgDbKey),
                dbStorage.getItem(styleSettingsDbKey)
            ]);

            if (savedStyleKey && CHAT_STYLES[savedStyleKey]) {
                state.currentChatStyle = CHAT_STYLES[savedStyleKey];
            } else {
                state.currentChatStyle = CHAT_STYLES['short-chat'];
            }
            if (savedApi) state.currentChatApi = savedApi;
            
            state.isDiyEnabled = savedDiyEnabled || false;
            if (elements.diySwitch) {
                elements.diySwitch.checked = state.isDiyEnabled;
            }

            const settings = savedStyleSettings || {};
            elements.styleOutputMin.value = settings.outputMin || '2';
            elements.styleOutputMax.value = settings.outputMax || '20';
            elements.styleVisualLimit.value = settings.visualLimit || '50';
            elements.styleMemoryLimit.value = settings.memoryLimit || '20';

            state.backgrounds = savedBackgrounds || [];
            
            const container = document.querySelector('.chat-container');
            const defaultBgColor = '#F8F9FB';
            if (savedActiveBg) {
                state.activeBackground = savedActiveBg;
                if (container) {
                     if (savedActiveBg.startsWith('#')) {
                        container.style.backgroundImage = '';
                        container.style.backgroundColor = savedActiveBg;
                        container.classList.remove('has-background');
                    } else {
                        container.style.backgroundColor = '';
                        container.style.backgroundImage = `url('${savedActiveBg}')`;
                        container.classList.add('has-background');
                    }
                }
            } else {
                state.activeBackground = defaultBgColor;
                if (container) {
                    container.style.backgroundImage = '';
                    container.style.backgroundColor = defaultBgColor;
                    container.classList.remove('has-background');
                }
            }
            
            await loadAndRenderHistory();
            await renderMemoryCards();
            renderBackgrounds();
            updateButtonStates();
            updateModelButtonText();
            updateInteractionModeUI();

            const getChatHistory = () => state.chatHistory;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(historyKey, state.chatHistory);
                await loadAndRenderHistory();
            };
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory);
            // [新增] 初始化表情包系统
            initializeEmojiSystem(elements, state, onSendEmoji);
        }
        await initializeChatState();

    } catch (error) {
        console.error("An error occurred during page initialization:", error);
        appContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">页面加载时发生严重错误，请查看控制台。</p>`;
    }
});