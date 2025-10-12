// config/chat.config.js

/**
 * Chat 功能模块的配置
 */

// ▼▼▼ 修改：添加 export ▼▼▼
export const CHAT_DB_KEYS = {
    // 用于存储当前正在聊天列表中的角色
    ACTIVE_CHAT_LIST: 'chatActiveList',
    
    // 用于存储聊天记录的键名前缀
    // 我们会用 'chatHistory_角色ID' 的格式来为每个角色单独存储聊天记录
    CHAT_HISTORY: 'chatHistory'
};

export const ALL_CHAT_DB_KEYS = Object.values(CHAT_DB_KEYS);
// ▲▲▲ 修改结束 ▲▲▲