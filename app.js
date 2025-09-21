// 确保在DOM加载完毕后执行脚本
document.addEventListener('DOMContentLoaded', () => {
    
    // 【修改点】移除了 closeBtn
    const openBtn = document.getElementById('open-stellar-totem-btn');
    const panel = document.getElementById('stellar-totem-panel');

    // 【修改点】更新了判断条件
    if (openBtn && panel) {
        
        // 1. 给“星图”图标添加点击事件
        openBtn.addEventListener('click', (event) => {
            event.preventDefault(); 
            panel.classList.add('visible');
        });

        // 【已移除】关闭按钮的点击事件已经删除

        // 2. 点击面板的灰色背景区域可以关闭面板 (这个功能保留)
        panel.addEventListener('click', (event) => {
            if (event.target === panel) {
                panel.classList.remove('visible');
            }
        });
    }
});