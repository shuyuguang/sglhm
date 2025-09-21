// inventory.js

document.addEventListener('DOMContentLoaded', function() {
    
    // ▼▼▼ 修改点：新增按钮的逻辑已全部移除 ▼▼▼
    
    // --- Tab 切换逻辑 (保持不变) ---
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
    
    console.log("物品页面加载完成，并已为Tab绑定事件。");
});