// config/api.config.js

/**
 * API Management 功能模块的配置
 */

const API_DB_KEYS = {
    // 用于存储所有 API 配置的键
    // (这个值 'api_configs_text' 来源于 api-management.js)
    CONFIGS: 'api_configs_text'
};

// 导出所有键的数组，方便 app.config.js 聚合
const ALL_API_DB_KEYS = Object.values(API_DB_KEYS);