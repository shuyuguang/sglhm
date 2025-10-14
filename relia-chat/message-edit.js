// relia-chat/message-edit.js

const menuActions = [
    { action: 'edit', icon: 'fa-solid fa-pencil', text: '编辑' },
    { action: 'reply', icon: 'fa-solid fa-reply', text: '回复' },
    { action: 'forward', icon: 'fa-solid fa-share', text: '转发' },
    { action: 'favorite', icon: 'fa-regular fa-star', text: '收藏' },
    { action: 'delete', icon: 'fa-regular fa-trash-can', text: '删除' },
    { action: 'multiselect', icon: 'fa-solid fa-check-double', text: '多选' },
];

export function initializeMessageMenu(chatArea, getChatHistory, updateChatHistory) {
    const overlay = document.getElementById('message-menu-overlay');
    const menu = document.getElementById('message-menu');

    if (!overlay || !menu) {
        console.error('消息菜单的 HTML 元素未找到！');
        return;
    }

    menu.innerHTML = menuActions.map(item => `
        <div class="message-menu-item" data-action="${item.action}">
            <i class="${item.icon}"></i>
            <span>${item.text}</span>
        </div>
    `).join('');

    let activeMessageElement = null;
    let activeMessageIndex = -1;
    let currentEditCleanup = null;

    const showMenu = (event) => {
        const messageRow = event.target.closest('.message-row');
        if (!messageRow) return;

        event.preventDefault();

        activeMessageElement = messageRow;
        activeMessageIndex = parseInt(messageRow.dataset.index, 10);
        
        const menuWidth = 120, menuHeight = 250, margin = 10;
        let x = event.clientX, y = event.clientY;

        if (x + menuWidth + margin > window.innerWidth) x = x - menuWidth - margin;
        else x = x + margin;

        if (y + menuHeight + margin > window.innerHeight) y = y - menuHeight;

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        overlay.classList.add('active');
    };

    const hideMenu = () => {
        overlay.classList.remove('active');
        activeMessageElement = null;
        activeMessageIndex = -1;
    };
    
    chatArea.addEventListener('contextmenu', showMenu);

    chatArea.addEventListener('click', (e) => {
        if (currentEditCleanup) {
            if (e.target.closest('.message-edit-container')) {
                return;
            }
            currentEditCleanup();
            currentEditCleanup = null;
            return;
        }

        if (e.target.closest('.chat-bubble')) {
            showMenu(e);
        }
    });


    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideMenu();
        }
    });

    menu.addEventListener('click', async (e) => {
        const menuItem = e.target.closest('.message-menu-item');
        if (!menuItem) return;

        const action = menuItem.dataset.action;
        const targetMessageElement = activeMessageElement;
        const targetMessageIndex = activeMessageIndex;
        
        if (targetMessageIndex === -1 || !targetMessageElement) return;

        hideMenu();

        const currentHistory = getChatHistory();
        const messageToModify = currentHistory[targetMessageIndex];

        switch (action) {
            case 'edit': {
                // [MODIFIED] 移除了 sender === 'user' 的判断，现在所有消息都可以编辑
                const bubble = targetMessageElement.querySelector('.chat-bubble');
                if (!bubble) break;

                bubble.style.display = 'none';

                const editContainer = document.createElement('div');
                // [MODIFIED] 动态添加 'user' 或 'character' 类，以便 CSS 应用正确样式
                editContainer.className = `message-edit-container ${messageToModify.sender}`;
                
                const textarea = document.createElement('textarea');
                textarea.className = 'message-edit-textarea';
                textarea.value = messageToModify.text;
                
                const actions = document.createElement('div');
                actions.className = 'message-edit-actions';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'message-edit-btn save';
                saveBtn.textContent = '保存';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'message-edit-btn cancel';
                cancelBtn.textContent = '取消';

                actions.appendChild(cancelBtn);
                actions.appendChild(saveBtn);
                editContainer.appendChild(textarea);
                editContainer.appendChild(actions);

                targetMessageElement.appendChild(editContainer);
                textarea.focus();
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';

                const cleanup = () => {
                    editContainer.remove();
                    bubble.style.display = '';
                    currentEditCleanup = null;
                };
                currentEditCleanup = cleanup;

                saveBtn.onclick = async () => {
                    const newText = textarea.value.trim();
                    if (newText) {
                        currentHistory[targetMessageIndex].text = newText;
                        cleanup();
                        await updateChatHistory(currentHistory);
                    } else {
                        // 如果内容被清空，视为删除
                        currentHistory.splice(targetMessageIndex, 1);
                        cleanup();
                        await updateChatHistory(currentHistory);
                    }
                };
                cancelBtn.onclick = cleanup;

                break;
            }
            case 'delete': {
                if (confirm('确定要删除这条消息吗？')) {
                    currentHistory.splice(targetMessageIndex, 1);
                    await updateChatHistory(currentHistory);
                }
                break;
            }
            default:
                alert(`“${menuItem.querySelector('span').textContent}”功能待开发...`);
                break;
        }
    });
}