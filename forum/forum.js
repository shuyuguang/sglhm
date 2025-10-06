// 1. 在模块顶部导入所有需要的函数和库
import { createPageLayout } from '../common/template.js';
import { dbStorage } from '../common/db.js'; // 确保 db.js 路径正确

// 2. 将页面专属的 HTML 内容定义为常量
const forumPageContent = `
    <div class="main-container">
        <main class="content-body">
            
            <!-- 首页内容 -->
            <div id="home-content" class="tab-content active">
                <nav class="sub-tab-nav">
                    <button class="sub-tab-item active" data-sub-tab="recommend">为你推荐</button>
                    <button class="sub-tab-item" data-sub-tab="following">正在关注</button>
                </nav>
                <div class="sub-tab-content-wrapper">
                    <div id="recommend-content" class="sub-tab-content active"><p>这里是【为你推荐】的内容区。</p></div>
                    <div id="following-content" class="sub-tab-content"><p>这里是【正在关注】的内容区。</p></div>
                </div>
                <div class="fab-container">
                    <div class="fab-options">
                        <a href="#" class="fab-option">
                            <span class="fab-label">直播</span>
                            <i class="fa-solid fa-video"></i>
                        </a>
                        <a href="#" class="fab-option">
                            <span class="fab-label">空间</span>
                            <i class="fa-solid fa-microphone"></i>
                        </a>
                        <a href="#" class="fab-option">
                            <span class="fab-label">图片</span>
                            <i class="fa-solid fa-image"></i>
                        </a>
                    </div>
                    <div class="fab-main-action">
                        <span class="fab-label main-label">发帖</span>
                        <a href="#" class="create-post-fab" title="创建">
                            <i class="fa-solid fa-plus icon-plus"></i>
                            <i class="fa-solid fa-feather-pointed icon-pen"></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- 通知内容 -->
            <div id="notifications-content" class="tab-content">
                <nav class="sub-tab-nav">
                    <button class="sub-tab-item active" data-sub-tab="all">全部</button>
                    <button class="sub-tab-item" data-sub-tab="mentions">提及</button>
                    <button class="sub-tab-item" data-sub-tab="replies">回复</button>
                </nav>
                <div class="sub-tab-content-wrapper">
                    <div id="all-content" class="sub-tab-content active"><p>这里是【全部】的通知。</p></div>
                    <div id="mentions-content" class="sub-tab-content"><p>这里是【提及】我的通知。</p></div>
                    <div id="replies-content" class="sub-tab-content"><p>这里是【回复】我的通知。</p></div>
                </div>
            </div>

            <!-- 我的内容 -->
            <div id="me-content" class="tab-content">
                <div class="profile-page">
                    <div class="profile-banner"></div>
                    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Avatar" class="profile-avatar">
                    <div class="profile-details">
                        <div class="profile-username">&nbsp;</div>
                        <div class="profile-bio"></div>
                        <div class="profile-stats">
                            <div class="stat-item"><span>-</span> 正在关注</div>
                            <div class="stat-item"><span>-</span> 关注者</div>
                        </div>
                    </div>
                </div>
                
                <nav class="sub-tab-nav">
                    <button class="sub-tab-item active" data-sub-tab="posts">帖子</button>
                    <button class="sub-tab-item" data-sub-tab="replies-me">回复</button>
                    <button class="sub-tab-item" data-sub-tab="likes">喜欢</button>
                </nav>
                <div class="sub-tab-content-wrapper">
                    <div id="posts-content" class="sub-tab-content active"><p>这里是我发布的【帖子】列表。</p></div>
                    <div id="replies-me-content" class="sub-tab-content"><p>这里是我的【回复】列表。</p></div>
                    <div id="likes-content" class="sub-tab-content"><p>这里是我【喜欢】的内容列表。</p></div>
                </div>
            </div>

        </main>
    </div>

    <!-- 底部导航栏 -->
    <nav class="bottom-tab-nav">
        <a href="#" class="tab-item active" data-tab="home"><i class="fa-solid fa-house"></i></a>
        <a href="#" class="tab-item" data-tab="notifications"><i class="fa-solid fa-bell"></i></a>
        <a href="#" class="tab-item" data-tab="me"><i class="fa-solid fa-user"></i></a>
    </nav>
`;

/**
 * 页面加载后需要执行的所有初始化操作。
 * 这个函数将在页面HTML渲染完毕后被调用。
 */
function initializePage() {
    console.log("喵言咪语页面加载完成，开始绑定事件和同步数据。");

    // 3a. 同步"我"页面的个人资料
    syncForumProfile();

    // 3b. 绑定主 Tab 切换事件
    const mainTabItems = document.querySelectorAll('.tab-item');
    const mainContentItems = document.querySelectorAll('.tab-content');
    mainTabItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();
            mainTabItems.forEach(tab => tab.classList.remove('active'));
            this.classList.add('active');
            const targetTab = this.getAttribute('data-tab');
            mainContentItems.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab + '-content')?.classList.add('active');
        });
    });

    // 3c. 绑定所有子 Tab 切换事件
    initializeSubTabs('#home-content');
    initializeSubTabs('#notifications-content');
    initializeSubTabs('#me-content');

    // 3d. 绑定悬浮按钮(FAB)的交互事件
    initializeFab();
}

/**
 * 从 IndexedDB 同步当前用户数据到 "我" 界面
 */
async function syncForumProfile() {
    const meContent = document.getElementById('me-content');
    if (!meContent) return;

    const bannerDiv = meContent.querySelector('.profile-banner');
    const avatarImg = meContent.querySelector('.profile-avatar');
    const usernameDiv = meContent.querySelector('.profile-username');
    const bioDiv = meContent.querySelector('.profile-bio');

    if (!bannerDiv || !avatarImg || !usernameDiv || !bioDiv) {
        console.error('无法在 "我" 界面中找到所需元素。');
        return;
    }

    try {
        const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
        const allProfiles = await dbStorage.getItem('userProfileData');
        if (!allProfiles || allProfiles.length === 0) return;

        const currentProfile = allProfiles.find(p => p.id === currentProfileId) || allProfiles[0];
        
        usernameDiv.textContent = currentProfile.name || '未命名';
        avatarImg.src = currentProfile.avatar;
        bannerDiv.style.backgroundImage = `url('${currentProfile.banner}')`;
        bioDiv.textContent = currentProfile.bio || '热爱生活，探索未知。';
    } catch (error) {
        console.error("同步用户资料失败:", error);
    }
}

/**
 * 初始化指定容器内的子 Tab
 * @param {string} containerSelector 容器的选择器
 */
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
            container.querySelector(`#${targetSubTab}-content`)?.classList.add('active');
        });
    });
}

/**
 * 初始化悬浮操作按钮 (FAB)
 */
function initializeFab() {
    const fabContainer = document.querySelector('.fab-container');
    const fabButton = document.querySelector('.create-post-fab');
    if (!fabButton || !fabContainer) return;

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
            // 这里可以添加跳转或弹窗逻辑
        } else {
            event.preventDefault();
            fabContainer.classList.add('active');
            this.classList.add('active');
            fabButton.setAttribute('title', '发布帖子');
            setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
        }
    });
}


// 4. 脚本的入口：调用 createPageLayout 来构建页面
//    并将所有初始化逻辑作为 onPageLoad 回调传入
createPageLayout({
    title: '喵言咪语',
    contentHtml: forumPageContent,
    onPageLoad: initializePage  // 关键：确保在HTML渲染后再执行初始化
});