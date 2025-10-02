// data-integration.js

document.addEventListener('DOMContentLoaded', () => {
    // ====================【数据库初始化】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({
        keyValueStore: 'key' // 确保与主应用中的定义一致
    });

    // 从 app.config.js 中获取所有需要备份的数据库键
    const STATIC_DB_KEYS = ALL_APP_DB_KEYS;


    // ====================【DOM 元素获取】====================
    const exportBtn = document.getElementById('export-local-btn');
    const importBtn = document.getElementById('import-local-btn');
    const clearBtn = document.getElementById('clear-local-btn');
    const importFileInput = document.getElementById('import-file-input');


    // ====================【核心功能函数】====================

    /**
     * 导出本地数据
     */
    async function handleExport() {
        try {
            // ▼▼▼【核心修改 ①】动态获取所有需要导出的数据键 ▼▼▼
            // 1. 从静态配置开始
            const keysToExport = new Set(STATIC_DB_KEYS);

            // 2. 动态生成聊天记录的键
            // 2.1 首先获取当前激活的聊天列表
            const activeChatListData = await db.keyValueStore.get(CHAT_DB_KEYS.ACTIVE_CHAT_LIST);
            if (activeChatListData && activeChatListData.value) {
                const activeChatList = activeChatListData.value;
                // 2.2 为列表中的每个角色生成对应的聊天记录键
                activeChatList.forEach(char => {
                    if (char.id) {
                        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`;
                        keysToExport.add(historyKey);
                    }
                });
            }
            
            // 3. 将 Set 转换为数组，用于批量获取
            const finalKeys = Array.from(keysToExport);
            // ▲▲▲【修改结束】▲▲▲
            
            const dataToExport = {};
            // 使用最终生成的键列表来获取数据
            const items = await db.keyValueStore.bulkGet(finalKeys);

            items.forEach((item) => {
                if (item) { // 只导出存在的数据
                    dataToExport[item.key] = item.value;
                }
            });

            if (Object.keys(dataToExport).length === 0) {
                alert('本地没有可导出的数据。');
                return;
            }

            // 格式化时间戳
            const now = new Date();
            const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
            const filename = `felotus-data-${timestamp}.json`;

            // 定义一个 replacer 函数，用于在 JSON 序列化时替换 Base64 图片
            const replacer = (key, value) => {
                const defaultAvatarUrl = 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg';
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    return defaultAvatarUrl;
                }
                return value;
            };

            const jsonString = JSON.stringify(dataToExport, replacer, 2);

            // 创建并下载文件
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`数据已成功导出为 ${filename}`);

        } catch (error) {
            console.error('导出数据时出错:', error);
            alert('导出失败，请查看控制台获取更多信息。');
        }
    }

    /**
     * 触发文件选择以导入数据
     */
    function handleImport() {
        importFileInput.click();
    }
    
    /**
     * 读取并处理导入的文件
     * @param {Event} event - 文件输入框的 change 事件
     */
    async function processImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm('导入数据将覆盖现有设置，确定要继续吗？')) {
            event.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件内容格式不正确，不是有效的JSON对象。');
                }
                
                const dataToPut = [];
                for (const key in importedData) {
                    // ▼▼▼【核心修改 ②】更新导入验证逻辑 ▼▼▼
                    // 允许静态键列表中的键，或者以聊天记录前缀开头的动态键
                    const isStaticKey = STATIC_DB_KEYS.includes(key);
                    const isDynamicChatKey = key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`);

                    if (isStaticKey || isDynamicChatKey) {
                        dataToPut.push({ key, value: importedData[key] });
                    }
                    // ▲▲▲【修改结束】▲▲▲
                }

                if (dataToPut.length === 0) {
                    alert('文件中没有找到可导入的数据。');
                    return;
                }
                
                await db.keyValueStore.bulkPut(dataToPut);
                alert('数据导入成功！\n请返回主页并刷新页面以应用更改。');

            } catch (error) {
                console.error('导入数据时出错:', error);
                alert(`导入失败：${error.message}`);
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = () => {
             alert('读取文件失败！');
             event.target.value = null;
        }
        reader.readAsText(file);
    }

    /**
     * 清除本地数据
     */
    async function handleClear() {
        if (!confirm('警告：此操作将删除所有本地角色和用户数据，且无法恢复！\n确定要清除所有数据吗？')) {
            return;
        }
        if (!confirm('再次确认：真的要删除所有本地数据吗？')) {
            return;
        }

        try {
            // ▼▼▼【核心修改 ③】清除数据时也需要动态处理 ▼▼▼
            // (虽然这个功能不常用，但保持逻辑一致性是好习惯)
            const keysToDelete = new Set(STATIC_DB_KEYS);
            const activeChatListData = await db.keyValueStore.get(CHAT_DB_KEYS.ACTIVE_CHAT_LIST);
            if (activeChatListData && activeChatListData.value) {
                activeChatListData.value.forEach(char => {
                    if (char.id) {
                        keysToDelete.add(`${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`);
                    }
                });
            }
            
            await db.keyValueStore.bulkDelete(Array.from(keysToDelete));
            // ▲▲▲【修改结束】▲▲▲
            alert('所有本地数据已成功清除。');
        } catch (error) {
            console.error('清除数据时出错:', error);
            alert('清除失败，请查看控制台获取更多信息。');
        }
    }


    // ====================【事件监听器绑定】====================
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', handleImport);
    clearBtn.addEventListener('click', handleClear);
    importFileInput.addEventListener('change', processImportFile);

});