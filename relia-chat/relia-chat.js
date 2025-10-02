// relia-chat.js

import { dbStorage } from '../common/db.js';
import { createPageLayout } from '../common/template.js';

document.addEventListener('DOMContentLoaded', function() {

    // ==================== 1. 定义所有需要的 HTML 结构 ====================
    
    const chatPageContent = `
        <div id="chat-list-area">
            <p class="no-char-message">点击右上角羽毛笔按钮，选择角色开始聊天吧！ 👋</p>
        </div>
    `;

    const charSelectPanelHtml = `
        <div class="modal-overlay" id="char-select-overlay">
            <div class="modal-panel" id="char-select-panel">
                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="single-chat">选择单聊</button>
                    <button class="modal-tab disabled" data-tab="create-group">创建群聊</button>
                    <button class="modal-tab" data-tab="select-group">选择群聊</button>
                </div>
                <div class="modal-content-container">
                    <div class="modal-tab-content active" id="single-chat-content">
                        <div class="sheet-body-list" id="char-list-container"></div>
                    </div>
                    <div class="modal-tab-content" id="select-group-content">
                        <p class="no-char-message">此页面存放已创建的群聊（该功能尚未完成）</p>
                    </div>
                </div>
                <div class="sheet-footer">
                    <button class="sheet-btn sheet-btn-cancel" id="cancel-selection-btn">取消</button>
                    <button class="sheet-btn sheet-btn-confirm" id="confirm-selection-btn">确认</button>
                </div>
            </div>
        </div>
    `;

    // ==================== 2. 页面和面板的功能函数 ====================

    let ui; // 用来存放所有DOM元素的引用

    /**
     * ▼▼▼ 修改：渲染聊天列表的函数，以支持显示最新消息 ▼▼▼
     */
    function renderChatList(chatList) {
        const container = document.getElementById('chat-list-area');
        if (!container) return;

        if (!chatList || chatList.length === 0) {
            container.innerHTML = '<p class="no-char-message">还没有任何聊天哦，快去选择角色吧！</p>';
            return;
        }

        container.innerHTML = chatList.map(char => `
            <div class="chat-card" data-char-id="${char.id}">
                <img src="${char.avatar}" alt="${char.name}" class="chat-card-avatar">
                <div class="chat-card-main">
                    <div class="chat-card-name">${char.name || '未命名'}</div>
                    <div class="chat-card-preview">${char.lastMessage || '...'}</div>
                </div>
                <div class="chat-card-meta">
                    <div class="chat-card-time">10:30</div>
                    <div class="unread-badge">3</div>
                </div>
            </div>
        `).join('');
    }
    // ▲▲▲ 修改结束 ▲▲▲

    /**
     * ▼▼▼ 修改：加载并渲染初始聊天列表，增加获取最新消息的逻辑 ▼▼▼
     */
    async function loadAndRenderInitialChats() {
        const savedChatList = await dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [];
        if (savedChatList.length === 0) {
            renderChatList([]);
            return;
        }

        // 并行查询所有聊天列表的历史记录，以获取最后一条消息
        const enhancedChatList = await Promise.all(
            savedChatList.map(async (char) => {
                const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`;
                const history = await dbStorage.getItem(historyKey);
                
                if (history && history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    // 将最后一条消息附加到角色对象上
                    return { ...char, lastMessage: lastMsg.text };
                }
                return char; // 如果没有历史记录，返回原对象
            })
        );
        
        renderChatList(enhancedChatList);
    }
    // ▲▲▲ 修改结束 ▲▲▲

    function switchTab(targetTabId) {
        if (!ui) return;
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
        if (!ui) return;
        switchTab('single-chat');
        ui.listContainer.innerHTML = '<p class="no-char-message">正在加载角色...</p>';
        ui.overlay.classList.add('active');
        try {
            const charProfileData = await dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES);
            const characters = charProfileData || [];
            
            const currentChatList = await dbStorage.getItem(CHAT_DB_KEYS.ACTIVE_CHAT_LIST) || [];
            const currentChatIds = new Set(currentChatList.map(c => c.id));
            
            renderCharacterList(characters, currentChatIds);
        } catch (error) {
            console.error("加载角色数据失败:", error);
            ui.listContainer.innerHTML = '<p class="no-char-message">加载失败，请检查控制台。</p>';
        }
    }

    function renderCharacterList(characters, selectedIds = new Set()) {
        if (!ui) return;
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
        if (!ui) return;
        ui.overlay.classList.remove('active');
    }

    async function handleConfirm() {
        if (!ui) return;
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
        // 确认后，重新加载整个列表以获取最新消息
        await loadAndRenderInitialChats();
        closePanel();
    }

    // ==================== 3. 执行页面渲染和事件绑定 ====================

    createPageLayout({
        title: '聊天',
        contentHtml: chatPageContent,
        modalsHtml: charSelectPanelHtml,
        onFeatherClick: openCharacterSelector,
        onPageLoad: loadAndRenderInitialChats
    });

    ui = {
        overlay: document.getElementById('char-select-overlay'),
        listContainer: document.getElementById('char-list-container'),
        confirmBtn: document.getElementById('confirm-selection-btn'),
        cancelBtn: document.getElementById('cancel-selection-btn'),
        tabsContainer: document.querySelector('.modal-tabs'),
        tabs: document.querySelectorAll('.modal-tab'),
        tabContents: document.querySelectorAll('.modal-tab-content'),
        chatListArea: document.getElementById('chat-list-area')
    };

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

    if (ui.chatListArea) {
        ui.chatListArea.addEventListener('click', (event) => {
            const card = event.target.closest('.chat-card');
            if (card) {
                const charId = card.dataset.charId;
                if (charId) {
                    window.location.href = `./chat-room.html?id=${charId}`;
                }
            }
        });
    }
});