// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 获取角色ID和数据 (无变化) ---
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        document.body.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
        return;
    }

    const [allChars, allUsers, currentUserId] = await Promise.all([
        dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
    ]);

    const character = allChars ? allChars.find(c => c.id === charId) : null;
    if (!character) {
        document.body.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
        return;
    }
    
    const currentUser = allUsers ? allUsers.find(u => u.id === currentUserId) : null;
    const user = currentUser || { avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

    // --- 2. 动态生成页面HTML ---
    // ▼▼▼ 核心修改点：在操作栏中增加四个功能项 ▼▼▼
    const pageHtml = `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="char-info">
                    <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar">
                    <div class="char-info-text">
                        <span class="char-info-name">${character.name || '未命名'}</span>
                        <span class="char-info-status">在线</span>
                    </div>
                </div>
                <button class="chat-header-btn options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </header>
            <main class="chat-messages" id="chat-messages-area"></main>
            <footer class="chat-input-area" id="chat-input-area">
                <div class="chat-input-main">
                    <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                    <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                    <button id="send-btn" disabled><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div class="chat-actions-bar">
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-camera"></i></button><span>拍照</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-microphone"></i></button><span>音频</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-palette"></i></button><span>主题</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-money-bill-transfer"></i></button><span>转账</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-gift"></i></button><span>礼物</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-phone"></i></button><span>通话</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-location-dot"></i></button><span>位置</span></div>
                    <!-- ▼▼▼ 新增下面四个功能项 ▼▼▼ -->
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-save"></i></button><span>存档</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-file"></i></button><span>文件</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>清单</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>音乐</span></div>
                </div>
            </footer>
        </div>
    `;
    // ▲▲▲ 修改结束 ▲▲▲
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 (无变化) ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const optionsBtn = document.querySelector('.options-btn');
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // --- 4. 核心功能函数 (无变化) ---
    function renderMessage({ text, sender }) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = (sender === 'user') ? user.avatar : character.avatar;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (text) {
            const newMessage = { text, sender: 'user' };
            renderMessage(newMessage);
            chatHistory.push(newMessage);
            await dbStorage.setItem(historyKey, chatHistory);
            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    }
    
    async function loadAndRenderHistory() {
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory;
            chatHistory.forEach(message => renderMessage(message));
        } else {
            renderMessage({ text: '发送示例内容', sender: 'user' });
            renderMessage({ text: '回复示例内容', sender: 'character' });
        }
    }

    // --- 5. 绑定事件 (无变化) ---
    input.addEventListener('input', () => {
        sendBtn.disabled = input.value.trim().length === 0;
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
    sendBtn.addEventListener('click', sendMessage);

    if (optionsBtn) {
        optionsBtn.addEventListener('click', () => {
            window.location.href = `./chat-setting.html?id=${charId}`;
        });
    }

    if (actionsToggleBtn) {
        actionsToggleBtn.addEventListener('click', () => {
            chatInputArea.classList.toggle('actions-expanded');
        });
    }

    // --- 6. 初始化页面 (无变化) ---
    await loadAndRenderHistory();
});