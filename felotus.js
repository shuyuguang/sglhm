// ▼▼▼ 核心修正：确保 import 路径正确，并只导入已导出的项 ▼▼▼
import { dbStorage } from './common/db.js';

/**
 * 从 IndexedDB 同步当前用户数据到 felotus.html 的 UI
 */
async function syncProfileData() {
    // 1. 获取 DOM 元素
    const avatarImg = document.querySelector('.top-left-profile .avatar');
    const usernameSpan = document.querySelector('.top-left-profile .username');
    
    if (!avatarImg || !usernameSpan) {
        console.error('无法在 felotus.html 中找到头像或用户名元素。');
        return;
    }

    // 2. 从数据库读取数据
    const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
    const allProfiles = await dbStorage.getItem('userProfileData');

    if (!allProfiles || allProfiles.length === 0) {
        console.warn('数据库中没有用户数据。');
        usernameSpan.innerHTML = '&nbsp;';
        return;
    }

    // 3. 查找当前用户
    const currentProfile = allProfiles.find(p => p.id === currentProfileId);

    // 4. 更新 UI
    if (currentProfile) {
        usernameSpan.textContent = currentProfile.name || '未命名';
        avatarImg.src = currentProfile.avatar;
    } else {
        const fallbackProfile = allProfiles[0];
        usernameSpan.textContent = fallbackProfile.name || '未命名';
        avatarImg.src = fallbackProfile.avatar;
    }
}


// 确保在DOM加载完毕后执行脚本
document.addEventListener('DOMContentLoaded', () => {
    
    syncProfileData();

    const initializePanel = (openBtnId, panelId) => {
        const openBtn = document.getElementById(openBtnId);
        const panel = document.getElementById(panelId);
        
        if (openBtn && panel) {
            openBtn.addEventListener('click', (event) => {
                event.preventDefault(); 
                panel.classList.add('visible');
            });

            panel.addEventListener('click', (event) => {
                if (event.target === panel) {
                    panel.classList.remove('visible');
                }
            });
        }
    };

    initializePanel('open-stellar-totem-btn', 'stellar-totem-panel');

    const openSideMenuBtn = document.getElementById('open-side-menu-btn');
    const sideMenuPanel = document.getElementById('side-menu-panel');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');

    if (openSideMenuBtn && sideMenuPanel && sideMenuOverlay) {
        openSideMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sideMenuOverlay.classList.add('visible');
            sideMenuPanel.classList.add('visible');
        });

        sideMenuOverlay.addEventListener('click', () => {
            sideMenuOverlay.classList.remove('visible');
            sideMenuPanel.classList.remove('visible');
        });
    }
});