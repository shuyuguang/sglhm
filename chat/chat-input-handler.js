// 文件名: relia-chat/chat-input-handler.js

/**
 * 初始化底部输入区域的交互逻辑
 * @param {object} elements - 共享的DOM元素引用
 * @param {function} updateButtonStates - 更新发送按钮状态的回调函数
 * @param {object} state - 共享的状态对象
 * @param {string} diyDbKey - 用于存储DIY状态的数据库键
 * @param {object} dbStorage - 数据库访问对象
 */
export function initializeInputArea(elements, updateButtonStates, state, diyDbKey, dbStorage) {

    // 输入框自适应高度和按钮状态更新
    if (elements.input) {
        elements.input.addEventListener('input', () => {
            elements.input.style.height = 'auto';
            elements.input.style.height = (elements.input.scrollHeight) + 'px';
            updateButtonStates();
        });

        // 点击输入框时，关闭所有展开的面板
        elements.input.addEventListener('focus', () => {
            elements.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
        });
    }

    // “+” 动作菜单的展开/收起
    if (elements.actionsToggleBtn && elements.actionsMenu) {
        // ▼▼▼ 核心修改：移除了Tab切换的逻辑 ▼▼▼
        elements.actionsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.chatInputArea.classList.remove('emoji-expanded');
            elements.chatInputArea.classList.toggle('actions-expanded');
        });
        // ▲▲▲ 修改结束 ▲▲▲
    }
    
    // DIY 开关逻辑
    if (elements.diySwitch) {
        elements.diySwitch.addEventListener('change', async () => {
            state.isDiyEnabled = elements.diySwitch.checked;
            await dbStorage.setItem(diyDbKey, state.isDiyEnabled);
            console.log(`DIY mode set to: ${state.isDiyEnabled}`);
        });
    }

    // 点击页面其他地方关闭展开的面板
    document.addEventListener('click', (event) => {
        if (elements.chatInputArea && !elements.chatInputArea.contains(event.target)) {
             elements.chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
        }
    });
}