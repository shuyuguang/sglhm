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
    
    // ▼▼▼ 新增：定义聊天记录的唯一键名和内存中的聊天记录数组 ▼▼▼
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];
    // ▲▲▲ 新增结束 ▲▲▲

    // --- 4. 核心功能函数 ---
    
    // renderMessage 函数保持不变
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

    /**
     * ▼▼▼ 修改：发送消息的函数，增加保存功能 ▼▼▼
     */
    async function sendMessage() {
        const text = input.value.trim();
        if (text) {
            const newMessage = { text, sender: 'user' };
            renderMessage(newMessage); // 1. 渲染到屏幕

            // 2. 更新内存中的历史记录
            chatHistory.push(newMessage);
            
            // 3. 将最新的历史记录完整保存到数据库
            await dbStorage.setItem(historyKey, chatHistory);

            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    }
    
    /**
     * ▼▼▼ 新增：加载并渲染历史消息的函数 ▼▼▼
     */
    async function loadAndRenderHistory() {
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory; // 从数据库加载到内存
            chatHistory.forEach(message => renderMessage(message));
        } else {
            // 如果没有历史记录，才显示示例消息
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

    // ▼▼▼ 新增：为三点图标按钮添加点击事件 ▼▼▼
    if (optionsBtn) {
        optionsBtn.addEventListener('click', () => {
            // 跳转到设置页面，并带上角色ID
            window.location.href = `./chat-setting.html?id=${charId}`;
        });
    }
    // ▲▲▲ 新增结束 ▲▲▲

    // --- 6. 初始化页面 ---
    await loadAndRenderHistory(); // 执行加载函数
});