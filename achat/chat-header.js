// 文件名: achat/chat-header.js

/**
 * 初始化顶部菜单系统
 * @param {object} elements - 共享的DOM元素引用
 * @param {object} editors - 包含 { chatEditor, userEditor } 的对象
 */
export function initializeHeaderMenu(elements, editors) {
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

    if (elements.editUserProfileTrigger) {
        elements.editUserProfileTrigger.addEventListener('click', () => {
            if (editors.userEditor) {
                editors.userEditor.open();
                toggleMenu();
            } else {
                alert('用户编辑器初始化失败！');
            }
        });
    }
    
    if (elements.editCharProfileTrigger) {
        elements.editCharProfileTrigger.addEventListener('click', () => {
            if (editors.chatEditor) {
                editors.chatEditor.open();
                toggleMenu();
            } else {
                alert('角色编辑器初始化失败！');
            }
        });
    }
}