// data-integration.js

import { ALL_APP_DB_KEYS } from '../config/app.config.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';
import { PROFILE_DB_KEYS } from '../config/profile.config.js';

// ▼▼▼ 新增：定义图片存储前缀 ▼▼▼
const CHAT_PHOTO_PREFIX = 'chat-photo/';
// ▲▲▲ 新增结束 ▲▲▲

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
        const staticKeys = new Set(ALL_APP_DB_KEYS);
        const allKeys = await db.keyValueStore.toCollection().keys();
        allKeys.forEach(key => staticKeys.add(key));
        return Array.from(staticKeys);
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

    function getSafeFilename(name, fallbackPrefix, id) {
        if (!name || name.trim() === '') {
            return `${fallbackPrefix}_${id}`;
        }
        const safeName = name.replace(/[\\/:*?"<>|]/g, ' ').trim();
        return safeName || `${fallbackPrefix}_${id}`;
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
            const imageFiles = new Map(); // 用于收集所有需要写入文件的图片Blob

            // --- 0. [新增] 导出聊天图片 ---
            const chatPhotoFolder = zip.folder("chat-photo");
            if (chatPhotoFolder) {
                for (const key in allData) {
                    if (key.startsWith(CHAT_PHOTO_PREFIX)) {
                        const filename = key.substring(CHAT_PHOTO_PREFIX.length);
                        const blob = dataURLtoBlob(allData[key]);
                        if (blob) {
                            chatPhotoFolder.file(filename, blob);
                        }
                        delete allData[key];
                    }
                }
            }

            // --- 1. 处理 Profile 数据 ---
            const profileFolder = zip.folder("profile");
            if (profileFolder) {
                const imageReplacer = (key, value) => {
                    if (typeof value === 'string' && value.startsWith('data:image/')) {
                        const blob = dataURLtoBlob(value);
                        if (blob) {
                            const extension = getExtensionFromMime(blob.type);
                            const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                            imageFiles.set(`profile/image/${filename}`, blob);
                            return `image/${filename}`;
                        }
                    }
                    return value;
                };
                
                const userData = allData[PROFILE_DB_KEYS.USER_PROFILES] || [];
                userData.forEach(user => {
                    const filename = getSafeFilename(user.name, 'user', user.id) + '.json';
                    profileFolder.file(`user/${filename}`, JSON.stringify(user, imageReplacer, 2));
                });
                delete allData[PROFILE_DB_KEYS.USER_PROFILES];

                const charData = allData[PROFILE_DB_KEYS.CHAR_PROFILES] || [];
                charData.forEach(char => {
                    const filename = getSafeFilename(char.name, 'char', char.id) + '.json';
                    profileFolder.file(`char/${filename}`, JSON.stringify(char, imageReplacer, 2));
                });
                delete allData[PROFILE_DB_KEYS.CHAR_PROFILES];

                if (allData[PROFILE_DB_KEYS.PRESETS]) {
                    profileFolder.file("public.json", JSON.stringify(allData[PROFILE_DB_KEYS.PRESETS], null, 2));
                    delete allData[PROFILE_DB_KEYS.PRESETS];
                }
            }
            Object.values(PROFILE_DB_KEYS).forEach(key => delete allData[key]);

            // --- 2. 处理 Chat 数据 ---
            const chatFolder = zip.folder("achat");
     
            if (chatFolder) {
                // 2.1 导出 Active Chat List 到 public.json
                if (allData[CHAT_DB_KEYS.ACTIVE_CHAT_LIST]) {
                    chatFolder.file("public.json", JSON.stringify(allData[CHAT_DB_KEYS.ACTIVE_CHAT_LIST], null, 2));
                    delete allData[CHAT_DB_KEYS.ACTIVE_CHAT_LIST];
                }

                // 2.2 导出 Emojis
                const emojis = allData[CHAT_DB_KEYS.EMOJIS] || [];
                const webEmojis = [];
                emojis.forEach(emoji => {
                    if (typeof emoji.data === 'string' && emoji.data.startsWith('data:image/')) {
                        const blob = dataURLtoBlob(emoji.data);
                        if (blob) {
                            const extension = getExtensionFromMime(blob.type);
                            const safeName = getSafeFilename(emoji.name, 'emoji', emoji.id);
                            const filename = `${safeName}.${extension}`;
                            imageFiles.set(`chat/emoji/image/${filename}`, blob);
                            webEmojis.push({ ...emoji, data: `image/${filename}` });
                        }
                    } else {
                        webEmojis.push(emoji);
                    }
                });
                if (webEmojis.length > 0) {
                    chatFolder.file("emoji/emoji.json", JSON.stringify(webEmojis, null, 2));
                }
                delete allData[CHAT_DB_KEYS.EMOJIS];

                // 2.3 导出 Backgrounds
                const backgrounds = allData[CHAT_DB_KEYS.GLOBAL_BACKGROUNDS] || [];
                const webBackgrounds = [];
                backgrounds.forEach((bg, index) => {
                    if (typeof bg === 'string' && bg.startsWith('data:image/')) {
                        const blob = dataURLtoBlob(bg);
                        if (blob) {
                            const extension = getExtensionFromMime(blob.type);
                            const filename = `background_${index}.${extension}`;
                            imageFiles.set(`chat/backgrounds/image/${filename}`, blob);
                            webBackgrounds.push(`image/${filename}`);
                        }
                    } else {
                        webBackgrounds.push(bg);
                    }
                });
                 if (webBackgrounds.length > 0) {
                    chatFolder.file("backgrounds/backgrounds.json", JSON.stringify(webBackgrounds, null, 2));
                }
                delete allData[CHAT_DB_KEYS.GLOBAL_BACKGROUNDS];
                
                // 2.4 导出聊天记录
                const allCharProfiles = await db.keyValueStore.get(PROFILE_DB_KEYS.CHAR_PROFILES).then(d => d ? d.value : []) || [];
                const charIdToNameMap = new Map(allCharProfiles.map(c => [c.id, c.name]));
                
                for (const key in allData) {
                    if (key.startsWith(`${CHAT_DB_KEYS.CHAT_HISTORY}_`)) {
                        const charId = key.substring(CHAT_DB_KEYS.CHAT_HISTORY.length + 1);
                        const charName = charIdToNameMap.get(charId) || 'UnknownChar';
                        const safeCharName = getSafeFilename(charName, 'chat', charId);
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const historyFilename = `${safeCharName}_${timestamp}.json`;
                        chatFolder.file(`${safeCharName}/${historyFilename}`, JSON.stringify(allData[key], null, 2));
                        delete allData[key];
                    }
                }
            }
            
            // --- 3. 处理剩余数据 ---
            Object.values(CHAT_DB_KEYS).forEach(key => delete allData[key]);
            if (Object.keys(allData).length > 0) {
                 zip.file("data.json", JSON.stringify(allData, null, 2));
            }

            // --- 4. 写入所有图片文件 ---
            for (const [path, blob] of imageFiles.entries()) {
                zip.file(path, blob);
            }

            // --- 5. 生成并下载 ZIP ---
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
            const imageBase64Map = new Map();
            const dataToPut = []; // 将所有要写入DB的数据收集到这里

            // --- 0. [新增] 预加载聊天图片到待写入列表 ---
            const chatPhotoFolder = zip.folder("chat-photo");
            if (chatPhotoFolder) {
                const photoPromises = [];
                chatPhotoFolder.forEach((relativePath, photoFile) => {
                    const promise = photoFile.async("blob").then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({
                            key: `${CHAT_PHOTO_PREFIX}${relativePath}`,
                            value: reader.result
                        });
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    }));
                    photoPromises.push(promise);
                });
                const chatPhotos = await Promise.all(photoPromises);
                dataToPut.push(...chatPhotos);
            }

            // --- 1. 预加载所有嵌入式图片为 DataURL ---
            const imageFolders = ["profile/image/", "chat/emoji/image/", "chat/backgrounds/image/", "images/"];
            const imagePromises = [];
            for (const folderPrefix of imageFolders) {
                zip.folder(folderPrefix).forEach((relativePath, imageFile) => {
                    const promise = imageFile.async("blob").then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({
                            // 标准化路径，移除前导文件夹
                            filename: `image/${relativePath}`, 
                            dataUrl: reader.result
                        });
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    }));
                    imagePromises.push(promise);
                });
            }
            const resolvedImages = await Promise.all(imagePromises);
            resolvedImages.forEach(img => imageBase64Map.set(img.filename, img.dataUrl));
            
            // --- 2. 定义通用的数据重构函数 ---
            function reconstructData(data) {
                if (Array.isArray(data)) return data.map(item => reconstructData(item));
                if (data !== null && typeof data === 'object') {
                    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, reconstructData(value)]));
                }
                if (typeof data === 'string' && data.startsWith('image/')) {
                    // 兼容新旧两种路径前缀
                    return imageBase64Map.get(data) || imageBase64Map.get(data.replace(/^image\//, 'images/')) || data;
                }
                return data;
            }

            // --- 3. 按顺序处理数据文件 ---
            // 3.1 导入 Profile (必须先做，为聊天记录提供ID映射)
            const profileUserFiles = zip.folder("profile/user").filter((p, f) => f.name.endsWith('.json'));
            if (profileUserFiles.length > 0) {
                 const userPromises = profileUserFiles.map(f => f.async("string").then(JSON.parse));
                 importedData[PROFILE_DB_KEYS.USER_PROFILES] = await Promise.all(userPromises);
            }
            const profileCharFiles = zip.folder("profile/char").filter((p, f) => f.name.endsWith('.json'));
            let nameToIdMap = new Map();
            if (profileCharFiles.length > 0) {
                const charPromises = profileCharFiles.map(f => f.async("string").then(JSON.parse));
                const charProfiles = await Promise.all(charPromises);
                importedData[PROFILE_DB_KEYS.CHAR_PROFILES] = charProfiles;
                nameToIdMap = new Map(charProfiles.map(c => [getSafeFilename(c.name, 'char', c.id), c.id]));
            }
            const profilePublicFile = zip.file("profile/public.json");
            if (profilePublicFile) {
                importedData[PROFILE_DB_KEYS.PRESETS] = JSON.parse(await profilePublicFile.async("string"));
            }

            // 3.2 导入 Chat
            const chatPublicFile = zip.file("achat/public.json");
            // ▲▲▲ 修改结束 ▲▲▲
            if (chatPublicFile) {
                importedData[CHAT_DB_KEYS.ACTIVE_CHAT_LIST] = JSON.parse(await chatPublicFile.async("string"));
            }
            // ▼▼▼ 修改点 ▼▼▼
            const emojiFile = zip.file("achat/emoji/emoji.json");
            // ▲▲▲ 修改结束 ▲▲▲
            if (emojiFile) {
                importedData[CHAT_DB_KEYS.EMOJIS] = JSON.parse(await emojiFile.async("string"));
            }
            // ▼▼▼ 修改点 ▼▼▼
            const backgroundsFile = zip.file("achat/backgrounds/backgrounds.json");
            // ▲▲▲ 修改结束 ▲▲▲
            if(backgroundsFile) {
                 importedData[CHAT_DB_KEYS.GLOBAL_BACKGROUNDS] = JSON.parse(await backgroundsFile.async("string"));
            }
            
            // ▼▼▼ 修改点 ▼▼▼
            const chatHistoryFolders = zip.folder("achat").filter((path, file) => file.dir);
            // ▲▲▲ 修改结束 ▲▲▲
            for (const folder of chatHistoryFolders) {
                // 排除 emoji 和 backgrounds 文件夹
                if (folder.name.endsWith('emoji/') || folder.name.endsWith('backgrounds/')) continue;
                
                const safeCharName = folder.name.split('/').filter(Boolean).pop();
                const charId = nameToIdMap.get(safeCharName);
                if (charId) {
                    const historyFiles = zip.folder(folder.name).filter((p, f) => f.name.endsWith('.json'));
                    if (historyFiles.length > 0) {
                        // 假设每个文件夹只有一个最新的历史文件，或者合并它们
                        const historyContent = await historyFiles[0].async("string");
                        importedData[`${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`] = JSON.parse(historyContent);
                    }
                }
            }

            // 3.3 导入根目录的 data.json (兼容旧版和新版的剩余数据)
            const rootDataFile = zip.file("data.json");
            if (rootDataFile) {
                Object.assign(importedData, JSON.parse(await rootDataFile.async("string")));
            }

            // --- 4. 最终处理和写入 ---
            const finalData = reconstructData(importedData);
            
            const allKnownKeys = new Set(await getKeysToProcess());
            for (const key in finalData) {
                if (allKnownKeys.has(key) || key.startsWith(CHAT_DB_KEYS.CHAT_HISTORY) || key.startsWith('relia-chat-')) {
                     dataToPut.push({ key, value: finalData[key] });
                }
            }
            if (dataToPut.length === 0) {
                alert('文件中没有找到可导入的数据。'); 
                return;
            }
            
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