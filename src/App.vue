<template>
  <div class="game-container">
    
    <!-- ① 左上角：名片区域 -->
    <!-- Vue 路由: 将来可以使用 <router-link> 替代 <a> -->
    <a href="./data-integration/data-integration.html" class="profile-link">
        <div class="area top-left-profile">
            <!-- Vue: 使用 :src 进行动态数据绑定 -->
            <img :src="avatar" alt="Avatar" class="avatar">
            <div class="user-info">
                <!-- Vue: 使用 {{ }} (Mustache 语法) 显示动态文本 -->
                <span class="username">{{ username }}</span>
            </div>
        </div>
    </a>
    
    <!-- ② 右上角：菜单区域 -->
    <div class="area top-right-menu">
        <!-- Vue: 使用 @click.prevent 替代 addEventListener 和 event.preventDefault() -->
        <a href="#" @click.prevent="showSideMenu" class="capsule-btn with-bg" title="菜单">
          <i class="fa-solid fa-bars"></i>
        </a>
    </div>

    <!-- ③ 名片区域下方菜单 -->
    <div class="area left-menu-top">
        <a href="./activity/activity.html" class="capsule-btn" title="活动"><i class="fa-solid fa-champagne-glasses"></i></a>
        <a href="./anniversary/anniversary.html" class="capsule-btn" title="纪念日"><i class="fa-solid fa-calendar-check"></i></a>
        <a href="./capsule-toy/capsule-toy.html" class="capsule-btn" title="扭蛋"><i class="fa-solid fa-egg"></i></a>
        <a href="./memory-achieve/memory-achieve.html" class="capsule-btn" title="记忆馆"><i class="fa-solid fa-camera-retro"></i></a>
    </div>

    <!-- ④ 余额区域下方菜单 -->
    <div class="area right-menu-top">
        <a href="./developer-guide/developer-guide.html" class="capsule-btn" title="与咪互动"><i class="fa-solid fa-cat"></i></a>
        <a href="./forum/forum.html" class="capsule-btn" title="论坛"><i class="fa-solid fa-comments"></i></a>
        <a href="./mailbox/mailbox.html" class="capsule-btn" title="邮箱"><i class="fa-solid fa-envelope"></i></a>
        <a href="./friend-npc/friend-npc.html" class="capsule-btn" title="与NPC交友"><i class="fa-solid fa-users"></i></a>
        <a href="./announcements/announcements.html" class="capsule-btn" title="公告"><i class="fa-solid fa-bullhorn"></i></a>
        <a href="./personality/personality.html" class="capsule-btn" title="个性化"><i class="fa-solid fa-palette"></i></a>
        <a href="./system-setting/system-setting.html" class="capsule-btn" title="设置"><i class="fa-solid fa-gear"></i></a>
    </div>
    
    <!-- ⑤ 左下角信息区域 -->
    <div class="area bottom-left-nav">
        <a href="./api-management/api-management.html" class="capsule-btn with-bg" title="配置"><i class="fa-solid fa-plug"></i></a>
        <a href="./rule-management/rule-management.html" class="capsule-btn with-bg" title="规则"><i class="fa-solid fa-scroll"></i></a>
        <a href="./global-management/global-management.html" class="capsule-btn with-bg" title="世界观"><i class="fa-solid fa-globe"></i></a>
        <a href="./profile/profile.html" class="capsule-btn with-bg" title="设定集"><i class="fa-solid fa-address-book"></i></a>
        <a href="./inventory/inventory.html" class="capsule-btn with-bg" title="背包"><i class="fa-solid fa-briefcase"></i></a>
    </div>

    <!-- ⑥ 信息区域上方菜单 -->
    <div class="area left-menu-bottom">
        <a href="./relia-chat/relia-chat.html" class="capsule-btn phone-icon-link" title="手机"><i class="fa-solid fa-mobile-screen-button"></i></a>
        <a href="./read/read.html" class="capsule-btn" title="阅读"><i class="fa-solid fa-book-open"></i></a>
        <a href="./diary/diary.html" class="capsule-btn" title="日记"><i class="fa-solid fa-book-journal-whills"></i></a>
    </div>

    <!-- ⑦ 右下角陪伴区域 -->
    <div class="area bottom-right-companion">
        <a href="./accompany/accompany.html" class="capsule-btn companion-btn with-bg" title="陪伴"><i class="fa-solid fa-hand-holding-heart"></i></a>
    </div>

    <!-- ⑧ 陪伴区域上方菜单 -->
    <div class="area right-menu-bottom">
        <!-- Vue: 使用 @click.prevent 绑定点击事件 -->
        <a href="#" @click.prevent="showStellarTotemPanel" class="capsule-btn" title="星图">
          <i class="fa-solid fa-circle-nodes"></i>
        </a>
        <a href="./serene-clock/serene-clock.html" class="capsule-btn" title="静谧时钟"><i class="fa-solid fa-clock"></i></a>
    </div>
  </div>

  <!-- 星图面板 -->
  <!-- Vue: 使用 :class 动态绑定 class，当 isStellarTotemVisible 为 true 时，添加 'visible' 类 -->
  <!-- Vue: 使用 @click.self 只在点击遮罩层本身时触发，而不是其子元素 -->
  <div 
    id="stellar-totem-panel" 
    class="panel-overlay" 
    :class="{ visible: isStellarTotemVisible }"
    @click.self="hideStellarTotemPanel"
  >
      <div class="panel-wrapper">
          <div class="panel-header"><h2 class="panel-title">星图·去处</h2></div>
          <div class="panel-content">
              <div class="panel-navigation">
                  <a href="./stellar-totem/explore.html" class="nav-button">
                      <div class="button-main"><i class="fa-solid fa-meteor"></i><span class="button-title">探索</span></div>
                      <p class="button-description">星际漫游</p>
                  </a>
                  <a href="./stellar-totem/leisure.html" class="nav-button">
                      <div class="button-main"><i class="fa-solid fa-map-location-dot"></i><span class="button-title">休闲</span></div>
                      <p class="button-description">城市日常</p>
                  </a>
                  <a href="./stellar-totem/pet.html" class="nav-button">
                      <div class="button-main"><i class="fa-solid fa-paw"></i><span class="button-title">宠物</span></div>
                      <p class="button-description">宠物互动</p>
                  </a>
                  <a href="./stellar-totem/home.html" class="nav-button">
                      <div class="button-main"><i class="fa-solid fa-seedling"></i><span class="button-title">家园</span></div>
                      <p class="button-description">养花种田</p>
                  </a>
              </div>
          </div>
      </div>
  </div>

  <!-- 侧边菜单面板 -->
  <!-- Vue: 同样使用 :class 和 @click 进行状态管理 -->
  <div 
    id="side-menu-overlay" 
    class="side-panel-overlay"
    :class="{ visible: isSideMenuVisible }"
    @click="hideSideMenu"
  ></div>
  <div 
    id="side-menu-panel" 
    class="side-panel"
    :class="{ visible: isSideMenuVisible }"
  >
    <!-- 侧边栏内容可以放在这里 -->
  </div>
</template>

<script setup>
// Vue: 从 'vue' 导入 ref (用于创建响应式变量) 和 onMounted (生命周期钩子)
import { ref, onMounted } from 'vue';
// Vue: 你的数据库模块导入路径可能需要根据项目结构调整
import { dbStorage } from './common/db.js';

// --- Vue: State Management (状态管理) ---
// 使用 ref 创建响应式变量，替代 DOM 元素来存储状态
const username = ref('&nbsp;'); // 初始值为空格
const avatar = ref('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); // 初始值为透明图片

// 控制面板可见性的状态
const isStellarTotemVisible = ref(false);
const isSideMenuVisible = ref(false);

// --- Vue: Methods (方法) ---
/**
 * 从 IndexedDB 同步当前用户数据到 Vue 的响应式状态
 */
async function syncProfileData() {
    try {
      const currentProfileId = await dbStorage.getItem('userCurrentProfileId') || 'felotus';
      const allProfiles = await dbStorage.getItem('userProfileData');

      if (!allProfiles || allProfiles.length === 0) {
          console.warn('数据库中没有用户数据。');
          username.value = '&nbsp;'; // 更新状态
          return;
      }

      const currentProfile = allProfiles.find(p => p.id === currentProfileId) || allProfiles[0];

      if (currentProfile) {
          // 直接更新 ref 变量，Vue 会自动更新 UI
          username.value = currentProfile.name || '未命名';
          avatar.value = currentProfile.avatar;
      }
    } catch (error) {
      console.error('同步用户数据时出错:', error);
      username.value = '加载失败';
    }
}

// 控制星图面板显示/隐藏的方法
const showStellarTotemPanel = () => {
  isStellarTotemVisible.value = true;
};
const hideStellarTotemPanel = () => {
  isStellarTotemVisible.value = false;
};

// 控制侧边菜单显示/隐藏的方法
const showSideMenu = () => {
  isSideMenuVisible.value = true;
};
const hideSideMenu = () => {
  isSideMenuVisible.value = false;
};


// --- Vue: Lifecycle Hooks (生命周期钩子) ---
// onMounted 相当于原生 JS 的 DOMContentLoaded
onMounted(() => {
    syncProfileData();
});
</script>

<style scoped>
/* Vue: 这里直接粘贴 app.css 的全部内容 */
/* `scoped` 属性会确保这些样式只应用到这个组件内的元素，不会污染全局 */

/* --- 基础与重置样式 --- */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

/* 
  注意: html, body 的全局样式最好放在一个全局 CSS 文件中
  (例如 src/assets/main.css)，而不是 scoped 组件里。
  但为了直接转换，暂时放在这里。
*/
:global(html), :global(body) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #fff;
}

/* --- 游戏主容器 --- */
.game-container {
    position: relative;
    width: 100%;
    height: 100%;
    background-image: url('https://i.postimg.cc/768WYVvR/ocean.jpg');
    background-size: cover;
    background-position: center;
}

/* ... (此处省略 app.css 的其余所有内容，请将它们完整粘贴到这里) ... */
/* --- 区域定位 --- */
.area { position: absolute; display: flex; }
/* --- 图标按钮基础样式 --- */
.capsule-btn { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; background-color: transparent; border-radius: 50%; text-decoration: none; color: #f0f0f0; cursor: pointer; transition: all 0.3s ease; font-size: 18px; text-shadow: 0 0 6px rgba(255, 248, 220, 0.35); }
/* --- 带背景的图标样式 --- */
.capsule-btn.with-bg { background-color: rgba(0, 0, 0, 0.45); backdrop-filter: blur(8px); text-shadow: none; }
/* --- 悬停效果 --- */
.capsule-btn:not(.with-bg):hover { transform: scale(1.15); color: #fff; }
/* --- 区域样式 (这部分无变化) --- */
.top-left-profile { top: 20px; left: 15px; align-items: flex-start; }
.avatar { width: 56px; height: 56px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.7); object-fit: cover; margin-right: 10px; }
.user-info { display: flex; flex-direction: column; padding-top: 10px; }
.username { font-size: 16px; font-weight: bold; }
.top-right-menu { top: 30px; right: 0; align-items: center; }
.top-right-menu .capsule-btn { height: 36px; width: 56px; border-radius: 24px 0 0 24px; }
.left-menu-top { top: 90px; left: 5px; flex-direction: column; }
.right-menu-top { top: 90px; right: 5px; flex-direction: column; align-items: flex-end; }
.bottom-left-nav { bottom: 20px; left: 15px; gap: 10px; }
.bottom-left-nav .capsule-btn { width: 38px; height: 38px; font-size: 15px; }
.left-menu-bottom { bottom: 72px; left: 5px; flex-direction: column; }
.bottom-right-companion { bottom: 20px; right: 25px; }
.companion-btn { width: 60px; height: 60px; font-size: 25px; }
.right-menu-bottom { bottom: 100px; right: 5px; flex-direction: column; align-items: flex-end; }
.left-menu-top > a:not(:first-child), .right-menu-top > a:not(:first-child), .left-menu-bottom > a:not(:first-child), .right-menu-bottom > a:not(:first-child) { margin-top: 2px; }
.phone-icon-link i { font-size: 22px; }
.profile-link, .profile-link:visited { text-decoration: none; color: inherit; }
/* --- 居中面板通用样式 --- */
.panel-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px); display: none; align-items: center; justify-content: center; z-index: 1000; opacity: 0; transition: opacity 0.3s ease-in-out; }
.panel-overlay.visible { display: flex; opacity: 1; }
.panel-wrapper { display: flex; flex-direction: column; width: 90%; max-width: 1200px; transition: height 0.3s ease, max-width 0.3s ease; }
.panel-header { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 3px; padding: 0 20px; }
.panel-title { font-size: 22px; font-weight: 600; color: #e0e0e0; text-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
.panel-content { position: relative; flex-grow: 1; background-color: rgba(25, 28, 40, 0.85); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; }
/* --- 星图面板特定样式 (v5 - 横向缩短) --- */
#stellar-totem-panel .panel-wrapper { height: auto; max-width: 340px; }
.panel-navigation { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; width: calc(130px * 2 + 20px); }
.nav-button { background-color: rgba(40, 45, 60, 0.7); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; color: #e0e0e0; cursor: pointer; padding: 20px; width: 130px; height: 140px; transition: all 0.3s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-decoration: none; }
.nav-button:hover { background-color: rgba(60, 65, 80, 0.9); border-color: rgba(255, 255, 255, 0.4); transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); }
.button-main { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.nav-button i { font-size: 28px; }
.button-title { font-size: 16px; font-weight: 600; color: #e0e0e0; }
.button-description { font-size: 13px; color: #a0a8b4; font-weight: normal; text-align: center; }
/* --- 侧边菜单面板样式 --- */
.side-panel-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: transparent; z-index: 1001; opacity: 0; pointer-events: none; transition: opacity 0.25s ease-in-out; }
.side-panel-overlay.visible { opacity: 1; pointer-events: auto; }
.side-panel { position: fixed; top: 0; right: 0; width: 50vw; height: 100dvh; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(10px); z-index: 1002; transform: translateX(100%); transition: transform 0.25s ease-in-out; border-top-left-radius: 16px; border-bottom-left-radius: 16px; }
.side-panel.visible { transform: translateX(0); }
</style>
