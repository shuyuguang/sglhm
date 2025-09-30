// ▼▼▼ [核心修正] 将导入路径从 ../../db.js 改为 ../db.js ▼▼▼
import { dbStorage } from '../db.js'; // 导入共享的 dbStorage

/**
 * 从 IndexedDB 同步当前用户数据到 forum.html 的 "我" 界面
 */
async function syncForumProfile() {
    // 1. 获取 "我" 界面的相关 DOM 元素
    const meContent = document.getElementById('me-content');
    if (!meContent) return; // 如果没有 "我" 的面板，则不执行

    const bannerDiv = meContent.querySelector('.profile-banner');
    const avatarImg = me-content.querySelector('.profile-avatar');
    const usernameDiv = meContent.querySelector('.profile-username');
    const bioDiv = meContent.querySelector('.profile-bio'); // 顺便把简介也加上

    if (!bannerDiv || !avatarImg || !usernameDiv || !bioDiv) {
        console.error('无法在 forum.html 的 "我" 界面中找到所需元素。');
        return;
    }

    // 2. 从数据库读取数据
    const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
    const allProfiles = await dbStorage.getItem('userProfileData');

    if (!allProfiles || allProfiles.length === 0) {
        console.warn('数据库中没有用户数据。');
        return;
    }

    // 3. 查找当前用户
    const currentProfile = allProfiles.find(p => p.id === currentProfileId);

    // 4. 更新 UI
    if (currentProfile) {
        usernameDiv.textContent = currentProfile.name || '未命名';
        avatarImg.src = currentProfile.avatar;
        bannerDiv.style.backgroundImage = `url('${currentProfile.banner}')`;
        bioDiv.textContent = currentProfile.bio || '热爱生活，探索未知。'; // 更新简介
    } else {
        const fallbackProfile = allProfiles[0];
        usernameDiv.textContent = fallbackProfile.name || '未命名';
        avatarImg.src = fallbackProfile.avatar;
        bannerDiv.style.backgroundImage = `url('${fallbackProfile.banner}')`;
        bioDiv.textContent = fallbackProfile.bio || '热爱生活，探索未知。'; // 更新简介
    }
}


document.addEventListener('DOMContentLoaded', function() {
    console.log("Felotus论坛页面加载完成。");

    syncForumProfile();

    const mainTabItems = document.querySelectorAll('.tab-item');
    const mainContentItems = document.querySelectorAll('.tab-content');

    mainTabItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();
            mainTabItems.forEach(tab => tab.classList.remove('active'));
            this.classList.add('active');
            const targetTab = this.getAttribute('data-tab');
            mainContentItems.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(targetTab + '-content');
            if (targetContent) {
                targetContent.classList.add('active');
            }
            console.log(`切换到主 Tab: ${targetTab}`);
        });
    });

    function initializeSubTabs(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const subTabItems = container.querySelectorAll('.sub-tab-item');
        const subContentItems = container.querySelectorAll('.sub-tab-content');

        subTabItems.forEach(item => {
            item.addEventListener('click', function() {
                subTabItems.forEach(subTab => subTab.classList.remove('active'));
                this.classList.add('active');
                const targetSubTab = this.getAttribute('data-sub-tab');
                subContentItems.forEach(content => content.classList.remove('active'));
                const targetSubContent = container.querySelector('#' + targetSubTab + '-content');
                if (targetSubContent) {
                    targetSubContent.classList.add('active');
                }
                console.log(`在 ${containerSelector} 中切换到子 Tab: ${targetSubTab}`);
            });
        });
    }

    initializeSubTabs('#home-content');
    initializeSubTabs('#notifications-content');
    initializeSubTabs('#me-content');

    const fabContainer = document.querySelector('.fab-container');
    const fabButton = document.querySelector('.create-post-fab');

    if (fabButton && fabContainer) {
        
        const openFabMenu = () => {
            if (fabContainer.classList.contains('active')) return;
            fabContainer.classList.add('active');
            fabButton.classList.add('active');
            fabButton.setAttribute('title', '发布帖子');
            setTimeout(() => {
                document.addEventListener('click', handleOutsideClick);
            }, 0);
        };

        const closeFabMenu = () => {
            fabContainer.classList.remove('active');
            fabButton.classList.remove('active');
            fabButton.setAttribute('title', '创建');
            document.removeEventListener('click', handleOutsideClick);
        };

        const handleOutsideClick = (event) => {
            if (!fabContainer.contains(event.target)) {
                closeFabMenu();
            }
        };

        fabButton.addEventListener('click', function(event) {
            if (this.classList.contains('active')) {
                console.log("执行发帖操作！");
            } else {
                event.preventDefault();
                openFabMenu();
            }
        });
    }
});