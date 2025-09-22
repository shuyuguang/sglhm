// ====================【Dexie.js 数据库封装】====================
// 确保 Dexie 脚本已经在 HTML 中引入
const db = new Dexie('userSettingsDB');

// 定义数据库结构
db.version(1).stores({
    keyValueStore: 'key' // 一个简单的键值存储表
});

// 封装好数据库的 get 和 set 方法，并导出
const dbStorage = {
    async setItem(key, value) {
        try {
            // 使用 structuredClone 来处理复杂对象，避免 "DataCloneError"
            const storableValue = structuredClone(value);
            await db.keyValueStore.put({ key, value: storableValue });
        } catch (error) {
            console.error(`[dbStorage] Failed to set item '${key}':`, error);
        }
    },
    async getItem(key) {
        try {
            const item = await db.keyValueStore.get(key);
            return item ? item.value : null;
        } catch (error) {
            console.error(`[dbStorage] Failed to get item '${key}':`, error);
            return null;
        }
    }
};

// ▼▼▼ 修改点：同时导出 db 实例和 dbStorage 对象 ▼▼▼
export { db, dbStorage };