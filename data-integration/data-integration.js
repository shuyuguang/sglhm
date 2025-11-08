// data-integration.js

// ▼▼▼ 修改开始 ▼▼▼
// 导入需要的配置变量
import { ALL_APP_DB_KEYS } from '../config/app.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
// 新增：导入 Profile 模块的 DB 键，用于识别和分离数据
import { PROFILE_DB_KEYS } from '../config/profile.config.js'; 
// ▲▲▲ 修改结束 ▲▲▲

document.addEventListener('DOMContentLoaded', () => {
    // ====================【数据库和配置】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({ keyValueStore: 'key' });

    // ====================【DOM 元素获取】====================
    const exportBtn = document.getElementById('export-local-btn');
    const importBtn = document.getElementById('import-local-btn');
    const clearBtn = document.getElementById('clear-local-btn');
    const importFileInput = document.getElementById('import-file-input');
    const exportCloudBtn = document.getElementById('export-cloud-btn');
    const importCloudBtn = document.getElementById('import-cloud-btn');
    const clearCloudBtn = document.getElementById('clear-cloud-btn');

    // ====================【通用辅助函数】====================
    const getKeysToProcess = async () => {
        const keys = new Set(ALL_APP_DB_KEYS);
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

    // 新增：安全的文件名生成器
    function getSafeFilename(name, fallbackPrefix, id) {
        if (!name || name.trim() === '') {
            return `${fallbackPrefix}_${id}.json`;
        }
        // 移除非法字符，替换为空格，然后去除多余空格
        const safeName = name.replace(/[\\/:*?"<>|]/g, ' ').trim();
        return safeName ? `${safeName}.json` : `${fallbackPrefix}_${id}.json`;
    }

    // ▼▼▼【核心修改】重写导出函数 `handleExport` ▼▼▼
    async function handleExport() {
        try {
            const finalKeys = await getKeysToProcess();
            const allData = await fetchDataFromDB(finalKeys);

            if (Object.keys(allData).length === 0) {
                alert('本地没有可导出的数据。');
                return;
            }

            const zip = new JSZip();
            const profileFolder = zip.folder("profile");
            const userFolder = profileFolder.folder("user");
            const charFolder = profileFolder.folder("char");
            const imageFolder = profileFolder.folder("image");
            
            const imageFiles = new Map();

            // 图片处理函数：将 dataURL 替换为文件路径
            const imageReplacer = (key, value) => {
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    const blob = dataURLtoBlob(value);
                    if (blob) {
                        const extension = getExtensionFromMime(blob.type);
                        const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                        imageFiles.set(filename, blob);
                        // 注意：路径现在是相对于 profile 文件夹的根目录
                        return `image/${filename}`; 
                    }
                }
                return value;
            };

            // 1. 处理用户(User)数据
            const userData = allData[PROFILE_DB_KEYS.USER_PROFILES] || [];
            userData.forEach(user => {
                const filename = getSafeFilename(user.name, 'user', user.id);
                const jsonString = JSON.stringify(user, imageReplacer, 2);
                userFolder.file(filename, jsonString);
            });
            delete allData[PROFILE_DB_KEYS.USER_PROFILES]; // 从主数据中移除，避免重复打包

            // 2. 处理角色(Char)数据
            const charData = allData[PROFILE_DB_KEYS.CHAR_PROFILES] || [];
            charData.forEach(char => {
                const filename = getSafeFilename(char.name, 'char', char.id);
                const jsonString = JSON.stringify(char, imageReplacer, 2);
                charFolder.file(filename, jsonString);
            });
            delete allData[PROFILE_DB_KEYS.CHAR_PROFILES];

            // 3. 处理公共预设(Public)数据
            const presets = allData[PROFILE_DB_KEYS.PRESETS];
            if (presets) {
                profileFolder.file("public.json", JSON.stringify(presets, null, 2));
            }
            delete allData[PROFILE_DB_KEYS.PRESETS];

            // 4. 将剩余的其他数据（如聊天、API设置等）存入根目录的 data.json
            // 同时，也移除 profile 相关的其他键
            Object.values(PROFILE_DB_KEYS).forEach(key => delete allData[key]);
            if (Object.keys(allData).length > 0) {
                 zip.file("data.json", JSON.stringify(allData, null, 2));
            }

            // 5. 将收集到的所有图片文件写入 image 文件夹
            for (const [filename, blob] of imageFiles.entries()) {
                imageFolder.file(filename, blob);
            }

            // 6. 生成并下载 ZIP 文件
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
            console.error('导出数据时出错:', error);
            alert('导出失败，请查看控制台。');
        }
    }

    // ▼▼▼【核心修改】重写导入函数 `processImportFile` ▼▼▼
    async function processImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('导入数据将覆盖现有设置，确定吗？')) {
            event.target.value = null;
            return;
        }
        try {
            const zip = await JSZip.loadAsync(file);
            let importedData = {};

            // 检查是新结构还是旧结构
            const isNewStructure = zip.folder("profile").length > 0;

            if (isNewStructure) {
                // --- 新结构导入逻辑 ---
                const imageBase64Map = new Map();
                const imagePromises = [];
                zip.folder("profile/image").forEach((relativePath, imageFile) => {
                    const promise = imageFile.async("blob").then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({ filename: `image/${relativePath}`, dataUrl: reader.result });
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
                        return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, reconstructData(value)]));
                    }
                    if (typeof data === 'string' && data.startsWith('image/')) {
                        return imageBase64Map.get(data) || data;
                    }
                    return data;
                }

                // 读取 profile/user/ 下的所有json
                const userFiles = zip.folder("profile/user").filter((path, file) => file.name.endsWith('.json'));
                const userPromises = userFiles.map(file => file.async("string").then(JSON.parse));
                importedData[PROFILE_DB_KEYS.USER_PROFILES] = await Promise.all(userPromises);

                // 读取 profile/char/ 下的所有json
                const charFiles = zip.folder("profile/char").filter((path, file) => file.name.endsWith('.json'));
                const charPromises = charFiles.map(file => file.async("string").then(JSON.parse));
                importedData[PROFILE_DB_KEYS.CHAR_PROFILES] = await Promise.all(charPromises);

                // 读取 public.json
                const publicFile = zip.file("profile/public.json");
                if (publicFile) {
                    importedData[PROFILE_DB_KEYS.PRESETS] = JSON.parse(await publicFile.async("string"));
                }
                
                // 读取根目录的 data.json (其他数据)
                const otherDataFile = zip.file("data.json");
                if (otherDataFile) {
                    const otherData = JSON.parse(await otherDataFile.async("string"));
                    Object.assign(importedData, otherData);
                }
                
                // 替换所有数据中的图片路径为 dataURL
                importedData = reconstructData(importedData);

            } else {
                // --- 旧结构导入逻辑 (兼容) ---
                const jsonFile = zip.file("data.json");
                if (!jsonFile) throw new Error("ZIP 文件中未找到 data.json");
                const jsonContent = await jsonFile.async("string");
                let oldImportedData = JSON.parse(jsonContent);

                const imageBase64Map = new Map();
                const imagePromises = [];
                zip.folder("images").forEach((relativePath, imageFile) => {
                    const promise = imageFile.async("blob").then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({ filename: `images/${relativePath}`, dataUrl: reader.result });
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    }));
                    imagePromises.push(promise);
                });
                const resolvedImages = await Promise.all(imagePromises);
                resolvedImages.forEach(img => imageBase64Map.set(img.filename, img.dataUrl));
                
                function reconstructOldData(data) {
                    if (Array.isArray(data)) return data.map(item => reconstructOldData(item));
                    if (data !== null && typeof data === 'object') {
                         return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, reconstructOldData(value)]));
                    }
                    if (typeof data === 'string' && data.startsWith('images/')) {
                        return imageBase64Map.get(data) || data;
                    }
                    return data;
                }
                importedData = reconstructOldData(oldImportedData);
            }

            // --- 通用写入数据库逻辑 ---
            const dataToPut = [];
            const allKeys = await getKeysToProcess();
            for (const key in importedData) {
                 if (allKeys.includes(key) || key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`)) {
                    dataToPut.push({ key, value: importedData[key] });
                }
            }
            if (dataToPut.length === 0) { alert('文件中没有找到可导入的数据。'); return; }
            
            await db.keyValueStore.bulkPut(dataToPut);
            alert('数据导入成功！\n请返回主页并刷新页面。');

        } catch (error) {
            console.error('导入数据时出错:', error);
            alert(`导入失败：${error.message}`);
        } finally {
            event.target.value = null;
        }
    }
    
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

    function handleCloudFeaturePlaceholder() {
        alert('云端功能正在开发中，敬请期待！');
    }

    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', processImportFile);
    clearBtn.addEventListener('click', handleClear);

    exportCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
    importCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
    clearCloudBtn.addEventListener('click', handleCloudFeaturePlaceholder);
});