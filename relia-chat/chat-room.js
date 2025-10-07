// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 获取角色ID和数据 (这部分保持不变) ---
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

    // --- 2. 动态生成页面HTML (这部分保持不变) ---
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
            <footer class="chat-input-area">
                <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                <button id="send-btn" disabled><i class="fa-solid fa-paper-plane"></i></button>
            </footer>
        </div>
    `;
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    // ▼▼▼ 修复：在这里获取三点图标按钮 ▼▼▼
    const optionsBtn = document.querySelector('.options-btn');
    // ▲▲▲ 修复结束 ▲▲▲
    
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // --- 4. 核心功能函数 (保持不变) ---
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

    // --- 5. 绑定事件 ---
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

    // ▼▼▼ 修复：现在这里的 optionsBtn 已经是定义好的了 ▼▼▼
    if (optionsBtn) {
        optionsBtn.addEventListener('click', () => {
            window.location.href = `./chat-setting.html?id=${charId}`;
        });
    }
    // ▲▲▲ 修复结束 ▲▲▲

    // --- 6. 初始化页面 ---
    await loadAndRenderHistory();
});