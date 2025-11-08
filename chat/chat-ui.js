// 文件名: relia-chat/chat-ui.js

/**
 * 根据角色和用户信息生成聊天室的核心HTML结构。
 * @param {object} character - 角色对象。
 * @returns {string} - 聊天室的innerHTML字符串。
 */
export function renderChatRoomUI(character) {
    return `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="chat-header-center">
                    <div class="char-info">
                        <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar">
                        <div class="char-info-text">
                            <span class="char-info-name">${character.name || '未命名'}</span>
                            <span class="char-info-status">在线</span>
                        </div>
                    </div>
                </div>
                <button class="chat-header-btn" id="menu-btn"><i class="fa-solid fa-bars"></i></button>
            </header>
            <main class="chat-messages" id="chat-messages-area"></main>
            <footer class="chat-input-area" id="chat-input-area">
                <div class="actions-menu" id="actions-menu">
                    <!-- ▼▼▼ 核心修改：移除了Tab栏和其它面板，只保留核心动作网格 ▼▼▼ -->
                    <div class="actions-menu-content" id="actions-menu-content">
                        <div id="menu-content-actions" class="actions-menu-pane active">
                            <div class="actions-grid-container">
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-camera"></i></button><span>拍照</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-microphone"></i></button><span>音频</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-palette"></i></button><span>主题</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>
                                <div class="action-item"><button class="action-btn" id="edit-settings-btn"><i class="fa-solid fa-pencil"></i></button><span>编辑</span></div>
                                <div class="action-item"><button class="action-btn" id="search-history-btn"><i class="fa-solid fa-brain"></i></button><span>数据</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-money-bill-transfer"></i></button><span>转账</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-sack-dollar"></i></button><span>收款</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-gift"></i></button><span>礼物</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-phone"></i></button><span>通话</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-location-dot"></i></button><span>位置</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>听歌</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-calendar-check"></i></button><span>打卡</span></div>
                                <div class="action-item"><button class="action-btn"><i class="fa-solid fa-link"></i></button><span>接龙</span></div>
                            </div>
                        </div>
                    </div>
                    <!-- ▲▲▲ 修改结束 ▲▲▲ -->
                </div>
                <div class="chat-input-main" id="chat-input-main">
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <div class="chat-input-wrapper" id="chat-input-wrapper">
                            <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                        </div>
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                        <div class="send-buttons-container" id="send-buttons-container">
                            <button id="respond-btn" class="send-action-btn"><i class="fa-regular fa-paper-plane"></i></button>
                            <button id="send-btn" class="send-action-btn primary"><i class="fa-solid fa-location-arrow"></i></button>
                        </div>
                    </div>
                </div>
                <!-- [修改] 填充底部表情选择面板 -->
                <div class="emoji-picker-bar">
                    <!-- 表情选择器将由JS动态生成到这里 -->
                </div>
            </footer>
        </div>
    `;
}

/**
 * 在聊天区域渲染一条消息。
 * @param {object} message - 消息对象 { text, sender, isEmoji, data }。
 * @param {number} index - 消息在历史记录中的索引。
 * @param {object} user - 当前用户对象。
 * @param {object} character - 当前角色对象。
 * @param {HTMLElement} chatArea - 聊天消息容器元素。
 * @returns {HTMLElement} - 创建的消息气泡元素。
 */
export function renderMessage(message, index, user, character, chatArea) {
    const { sender, isEmoji, data, text } = message;

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender}`;
    messageRow.dataset.index = index;

    const avatar = document.createElement('img');
    avatar.className = 'message-avatar';
    avatar.src = (sender === 'user') ? user.avatar : character.avatar;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    // [修改] 核心修改：判断是否为表情消息
    if (isEmoji) {
        bubble.classList.add('is-emoji-message');
        bubble.innerHTML = `<img src="${data}" alt="emoji" class="message-emoji-img">`;
    } else {
        bubble.textContent = text;
    }

    messageRow.appendChild(avatar);
    messageRow.appendChild(bubble);

    chatArea.appendChild(messageRow);
    chatArea.scrollTop = chatArea.scrollHeight;
    return bubble;
}


/**
 * 在聊天区域渲染一条系统消息（如加载中、错误提示）。
 * @param {string} text - 消息文本。
 * @param {string} type - 消息类型 ('loading', 'error', etc.)。
 * @param {HTMLElement} chatArea - 聊天消息容器元素。
 * @returns {HTMLElement} - 创建的消息行元素。
 */
export function renderSystemMessage(text, type = 'loading', chatArea) {
    const messageRow = document.createElement('div');
    messageRow.className = `message-row system ${type}`;
    messageRow.innerHTML = `<div class="chat-bubble system">${text}</div>`;
    chatArea.appendChild(messageRow);
    chatArea.scrollTop = chatArea.scrollHeight;
    return messageRow;
}