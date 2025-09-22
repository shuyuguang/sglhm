// leisure.js

document.addEventListener('DOMContentLoaded', function() {
    
    // 【修改点】获取的元素 ID 从 'add-btn' 改为 'edit-btn'
    const editButton = document.getElementById('edit-btn');
    if (editButton) {
        editButton.addEventListener('click', function() {
            // 这里是未来的编辑逻辑
            console.log("编辑按钮被点击。");
        });
    }
    
    // 【修改点】更新了日志信息
    console.log("休闲页面加载完成，并已为编辑按钮绑定事件。");
});