// rule-management.js

document.addEventListener('DOMContentLoaded', function() {
    
    function updateIndicatorPosition() {
        const indicator = document.querySelector('.active-tab-indicator');
        const activeButton = document.querySelector('.tab-button.active');
        const tabsNav = document.querySelector('.tabs-nav');

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

    requestAnimationFrame(updateIndicatorPosition); 

    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.addEventListener('scroll', updateIndicatorPosition);
    }
    window.addEventListener('scroll', updateIndicatorPosition);
    window.addEventListener('resize', updateIndicatorPosition);

    // 【核心修改】更新日志信息
    console.log("规则提示词页面JS加载，小爱心指示器逻辑已启动。");
});