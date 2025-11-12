// 文件名: achat/message-edit.js

let menuOverlay, menu, chatAreaRef, getChatHistoryCallback, updateChatHistoryCallback;
let currentTargetMessage = null;
let longPressTimer = null;
const LONG_PRESS_DELAY = 500; // 长按500毫秒触发

function createMenuItem(icon, text, action, disabled = false) {
    const item = document.createElement('div');
    item.className = 'message-menu-item';
    if (disabled) item.classList.add('disabled');
    item.innerHTML = `<i class="fa-solid ${icon}"></i><span>${text}</span>`;
    if (!disabled) {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            action();
            closeMenu();
        });
    }
    return item;
}

function openMenu(event, messageElement) {
    const index = parseInt(messageElement.dataset.index, 10);
    const history = getChatHistoryCallback();
    const messageData = history[index];
    if (!messageData) return;

    currentTargetMessage = { element: messageElement, data: messageData, index };

    menu.innerHTML = ''; // 清空菜单

    // --- 构建菜单项 ---
    const isUserText = messageData.sender === 'user' && !messageData.isEmoji && !messageData.type;
    
    menu.appendChild(createMenuItem('fa-copy', '复制', handleCopy, !isUserText));
    menu.appendChild(createMenuItem('fa-reply', '回复', handleReply, true)); // 功能暂未实现，禁用
    menu.appendChild(createMenuItem('fa-pen-to-square', '编辑', handleEdit, !isUserText));
    menu.appendChild(createMenuItem('fa-trash-can', '删除', handleDelete));
    menu.appendChild(createMenuItem('fa-ellipsis', '更多', handleMore, true)); // 功能暂未实现，禁用
    
    // --- 定位菜单 ---
    const rect = messageElement.getBoundingClientRect();
    const menuHeight = 120; // 菜单预估高度
    let top = event.clientY;
    let left = event.clientX;

    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }
    if (left + menu.offsetWidth > window.innerWidth) {
        left = window.innerWidth - menu.offsetWidth - 10;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    menuOverlay.classList.add('active');
}

function closeMenu() {
    menuOverlay.classList.remove('active');
    currentTargetMessage = null;
}

// --- 菜单动作处理 ---

function handleCopy() {
    if (currentTargetMessage && currentTargetMessage.data.text) {
        navigator.clipboard.writeText(currentTargetMessage.data.text)
            .then(() => console.log('复制成功'))
            .catch(err => console.error('复制失败:', err));
    }
}

function handleReply() {
    // 功能待实现
    alert('回复功能正在开发中...');
}

function handleDelete() {
    if (currentTargetMessage && confirm('确定要删除这条消息吗？')) {
        let history = getChatHistoryCallback();
        history.splice(currentTargetMessage.index, 1);
        updateChatHistoryCallback(history);
    }
}

function handleEdit() {
    if (!currentTargetMessage || !currentTargetMessage.element) return;
    
    const bubble = currentTargetMessage.element.querySelector('.chat-bubble.user');
    if (!bubble) return;
    
    const originalText = currentTargetMessage.data.text;
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

    bubble.querySelector('.message-edit-btn.cancel').addEventListener('click', () => {
        updateChatHistoryCallback(getChatHistoryCallback()); // 重新渲染以恢复原状
    });

    bubble.querySelector('.message-edit-btn.save').addEventListener('click', () => {
        const newText = textarea.value.trim();
        if (newText) {
            let history = getChatHistoryCallback();
            history[currentTargetMessage.index].text = newText;
            updateChatHistoryCallback(history);
        }
    });
}

function handleMore() {
    // 功能待实现
    alert('更多功能正在开发中...');
}


// --- 初始化函数 ---

export function initializeMessageMenu(chatArea, getChatHistory, updateChatHistory, getEmojis) {
    chatAreaRef = chatArea;
    getChatHistoryCallback = getChatHistory;
    updateChatHistoryCallback = updateChatHistory;
    
    menuOverlay = document.getElementById('message-menu-overlay');
    menu = document.getElementById('message-menu');

    if (!menuOverlay || !menu) {
        console.error('消息菜单的HTML元素未找到!');
        return;
    }

    // 点击遮罩关闭菜单
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) closeMenu();
    });

    // 桌面端右键菜单
    chatAreaRef.addEventListener('contextmenu', (e) => {
        const messageGroup = e.target.closest('.message-group-container');
        if (messageGroup) {
            e.preventDefault();
            openMenu(e, messageGroup);
        }
    });

    // 移动端长按
    chatAreaRef.addEventListener('pointerdown', (e) => {
        const messageGroup = e.target.closest('.message-group-container');
        if (messageGroup) {
            longPressTimer = setTimeout(() => {
                openMenu(e, messageGroup);
                navigator.vibrate?.(50); // 轻微震动提示
            }, LONG_PRESS_DELAY);
        }
    });

    chatAreaRef.addEventListener('pointerup', () => {
        clearTimeout(longPressTimer);
    });

    chatAreaRef.addEventListener('pointermove', () => {
        clearTimeout(longPressTimer);
    });
}