// personality.js

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 保存并返回逻辑 ---
    const saveButton = document.getElementById('save-btn');
    if (saveButton) {
        saveButton.addEventListener('click', function() {
            
            // --- 这里是未来的保存逻辑 ---
            console.log("正在保存个性化设置...");

            // 保存操作（模拟）后，立即跳转回主页
            window.location.href = '../../app.html';

        });
    }

    // --- Tab 切换逻辑 ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮和面板的 active 状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // 为当前点击的按钮和对应面板添加 active 状态
            button.classList.add('active');
            const targetPane = document.getElementById(button.dataset.tab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
    
    console.log("个性化页面加载完成，并已为按钮和Tab绑定事件。");
});