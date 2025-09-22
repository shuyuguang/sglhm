import { dbStorage } from './db.js'; // 导入共享的 dbStorage

/**
 * 从 IndexedDB 同步当前用户数据到 app.html 的 UI
 */
async function syncProfileData() {
    // 1. 获取 DOM 元素
    const avatarImg = document.querySelector('.top-left-profile .avatar');
    const usernameSpan = document.querySelector('.top-left-profile .username');
    
    if (!avatarImg || !usernameSpan) {
        console.error('无法在 app.html 中找到头像或用户名元素。');
        return;
    }

    // 2. 从数据库读取数据
    const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
    const allProfiles = await dbStorage.getItem('userProfileData');

    // ▼▼▼ 修改这里的后备逻辑 ▼▼▼
    if (!allProfiles || allProfiles.length === 0) {
        console.warn('数据库中没有用户数据。');
        // 将后备方案也设置为空内容，这样就不会加载任何图片
        usernameSpan.innerHTML = '&nbsp;'; // 使用空格占位
        // 头像的 src 在 HTML 中已经是透明图片了，这里无需再设置
        return;
    }
    // ▲▲▲ 修改结束 ▲▲▲

    // 3. 查找当前用户
    const currentProfile = allProfiles.find(p => p.id === currentProfileId);

    // 4. 更新 UI
    if (currentProfile) {
        usernameSpan.textContent = currentProfile.name || '未命名';
        avatarImg.src = currentProfile.avatar;
    } else {
        // 如果找不到当前用户（例如数据损坏），则使用第一个用户或默认值
        const fallbackProfile = allProfiles[0];
        usernameSpan.textContent = fallbackProfile.name || '未命名';
        avatarImg.src = fallbackProfile.avatar;
    }
}


// 确保在DOM加载完毕后执行脚本
document.addEventListener('DOMContentLoaded', () => {
    
    // ▼▼▼ 新增：在页面加载时调用同步函数 ▼▼▼
    syncProfileData();

    /**
     * 初始化居中模态面板的函数
     * @param {string} openBtnId - 打开面板的按钮的ID
     * @param {string} panelId - 面板的ID
     */
    const initializePanel = (openBtnId, panelId) => {
        const openBtn = document.getElementById(openBtnId);
        const panel = document.getElementById(panelId);
        
        if (openBtn && panel) {
            
            // 1. 给“打开”按钮添加点击事件
            openBtn.addEventListener('click', (event) => {
                event.preventDefault(); 
                panel.classList.add('visible');
            });

            // 2. 点击面板的灰色背景区域可以关闭面板
            panel.addEventListener('click', (event) => {
                if (event.target === panel) {
                    panel.classList.remove('visible');
                }
            });
        }
    };

    // 初始化“星图”面板
    initializePanel('open-stellar-totem-btn', 'stellar-totem-panel');

    // [删除] 初始化“公告”面板的调用已被移除


    // --- 【新增】侧边菜单面板的控制逻辑 ---
    const openSideMenuBtn = document.getElementById('open-side-menu-btn');
    const sideMenuPanel = document.getElementById('side-menu-panel');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');

    if (openSideMenuBtn && sideMenuPanel && sideMenuOverlay) {
        
        // 打开侧边菜单
        openSideMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sideMenuOverlay.classList.add('visible');
            sideMenuPanel.classList.add('visible');
        });

        // 点击遮罩层关闭侧边菜单
        sideMenuOverlay.addEventListener('click', () => {
            sideMenuOverlay.classList.remove('visible');
            sideMenuPanel.classList.remove('visible');
        });
    }
});