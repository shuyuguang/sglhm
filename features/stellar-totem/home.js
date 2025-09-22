// home.js

document.addEventListener('DOMContentLoaded', function() {
    
    const editButton = document.getElementById('edit-btn');
    if (editButton) {
        editButton.addEventListener('click', function() {
            // 这里是未来的编辑逻辑
            console.log("编辑按钮被点击。");
        });
    }
    
    console.log("家园页面加载完成，并已为编辑按钮绑定事件。");
});