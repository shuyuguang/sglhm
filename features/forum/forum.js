import { dbStorage } from '../../db.js';// 导入共享的 dbStorage

/**
 * 从 IndexedDB 同步当前用户数据到 forum.html 的 "我" 界面
 */
async function syncForumProfile() {
    // 1. 获取 "我" 界面的相关 DOM 元素
    const meContent = document.getElementById('me-content');
    if (!meContent) return; // 如果没有 "我" 的面板，则不执行

    const bannerDiv = meContent.querySelector('.profile-banner');
    const avatarImg = meContent.querySelector('.profile-avatar');
    const usernameDiv = meContent.querySelector('.profile-username');

    if (!bannerDiv || !avatarImg || !usernameDiv) {
        console.error('无法在 forum.html 的 "我" 界面中找到所需元素。');
        return;
    }

    // 2. 从数据库读取数据
    const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
    const allProfiles = await dbStorage.getItem('userProfileData');

    if (!allProfiles || allProfiles.length === 0) {
        console.warn('数据库中没有用户数据。');
        // 可选：设置默认值
        usernameDiv.textContent = 'Felotus';
        avatarImg.src = 'https://picsum.photos/seed/felotus-me/200/200';
        bannerDiv.style.backgroundImage = "url('https://i.postimg.cc/768WYVvR/ocean.jpg')";
        return;
    }

    // 3. 查找当前用户
    const currentProfile = allProfiles.find(p => p.id === currentProfileId);

    // 4. 更新 UI
    if (currentProfile) {
        usernameDiv.textContent = currentProfile.name || '未命名';
        avatarImg.src = currentProfile.avatar;
        // 背景是 background-image
        bannerDiv.style.backgroundImage = `url('${currentProfile.banner}')`;
    } else {
        const fallbackProfile = allProfiles[0];
        usernameDiv.textContent = fallbackProfile.name || '未命名';
        avatarImg.src = fallbackProfile.avatar;
        bannerDiv.style.backgroundImage = `url('${fallbackProfile.banner}')`;
    }
}


// forum.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Felotus论坛页面加载完成。");

    // ▼▼▼ 新增：在页面加载时调用同步函数 ▼▼▼
    syncForumProfile();

    // --- 一级 Tab (底部导航) 逻辑 (无变化) ---
    // ... (你原来的 forum.js 代码保持不变) ...
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

    // --- 【重构】二级 Tab 逻辑 ---
    // ... (你原来的 forum.js 代码保持不变) ...
    function initializeSubTabs(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return; // 如果容器不存在，则直接返回

        const subTabItems = container.querySelectorAll('.sub-tab-item');
        const subContentItems = container.querySelectorAll('.sub-tab-content');

        subTabItems.forEach(item => {
            item.addEventListener('click', function() {
                // 只在当前容器内切换 active 状态
                subTabItems.forEach(subTab => subTab.classList.remove('active'));
                this.classList.add('active');

                const targetSubTab = this.getAttribute('data-sub-tab');
                
                // 只在当前容器内切换内容
                subContentItems.forEach(content => content.classList.remove('active'));
                const targetSubContent = container.querySelector('#' + targetSubTab + '-content');
                if (targetSubContent) {
                    targetSubContent.classList.add('active');
                }

                console.log(`在 ${containerSelector} 中切换到子 Tab: ${targetSubTab}`);
            });
        });
    }

    // 分别为首页和通知页初始化二级 Tab
    initializeSubTabs('#home-content');
    initializeSubTabs('#notifications-content');
    
    // 【新增】为“我”的页面初始化二级 Tab
    initializeSubTabs('#me-content');


    // ▼▼▼ 重写：悬浮按钮菜单逻辑 ▼▼▼
    // ... (你原来的 forum.js 代码保持不变) ...
    const fabContainer = document.querySelector('.fab-container');
    const fabButton = document.querySelector('.create-post-fab');

    if (fabButton && fabContainer) {
        
        const openFabMenu = () => {
            if (fabContainer.classList.contains('active')) return; // 如果已经打开，则不执行任何操作
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
            // 点击的目标不在 fabContainer 内部，则关闭菜单
            if (!fabContainer.contains(event.target)) {
                closeFabMenu();
            }
        };

        fabButton.addEventListener('click', function(event) {
            // 检查当前是否是激活状态 (羽毛笔)
            if (this.classList.contains('active')) {
                // 如果是羽毛笔，它就是“发帖”按钮，让链接正常工作
                console.log("执行发帖操作！");
                // 关键：这里不再调用 closeFabMenu()
            } else {
                // 如果是加号，它的功能是打开菜单
                event.preventDefault(); // 阻止 a 标签的默认跳转行为
                openFabMenu();
            }
        });
    }
});