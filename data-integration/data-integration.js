// data-integration.js

document.addEventListener('DOMContentLoaded', () => {
    // ====================【数据库初始化】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({
        keyValueStore: 'key' // 确保与主应用中的定义一致
    });

    // 定义需要备份和恢复的数据键
    const PROFILE_DATA_KEYS = [
        'userProfileData',
        'userCurrentProfileId',
        'charProfileData',
        'charCurrentProfileId',
        'globalPresetContentStore',
        'profileYDNMode',
        'profileYDMMode'
    ];


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
            const dataToExport = {};
            const items = await db.keyValueStore.bulkGet(PROFILE_DATA_KEYS);

            items.forEach((item, index) => {
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

            // ▼▼▼【核心修改点】▼▼▼
            // 1. 定义一个 replacer 函数，用于在 JSON 序列化时替换 Base64 图片
            const replacer = (key, value) => {
                const defaultAvatarUrl = 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg';
                // 检查值是否为字符串，并且以 'data:image/' 开头
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    // 如果是，就返回默认头像 URL
                    return defaultAvatarUrl;
                }
                // 否则，返回原始值
                return value;
            };

            // 2. 在 JSON.stringify 中使用这个 replacer 函数
            // 第一个参数是要序列化的对象
            // 第二个参数是 replacer 函数
            // 第三个参数是缩进（用于美化输出）
            const jsonString = JSON.stringify(dataToExport, replacer, 2);
            // ▲▲▲【修改结束】▲▲▲

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
            event.target.value = null; // 重置文件输入，以便下次可以选择相同文件
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // 验证导入的数据是否为对象
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件内容格式不正确，不是有效的JSON对象。');
                }
                
                const dataToPut = [];
                for (const key in importedData) {
                    // 只导入我们关心的数据键
                    if (PROFILE_DATA_KEYS.includes(key)) {
                        dataToPut.push({ key, value: importedData[key] });
                    }
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
                event.target.value = null; // 无论成功失败都重置
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
            await db.keyValueStore.bulkDelete(PROFILE_DATA_KEYS);
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
