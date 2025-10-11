// config/api.config.js

/**
 * API Management 功能模块的配置
 */

const API_DB_KEYS = {
    // 用于存储所有【用户自定义】API 配置的键
    CONFIGS: 'api_configs_text',

    // 用于存储内置 API 的【用户数据】(API Key, 已选模型等)
    BUILT_IN_DATA: 'built_in_api_data',
    // 用于存储内置 API 的【状态】(是否启用)
    BUILT_IN_STATES: 'built_in_api_states',
    
    // ▼▼▼ 新增点 ▼▼▼
    // 用于存储聊天界面当前选择的、全局激活的模型ID
    GLOBAL_ACTIVE_MODEL_ID: 'global_active_model_id'
};

// 导出所有键的数组，方便 app.config.js 聚合
const ALL_API_DB_KEYS = Object.values(API_DB_KEYS);