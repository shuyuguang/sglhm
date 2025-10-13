// config/app.config.js

/**
 * 应用程序全局配置，用于数据中心等全局工具。
 * 它会聚合所有功能模块的数据库键。
 */

// 1. 导入各个模块的 DB 键
import { ALL_PROFILE_DB_KEYS } from './profile.config.js';
import { ALL_CHAT_DB_KEYS } from './chat.config.js';
import { ALL_API_DB_KEYS } from './api.config.js';
import { ALL_RULE_DB_KEYS } from './rule.config.js'; // ▼▼▼ 新增：导入规则模块的DB键 ▼▼▼

// 2. 聚合所有键并导出
export const ALL_APP_DB_KEYS = [
    // 从 Profile 模块导入
    ...ALL_PROFILE_DB_KEYS,

    // 从 Chat 模块导入
    ...ALL_CHAT_DB_KEYS,

    // 从 API 模块导入
    ...ALL_API_DB_KEYS,

    // ▼▼▼ 新增：从 Rule Management 模块导入 ▼▼▼
    ...ALL_RULE_DB_KEYS,

    // 从 Diary 模块导入 (未来扩展)
    // ...ALL_DIARY_DB_KEYS
];