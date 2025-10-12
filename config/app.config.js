// config/app.config.js

/**
 * 应用程序全局配置，用于数据中心等全局工具。
 * 它会聚合所有功能模块的数据库键。
 */

const ALL_APP_DB_KEYS = [
    // 1. 从 Profile 模块导入
    ...ALL_PROFILE_DB_KEYS,

    // 2. 从 Chat 模块导入
    ...ALL_CHAT_DB_KEYS,

    // 3. 从 API 模块导入 (这个文件已经包含了我们的新键)
    ...ALL_API_DB_KEYS,

    // 4. 从 Diary 模块导入 (未来扩展)
    // ...ALL_DIARY_DB_KEYS
];