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

        isLongPress = false; // 重置长按标志
        
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            // 长按触发时，我们什么都不做，浏览器会接管并开始文本选择
            // 此时因为 isLongPress 已经是 true，mouseup 时就不会显示菜单了
        }, LONG_PRESS_THRESHOLD);
    });

    container.addEventListener('mouseup', (e) => {
        clearTimeout(longPressTimer); // 无论如何，先清除定时器
        
        const bubble = e.target.closest('.chat-bubble');
        if (!bubble || isLongPress) {
            // 如果是长按，或者点击的不是消息气泡，则不执行任何操作
            return;
        }

        // --- 如果不是长按，这就是一次单击 ---
        e.preventDefault(); // 阻止可能的默认行为，如文本选择闪烁
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
 * @param {MouseEvent} event - 触发的鼠标事件。
 * @param {number} index - 消息在历史记录中的索引。
 * @param {HTMLElement} bubble - 被点击的消息气泡元素。
 * @param {function} getChatHistory - 获取聊天历史的函数。
 * @param {function} updateChatHistory - 更新聊天历史的函数。
 */
function showMenu(event, index, bubble, getChatHistory, updateChatHistory) {
    const menu = document.getElementById('message-menu');
    const menuOverlay = document.getElementById('message-menu-overlay');
    const chatHistory = getChatHistory();
    const message = chatHistory[index];

    if (!message) return;

    // 动态生成菜单项
    menu.innerHTML = `
        <div class="message-menu-item" data-action="copy"><i class="fa-regular fa-copy"></i><span>复制</span></div>
        <div class="message-menu-item" data-action="edit"><i class="fa-regular fa-pen-to-square"></i><span>编辑</span></div>
        <div class="message-menu-item" data-action="delete" style="color: #e53e3e;"><i class="fa-regular fa-trash-can"></i><span>删除</span></div>
    `;

    // 绑定菜单项事件
    menu.onclick = (e) => {
        const item = e.target.closest('.message-menu-item');
        if (!item) return;

        const action = item.dataset.action;

        if (action === 'copy') {
            navigator.clipboard.writeText(message.text)
                .then(() => console.log('消息已复制'))
                .catch(err => console.error('复制失败:', err));
        } else if (action === 'delete') {
            if (confirm('确定要删除这条消息吗？')) {
                const newHistory = [...chatHistory];
                newHistory.splice(index, 1);
                updateChatHistory(newHistory);
            }
        } else if (action === 'edit') {
            startEditing(bubble, index, getChatHistory, updateChatHistory);
        }
        hideMenu();
    };

    // 定位菜单
    const menuWidth = 120;
    const menuHeight = 130;
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
 * @param {HTMLElement} bubble - 要编辑的消息气泡元素。
 * @param {number} index - 消息索引。
 * @param {function} getChatHistory - 获取聊天历史的函数。
 * @param {function} updateChatHistory - 更新聊天历史的函数。
 */
function startEditing(bubble, index, getChatHistory, updateChatHistory) {
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
        if (shouldSave) {
            const newText = textarea.value.trim();
            if (newText && newText !== originalText) {
                const newHistory = [...getChatHistory()];
                newHistory[index].text = newText;
                updateChatHistory(newHistory);
            } else {
                // 如果内容为空或未改变，则恢复原状
                bubble.textContent = originalText;
            }
        } else {
            bubble.textContent = originalText;
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}