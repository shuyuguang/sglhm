// capsule-toy.js

document.addEventListener('DOMContentLoaded', function() {
    
    const addButton = document.getElementById('add-btn');
    if (addButton) {
        addButton.addEventListener('click', function() {
            // 这里是未来的新增逻辑
            console.log("新增按钮被点击。");
        });
    }
    
    console.log("扭蛋页面加载完成，并已为新按钮绑定事件。");
});