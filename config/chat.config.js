// config/chat.config.js

/**
 * Chat 功能模块的配置
 */

export const CHAT_DB_KEYS = {
    // 用于存储当前正在聊天列表中的角色
    ACTIVE_CHAT_LIST: 'chatActiveList',
    
    // 用于存储聊天记录的键名前缀
    // 我们会用 'chatHistory_角色ID' 的格式来为每个角色单独存储聊天记录
    CHAT_HISTORY: 'chatHistory',
    
    // 用于存储每个聊天会话选择的API模型
    CHAT_SELECTED_API: 'chat_selected_api',

    // ▼▼▼ 新增：表情包和背景的数据库键 ▼▼▼
    // 用于存储所有自定义表情包
    EMOJIS: 'relia-chat-emojis',

    // 用于存储所有自定义聊天背景
    GLOBAL_BACKGROUNDS: 'relia-chat-global-backgrounds'
    // ▲▲▲ 新增结束 ▲▲▲
};

// 为了方便，提供一个包含所有键的数组
// 注意：这个数组只包含固定键，不包含动态生成的键（如聊天记录）
export const ALL_CHAT_DB_KEYS = Object.values(CHAT_DB_KEYS);