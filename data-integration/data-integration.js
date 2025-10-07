// data-integration.js

document.addEventListener('DOMContentLoaded', () => {
    // ====================【数据库和配置】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({ keyValueStore: 'key' });
    const STATIC_DB_KEYS = ALL_APP_DB_KEYS;

    // ====================【DOM 元素获取】====================
    // 本地功能按钮
    const exportZipBtn = document.getElementById('export-zip-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const importZipBtn = document.getElementById('import-zip-btn');
    const importJsonBtn = document.getElementById('import-json-btn');
    const clearBtn = document.getElementById('clear-local-btn');
    const importZipInput = document.getElementById('import-zip-input');
    const importJsonInput = document.getElementById('import-json-input');

    // ▼▼▼ 新增：云端功能按钮 ▼▼▼
    const exportCloudBtn = document.getElementById('export-cloud-btn');
    const importCloudBtn = document.getElementById('import-cloud-btn');
    const clearCloudBtn = document.getElementById('clear-cloud-btn');
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


    // ====================【通用辅助函数】====================
    const getKeysToProcess = async () => {
        const keys = new Set(STATIC_DB_KEYS);
        const activeChatListData = await db.keyValueStore.get(CHAT_DB_KEYS.ACTIVE_CHAT_LIST);
        if (activeChatListData && activeChatListData.value) {
            activeChatListData.value.forEach(char => {
                if (char.id) keys.add(`${CHAT_DB_KEYS.CHAT_HISTORY}_${char.id}`);
            });
        }
        return Array.from(keys);
    };

    const fetchDataFromDB = async (keys) => {
        const items = await db.keyValueStore.bulkGet(keys);
        const data = {};
        items.forEach(item => { if (item) data[item.key] = item.value; });
        return data;
    };

    // ====================【ZIP 导出/导入函数】====================
    
    function dataURLtoBlob(dataUrl) { /* ... (此函数不变) ... */ }
    function getExtensionFromMime(mimeType) { /* ... (此函数不变) ... */ }
    // (为了简洁，这里省略了上面两个函数的具体实现，请从你之前的文件中保留它们)
    function dataURLtoBlob(dataUrl) {
        const arr = dataUrl.split(','), mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        const mime = mimeMatch[1], bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) { u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], { type: mime });
    }
    function getExtensionFromMime(mimeType) { return mimeType.split('/')[1] || 'bin'; }


    async function handleExportZip() {
        try {
            const finalKeys = await getKeysToProcess();
            const dataToExport = await fetchDataFromDB(finalKeys);

            if (Object.keys(dataToExport).length === 0) {
                alert('本地没有可导出的数据。');
                return;
            }

            const zip = new JSZip();
            const imagesFolder = zip.folder("images");
            const imageFiles = new Map();

            const replacer = (key, value) => {
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    const blob = dataURLtoBlob(value);
                    if (blob) {
                        const extension = getExtensionFromMime(blob.type);
                        const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                        imageFiles.set(filename, blob);
                        return `images/${filename}`;
                    }
                }
                return value;
            };

            const jsonString = JSON.stringify(dataToExport, replacer, 2);
            zip.file("data.json", jsonString);
            for (const [filename, blob] of imageFiles.entries()) {
                imagesFolder.file(filename, blob);
            }

            const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
            console.error('导出ZIP时出错:', error);
            alert('导出失败，请查看控制台。');
        }
    }

    async function processImportZipFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('导入ZIP将覆盖现有设置，确定吗？')) {
            event.target.value = null;
            return;
        }
        try {
            const zip = await JSZip.loadAsync(file);
            const jsonFile = zip.file("data.json");
            if (!jsonFile) throw new Error("ZIP 文件中未找到 data.json");
            const jsonContent = await jsonFile.async("string");
            let importedData = JSON.parse(jsonContent);

            const imageBase64Map = new Map();
            const imagePromises = [];
            zip.folder("images").forEach((relativePath, imageFile) => {
                const promise = imageFile.async("blob").then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({ filename: relativePath, dataUrl: reader.result });
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }));
                imagePromises.push(promise);
            });
            const resolvedImages = await Promise.all(imagePromises);
            resolvedImages.forEach(img => imageBase64Map.set(img.filename, img.dataUrl));
            
            function reconstructData(data) {
                if (Array.isArray(data)) return data.map(item => reconstructData(item));
                if (data !== null && typeof data === 'object') {
                    const newObj = {};
                    for (const key in data) newObj[key] = reconstructData(data[key]);
                    return newObj;
                }
                if (typeof data === 'string' && data.startsWith('images/')) {
                    const filename = data.substring(7);
                    return imageBase64Map.get(filename) || data;
                }
                return data;
            }
            const reconstructedData = reconstructData(importedData);

            const dataToPut = [];
            const allKeys = await getKeysToProcess();
            for (const key in reconstructedData) {
                if (allKeys.includes(key) || key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`)) {
                    dataToPut.push({ key, value: reconstructedData[key] });
                }
            }
            if (dataToPut.length === 0) { alert('文件中没有找到可导入的数据。'); return; }
            
            await db.keyValueStore.bulkPut(dataToPut);
            alert('ZIP数据导入成功！\n请返回主页并刷新页面。');
        } catch (error) {
            console.error('导入ZIP时出错:', error);
            alert(`导入失败：${error.message}`);
        } finally {
            event.target.value = null;
        }
    }

    // ====================【JSON 导出/导入函数】====================

    async function handleExportJson() {
        try {
            const finalKeys = await getKeysToProcess();
            const dataToExport = await fetchDataFromDB(finalKeys);

            if (Object.keys(dataToExport).length === 0) {
                alert('本地没有可导出的数据。');
                return;
            }

            // ★ 核心：定义JSON专用的图片替换规则
            const jsonReplacer = (key, value) => {
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    if (key === 'avatar') {
                        return 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg';
                    }
                    if (key === 'banner') {
                        return 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg';
                    }
                    // 对于其他非头像/背景的Base64图片，也用默认头像URL替换
                    return 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg';
                }
                return value;
            };

            const jsonString = JSON.stringify(dataToExport, jsonReplacer, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const jsonFilename = `felotus-data-${timestamp}.json`;

            const a = document.createElement('a');
            a.href = url;
            a.download = jsonFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`数据已成功导出为 ${jsonFilename}`);
        } catch (error) {
            console.error('导出JSON时出错:', error);
            alert('导出失败，请查看控制台。');
        }
    }
    
    async function processImportJsonFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('导入JSON将覆盖现有设置，确定吗？')) {
            event.target.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件内容不是有效的JSON对象。');
                }
                
                const dataToPut = [];
                const allKeys = await getKeysToProcess();
                for (const key in importedData) {
                    if (allKeys.includes(key) || key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`)) {
                        dataToPut.push({ key, value: importedData[key] });
                    }
                }
                if (dataToPut.length === 0) { alert('文件中没有找到可导入的数据。'); return; }
                
                await db.keyValueStore.bulkPut(dataToPut);
                alert('JSON数据导入成功！\n请返回主页并刷新页面。');
            } catch (error) {
                console.error('导入JSON时出错:', error);
                alert(`导入失败：${error.message}`);
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = () => { alert('读取文件失败！'); event.target.value = null; }
        reader.readAsText(file);
    }
    
    // ====================【清除数据函数】====================
    async function handleClear() { /* ... (此函数不变) ... */ }
    async function handleClear() {
        if (!confirm('警告：此操作将删除所有本地角色和用户数据，且无法恢复！\n确定要清除所有数据吗？')) return;
        if (!confirm('再次确认：真的要删除所有本地数据吗？')) return;
        try {
            const keysToDelete = await getKeysToProcess();
            await db.keyValueStore.bulkDelete(Array.from(keysToDelete));
            alert('所有本地数据已成功清除。');
        } catch (error) {
            console.error('清除数据时出错:', error);
            alert('清除失败，请查看控制台。');
        }
    }

// ▼▼▼ 新增：云端功能占位符函数 ▼▼▼
    function handleCloudFeaturePlaceholder() {
        alert('云端功能正在开发中，敬请期待！');
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // ====================【事件监听器绑定】====================
    exportZipBtn.addEventListener('click', handleExportZip);
    exportJsonBtn.addEventListener('click', handleExportJson);
    
    importZipBtn.addEventListener('click', () => importZipInput.click());
    importJsonBtn.addEventListener('click', () => importJsonInput.click());

    importZipInput.addEventListener('change', processImportZipFile);
    importJsonInput.addEventListener('change', processImportJsonFile);

    clearBtn.addEventListener('click', handleClear);
    
// ▼▼▼ 新增：云端功能 ▼▼▼
    exportCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
    importCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
    clearCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
});