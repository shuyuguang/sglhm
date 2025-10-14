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

    // ▼▼▼ 修改点 1：更新菜单项为指定的 8 个 ▼▼▼
    const menuItems = [
        { action: 'edit', icon: 'fa-regular fa-pen-to-square', text: '编辑' },
        { action: 'reply', icon: 'fa-solid fa-reply', text: '回复' },
        { action: 'forward', icon: 'fa-solid fa-share', text: '转发' },
        { action: 'copy', icon: 'fa-regular fa-copy', text: '复制' },
        { action: 'delete', icon: 'fa-regular fa-trash-can', text: '删除', isDestructive: true },
        { action: 'favorite', icon: 'fa-regular fa-star', text: '收藏' },
        { action: 'multiselect', icon: 'fa-solid fa-check-double', text: '多选' },
        { action: 'other', icon: 'fa-solid fa-ellipsis', text: '其它' }
    ];
    // ▲▲▲ 修改结束 ▲▲▲

    menu.innerHTML = menuItems.map(item => `
        <div class="message-menu-item" data-action="${item.action}" ${item.isDestructive ? 'style="color: #e53e3e;"' : ''}>
            <i class="${item.icon}"></i><span>${item.text}</span>
        </div>
    `).join('');

    menu.onclick = (e) => {
        const item = e.target.closest('.message-menu-item');
        if (!item) return;

        const action = item.dataset.action;
        const actionText = item.querySelector('span')?.textContent || '该功能';

        switch (action) {
            case 'copy':
                navigator.clipboard.writeText(message.text)
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

    // ▼▼▼ 修改点 2：根据新的 2x4 网格布局，调整菜单的估算宽高 ▼▼▼
    const menuWidth = 280;  // 4个图标宽度 + 间距
    const menuHeight = 140; // 2行图标高度 + 间距
    // ▲▲▲ 修改结束 ▲▲▲

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
 * (此函数无变化)
 */
function hideMenu() {
    const menuOverlay = document.getElementById('message-menu-overlay');
    menuOverlay.classList.remove('active');
}

/**
 * 将消息气泡变为可编辑状态。
 * (此函数无变化)
 */
function startEditing(bubble, index, getChatHistory, updateChatHistory) {
    bubble.classList.add('editing');
    
    const originalText = getChatHistory()[index].text;
    bubble.innerHTML = `
        <div class="message-edit-container">
            <textarea class="message-edit-textarea">${originalText}</textarea>
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

        if (shouldSave) {
            const newText = textarea.value.trim();
            if (newText && newText !== originalText) {
                const newHistory = [...getChatHistory()];
                newHistory[index].text = newText;
                updateChatHistory(newHistory);
            } else {
                bubble.textContent = originalText;
            }
        } else {
            bubble.textContent = originalText;
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}