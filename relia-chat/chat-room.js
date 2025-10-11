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

    // --- 2. 动态生成页面HTML (有修改) ---
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

                <div class="chat-input-main" id="chat-input-main">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                        <!-- ▼▼▼ 新增：发送按钮容器 ▼▼▼ -->
                        <div class="send-buttons-container" id="send-buttons-container">
                            <button id="respond-btn" class="send-action-btn">响应</button>
                            <button id="send-btn" class="send-action-btn primary">发送</button>
                        </div>
                        <!-- ▲▲▲ 新增结束 ▲▲▲ -->
                    </div>
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                    </div>
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
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-save"></i></button><span>存档</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-file"></i></button><span>文件</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>音乐</span></div>
                </div>
                
                <div class="emoji-picker-bar">
                    <div class="emoji-placeholder">表情面板功能待开发...</div>
                </div>
            </footer>
        </div>
    `;
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 (有修改) ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    const optionsBtn = document.querySelector('.options-btn');
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    // ▼▼▼ 新增：获取发送按钮相关元素 ▼▼▼
    const sendButtonsContainer = document.getElementById('send-buttons-container');
    const sendBtn = document.getElementById('send-btn');
    const respondBtn = document.getElementById('respond-btn');
    // ▲▲▲ 新增结束 ▲▲▲
    
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // --- 4. 核心功能函数 (有修改) ---
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

    // ▼▼▼ 新增：处理消息发送的函数 ▼▼▼
    async function handleSendMessage(actionType = 'send') {
        const text = input.value.trim();
        if (text === '') return;

        console.log(`按钮动作: ${actionType}, 内容: ${text}`);

        // 1. 渲染并保存用户消息
        const userMessage = { text, sender: 'user' };
        renderMessage(userMessage);
        chatHistory.push(userMessage);
        await dbStorage.setItem(historyKey, chatHistory);

        // 2. 清空输入框并重置状态
        input.value = '';
        input.style.height = '';
        sendButtonsContainer.classList.remove('visible');
        input.focus();

        // 3. 模拟角色回复
        setTimeout(async () => {
            const replyMessage = { text: `收到你的[${actionType}]消息: "${text}"`, sender: 'character' };
            renderMessage(replyMessage);
            chatHistory.push(replyMessage);
            await dbStorage.setItem(historyKey, chatHistory);
        }, 800);
    }
    // ▲▲▲ 新增结束 ▲▲▲

    // --- 5. 绑定事件 (有修改) ---
    input.addEventListener('input', () => {
        // ▼▼▼ 修改：根据输入内容显隐发送按钮 ▼▼▼
        if (input.value.trim() === '') {
            input.style.height = '';
            sendButtonsContainer.classList.remove('visible');
        } else {
            input.style.height = 'auto';
            input.style.height = (input.scrollHeight) + 'px';
            sendButtonsContainer.classList.add('visible');
        }
        // ▲▲▲ 修改结束 ▲▲▲
    });

    // ▼▼▼ 新增：为发送和响应按钮绑定事件 ▼▼▼
    if (sendBtn) {
        sendBtn.addEventListener('click', () => handleSendMessage('发送'));
    }
    if (respondBtn) {
        respondBtn.addEventListener('click', () => handleSendMessage('响应'));
    }
    // ▲▲▲ 新增结束 ▲▲▲

    if (optionsBtn) {
        optionsBtn.addEventListener('click', () => {
            window.location.href = `./chat-setting.html?id=${charId}`;
        });
    }

    if (actionsToggleBtn) {
        actionsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatInputArea.classList.remove('emoji-expanded');
            chatInputArea.classList.toggle('actions-expanded');
        });
    }
    
    if (emojiToggleBtn) {
        emojiToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatInputArea.classList.remove('actions-expanded');
            chatInputArea.classList.toggle('emoji-expanded');
        });
    }

    const expandInputLayout = () => {
        if (!chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.add('input-focused');
        }
    };

    const collapseInputLayout = () => {
        if (chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.remove('input-focused');
        }
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    };
    
    input.addEventListener('focus', () => {
        expandInputLayout();
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    });

    document.addEventListener('click', (event) => {
        if (!chatInputArea.contains(event.target)) {
            collapseInputLayout();
        }
    });

    // --- 6. 初始化页面 (无变化) ---
    await loadAndRenderHistory();
});