// read.js

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 保存并返回逻辑 ---
    const saveButton = document.getElementById('save-btn');
    if (saveButton) {
        saveButton.addEventListener('click', function() {
            
            // --- 这里是未来的保存逻辑 ---
            console.log("正在保存阅读信息...");

            // 保存操作（模拟）后，立即跳转回主页
            window.location.href = '../../app.html';

        });
    }
    
    console.log("阅读页面加载完成，并已为按钮绑定事件。");
});