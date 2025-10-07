// relia-chat/chat-setting.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. 从URL获取角色ID
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        document.body.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
        return;
    }

    // 2. 定义页面HTML结构
    const pageHtml = `
        <div class="setting-page">
            <header class="setting-header">
                <a href="./chat-room.html?id=${charId}" class="back-btn">
                    <i class="fa-solid fa-chevron-left"></i>
                </a>
                <h1 class="header-title">聊天设置</h1>
            </header>
            <main class="setting-content">
                <div class="setting-menu" id="setting-menu">
                    <div class="setting-item" data-action="view-history">
                        <span>查看聊天记录</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <div class="setting-item" data-action="hide-avatar">
                        <span>隐藏当前聊天头像</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                    <div class="setting-item" data-action="set-background">
                        <span>设置当前聊天背景</span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </main>
        </div>
    `;

    // 3. 将HTML渲染到页面
    document.body.innerHTML = pageHtml;

    // 4. 绑定事件监听器 (为未来功能做准备)
    const settingMenu = document.getElementById('setting-menu');
    if (settingMenu) {
        settingMenu.addEventListener('click', (event) => {
            const item = event.target.closest('.setting-item');
            if (!item) return;

            const action = item.dataset.action;
            
            // 根据data-action属性执行不同操作
            switch (action) {
                case 'view-history':
                    alert('“查看聊天记录”功能尚未实现。');
                    break;
                case 'hide-avatar':
                    alert('“隐藏当前聊天头像”功能尚未实现。');
                    break;
                case 'set-background':
                    alert('“设置当前聊天背景”功能尚未实现。');
                    break;
                default:
                    console.warn('未知的设置项:', action);
            }
        });
    }
});