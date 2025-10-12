// config/profile.config.js

/**
 * Profile 功能模块的配置
 */

// ====================【UI & 交互常量】====================
// ▼▼▼ 修改：在常量前面加上 export ▼▼▼
export const GENDER_OPTIONS = ['⚲（？）', '♀（女）', '♂（男）'];
export const LONG_PRESS_DURATION = 500; // 长按删除预设的延迟时间（毫秒）
// ▲▲▲ 修改结束 ▲▲▲


// ====================【数据库键配置】====================
// ▼▼▼ 修改：在常量前面加上 export ▼▼▼
export const PROFILE_DB_KEYS = {
    // 核心数据
    USER_PROFILES: 'userProfileData',
    USER_CURRENT_ID: 'userCurrentProfileId',
    CHAR_PROFILES: 'charProfileData',
    CHAR_CURRENT_ID: 'charCurrentProfileId',
    
    // UI状态
    YDN_MODE: 'profileYDNMode',
    YDM_MODE: 'profileYDMMode',

    // 全局预设
    PRESETS: 'globalPresetContentStore'
};

// 为了方便，提供一个包含所有键的数组
export const ALL_PROFILE_DB_KEYS = Object.values(PROFILE_DB_KEYS);
// ▲▲▲ 修改结束 ▲▲▲