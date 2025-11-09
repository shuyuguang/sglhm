// 文件名: relia-chat/chat-ui.js

// ... (renderChatRoomUI function remains unchanged)

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function renderMessageGroup(messageGroup, index, user, character, chatArea) {
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
                const imageUrl = messageGroup.renderData || messageGroup.data;
                bubble.innerHTML = `
                    <a href="${imageUrl}" target="_blank" title="点击查看大图">
                        <img src="${imageUrl}" alt="用户图片" class="message-photo-img">
                    </a>
                `;
                break;
            // ▼▼▼ 新增：渲染链接卡片 ▼▼▼
            case 'link':
                bubble.classList.add('is-link-message');
                bubble.innerHTML = `
                    <a href="${escapeHtml(messageGroup.url)}" target="_blank" class="link-card-container">
                        ${messageGroup.image ? `
                        <div class="link-card-image">
                            <img src="${escapeHtml(messageGroup.image)}" alt="Link preview">
                        </div>` : ''}
                        <div class="link-card-text">
                            <div class="link-card-title">${escapeHtml(messageGroup.title)}</div>
                            <div class="link-card-description">${escapeHtml(messageGroup.description)}</div>
                        </div>
                    </a>
                `;
                break;
            // ▲▲▲ 新增结束 ▲▲▲
            default:
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

            // ▼▼▼ 新增：渲染AI回复的链接卡片 ▼▼▼
            if (messagePart.type === 'link') {
                bubble.classList.add('is-link-message');
                bubble.innerHTML = `
                    <a href="${escapeHtml(messagePart.url)}" target="_blank" class="link-card-container">
                         ${messagePart.image ? `
                        <div class="link-card-image">
                            <img src="${escapeHtml(messagePart.image)}" alt="Link preview">
                        </div>` : ''}
                        <div class="link-card-text">
                            <div class="link-card-title">${escapeHtml(messagePart.title)}</div>
                            <div class="link-card-description">${escapeHtml(messagePart.description)}</div>
                        </div>
                    </a>
                `;
            } // ▲▲▲ 新增结束 ▲▲▲
            else if (messagePart.isEmoji) {
                bubble.classList.add('is-emoji-message');
                bubble.innerHTML = `<img src="${messagePart.data}" alt="emoji" class="message-emoji-img">`;
            } else {
                bubble.textContent = messagePart.text;
            }

            messageRow.appendChild(avatar);
            messageRow.appendChild(bubble);
            messageGroupContainer.appendChild(messageRow);
        });

        if (messageGroup.replyVersions.length > 1) {
            const pager = document.createElement('div');
            pager.className = 'reply-pager';
            pager.innerHTML = `
                <button class="pager-btn" data-action="prev" ${activeReplyIndex === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
                <span class="pager-text">${activeReplyIndex + 1} / ${messageGroup.replyVersions.length}</span>
                <button class="pager-btn" data-action="next" ${activeReplyIndex === messageGroup.replyVersions.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
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