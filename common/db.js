// common/db.js

// 确保 Dexie 脚本已经在 HTML 中引入
const db = new Dexie('userSettingsDB');

// 定义数据库结构 (版本号保持不变，除非你真的需要修改表结构)
db.version(1).stores({
    keyValueStore: 'key' // 一个简单的键值存储表
});

/**
 * 一个封装好的、类似 localStorage 的数据库访问对象
 */
export const dbStorage = {
    /**
     * 向数据库中存储一个键值对
     * @param {string} key - 数据的键
     * @param {*} value - 要存储的值
     */
    async setItem(key, value) {
        try {
            // 使用 structuredClone 来处理复杂对象，避免 "DataCloneError"
            const storableValue = structuredClone(value);
            await db.keyValueStore.put({ key, value: storableValue });
        } catch (error) {
            console.error(`[dbStorage] 写入失败 '${key}':`, error);
        }
    },

    /**
     * 从数据库中获取一个值
     * @param {string} key - 数据的键
     * @returns {Promise<*|null>} 返回找到的值，如果没找到则返回 null
     */
    async getItem(key) {
        try {
            const item = await db.keyValueStore.get(key);
            return item ? item.value : null;
        } catch (error) {
            console.error(`[dbStorage] 读取失败 '${key}':`, error);
            return null;
        }
    },
    
    /**
     * 从数据库中移除一个键值对
     * @param {string} key - 要移除的数据的键
     */
    async removeItem(key) {
        try {
            await db.keyValueStore.delete(key);
        } catch (error) {
            console.error(`[dbStorage] 删除失败 '${key}':`, error);
        }
    }
};