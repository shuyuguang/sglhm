// 文件名: relia-chat/chat-header.js

/**
 * 初始化顶部菜单系统
 * @param {object} elements - 共享的DOM元素引用
 */
// ▼▼▼ 核心修改：移除 editors 参数 ▼▼▼
export function initializeHeaderMenu(elements) {
    const toggleMenu = () => {
        elements.headerContentPanel.classList.toggle('active');
        elements.headerTabsPanel.classList.toggle('active');
        elements.headerMenuOverlay.classList.toggle('active');
    };

    if (elements.menuBtn) {
        elements.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    if (elements.headerMenuOverlay) {
        elements.headerMenuOverlay.addEventListener('click', toggleMenu);
    }

    const menuList = elements.headerTabsPanel?.querySelector('.header-menu-list');
    if (menuList && elements.headerContentPanel) {
        menuList.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            e.preventDefault();
            const targetId = link.dataset.target;

            menuList.querySelectorAll('a.active').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            elements.headerContentPanel.querySelectorAll('.secondary-content-pane.active').forEach(p => p.classList.remove('active'));
            document.getElementById(targetId)?.classList.add('active');
        });
    }
}