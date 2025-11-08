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

    // --- 核心逻辑：区分单击和长按 ---
    container.addEventListener('mousedown', (e) => {
        const bubble = e.target.closest('.chat-bubble');
        if (!bubble) return;

        isLongPress = false; 
        
        longPressTimer = setTimeout(() => {
            isLongPress = true;
        }, LONG_PRESS_THRESHOLD);
    });

    container.addEventListener('mouseup', (e) => {
        clearTimeout(longPressTimer);
        
        const bubble = e.target.closest('.chat-bubble');
        
        if (!bubble || isLongPress || bubble.classList.contains('editing')) {
            return;
        }

        // --- 如果不是长按，这就是一次单击 ---
        e.preventDefault();
        const messageRow = bubble.closest('.message-row');
        const index = parseInt(messageRow.dataset.index, 10);
        
        showMenu(e, index, bubble, getChatHistory, updateChatHistory);
    });

    // 点击菜单外部区域隐藏菜单
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) {
            hideMenu();
        }
    });
}


/**
 * 显示操作菜单。
 */
function showMenu(event, index, bubble, getChatHistory, updateChatHistory) {
    const menu = document.getElementById('message-menu');
    const menuOverlay = document.getElementById('message-menu-overlay');
    const chatHistory = getChatHistory();
    const message = chatHistory[index];

    if (!message) return;

    // [核心修改] 复制和编辑按钮的可用性判断
    const canCopy = message.text || message.isEmoji;
    const canEdit = message.sender === 'user' && (message.text || message.isEmoji);

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
                // [核心修改] 复制时也处理表情
                const textToCopy = message.isEmoji ? `[Emoji: ${message.name}]` : message.text;
                navigator.clipboard.writeText(textToCopy)
                    .then(() => console.log('消息已复制'))
                    .catch(err => console.error('复制失败:', err));
                break;
            case 'delete':
                if (confirm('确定要删除这条消息吗？')) {
                    const newHistory = [...chatHistory];
                    newHistory.splice(index, 1);
                    updateChatHistory(newHistory);
                }
                break;
            case 'edit':
                startEditing(bubble, index, getChatHistory, updateChatHistory);
                break;
            default:
                alert(`“${actionText}”功能待开发...`);
                break;
        }

        hideMenu();
    };

    const menuWidth = 240;
    const menuHeight = 120;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let top = event.clientY;
    let left = event.clientX;

    if (left + menuWidth > screenWidth - 10) {
        left = screenWidth - menuWidth - 10;
    }
    if (top + menuHeight > screenHeight - 10) {
        top = screenHeight - menuHeight - 10;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    menuOverlay.classList.add('active');
}

/**
 * 隐藏操作菜单。
 */
function hideMenu() {
    const menuOverlay = document.getElementById('message-menu-overlay');
    menuOverlay.classList.remove('active');
}

/**
 * 将消息气泡变为可编辑状态。
 */
function startEditing(bubble, index, getChatHistory, updateChatHistory) {
    bubble.classList.add('editing');
    
    // [核心修改] 获取消息对象并判断类型
    const message = getChatHistory()[index];
    const originalContent = message.isEmoji ? `[Emoji: ${message.name}]` : message.text;
    
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
        const originalMessage = getChatHistory()[index];

        // [核心修改] 如果是表情消息，直接恢复，不保存文本修改
        if (originalMessage.isEmoji) {
            bubble.classList.remove('editing');
            bubble.innerHTML = `<img src="${originalMessage.data}" alt="emoji" class="message-emoji-img">`;
            // 因为内容没变，所以不需要调用 updateChatHistory
            return; 
        }

        // --- 以下是原有的文本消息处理逻辑 ---
        bubble.classList.remove('editing');
        if (shouldSave) {
            const newText = textarea.value.trim();
            if (newText && newText !== originalMessage.text) {
                const newHistory = [...getChatHistory()];
                newHistory[index].text = newText;
                updateChatHistory(newHistory); // 这个函数会重新渲染，所以我们不需要手动改bubble.textContent
            } else {
                // 如果没变或者为空，恢复原始文本
                bubble.textContent = originalMessage.text;
            }
        } else {
            // 取消编辑，恢复原始文本
            bubble.textContent = originalMessage.text;
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}