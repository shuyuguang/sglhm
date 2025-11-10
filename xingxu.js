// xingxu.js

import { dbStorage } from './common/db.js';
import { PROFILE_DB_KEYS } from './config/profile.config.js';
import { CHAT_DB_KEYS } from './config/chat.config.js';

document.addEventListener('DOMContentLoaded', function() {

    // ==================== 1. UI 元素引用 ====================
    let ui = {
        // Tab切换相关
        tabItems: document.querySelectorAll('.tab-item'),
        pages: document.querySelectorAll('.page'),
        
        // 聊天列表相关
        addChatBtn: document.getElementById('add-chat-btn'),
        chatListArea: document.getElementById('chat-list-area'),

        // 角色选择面板相关
        overlay: document.getElementById('char-select-overlay'),
        listContainer: document.getElementById('char-list-container'),
        confirmBtn: document.getElementById('confirm-selection-btn'),
        cancelBtn: document.getElementById('cancel-selection-btn'),
        tabsContainer: document.querySelector('.modal-tabs'),
        tabs: document.querySelectorAll('.modal-tab'),
        tabContents: document.querySelectorAll('.modal-tab-content')
    };

    // ==================== 2. 功能函数 (大部分来自 relia-chat.js) ====================

    function renderChatList(chatList) {
        if (!ui.chatListArea) return;

        if (!chatList || chatList.length === 0) {
            ui.chatListArea.innerHTML = '<p class="no-char-message">点击右上角加号按钮，选择角色开始聊天吧！ 👋</p>';
            return;
        }

        ui.chatListArea.innerHTML = chatList.map(char => `
            <div class="chat-card" data-char-id="${char.id}">
                <img src="${char.avatar}" alt="${char.name}" class="chat-card-avatar">
                <div class="chat-card-main">
                    <div class="chat-card-name">${char.name || '未命名'}</div>
                    <div class="chat-card-preview">${char.lastMessage || '...'}</div>
                </div>
                <div class="chat-card-meta">
                    <div class="chat-card-time"></div>
                    <!-- <div class="unread-badge">1</div> -->
                </div>
            </div>
        `).join('');
    }

    async function loadAndRenderInitialChats() {
        const [savedChatList, allCharProfiles] = await Promise.all([
            dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [],
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || []
        ]);

        if (savedChatList.length === 0) {
            renderChatList([]);
            return;
        }

        const profileMap = new Map(allCharProfiles.map(p => [p.id, p]));
        let hasChanges = false;

        const syncedChatList = savedChatList.map(chat => {
            const latestProfile = profileMap.get(chat.id);
            if (latestProfile && (chat.name !== latestProfile.name || chat.avatar !== latestProfile.avatar)) {
                hasChanges = true;
                return { ...chat, name: latestProfile.name, avatar: latestProfile.avatar };
            }
            return chat;
        });

        if (hasChanges) {
            await dbStorage.setItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST, syncedChatList);
        }

        const enhancedChatList = await Promise.all(
            syncedChatList.map(async (char) => {
                const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`;
                const history = await dbStorage.getItem(historyKey);
                
                if (history && history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    let previewText = '';
                    if (lastMsg.text) {
                        previewText = lastMsg.text;
                    } else if (lastMsg.isEmoji) {
                        previewText = `[${lastMsg.name}]`;
                    } else if (lastMsg.type === 'image') {
                        previewText = '[图片]';
                    } else if (lastMsg.type === 'link') {
                        previewText = `[链接] ${lastMsg.title}`;
                    }
                    return { ...char, lastMessage: previewText };
                }
                return char;
            })
        );
        
        renderChatList(enhancedChatList);
    }

    function switchTab(targetTabId) {
        ui.tabs.forEach(tab => tab.classList.remove('active'));
        ui.tabContents.forEach(content => content.classList.remove('active'));
        const targetTab = document.querySelector(`.modal-tab[data-tab="${targetTabId}"]`);
        const targetContent = document.getElementById(`${targetTabId}-content`);
        if (targetTab && targetContent) {
            targetTab.classList.add('active');
            targetContent.classList.add('active');
        }
        ui.confirmBtn.style.display = (targetTabId === 'single-chat') ? '' : 'none';
    }

    async function openCharacterSelector() {
        switchTab('single-chat');
        ui.listContainer.innerHTML = '<p class="no-char-message">正在加载角色...</p>';
        ui.overlay.classList.add('active');
        try {
            const characters = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
            const currentChatList = await dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [];
            const currentChatIds = new Set(currentChatList.map(c => c.id));
            renderCharacterList(characters, currentChatIds);
        } catch (error) {
            console.error("加载角色数据失败:", error);
            ui.listContainer.innerHTML = '<p class="no-char-message">加载失败，请检查控制台。</p>';
        }
    }

    function renderCharacterList(characters, selectedIds = new Set()) {
        if (!characters || characters.length === 0) {
            ui.listContainer.innerHTML = '<p class="no-char-message">还没有创建任何TA角色哦</p>';
            return;
        }
        ui.listContainer.innerHTML = characters.map(char => {
            const isChecked = selectedIds.has(char.id) ? 'checked' : '';
            return `
                <div class="char-item" data-char-id="${char.id}">
                    <img src="${char.avatar}" alt="${char.name}" class="avatar">
                    <span class="name">${char.name || '未命名'}</span>
                    <input type="checkbox" data-id="${char.id}" data-name="${char.name}" data-avatar="${char.avatar}" ${isChecked}>
                </div>`;
        }).join('');
    }

    function closePanel() {
        ui.overlay.classList.remove('active');
    }

    async function handleConfirm() {
        const selectedChars = [];
        const checkboxes = ui.listContainer.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(box => {
            selectedChars.push({ 
                id: box.dataset.id, 
                name: box.dataset.name,
                avatar: box.dataset.avatar
            });
        });
        
        await dbStorage.setItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST, selectedChars);
        await loadAndRenderInitialChats();
        closePanel();
    }
    
    // ==================== 3. 事件绑定 ====================

    // 底部Tab切换逻辑
    ui.tabItems.forEach(tab => {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const currentActiveTab = document.querySelector('.tab-item.active');
            if (currentActiveTab === this) return;
            const targetPageId = this.getAttribute('data-page');

            ui.tabItems.forEach(item => item.classList.remove('active'));
            this.classList.add('active');

            ui.pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetPageId).classList.add('active');
        });
    });

    // 聊天选择面板相关事件
    ui.addChatBtn.addEventListener('click', openCharacterSelector);
    ui.cancelBtn.addEventListener('click', closePanel);
    ui.confirmBtn.addEventListener('click', handleConfirm);
    ui.overlay.addEventListener('click', (event) => {
        if (event.target === ui.overlay) closePanel();
    });
    ui.listContainer.addEventListener('click', (event) => {
        const targetItem = event.target.closest('.char-item');
        if (targetItem) {
            const checkbox = targetItem.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = !checkbox.checked;
        }
    });
    ui.tabsContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('modal-tab') && !target.classList.contains('disabled')) {
            switchTab(target.dataset.tab);
        }
    });

    // 聊天列表点击进入聊天室
    if (ui.chatListArea) {
        ui.chatListArea.addEventListener('click', (event) => {
            const card = event.target.closest('.chat-card');
            if (card) {
                const charId = card.dataset.charId;
                if (charId) {
                    // [!] 核心改动：路径指向新的 chat/ 文件夹
                    window.location.href = `./chat/chat-room.html?id=${charId}`;
                }
            }
        });
    }

    // ==================== 4. 页面初始化 ====================
    loadAndRenderInitialChats();
});