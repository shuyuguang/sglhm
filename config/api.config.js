// config/api.config.js

/**
 * API Management 功能模块的配置
 */

// 1. 数据库键 (保持不变)
export const API_DB_KEYS = {
    CONFIGS: 'api_configs_text',
    BUILT_IN_DATA: 'built_in_api_data',
    BUILT_IN_STATES: 'built_in_api_states'
};

export const ALL_API_DB_KEYS = Object.values(API_DB_KEYS);


// ▼▼▼ 修改开始 ▼▼▼

// 2. 默认的可编辑 API 卡片定义
export const DEFAULT_EDITABLE_APIS = [
    { 
        id: 'default-openai',
        provider: 'openai', 
        name: 'OpenAI', 
        baseUrl: 'https://api.openai.com', 
        path: '/v1/chat/completions',
    },
    { 
        id: 'default-google',
        provider: 'google', 
        name: 'Google', 
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta', 
        path: null,
    }
];

// 3. 内置的(只读) API 卡片定义
export const BUILT_IN_APIS = [
    { id: 'built-in-deepseek', name: 'DeepSeek', shortName: 'DS', isBuiltIn: true, baseUrl: 'https://api.deepseek.com/v1', path: '/chat/completions' },
    { id: 'built-in-siliconflow', name: '硅基流动', shortName: '硅', isBuiltIn: true, baseUrl: 'https://api.siliconflow.cn/v1', path: '/chat/completions' },
    { id: 'built-in-openrouter', name: 'OpenRouter', shortName: 'OR', isBuiltIn: true, baseUrl: 'https://openrouter.ai/api/v1', path: '/chat/completions' },
];

// 4. 创建一个包含所有 API 定义的查找对象，方便其他模块使用
const allBuiltInDefinitions = {};
[...DEFAULT_EDITABLE_APIS, ...BUILT_IN_APIS].forEach(api => {
    allBuiltInDefinitions[api.id] = api;
});
export const ALL_BUILT_IN_API_DEFINITIONS = allBuiltInDefinitions;

// ▲▲▲ 修改结束 ▲▲▲