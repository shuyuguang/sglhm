// relia-chat.js

document.addEventListener('DOMContentLoaded', function() {
    
    const addButton = document.getElementById('add-btn');
    if (addButton) {
        addButton.addEventListener('click', function() {
            // 这里是未来的新增逻辑
            console.log("新增按钮被点击。");
            // alert("你点击了新增按钮！"); // <-- 我把这行弹出提示删掉了！
        });
    }
    
    console.log("聊天页面加载完成，并已为新按钮绑定事件。");
});