// 文件名: relia-chat/chat-room.js (重构后)

import { dbStorage } from '../common/db.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { createChatEditor } from './chat-editor-bridge.js';
import { initializeMessageMenu } from './message-edit.js';
import { CHAT_STYLES, createChatPromptPanel } from './chat-prompt.js';

// 导入新模块
import { renderChatRoomUI, renderMessage, renderSystemMessage } from './chat-ui.js';
import { initializeMemorySystem } from './chat-memory.js';
import { initializeModelSelector, updateModelButtonText } from './chat-model-selector.js';
import { createApiHandler } from './chat-api.js';


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
        
        // 集中获取所有需要的DOM元素
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
            promptBtn: document.getElementById('prompt-btn'),
            inspirationBtn: document.getElementById('inspiration-btn'),
            editSettingsBtn: document.getElementById('edit-settings-btn'),
            searchHistoryBtn: document.getElementById('search-history-btn'),
            workbenchBtn: document.getElementById('workbench-btn'),
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
        };

        // --- 3. 状态管理 ---
        const state = {
            chatHistory: [],
            memories: [],
            currentChatApi: null,
            currentChatStyle: CHAT_STYLES['dialogue'],
        };
        
        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
        const selectedApiKey = `${CHAT_DB_KEYS.CHAT_SELECTED_API}_${charId}`;
        const styleDbKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_style_${charId}`;
        const memoryDbKey = `relia-chat-memory_${charId}`;

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

        // 初始化各个子系统
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
            elements.sendBtn.disabled = !hasText;
            elements.respondBtn.disabled = false;
        }

        const handleSendMessage = createApiHandler({
            state, elements, character, user, historyKey, dbStorage,
            renderMessage, renderSystemMessage, loadAndRenderHistory, updateButtonStates
        });

        const expandInputLayout = () => {
            if (!elements.chatInputArea.classList.contains('input-focused')) {
                elements.chatInputArea.classList.add('input-focused');
                elements.sendButtonsContainer.classList.add('visible');
                updateButtonStates();
            }
        };

        const collapseInputLayout = () => {
            if (elements.chatInputArea.classList.contains('input-focused')) {
                elements.chatInputArea.classList.remove('input-focused');
                elements.sendButtonsContainer.classList.remove('visible');
            }
            elements.chatInputArea.classList.remove('emoji-expanded', 'actions-expanded');
        };

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
        
        if (elements.emojiToggleBtn) {
            elements.emojiToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.chatInputArea.classList.remove('actions-expanded');
                elements.chatInputArea.classList.toggle('emoji-expanded');
            });
        }

        if (elements.promptBtn) elements.promptBtn.addEventListener('click', () => alert('“快捷指令（闪电）”功能待开发'));
        if (elements.inspirationBtn) elements.inspirationBtn.addEventListener('click', () => alert('“灵感（灯泡）”功能待开发'));

        if (elements.workbenchBtn) {
            createChatPromptPanel({
                triggerElement: elements.workbenchBtn,
                container: document.body,
                charId: charId,
                onSave: (styleObject) => {
                    console.log('已保存默认风格:', styleObject.name);
                    state.currentChatStyle = styleObject;
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
            expandInputLayout();
            elements.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
        });
        document.addEventListener('click', (event) => {
            if (!elements.chatInputArea.contains(event.target)) collapseInputLayout();
        });

        // --- 7. 初始化页面 ---
        async function initializeChatState() {
            const savedStyleKey = await dbStorage.getItem(styleDbKey);
            if (savedStyleKey && CHAT_STYLES[savedStyleKey]) {
                state.currentChatStyle = CHAT_STYLES[savedStyleKey];
            }
            const savedApi = await dbStorage.getItem(selectedApiKey);
            if (savedApi) state.currentChatApi = savedApi;
            
            await loadAndRenderHistory();
            await renderMemoryCards();
            updateButtonStates();
            updateModelButtonText();

            const getChatHistory = () => state.chatHistory;
            const updateChatHistory = async (newHistory) => {
                state.chatHistory = newHistory;
                await dbStorage.setItem(historyKey, state.chatHistory);
                await loadAndRenderHistory();
            };
            initializeMessageMenu(elements.chatArea, getChatHistory, updateChatHistory);
        }
        await initializeChatState();

    } catch (error) {
        console.error("An error occurred during page initialization:", error);
        appContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">页面加载时发生严重错误，请查看控制台。</p>`;
    }
});