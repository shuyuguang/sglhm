// relia-chat/message-edit.js

const LONG_PRESS_THRESHOLD = 400; // 长按阈值，单位：毫秒

let longPressTimer = null;
let isLongPress = false;

/**
 * 初始化消息长按和单击事件处理。
 * @param {HTMLElement} container - 消息列表的容器元素 (chatArea)。
 * @param {function} getChatHistory - 一个返回当前聊天历史数组的函数。
 * @param {function} updateChatHistory - 一个用新历史数组更新状态和UI的函数。
 */
export function initializeMessageMenu(container, getChatHistory, updateChatHistory) {
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

        // ▼▼▼ 核心修改：获取是哪个部分被点击了 ▼▼▼
        const messageRow = bubble.closest('.message-row');
        const partIndex = messageRow && messageRow.dataset.partIndex ? parseInt(messageRow.dataset.partIndex, 10) : -1;
        // ▲▲▲ 修改结束 ▲▲▲
        
        showMenu(e, index, partIndex, bubble, getChatHistory, updateChatHistory);
    });

    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) hideMenu();
    });
}

/**
 * 显示操作菜单。
 */
function showMenu(event, index, partIndex, bubble, getChatHistory, updateChatHistory) {
    const menu = document.getElementById('message-menu');
    const menuOverlay = document.getElementById('message-menu-overlay');
    const chatHistory = getChatHistory();
    const messageData = chatHistory[index];

    if (!messageData) return;

    let canCopy = false;
    let canEdit = false;
    let textToCopy = '';

    if (messageData.sender === 'user') {
        if (messageData.isEmoji) {
            textToCopy = `[Emoji: ${messageData.name}]`;
            canCopy = true;
            canEdit = false;
        } else {
            textToCopy = messageData.text;
            canCopy = true;
            canEdit = true;
        }
    } else if (messageData.sender === 'character') {
        const activeVersion = messageData.replyVersions[messageData.activeReplyIndex];
        textToCopy = activeVersion.map(part => part.isEmoji ? `[Emoji: ${part.name}]` : part.text).join('\n');
        canCopy = textToCopy.length > 0;
        
        // ▼▼▼ 核心修改：现在可以编辑AI的文本消息了 ▼▼▼
        const clickedPart = (partIndex !== -1) ? activeVersion[partIndex] : null;
        canEdit = clickedPart ? !clickedPart.isEmoji : false; // 只能编辑文本部分，不能编辑表情
        // ▲▲▲ 修改结束 ▲▲▲
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
                    const newHistory = [...chatHistory];
                    newHistory.splice(index, 1);
                    updateChatHistory(newHistory);
                }
                break;
            case 'edit':
                // ▼▼▼ 核心修改：传递 partIndex ▼▼▼
                startEditing(bubble, index, partIndex, getChatHistory, updateChatHistory);
                // ▲▲▲ 修改结束 ▲▲▲
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
function startEditing(bubble, index, partIndex, getChatHistory, updateChatHistory) {
    bubble.classList.add('editing');
    
    const messageData = getChatHistory()[index];
    let originalContent = '';

    if (messageData.sender === 'user') {
        originalContent = messageData.text;
    } else if (messageData.sender === 'character') {
        const activeVersion = messageData.replyVersions[messageData.activeReplyIndex];
        originalContent = activeVersion[partIndex].text;
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
            if (originalMessageGroup.sender === 'user') {
                if (newText && newText !== originalMessageGroup.text) {
                    newHistory[index].text = newText;
                    updateChatHistory(newHistory);
                } else {
                    bubble.textContent = originalMessageGroup.text;
                }
            } else if (originalMessageGroup.sender === 'character') {
                const partToUpdate = newHistory[index].replyVersions[originalMessageGroup.activeReplyIndex][partIndex];
                if (newText && newText !== partToUpdate.text) {
                    partToUpdate.text = newText;
                    updateChatHistory(newHistory);
                } else {
                    bubble.textContent = partToUpdate.text;
                }
            }
        } else {
            // 取消编辑，无论如何都恢复原始内容
            if (originalMessageGroup.sender === 'user') {
                 bubble.textContent = originalMessageGroup.text;
            } else {
                 const partToRestore = originalMessageGroup.replyVersions[originalMessageGroup.activeReplyIndex][partIndex];
                 bubble.textContent = partToRestore.text;
            }
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}