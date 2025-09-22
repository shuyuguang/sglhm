// mailbox.js

document.addEventListener('DOMContentLoaded', function() {
    console.log("邮箱页面加载完成。");

    const multiSelectBtn = document.getElementById('multi-select-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (multiSelectBtn && deleteBtn) {
        multiSelectBtn.addEventListener('click', () => {
            // 切换多选按钮的激活状态
            multiSelectBtn.classList.toggle('active');

            // 根据多选按钮是否激活，来决定删除按钮是否可用
            if (multiSelectBtn.classList.contains('active')) {
                deleteBtn.disabled = false;
                console.log("多选模式已开启");
            } else {
                deleteBtn.disabled = true;
                console.log("多选模式已关闭");
            }
        });

        deleteBtn.addEventListener('click', () => {
            if (!deleteBtn.disabled) {
                // 这里可以添加实际的删除逻辑
                alert("删除按钮被点击！");
            }
        });
    }
});