// 文件名: relia-chat/chat-ui.js

/**
 * 根据角色和用户信息生成聊天室的核心HTML结构。
 * @param {object} character - 角色对象。
 * @returns {string} - 聊天室的innerHTML字符串。
 */
export function renderChatRoomUI(character) {
    // ... (此函数保持不变) ...
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

// ... (escapeHtml 函数保持不变) ...
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}


export function renderMessageGroup(messageGroup, index, user, character) {
    // ... (前面的代码保持不变, 直到 bubble.innerHTML) ...
    const { sender, type } = messageGroup; 
    
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
                const imageUrl = messageGroup.renderData;
                const imageTitle = messageGroup.source === 'local' ? `本地图片: ${messageGroup.filename}` : `网络图片: ${messageGroup.url}`;
                const imageAlt = messageGroup.filename || '用户图片';
                
                bubble.innerHTML = `
                    <a href="${imageUrl}" target="_blank" title="${imageTitle} (点击查看大图)">
                        <img src="${imageUrl}" alt="${imageAlt}" class="message-photo-img">
                    </a>
                `;
                break;
            case 'link':
                bubble.classList.add('is-link-message');
                const { title, body, source, image } = messageGroup;
                
                let imageHtml = '';
                if (image) {
                     let imageContent = '';
                     if (image.type === 'text-photo') {
                        imageContent = `<div class="link-card-image text-photo">${escapeHtml(image.text)}</div>`;
                    } else if (image.type === 'image') {
                        // ▼▼▼ 核心修复：确保这里优先使用 renderData ▼▼▼
                        const linkImageUrl = image.renderData || (image.source === 'url' ? image.url : '');
                        imageContent = `<img src="${linkImageUrl}" class="link-card-image">`;
                        // ▲▲▲ 修复结束 ▲▲▲
                    }
                    imageHtml = `<div class="link-card-image-wrapper">${imageContent}</div>`;
                }

                bubble.innerHTML = `
                    <div class="link-card-container">
                        <div class="link-card-title">${escapeHtml(title)}</div>
                        <div class="link-card-main">
                            <div class="link-card-body">${escapeHtml(body)}</div>
                            ${imageHtml}
                        </div>
                        ${source ? `<div class="link-card-footer">${escapeHtml(source)}</div>` : ''}
                    </div>
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

        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        messageGroupContainer.appendChild(messageRow);

    } else if (sender === 'character') {
        const activeReplyIndex = messageGroup.activeReplyIndex || 0;
        const currentReplyVersion = messageGroup.replyVersions[activeReplyIndex];

        currentReplyVersion.forEach((messagePart, partIndex) => {
            const messageRow = document.createElement('div');
            messageRow.className = `message-row ${sender}`;
            messageRow.dataset.partIndex = partIndex; 
            
            const avatar = document.createElement('img');
            avatar.className = 'message-avatar';
            avatar.src = character.avatar;

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${sender}`;
            
            // ▼▼▼ 核心修复：确保AI回复的链接卡片也能正确显示图片 ▼▼▼
            if (messagePart.type === 'link') {
                bubble.classList.add('is-link-message');
                const { title, body, source, image } = messagePart;
                
                let imageHtml = '';
                if (image) {
                     let imageContent = '';
                     if (image.type === 'text-photo') {
                        imageContent = `<div class="link-card-image text-photo">${escapeHtml(image.text)}</div>`;
                    } else if (image.type === 'image') {
                        // AI生成的图片总是 base64 data URL
                        imageContent = `<img src="${image.data}" class="link-card-image">`;
                    }
                    imageHtml = `<div class="link-card-image-wrapper">${imageContent}</div>`;
                }

                bubble.innerHTML = `
                    <div class="link-card-container">
                        <div class="link-card-title">${escapeHtml(title)}</div>
                        <div class="link-card-main">
                            <div class="link-card-body">${escapeHtml(body)}</div>
                            ${imageHtml}
                        </div>
                        ${source ? `<div class="link-card-footer">${escapeHtml(source)}</div>` : ''}
                    </div>
                `;
            } else if (messagePart.isEmoji) {
                bubble.classList.add('is-emoji-message');
                bubble.innerHTML = `<img src="${messagePart.data}" alt="emoji" class="message-emoji-img">`;
            } else {
                bubble.textContent = messagePart.text;
            }
            // ▲▲▲ 修复结束 ▲▲▲

            messageRow.appendChild(avatar);
            messageRow.appendChild(bubble);
            messageGroupContainer.appendChild(messageRow);
        });


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
    
    return messageGroupContainer;
}

// ... (renderSystemMessage 函数保持不变) ...
export function renderSystemMessage(text, type = 'loading', chatArea) {
    const messageRow = document.createElement('div');
    messageRow.className = `message-row system ${type}`;
    messageRow.innerHTML = `<div class="chat-bubble system">${text}</div>`;
    chatArea.appendChild(messageRow);
    chatArea.scrollTop = chatArea.scrollHeight;
    return messageRow;
}