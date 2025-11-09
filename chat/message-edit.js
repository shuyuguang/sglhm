// relia-chat/message-edit.js

const LONG_PRESS_THRESHOLD = 400;

let longPressTimer = null;
let isLongPress = false;

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

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
        
        // ▼▼▼ 核心修复：如果目标是链接，阻止默认的拖拽行为 ▼▼▼
        if (e.target.closest('a')) {
            e.preventDefault();
        }
        // ▲▲▲ 修复结束 ▲▲▲

        isLongPress = false; 
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            // ▼▼▼ 核心修复：长按时直接显示菜单 ▼▼▼
            const longPressBubble = e.target.closest('.chat-bubble');
            if (longPressBubble) {
                showMenuForBubble(e, longPressBubble, getChatHistory, updateChatHistory, getEmojis);
            }
            // ▲▲▲ 修复结束 ▲▲▲
        }, LONG_PRESS_THRESHOLD);
    });

    container.addEventListener('mouseup', (e) => {
        const wasLongPress = isLongPress;
        clearTimeout(longPressTimer);
        isLongPress = false; 

        if (wasLongPress) { // 如果是长按，mouseup 时不做任何事，因为菜单已在 mousedown 的计时器中显示
            return;
        }

        const bubble = e.target.closest('.chat-bubble');
        if (!bubble || bubble.classList.contains('editing')) return;

        // ▼▼▼ 修改点：如果是短击链接卡片，则模拟点击打开链接 ▼▼▼
        if (bubble.classList.contains('is-link-message')) {
            const link = bubble.querySelector('a');
            if (link) {
                window.open(link.href, '_blank');
            }
            return;
        }
        // ▲▲▲ 修改结束 ▲▲▲
        
        if (e.target.closest('.text-photo-preview-btn')) {
            return;
        }

        showMenuForBubble(e, bubble, getChatHistory, updateChatHistory, getEmojis);
    });

    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) hideMenu();
    });
}

function showMenuForBubble(event, bubble, getChatHistory, updateChatHistory, getEmojis) {
    const messageGroup = bubble.closest('.message-group-container');
    if (!messageGroup) return;
    const index = parseInt(messageGroup.dataset.index, 10);
    const messageRow = bubble.closest('.message-row');
    const partIndex = messageRow && messageRow.dataset.partIndex ? parseInt(messageRow.dataset.partIndex, 10) : -1;
    
    showMenu(event, index, partIndex, bubble, getChatHistory, updateChatHistory, getEmojis);
}

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
            // ▼▼▼ 新增：处理链接卡片的操作权限 ▼▼▼
            case 'link':
                textToCopy = `[Link: ${currentPart.url} | ${currentPart.title} | ${currentPart.description} | ${currentPart.image}]`;
                canCopy = true;
                canEdit = true;
                break;
            // ▲▲▲ 新增结束 ▲▲▲
            default:
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
                    const newHistory = JSON.parse(JSON.stringify(chatHistory));
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
            // ▼▼▼ 新增：准备链接卡片的编辑内容 ▼▼▼
            case 'link':
                originalContent = `[Link: ${originalPart.url} | ${originalPart.title} | ${originalPart.description} | ${originalPart.image}]`;
                break;
            // ▲▲▲ 新增结束 ▲▲▲
            default:
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
                const linkRegex = /^\[Link:\s*(.*?)\s*\]$/; // 新增正则
                const photoMatch = newText.match(photoRegex);
                const emojiMatch = newText.match(emojiRegex);
                const linkMatch = newText.match(linkRegex); // 新增匹配
                
                let partToUpdate = (originalMessageGroup.sender === 'user') 
                    ? newHistory[index] 
                    : newHistory[index].replyVersions[originalMessageGroup.activeReplyIndex][partIndex];
                
                // 清理旧属性
                const keysToDelete = ['isEmoji', 'name', 'data', 'text', 'url', 'title', 'description', 'image'];
                keysToDelete.forEach(key => delete partToUpdate[key]);

                if (photoMatch && photoMatch[1]) {
                    partToUpdate.type = 'text-photo';
                    partToUpdate.text = photoMatch[1];
                } else if (linkMatch && linkMatch[1]) {
                    // ▼▼▼ 新增：处理链接卡片保存逻辑 ▼▼▼
                    const parts = linkMatch[1].split('|').map(p => p.trim());
                     if (parts.length >= 3) {
                        partToUpdate.type = 'link';
                        partToUpdate.url = parts[0];
                        partToUpdate.title = parts[1];
                        partToUpdate.description = parts[2];
                        partToUpdate.image = parts[3] || '';
                    } else { // 格式不正确，作为纯文本处理
                        partToUpdate.type = undefined;
                        partToUpdate.text = newText;
                    }
                    // ▲▲▲ 新增结束 ▲▲▲
                } else if (emojiMatch && emojiMatch[1]) {
                    // ... (表情逻辑)
                } else {
                    partToUpdate.type = undefined;
                    partToUpdate.text = newText;
                }
                updateChatHistory(newHistory);
                return;
            }
        }
        
        let partToRestore = (originalMessageGroup.sender === 'user')
             ? originalMessageGroup
             : originalMessageGroup.replyVersions[originalMessageGroup.activeReplyIndex][partIndex];

        bubble.className = `chat-bubble ${partToRestore.sender || messageData.sender}`;
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
                 const imageUrl = partToRestore.renderData || partToRestore.data;
                 bubble.innerHTML = `
                    <a href="${imageUrl}" target="_blank" title="点击查看大图">
                        <img src="${imageUrl}" alt="用户图片" class="message-photo-img">
                    </a>
                 `;
                 break;
            // ▼▼▼ 新增：处理链接卡片取消编辑的渲染恢复 ▼▼▼
            case 'link':
                 bubble.classList.add('is-link-message');
                 bubble.innerHTML = `
                    <a href="${escapeHtml(partToRestore.url)}" target="_blank" class="link-card-container">
                        ${partToRestore.image ? `
                        <div class="link-card-image">
                            <img src="${escapeHtml(partToRestore.image)}" alt="Link preview">
                        </div>` : ''}
                        <div class="link-card-text">
                            <div class="link-card-title">${escapeHtml(partToRestore.title)}</div>
                            <div class="link-card-description">${escapeHtml(partToRestore.description)}</div>
                        </div>
                    </a>
                `;
                break;
            // ▲▲▲ 新增结束 ▲▲▲
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