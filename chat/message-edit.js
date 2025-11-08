// relia-chat/message-edit.js

const LONG_PRESS_THRESHOLD = 400; // 长按阈值，单位：毫秒

let longPressTimer = null;
let isLongPress = false;

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
        if (!bubble || isLongPress || bubble.classList.contains('editing')) return;

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
    let canEdit = false; // 默认所有消息都可以编辑
    let textToCopy = '';
    let currentPart = null;

    if (messageData.sender === 'user') {
        currentPart = messageData;
        textToCopy = messageData.isEmoji ? messageData.name : messageData.text;
    } else if (messageData.sender === 'character' && partIndex !== -1) {
        const activeVersion = messageData.replyVersions[messageData.activeReplyIndex];
        currentPart = activeVersion[partIndex];
        if (currentPart) {
            textToCopy = currentPart.isEmoji ? currentPart.name : currentPart.text;
        }
    }

    // ▼▼▼ 核心修改：简化判断逻辑 ▼▼▼
    canCopy = !!currentPart && textToCopy.length > 0;
    canEdit = !!currentPart; // 只要有内容部分，就可以编辑
    // ▲▲▲ 修改结束 ▲▲▲

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
            // ▼▼▼ 核心修改：重写删除逻辑 ▼▼▼
            case 'delete':
                if (confirm('确定要删除这条消息吗？')) {
                    const newHistory = [...chatHistory];
                    const messageToDelete = newHistory[index];

                    if (messageToDelete.sender === 'user') {
                        newHistory.splice(index, 1);
                    } else if (messageToDelete.sender === 'character' && partIndex !== -1) {
                        const activeVersion = messageToDelete.replyVersions[messageToDelete.activeReplyIndex];
                        activeVersion.splice(partIndex, 1); // 从当前版本中删除该部分

                        // 如果删除后当前版本为空，则删除整个消息组
                        if (activeVersion.length === 0) {
                            newHistory.splice(index, 1);
                        }
                    }
                    updateChatHistory(newHistory);
                }
                break;
            // ▲▲▲ 修改结束 ▲▲▲
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
    
    // ▼▼▼ 核心修改：根据内容类型决定编辑框的初始文本 ▼▼▼
    if (originalPart) {
        originalContent = originalPart.isEmoji ? originalPart.name : originalPart.text;
    }
    // ▲▲▲ 修改结束 ▲▲▲

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
            if (!newText) { // 不允许保存为空
                shouldSave = false;
            } else {
                const allEmojis = getEmojis();
                const foundEmoji = allEmojis.find(e => e.name === newText);
                
                let partToUpdate;
                if (originalMessageGroup.sender === 'user') {
                    partToUpdate = newHistory[index];
                } else {
                    partToUpdate = newHistory[index].replyVersions[originalMessageGroup.activeReplyIndex][partIndex];
                }

                // ▼▼▼ 核心修改：实现文本与表情的智能转换和保存 ▼▼▼
                if (foundEmoji) {
                    // 如果输入内容匹配到一个表情，则更新为表情消息
                    partToUpdate.isEmoji = true;
                    partToUpdate.name = foundEmoji.name;
                    partToUpdate.data = foundEmoji.data;
                    delete partToUpdate.text; // 删除旧的text属性
                } else {
                    // 否则，更新为纯文本消息
                    partToUpdate.isEmoji = false;
                    partToUpdate.text = newText;
                    delete partToUpdate.name; // 删除旧的表情属性
                    delete partToUpdate.data;
                }
                updateChatHistory(newHistory);
                // ▲▲▲ 修改结束 ▲▲▲
                return; // 直接返回，因为UI会由updateChatHistory刷新
            }
        }
        
        // 如果是取消编辑或保存失败，则恢复原始气泡内容
        let partToRestore;
        if (originalMessageGroup.sender === 'user') {
             partToRestore = originalMessageGroup;
        } else {
             partToRestore = originalMessageGroup.replyVersions[originalMessageGroup.activeReplyIndex][partIndex];
        }

        // ▼▼▼ 核心修改：恢复时也需要区分表情和文本 ▼▼▼
        if (partToRestore.isEmoji) {
            bubble.innerHTML = `<img src="${partToRestore.data}" alt="emoji" class="message-emoji-img">`;
            bubble.classList.add('is-emoji-message');
        } else {
            bubble.textContent = partToRestore.text;
            bubble.classList.remove('is-emoji-message');
        }
        // ▲▲▲ 修改结束 ▲▲▲
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}