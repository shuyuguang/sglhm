// config/api.config.js

/**
 * API Management 功能模块的配置
 */

// ▼▼▼ 修改点：添加 export ▼▼▼
export const API_DB_KEYS = {
    // 用于存储所有【用户自定义】API 配置的键
    CONFIGS: 'api_configs_text',

    // 内置 API 相关的两个键
    // 用于存储内置 API 的【用户数据】(API Key, 已选模型等)
    BUILT_IN_DATA: 'built_in_api_data',
    // 用于存储内置 API 的【状态】(是否启用)
    BUILT_IN_STATES: 'built_in_api_states'
};
// ▲▲▲ 修改结束 ▲▲▲

// 导出所有键的数组，方便 app.config.js 聚合
export const ALL_API_DB_KEYS = Object.values(API_DB_KEYS);
