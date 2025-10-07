// 1. 在模块顶部导入需要的函数
import { createPageLayout } from '../common/template.js';

// 2. 定义页面的专属 HTML 内容
const ruleManagementPageContent = `
    <!-- Tab 导航栏 -->
    <nav class="tabs-nav">
        <div class="tabs-container">
            <button class="tab-button active" data-tab="chat">心语低鸣</button>
            <button class="tab-button" data-tab="reading">万象交响</button>
            <button class="tab-button" data-tab="diary">岁月画卷</button>
        </div>
    </nav>

    <!-- 用于显示小爱心的独立元素 -->
    <div class="active-tab-indicator"></div>

    <div class="main-container">
        <main class="content-body">
            <!-- Tab 内容面板 -->
            <div class="tabs-content">
                <div id="chat" class="tab-pane active">
                    <p>这里是【心语低鸣】规则的设置区。</p>
                </div>
                <div id="reading" class="tab-pane">
                    <p>这里是【万象交响】规则的设置区。</p>
                </div>
                <div id="diary" class="tab-pane">
                    <p>这里是【岁月画卷】规则的设置区。</p>
                </div>
            </div>
        </main>
    </div>
`;

/**
 * 页面加载后需要执行的所有初始化操作。
 */
function initializePage() {
    console.log("规则提示词页面JS加载，小爱心指示器逻辑已启动。");

    const indicator = document.querySelector('.active-tab-indicator');
    const tabsNav = document.querySelector('.tabs-nav');
    
    function updateIndicatorPosition() {
        const activeButton = document.querySelector('.tab-button.active');
        if (!indicator || !activeButton || !tabsNav) {
            if(indicator) indicator.style.opacity = '0';
            return;
        }

        const buttonRect = activeButton.getBoundingClientRect();
        const buttonCenter = buttonRect.left + buttonRect.width / 2;
        const indicatorLeft = buttonCenter - (indicator.offsetWidth / 2);

        indicator.style.left = `${indicatorLeft}px`;
        indicator.style.opacity = '1';

        const tabsNavRect = tabsNav.getBoundingClientRect();
        indicator.style.top = `${tabsNavRect.top + tabsNav.offsetHeight - indicator.offsetHeight / 2 - 4}px`;
        indicator.style.position = 'fixed';
    }

    // 事件委托：监听整个 body 的点击事件
    document.body.addEventListener('click', function(event) {
        if (event.target.matches('.tab-button')) {
            const clickedButton = event.target;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

            clickedButton.classList.add('active');
            const targetPane = document.getElementById(clickedButton.dataset.tab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            updateIndicatorPosition();
        }
    });

    // 初始调用和事件绑定
    requestAnimationFrame(updateIndicatorPosition);
    window.addEventListener('scroll', updateIndicatorPosition, { passive: true });
    window.addEventListener('resize', updateIndicatorPosition);
}

// 3. 定义羽毛笔按钮的功能
const handleRuleManagementFeatherClick = () => {
    console.log('羽毛笔被点击，可以在这里执行保存规则提示词相关设置的逻辑。');
    alert('规则已保存！(模拟)');
};

// 4. 脚本的入口：调用 createPageLayout 来构建页面
//    并将所有初始化逻辑作为 onPageLoad 回调传入
createPageLayout({
    title: '规则提示词',
    contentHtml: ruleManagementPageContent,
    onFeatherClick: handleRuleManagementFeatherClick,
    onPageLoad: initializePage // 关键：确保在HTML渲染完毕后再执行初始化
});