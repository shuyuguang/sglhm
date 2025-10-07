// data-integration.js

document.addEventListener('DOMContentLoaded', () => {
    // ====================【数据库初始化】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({
        keyValueStore: 'key'
    });

    const STATIC_DB_KEYS = ALL_APP_DB_KEYS;

    // ====================【DOM 元素获取】====================
    const exportBtn = document.getElementById('export-local-btn');
    const importBtn = document.getElementById('import-local-btn');
    const clearBtn = document.getElementById('clear-local-btn');
    const importFileInput = document.getElementById('import-file-input');

    // ====================【辅助函数】====================

    /**
     * 将 data:image/... 格式的 Base64 字符串转换为 Blob 对象
     * @param {string} dataUrl - Base64 字符串
     * @returns {Blob}
     */
    function dataURLtoBlob(dataUrl) {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * 从 MIME 类型获取文件扩展名
     * @param {string} mimeType - e.g., 'image/png'
     * @returns {string} - e.g., 'png'
     */
    function getExtensionFromMime(mimeType) {
        return mimeType.split('/')[1] || 'bin';
    }


    // ====================【核心功能函数 - ZIP 方案】====================

    /**
     * 导出本地数据为 ZIP 文件
     */
    async function handleExport() {
        try {
            // 1. 获取所有需要导出的数据库键（这部分逻辑与你原来的一致）
            const keysToExport = new Set(STATIC_DB_KEYS);
            const activeChatListData = await db.keyValueStore.get(CHAT_DB_KEYS.ACTIVE_CHAT_LIST);
            if (activeChatListData && activeChatListData.value) {
                activeChatListData.value.forEach(char => {
                    if (char.id) keysToExport.add(`${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`);
                });
            }
            const finalKeys = Array.from(keysToExport);
            
            // 2. 从数据库批量获取数据
            const items = await db.keyValueStore.bulkGet(finalKeys);
            const dataToExport = {};
            items.forEach(item => {
                if (item) dataToExport[item.key] = item.value;
            });

            if (Object.keys(dataToExport).length === 0) {
                alert('本地没有可导出的数据。');
                return;
            }

            // 3. 准备 ZIP 和图片处理
            const zip = new JSZip();
            const imagesFolder = zip.folder("images");
            const imageFiles = new Map(); // 用于存储待添加的图片 Blob

            // 4. 定义一个 JSON replacer 函数来处理图片
            const replacer = (key, value) => {
                // 只处理本地上传的 Base64 图片
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    const blob = dataURLtoBlob(value);
                    if (blob) {
                        const extension = getExtensionFromMime(blob.type);
                        const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                        
                        imageFiles.set(filename, blob); // 暂存图片 Blob
                        
                        // 在 JSON 中用路径替换 Base64
                        return `images/${filename}`; 
                    }
                }
                // 保留普通的 URL 图片和其它数据
                return value;
            };

            // 5. 生成 JSON 字符串，同时填充 imageFiles
            const jsonString = JSON.stringify(dataToExport, replacer, 2);
            zip.file("data.json", jsonString);

            // 6. 将所有收集到的图片添加到 ZIP 中
            for (const [filename, blob] of imageFiles.entries()) {
                imagesFolder.file(filename, blob);
            }

            // 7. 生成并下载 ZIP 文件
            const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
            
            const now = new Date();
            const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
            const zipFilename = `felotus-data-${timestamp}.zip`;

            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = zipFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            alert(`数据已成功导出为 ${zipFilename}`);

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
     * 读取并处理导入的 ZIP 文件
     * @param {Event} event - 文件输入框的 change 事件
     */
    async function processImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm('导入数据将覆盖现有设置，确定要继续吗？')) {
            event.target.value = null;
            return;
        }

        try {
            // 1. 加载 ZIP 文件
            const zip = await JSZip.loadAsync(file);

            // 2. 读取并解析 data.json
            const jsonFile = zip.file("data.json");
            if (!jsonFile) throw new Error("ZIP 文件中未找到 data.json");
            const jsonContent = await jsonFile.async("string");
            let importedData = JSON.parse(jsonContent);

            // 3. 读取 images 文件夹中的所有图片，并转换为 Base64
            const imageBase64Map = new Map();
            const imagePromises = [];
            zip.folder("images").forEach((relativePath, imageFile) => {
                const promise = imageFile.async("blob").then(blob => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({ filename: relativePath, dataUrl: reader.result });
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                });
                imagePromises.push(promise);
            });

            // 等待所有图片转换完成
            const resolvedImages = await Promise.all(imagePromises);
            resolvedImages.forEach(img => imageBase64Map.set(img.filename, img.dataUrl));
            
            // 4. 递归恢复数据中的图片路径为 Base64
            function reconstructDataWithImages(data) {
                if (Array.isArray(data)) {
                    return data.map(item => reconstructDataWithImages(item));
                } else if (data !== null && typeof data === 'object') {
                    const newObj = {};
                    for (const key in data) {
                        newObj[key] = reconstructDataWithImages(data[key]);
                    }
                    return newObj;
                } else if (typeof data === 'string' && data.startsWith('images/')) {
                    const filename = data.substring(7); // "images/".length
                    return imageBase64Map.get(filename) || data; // 如果找不到图片，保留原路径
                }
                return data;
            }

            const reconstructedData = reconstructDataWithImages(importedData);

            // 5. 准备写入数据库
            const dataToPut = [];
            for (const key in reconstructedData) {
                const isStaticKey = STATIC_DB_KEYS.includes(key);
                const isDynamicChatKey = key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`);
                if (isStaticKey || isDynamicChatKey) {
                    dataToPut.push({ key, value: reconstructedData[key] });
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
            event.target.value = null;
        }
    }


    /**
     * 清除本地数据 (此函数逻辑不变)
     */
    async function handleClear() {
        if (!confirm('警告：此操作将删除所有本地角色和用户数据，且无法恢复！\n确定要清除所有数据吗？')) {
            return;
        }
        if (!confirm('再次确认：真的要删除所有本地数据吗？')) {
            return;
        }

        try {
            const keysToDelete = new Set(STATIC_DB_KEYS);
            const activeChatListData = await db.keyValueStore.get(CHAT_DB_KEYS.ACTIVE_CHAT_LIST);
            if (activeChatListData && activeChatListData.value) {
                activeChatListData.value.forEach(char => {
                    if (char.id) keysToDelete.add(`${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`);
                });
            }
            
            await db.keyValueStore.bulkDelete(Array.from(keysToDelete));
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