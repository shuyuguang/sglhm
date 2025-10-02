/**
 * 页面布局生成器
 * 它会清空 <body> 并创建标准的头部和内容区域。
 * 
 * @param {object} options - 配置对象
 * @param {string} options.title - 页面顶部显示的标题
 * @param {string} options.contentHtml - 页面主体区域要显示的 HTML 内容
 * @param {string} [options.modalsHtml=''] - (可选) 页面所需的模态框、面板等浮层元素的 HTML
 * @param {function} options.onFeatherClick - 当右上角的羽毛笔按钮被点击时要执行的函数
 * @param {function} [options.onPageLoad] - (可选) 页面HTML渲染完成后要执行的初始化函数
 */
// ▼▼▼ 核心修改：在函数前添加 export 关键字 ▼▼▼
export function createPageLayout({ title, contentHtml, modalsHtml = '', onFeatherClick, onPageLoad }) {
    
    const pageHtml = `
        <header class="page-header">
            <h1 class="page-title">${title}</h1>
            <div class="header-actions">
                <button class="btn-help" id="help-btn" title="帮助"><i class="fa-solid fa-question"></i></button>
                <button class="btn-add" id="add-btn" title="新增"><i class="fa-solid fa-feather-pointed"></i></button>
                <a href="../app.html" class="btn-back" title="返回"><i class="fa-solid fa-chevron-right"></i></a>
            </div>
        </header>

        <div class="main-container">
            <main class="content-body">
                ${contentHtml}
            </main>
        </div>

        ${modalsHtml}
    `;

    document.body.innerHTML = pageHtml;

    // 为羽毛笔按钮绑定事件
    const featherButton = document.getElementById('add-btn');
    if (featherButton && typeof onFeatherClick === 'function') {
        featherButton.addEventListener('click', onFeatherClick);
    }

    // 如果有页面加载后的回调函数，则执行它
    if (typeof onPageLoad === 'function') {
        onPageLoad();
    }
}