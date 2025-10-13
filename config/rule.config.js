// config/rule.config.js

/**
 * Rule Management 功能模块的配置
 */

// 数据库键
export const RULE_DB_KEYS = {
    // 用于存储所有规则数据的键
    RULES_DATA: 'ruleManagementData', 
};

// 包含所有键的数组，方便全局集成
export const ALL_RULE_DB_KEYS = Object.values(RULE_DB_KEYS);