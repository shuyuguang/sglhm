// xingxu-spa.js

import { dbStorage } from './common/db.js';
import { PROFILE_DB_KEYS } from './config/profile.config.js';
import { CHAT_DB_KEYS } from './config/chat.config.js';
import { initializeAndOpenChatRoom, closeChatRoom } from './achat/chat-room-spa.js';

document.addEventListener('DOMContentLoaded', function() {

    let ui = {
        // 主页面元素
        tabItems: document.querySelectorAll('.tab-item'),
        mainPages: document.querySelectorAll('.content-container > .page'),
        chatListArea: document.getElementById('chat-list-area'),
        sideMenuBtn: document.getElementById('side-menu-trigger-btn'),
        gameRedirectBtn: document.getElementById('game-redirect-btn'),
        addChatBtn: document.getElementById('add-chat-btn'),
        sideMenuOverlay: document.getElementById('side-menu-overlay'),
        
        // 新增：添加聊天页面元素
        addChatPage: document.getElementById('add-chat-page'),
        backToChatListBtn: document.getElementById('back-to-chat-list-btn'),
        saveChatSelectionBtn: document.getElementById('save-chat-selection-btn'),
        addChatTabs: document.querySelectorAll('.add-chat-tab'),
        addChatTabContents: document.querySelectorAll('.add-chat-tab-content'),
        addFriendsListContainer: document.getElementById('add-friends-list-container'),
    };
    
    function openSideMenu() {
        if (ui.sideMenuOverlay) ui.sideMenuOverlay.classList.add('active');
    }

    function closeSideMenu() {
        if (ui.sideMenuOverlay) ui.sideMenuOverlay.classList.remove('active');
    }

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
                <div class="chat-card-meta"><div class="chat-card-time"></div></div>
            </div>
        `).join('');
    }

    async function loadAndRenderInitialChats() {
        const [savedChatList, allCharProfiles] = await Promise.all([
            dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [],
            dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || []
        ]);
        if (savedChatList.length === 0) { renderChatList([]); return; }
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
        if (hasChanges) await dbStorage.setItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST, syncedChatList);
        const enhancedChatList = await Promise.all(
            syncedChatList.map(async (char) => {
                const history = await dbStorage.getItem(`${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`);
                if (history && history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    let previewText = '';
                    if (lastMsg.text) previewText = lastMsg.text;
                    else if (lastMsg.isEmoji) previewText = `[${lastMsg.name}]`;
                    else if (lastMsg.type === 'image') previewText = '[图片]';
                    else if (lastMsg.type === 'link') previewText = `[链接] ${lastMsg.title}`;
                    return { ...char, lastMessage: previewText };
                }
                return char;
            })
        );
        renderChatList(enhancedChatList);
    }
    
    // --- 新页面逻辑 ---
    
    async function openAddChatPage() {
        ui.addChatPage.classList.add('active');
        ui.addFriendsListContainer.innerHTML = '<p class="no-char-message">正在加载角色...</p>';
        
        try {
            const characters = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES) || [];
            const currentChatList = await dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [];
            const currentChatIds = new Set(currentChatList.map(c => c.id));
            renderCharacterList(characters, currentChatIds);
        } catch (error) {
            console.error("加载角色数据失败:", error);
            ui.addFriendsListContainer.innerHTML = '<p class="no-char-message">加载失败，请检查控制台。</p>';
        }
    }

    function closeAddChatPage() {
        ui.addChatPage.classList.remove('active');
    }

    function renderCharacterList(characters, selectedIds = new Set()) {
        if (!characters || characters.length === 0) {
            ui.addFriendsListContainer.innerHTML = '<p class="no-char-message">还没有创建任何TA角色哦</p>';
            return;
        }
        ui.addFriendsListContainer.innerHTML = characters.map(char => {
            const isChecked = selectedIds.has(char.id) ? 'checked' : '';
            return `
                <div class="char-item" data-char-id="${char.id}">
                    <img src="${char.avatar}" alt="${char.name}" class="avatar">
                    <span class="name">${char.name || '未命名'}</span>
                    <input type="checkbox" data-id="${char.id}" data-name="${char.name}" data-avatar="${char.avatar}" ${isChecked}>
                </div>`;
        }).join('');
    }

    async function handleSaveSelection() {
        const selectedChars = [];
        const checkboxes = ui.addFriendsListContainer.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(box => {
            selectedChars.push({ id: box.dataset.id, name: box.dataset.name, avatar: box.dataset.avatar });
        });
        await dbStorage.setItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST, selectedChars);
        await loadAndRenderInitialChats();
        closeAddChatPage();
    }
    
    function switchAddChatTab(targetTabId) {
        ui.addChatTabs.forEach(tab => tab.classList.remove('active'));
        ui.addChatTabContents.forEach(content => content.classList.remove('active'));
        
        const targetTab = document.querySelector(`.add-chat-tab[data-tab="${targetTabId}"]`);
        const targetContent = document.getElementById(targetTabId);
        
        if (targetTab && targetContent) {
            targetTab.classList.add('active');
            targetContent.classList.add('active');
        }
    }

    // --- 事件绑定 ---
    ui.tabItems.forEach(tab => tab.addEventListener('click', function(e) {
        e.preventDefault();
        const currentActiveTab = document.querySelector('.tab-item.active');
        if (currentActiveTab === this) return;
        const targetPageId = this.getAttribute('data-page');
        ui.tabItems.forEach(item => item.classList.remove('active'));
        this.classList.add('active');
        ui.mainPages.forEach(page => page.classList.remove('active'));
        document.getElementById(targetPageId).classList.add('active');
    }));

    if (ui.sideMenuBtn) ui.sideMenuBtn.addEventListener('click', openSideMenu);
    if (ui.sideMenuOverlay) ui.sideMenuOverlay.addEventListener('click', (e) => {
        if (e.target === ui.sideMenuOverlay) closeSideMenu();
    });
    if (ui.gameRedirectBtn) ui.gameRedirectBtn.addEventListener('click', () => { window.location.href = 'felotus.html'; });

    // 绑定新页面事件
    ui.addChatBtn.addEventListener('click', openAddChatPage);
    ui.backToChatListBtn.addEventListener('click', closeAddChatPage);
    ui.saveChatSelectionBtn.addEventListener('click', handleSaveSelection);

    ui.addFriendsListContainer.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.char-item');
        if (targetItem) {
            const checkbox = targetItem.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = !checkbox.checked;
        }
    });

    ui.addChatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchAddChatTab(tab.dataset.tab);
        });
    });

    if (ui.chatListArea) {
        ui.chatListArea.addEventListener('click', (event) => {
            const card = event.target.closest('.chat-card');
            if (card) {
                const charId = card.dataset.charId;
                if (charId) {
                    initializeAndOpenChatRoom(charId);
                }
            }
        });
    }

    document.addEventListener('refreshChatList', loadAndRenderInitialChats);

    loadAndRenderInitialChats();
});