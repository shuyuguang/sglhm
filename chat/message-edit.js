// relia-chat/message-edit.js

const LONG_PRESS_THRESHOLD = 400; // 长按阈值，单位：毫秒

let longPressTimer = null;
let isLongPress = false;

// HTML转义函数，确保安全
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * 初始化消息长按和单击事件处理。
 * @param {HTMLElement} container - 消息列表的容器元素 (chatArea)。
 * @param {function} getChatHistory - 一个返回当前聊天历史数组的函数。
 * @param {function} updateChatHistory - 一个用新历史数组更新状态和UI的函数。
 * @param {function} getEmojis - 一个返回当前所有可用表情包数组的函数。
 */
export function initializeMessageMenu(container, getChatHistory, updateChatHistory, getEmojis) {
    const menuOverlay = document.getElementById('message-menu-overlay');
    const menu = document.getElementById('message-menu');

    if (!container || !menuOverlay || !menu) {
        console.warn('消息菜单所需的一个或多个 DOM 元素未找到。');
        return;
    }

    container.addEventListener('mousedown', (e) => {
        const bubble = e.target.closest('.chat-bubble');
        if (!bubble) return;
        isLongPress = false; 
        longPressTimer = setTimeout(() => { isLongPress = true; }, LONG_PRESS_THRESHOLD);
    });

    container.addEventListener('mouseup', (e) => {
        clearTimeout(longPressTimer);
        const bubble = e.target.closest('.chat-bubble');
        
        if (e.target.closest('.text-photo-preview-btn')) {
            return;
        }
        
        if (!bubble || bubble.classList.contains('editing')) return;
        
        // ▼▼▼ [核心修改] 区分链接卡片和其他消息的菜单触发方式 ▼▼▼
        const isLinkCard = bubble.classList.contains('is-link-message');

        // 如果是链接卡片，但不是长按 -> 阻止菜单
        // 如果不是链接卡片，但是长按 -> 阻止菜单
        if (isLinkCard !== isLongPress) {
            isLongPress = false; // 重置状态
            return;
        }
        // ▲▲▲ [核心修改] 结束 ▲▲▲

        e.preventDefault();
        
        const messageGroup = bubble.closest('.message-group-container');
        if (!messageGroup) return;
        const index = parseInt(messageGroup.dataset.index, 10);
        const messageRow = bubble.closest('.message-row');
        const partIndex = messageRow && messageRow.dataset.partIndex ? parseInt(messageRow.dataset.partIndex, 10) : -1;
        
        showMenu(e, index, partIndex, bubble, getChatHistory, updateChatHistory, getEmojis);
    });

    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) hideMenu();
    });
}

/**
 * 显示操作菜单。
 */
function showMenu(event, index, partIndex, bubble, getChatHistory, updateChatHistory, getEmojis) {
    const menu = document.getElementById('message-menu');
    const menuOverlay = document.getElementById('message-menu-overlay');
    const chatHistory = getChatHistory();
    const messageData = chatHistory[index];

    if (!messageData) return;

    let canCopy = false;
    let canEdit = false;
    let textToCopy = '';
    let currentPart = null;

    if (messageData.sender === 'user') {
        currentPart = messageData;
    } else if (messageData.sender === 'character' && partIndex !== -1) {
        const activeVersion = messageData.replyVersions[messageData.activeReplyIndex];
        currentPart = activeVersion ? activeVersion[partIndex] : null;
    }
    
    if (currentPart) {
        switch(currentPart.type) {
            case 'text-photo':
                textToCopy = `[Photo: ${currentPart.text}]`;
                canCopy = true;
                canEdit = true;
                break;
            case 'image':
                canCopy = false;
                canEdit = false;
                break;
            // ▼▼▼ [核心修改] 禁用链接卡片的编辑和复制功能 ▼▼▼
            case 'link':
                textToCopy = ``; // 复制内容为空
                canCopy = false; // 禁用复制
                canEdit = false; // 禁用编辑
                break;
            // ▲▲▲ [核心修改] 结束 ▲▲▲
            default: // 兼容旧文本和表情
                textToCopy = currentPart.isEmoji ? `[Emoji: ${currentPart.name}]` : currentPart.text;
                canCopy = textToCopy.length > 0;
                canEdit = true;
                break;
        }
    }

    const menuItems = [
        { action: 'edit', icon: 'fa-regular fa-pen-to-square', text: '编辑', disabled: !canEdit },
        { action: 'reply', icon: 'fa-solid fa-quote-left', text: '回复' },
        { action: 'favorite', icon: 'fa-regular fa-star', text: '收藏' },
        { action: 'delete', icon: 'fa-regular fa-trash-can', text: '删除', isDestructive: true },
        { action: 'forward', icon: 'fa-solid fa-share', text: '转发' },
        { action: 'copy', icon: 'fa-regular fa-copy', text: '复制', disabled: !canCopy },
        { action: 'multiselect', icon: 'fa-solid fa-check-double', text: '多选' },
        { action: 'branch', icon: 'fa-solid fa-code-branch', text: '分支' }
    ];

    menu.innerHTML = menuItems.map(item => `
        <div class="message-menu-item ${item.disabled ? 'disabled' : ''}" data-action="${item.action}" ${item.isDestructive ? 'style="color: #e53e3e;"' : ''}>
            <i class="${item.icon}"></i><span>${item.text}</span>
        </div>
    `).join('');

    menu.onclick = (e) => {
        const item = e.target.closest('.message-menu-item');
        if (!item || item.classList.contains('disabled')) return;

        const action = item.dataset.action;
        const actionText = item.querySelector('span')?.textContent || '该功能';

        switch (action) {
            case 'copy':
                navigator.clipboard.writeText(textToCopy).catch(err => console.error('复制失败:', err));
                break;
            case 'delete':
                if (confirm('确定要删除这条消息吗？')) {
                    const newHistory = JSON.parse(JSON.stringify(chatHistory)); // 深拷贝以安全修改
                    const messageGroup = newHistory[index];

                    if (messageGroup.sender === 'user') {
                        newHistory.splice(index, 1);
                    } else if (messageGroup.sender === 'character' && partIndex !== -1) {
                        const activeVersion = messageGroup.replyVersions[messageGroup.activeReplyIndex];
                        
                        if (activeVersion && activeVersion.length > partIndex) {
                            activeVersion.splice(partIndex, 1);
                        }

                        if (activeVersion.length === 0) {
                            if (messageGroup.replyVersions.length > 1) {
                                messageGroup.replyVersions.splice(messageGroup.activeReplyIndex, 1);
                                messageGroup.activeReplyIndex = Math.max(0, messageGroup.activeReplyIndex - 1);
                            } else {
                                newHistory.splice(index, 1);
                            }
                        }
                    }
                    updateChatHistory(newHistory);
                }
                break;
            case 'edit':
                startEditing(bubble, index, partIndex, getChatHistory, updateChatHistory, getEmojis);
                break;
            default:
                alert(`“${actionText}”功能待开发...`);
                break;
        }
        hideMenu();
    };

    const menuWidth = 240, menuHeight = 120;
    const screenWidth = window.innerWidth, screenHeight = window.innerHeight;
    let top = event.clientY, left = event.clientX;
    if (left + menuWidth > screenWidth - 10) left = screenWidth - menuWidth - 10;
    if (top + menuHeight > screenHeight - 10) top = screenHeight - menuHeight - 10;
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menuOverlay.classList.add('active');
}

function hideMenu() {
    document.getElementById('message-menu-overlay').classList.remove('active');
}

/**
 * 将消息气泡变为可编辑状态。
 */
function startEditing(bubble, index, partIndex, getChatHistory, updateChatHistory, getEmojis) {
    bubble.classList.add('editing');
    
    const messageData = getChatHistory()[index];
    let originalPart = null;
    let originalContent = '';

    if (messageData.sender === 'user') {
        originalPart = messageData;
    } else if (messageData.sender === 'character') {
        const activeVersion = messageData.replyVersions[messageData.activeReplyIndex];
        originalPart = activeVersion[partIndex];
    }
    
    if (originalPart) {
        switch(originalPart.type) {
            case 'text-photo':
                originalContent = `[Photo: ${originalPart.text}]`;
                break;
            case 'link':
                originalContent = `${originalPart.title}\n\n${originalPart.body}${originalPart.source ? `\n\n来源: ${originalPart.source}`: ''}`;
                break;
            default: // 兼容旧文本和表情
                originalContent = originalPart.isEmoji ? `[Emoji: ${originalPart.name}]` : originalPart.text;
                break;
        }
    }

    bubble.innerHTML = `
        <div class="message-edit-container">
            <textarea class="message-edit-textarea">${originalContent}</textarea>
            <div class="message-edit-actions">
                <button class="message-edit-btn cancel">取消</button>
                <button class="message-edit-btn save">保存</button>
            </div>
        </div>
    `;

    const textarea = bubble.querySelector('.message-edit-textarea');
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    });

    const stopEditing = (shouldSave) => {
        bubble.classList.remove('editing');
        const originalMessageGroup = getChatHistory()[index];
        const newHistory = [...getChatHistory()];
        
        if (shouldSave) {
            const newText = textarea.value.trim();
            if (!newText) {
                shouldSave = false;
            } else {
                const photoRegex = /^\[Photo:\s*(.*?)\s*\]$/;
                const emojiRegex = /^\[Emoji:\s*(.*?)\s*\]$/;
                const photoMatch = newText.match(photoRegex);
                const emojiMatch = newText.match(emojiRegex);
                
                let partToUpdate = (originalMessageGroup.sender === 'user') 
                    ? newHistory[index] 
                    : newHistory[index].replyVersions[originalMessageGroup.activeReplyIndex][partIndex];

                if (originalPart.type === 'link') {
                    const lines = newText.split('\n');
                    partToUpdate.title = lines[0] || '无标题';
                    const sourceLineIndex = lines.findIndex(line => line.toLowerCase().startsWith('来源:'));
                    if (sourceLineIndex !== -1) {
                        partToUpdate.source = lines[sourceLineIndex].substring(5).trim();
                        partToUpdate.body = lines.slice(1, sourceLineIndex).filter(line => line.trim() !== '').join('\n');
                    } else {
                        partToUpdate.source = '';
                        partToUpdate.body = lines.slice(1).filter(line => line.trim() !== '').join('\n');
                    }
                } else if (photoMatch && photoMatch[1]) {
                    partToUpdate.type = 'text-photo';
                    partToUpdate.text = photoMatch[1];
                    delete partToUpdate.isEmoji;
                    delete partToUpdate.name;
                    delete partToUpdate.data;
                } else if (emojiMatch && emojiMatch[1]) {
                    // 表情逻辑不变
                } else { // 普通文本
                    partToUpdate.type = undefined;
                    partToUpdate.isEmoji = false;
                    partToUpdate.text = newText;
                    delete partToUpdate.name;
                    delete partToUpdate.data;
                }
                updateChatHistory(newHistory);
                return;
            }
        }
        
        let partToRestore = (originalMessageGroup.sender === 'user')
             ? originalMessageGroup
             : originalMessageGroup.replyVersions[originalMessageGroup.activeReplyIndex][partIndex];

        bubble.className = 'chat-bubble user';
        switch(partToRestore.type) {
             case 'text-photo':
                bubble.classList.add('is-image-message');
                bubble.innerHTML = `
                    <div class="photo-message-container">
                        <img src="https://i.postimg.cc/wBtdFsGF/tpybxmnh.jpg" alt="文字图" class="message-photo-img">
                        <button class="text-photo-preview-btn" data-text="${escapeHtml(partToRestore.text)}" title="预览文字">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                `;
                break;
            case 'image':
                bubble.classList.add('is-image-message');
                bubble.innerHTML = `
                    <a href="${partToRestore.data}" target="_blank" title="点击查看大图">
                        <img src="${partToRestore.data}" alt="用户图片" class="message-photo-img">
                    </a>
                `;
                break;
            case 'link':
                bubble.classList.add('is-link-message');
                const { title, body, source, image } = partToRestore;
                let imageHtml = '';
                if (image) {
                     if (image.type === 'text-photo') {
                        imageHtml = `<div class="link-card-image text-photo">${escapeHtml(image.text)}</div>`;
                    } else if (image.type === 'image') {
                        const imageUrl = image.renderData || image.data;
                        imageHtml = `<img src="${imageUrl}" class="link-card-image">`;
                    }
                }
                bubble.innerHTML = `
                    <div class="link-card-container">
                        ${imageHtml}
                        <div class="link-card-content">
                            <div class="link-card-title">${escapeHtml(title)}</div>
                            <div class="link-card-body">${escapeHtml(body)}</div>
                        </div>
                        ${source ? `<div class="link-card-footer">${escapeHtml(source)}</div>` : ''}
                    </div>
                `;
                break;
            default:
                 if (partToRestore.isEmoji) {
                    bubble.innerHTML = `<img src="${partToRestore.data}" alt="emoji" class="message-emoji-img">`;
                    bubble.classList.add('is-emoji-message');
                } else {
                    bubble.textContent = partToRestore.text;
                }
                break;
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}