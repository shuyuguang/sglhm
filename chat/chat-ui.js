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
                    <div class="actions-menu-content">
                        <div class="actions-columns-container">
                            <!-- 左区 -->
                            <div class="actions-column">         
                                <button class="action-list-item"><i class="fa-regular fa-comments"></i><span>新聊天</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-folder-open"></i><span>管理文件</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-pen-ruler"></i><span>全局编辑</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-magnifying-glass"></i><span>查找记录</span></button>
                                <button class="action-list-item"><i class="fa-regular fa-star"></i><span>收藏</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-timeline"></i><span>时间线</span></button>
                                <button class="action-list-item" id="regenerate-btn"><i class="fa-solid fa-arrows-rotate"></i><span>重新生成</span></button>
                                <button class="action-list-item" id="continue-btn"><i class="fa-solid fa-forward"></i><span>继续</span></button>
                            </div>
                            <!-- 中区 -->
                            <div class="actions-column">
                                <button class="action-list-item"><i class="fa-solid fa-image"></i><span>图片</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-link"></i><span>链接</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-microphone"></i><span>语音</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-money-bill-transfer"></i><span>转账</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-gift"></i><span>礼物</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-phone"></i><span>通话</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-location-dot"></i><span>定位</span></button>
                                <button class="action-list-item"><i class="fa-solid fa-music"></i><span>听歌</span></button>
                            </div>
                            <!-- 右区 -->
                            <div class="actions-column">
                                <button class="action-list-item"><i class="fa-solid fa-location-crosshairs"></i><span>跳转楼层</span></button>
                            </div>
                        </div>
                    </div>
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
                <div class="emoji-picker-bar">
                    <!-- 表情选择器将由JS动态生成到这里 -->
                </div>
            </footer>
        </div>
    `;
}

// [新增] 一个简单的HTML转义函数，防止XSS攻击
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         // ▼▼▼ 核心修复：补全了对引号的转义 ▼▼▼
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
         // ▲▲▲ 修复结束 ▲▲▲
}


/**
 * 在聊天区域渲染一个完整的消息组（可能包含多个气泡）。
 * @param {object} messageGroup - 消息组对象。
 * @param {number} index - 消息组在历史记录中的索引。
 * @param {object} user - 当前用户对象。
 * @param {object} character - 当前角色对象。
 * @param {HTMLElement} chatArea - 聊天消息容器元素。
 */
export function renderMessageGroup(messageGroup, index, user, character, chatArea) {
    const { sender, type } = messageGroup; // <-- 新增 type
    
    const messageGroupContainer = document.createElement('div');
    messageGroupContainer.className = 'message-group-container';
    messageGroupContainer.dataset.index = index;

    if (sender === 'user') {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = user.avatar;

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;

        // ▼▼▼ 核心修改：根据消息类型渲染 ▼▼▼
        switch(type) {
            case 'text-photo':
                bubble.classList.add('is-image-message');
                bubble.innerHTML = `
                    <div class="photo-message-container">
                        <img src="https://i.postimg.cc/wBtdFsGF/tpybxmnh.jpg" alt="文字图" class="message-photo-img">
                       
                        <button class="text-photo-preview-btn" data-text="${escapeHtml(messageGroup.text)}" title="预览文字">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        
                    </div>
                `;
                break;
            case 'image':
    bubble.classList.add('is-image-message');
    // 核心修改：将图片用 a 标签包裹，点击可查看原图
    bubble.innerHTML = `
        <a href="${messageGroup.data}" target="_blank" title="点击查看大图">
            <img src="${messageGroup.data}" alt="用户图片" class="message-photo-img">
        </a>
    `;
    break;
            default: // 兼容旧的文本和表情消息
                if (messageGroup.isEmoji) {
                    bubble.classList.add('is-emoji-message');
                    bubble.innerHTML = `<img src="${messageGroup.data}" alt="emoji" class="message-emoji-img">`;
                } else {
                    bubble.textContent = messageGroup.text;
                }
                break;
        }
        // ▲▲▲ 修改结束 ▲▲▲

        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        messageGroupContainer.appendChild(messageRow);

    } else if (sender === 'character') {
        const activeReplyIndex = messageGroup.activeReplyIndex || 0;
        const currentReplyVersion = messageGroup.replyVersions[activeReplyIndex];

        // ▼▼▼ 核心修改：为AI的每个消息气泡添加 partIndex ▼▼▼
        currentReplyVersion.forEach((messagePart, partIndex) => {
            const { isEmoji, data, text } = messagePart;
            const messageRow = document.createElement('div');
            messageRow.className = `message-row ${sender}`;
            messageRow.dataset.partIndex = partIndex; // 添加部分索引
            
            const avatar = document.createElement('img');
            avatar.className = 'message-avatar';
            avatar.src = character.avatar;

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${sender}`;

            if (isEmoji) {
                bubble.classList.add('is-emoji-message');
                bubble.innerHTML = `<img src="${data}" alt="emoji" class="message-emoji-img">`;
            } else {
                bubble.textContent = text;
            }

            messageRow.appendChild(avatar);
            messageRow.appendChild(bubble);
            messageGroupContainer.appendChild(messageRow);
        });
        // ▲▲▲ 修改结束 ▲▲▲

        if (messageGroup.replyVersions.length > 1) {
            const pager = document.createElement('div');
            pager.className = 'reply-pager';
            pager.innerHTML = `
                <button class="pager-btn" data-action="prev" ${activeReplyIndex === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <span class="pager-text">${activeReplyIndex + 1} / ${messageGroup.replyVersions.length}</span>
                <button class="pager-btn" data-action="next" ${activeReplyIndex === messageGroup.replyVersions.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;
            messageGroupContainer.appendChild(pager);
        }
    }
    
    chatArea.appendChild(messageGroupContainer);
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