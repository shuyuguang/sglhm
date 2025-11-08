// relia-chat/message-edit.js

const LONG_PRESS_THRESHOLD = 400;

let longPressTimer = null;
let isLongPress = false;
let getEmojisCallback = () => []; // 用于存储获取表情包列表的函数

/**
 * 初始化消息长按和单击事件处理。
 * @param {HTMLElement} container - 消息列表的容器元素 (chatArea)。
 * @param {function} getChatHistory - 一个返回当前聊天历史数组的函数。
 * @param {function} updateChatHistory - 一个用新历史数组更新状态和UI的函数。
 * @param {function} getEmojis - 一个返回当前所有表情包对象的函数。
 */
export function initializeMessageMenu(container, getChatHistory, updateChatHistory, getEmojis) {
    const menuOverlay = document.getElementById('message-menu-overlay');
    const menu = document.getElementById('message-menu');
    getEmojisCallback = getEmojis; // 保存函数以便后续使用

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

    // ▼▼▼ 核心修改：统一所有消息类型的操作逻辑 ▼▼▼
    let canCopy = true;
    let canEdit = true;
    let textToCopy = '';
    let targetPart = null; // 用来存储被操作的具体消息部分

    if (messageData.sender === 'user') {
        targetPart = messageData;
    } else if (messageData.sender === 'character') {
        if (partIndex !== -1) {
            targetPart = messageData.replyVersions[messageData.activeReplyIndex][partIndex];
        }
    }
    
    if (!targetPart) return; // 如果找不到目标，则不显示菜单

    textToCopy = targetPart.isEmoji ? `[Emoji: ${targetPart.name}]` : targetPart.text;
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

    menu.innerHTML = menuItems.map(item => `...`).join(''); // (HTML不变)

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
                    const msgGroupToDeleteFrom = newHistory[index];
                    
                    if (msgGroupToDeleteFrom.sender === 'user') {
                        newHistory.splice(index, 1); // 用户消息，直接删除整个组
                    } else if (msgGroupToDeleteFrom.sender === 'character' && partIndex !== -1) {
                        const activeVersion = msgGroupToDeleteFrom.replyVersions[msgGroupToDeleteFrom.activeReplyIndex];
                        activeVersion.splice(partIndex, 1); // AI消息，只删除被点击的部分
                        
                        // 如果删除后当前版本空了，并且是唯一版本，则删除整个消息组
                        if (activeVersion.length === 0 && msgGroupToDeleteFrom.replyVersions.length === 1) {
                             newHistory.splice(index, 1);
                        }
                        // (如果还有其他版本，我们保留这个空版本，用户可以切换到其他版本或重新生成)
                    }
                    updateChatHistory(newHistory);
                }
                break;
            case 'edit':
                startEditing(bubble, index, partIndex, getChatHistory, updateChatHistory);
                break;
            default:
                alert(`“${actionText}”功能待开发...`);
                break;
        }
        hideMenu();
    };

    // (菜单定位逻辑不变)
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
    let originalPart = null;
    let originalContent = '';

    if (messageData.sender === 'user') {
        originalPart = messageData;
    } else if (messageData.sender === 'character') {
        originalPart = messageData.replyVersions[messageData.activeReplyIndex][partIndex];
    }
    
    if (!originalPart) return;

    originalContent = originalPart.isEmoji ? originalPart.name : originalPart.text;

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
    // ... (textarea自适应高度逻辑不变)
    
    const stopEditing = (shouldSave) => {
        if (shouldSave) {
            const newContent = textarea.value.trim();
            const newHistory = [...getChatHistory()];
            let partToUpdate;
            
            if (messageData.sender === 'user') {
                partToUpdate = newHistory[index];
            } else {
                // 确保我们修改的是正确的版本！
                partToUpdate = newHistory[index].replyVersions[messageData.activeReplyIndex][partIndex];
            }
            
            if (originalPart.isEmoji) {
                const availableEmojis = getEmojisCallback();
                const foundEmoji = availableEmojis.find(e => e.name === newContent);
                if (foundEmoji) {
                    partToUpdate.name = foundEmoji.name;
                    partToUpdate.data = foundEmoji.data;
                    updateChatHistory(newHistory);
                } else {
                    alert(`表情 "${newContent}" 不存在！`);
                    bubble.classList.remove('editing');
                    bubble.innerHTML = `<img src="${originalPart.data}" alt="emoji" class="message-emoji-img">`;
                }
            } else { // 是文本
                if (newContent && newContent !== originalPart.text) {
                    partToUpdate.text = newContent;
                    updateChatHistory(newHistory);
                } else {
                    bubble.classList.remove('editing');
                    bubble.textContent = originalPart.text;
                }
            }
        } else {
            // 取消编辑，恢复原状
            bubble.classList.remove('editing');
            if(originalPart.isEmoji) {
                bubble.innerHTML = `<img src="${originalPart.data}" alt="emoji" class="message-emoji-img">`;
            } else {
                bubble.textContent = originalPart.text;
            }
        }
    };
    
    bubble.querySelector('.save').onclick = () => stopEditing(true);
    bubble.querySelector('.cancel').onclick = () => stopEditing(false);
}