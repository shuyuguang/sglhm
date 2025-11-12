// 文件名: relia-chat/chat-emoji.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

const EMOJI_DB_KEY = CHAT_DB_KEYS.EMOJIS || 'relia-chat-emojis';

// ... (compressImage function remains unchanged) ...
function compressImage(dataUrl, fileType, maxSize = 128) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (img.width <= maxSize && img.height <= maxSize) {
                resolve(dataUrl);
                return;
            }
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const quality = fileType === 'image/jpeg' ? 0.85 : 1.0;
            const compressedDataUrl = canvas.toDataURL(fileType, quality);
            resolve(compressedDataUrl);
        };
        img.onerror = (error) => reject(error);
        img.src = dataUrl;
    });
}


let state = {};
let elements = {};
let onSendEmojiCallback = null;
let isSelectionMode = false;
let selectedEmojiIds = new Set();

async function renderEmojiManagementGrid() {
    const container = elements.emojiManagementGridContainer;
    if (!container) return;

    const emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];
    
    container.innerHTML = `
        <div class="emoji-management-header">
            <h4 class="emoji-management-title">表情包管理</h4>
            <div class="emoji-actions">
                <button class="emoji-action-btn" id="emoji-select-btn" title="多选"><i class="fa-solid fa-check-double"></i></button>
                <button class="emoji-action-btn" id="emoji-delete-btn" title="删除选中"><i class="fa-solid fa-trash-can"></i></button>
                <button class="emoji-action-btn" id="emoji-add-web-btn" title="添加网络图片"><i class="fa-solid fa-link"></i></button>
                <button class="emoji-action-btn" id="emoji-add-local-btn" title="上传本地图片"><i class="fa-solid fa-plus"></i></button>
            </div>
        </div>
        <div class="emoji-management-grid"></div>
    `;

    const grid = container.querySelector('.emoji-management-grid');
    if (isSelectionMode) {
        container.classList.add('selection-mode');
    } else {
        container.classList.remove('selection-mode');
    }

    if (emojis.length > 0) {
        emojis.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'emoji-item';
            item.dataset.id = emoji.id;
            item.innerHTML = `
                <img src="${emoji.data}" alt="${emoji.name}">
                <div class="selection-overlay"><i class="fa-solid fa-circle-check"></i></div>
            `;
            if (isSelectionMode && selectedEmojiIds.has(emoji.id)) {
                item.classList.add('selected');
            }
            grid.appendChild(item);
        });
    }
    bindManagementHeaderEvents();
}

async function renderEmojiPicker() {
    // ... (this function remains unchanged) ...
    const container = elements.emojiPickerBar;
    if (!container) return;
    const emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];
    if (emojis.length === 0) {
        container.innerHTML = `<div class="emoji-placeholder">还没有表情包，快去添加吧！</div>`;
        return;
    }
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    emojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-picker-item';
        item.innerHTML = `<img src="${emoji.data}" alt="${emoji.name}">`;
        item.addEventListener('click', () => {
            if (onSendEmojiCallback) {
                onSendEmojiCallback(emoji);
            }
        });
        grid.appendChild(item);
    });
    container.appendChild(grid);
}

function enterSelectionMode() {
    isSelectionMode = true;
    selectedEmojiIds.clear();
    elements.emojiManagementGridContainer.classList.add('selection-mode');
    updateDeleteButtonState();
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedEmojiIds.clear();
    elements.emojiManagementGridContainer.classList.remove('selection-mode');
    renderEmojiManagementGrid();
}

function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('emoji-delete-btn');
    if (!deleteBtn) return;
    if (isSelectionMode && selectedEmojiIds.size > 0) {
        deleteBtn.classList.add('active');
    } else {
        deleteBtn.classList.remove('active');
    }
}

async function handleLocalUpload(files) {
    // ... (this function remains unchanged) ...
    const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const isCompressible = file.type === 'image/jpeg' || file.type === 'image/png';
            const isGif = file.type === 'image/gif';
            if (!isCompressible && !isGif) {
                console.warn(`Skipped unsupported file type: ${file.type}`);
                return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let imageDataUrl = e.target.result;
                    if (isCompressible) {
                        imageDataUrl = await compressImage(imageDataUrl, file.type);
                    }
                    const name = prompt(`请输入表情包名称:`, file.name.split('.').slice(0, -1).join('.'));
                    if (name === null) {
                        return resolve(null);
                    }
                    resolve({
                        id: `emoji_${Date.now()}_${Math.random()}`,
                        name: name || '未命名表情',
                        data: imageDataUrl
                    });
                } catch (error) {
                    console.error("处理单个文件时出错:", file.name, error);
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    });
    try {
        const newEmojisRaw = await Promise.all(filePromises);
        const newEmojis = newEmojisRaw.filter(emoji => emoji !== null);
        if (newEmojis.length > 0) {
            const emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];
            emojis.push(...newEmojis);
            await dbStorage.setItem(EMOJI_DB_KEY, emojis);
            await renderAll();
            alert(`成功添加了 ${newEmojis.length} 个表情！`);
        }
    } catch (error) {
        console.error("处理文件上传时出错:", error);
        alert("文件读取或压缩失败，请检查控制台获取详细信息。");
    }
}

async function handleWebUpload() {
    // ... (this function remains unchanged) ...
    const inputText = elements.webEmojiUrlInput.value.trim();
    if (!inputText) return alert('输入内容不能为空！');
    const newEmojis = [];
    const lines = inputText.split('\n');
    const urlRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp))/i;
    lines.forEach(line => {
        const trimmedLine = line.trim();
        const match = trimmedLine.match(urlRegex);
        if (match) {
            const url = match[0];
            const name = trimmedLine.replace(url, '').trim();
            if (name) {
                newEmojis.push({
                    id: `emoji_${Date.now()}_${Math.random()}`,
                    name: name,
                    data: url
                });
            }
        }
    });
    if (newEmojis.length > 0) {
        const emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];
        emojis.push(...newEmojis);
        await dbStorage.setItem(EMOJI_DB_KEY, emojis);
        await renderAll();
        elements.webEmojiUrlInput.value = '';
        elements.webEmojiModal.classList.remove('active');
        alert(`成功添加了 ${newEmojis.length} 个网络表情！`);
    } else {
        alert('添加失败！请检查格式是否为 "链接 名称"，每行一个。');
    }
}

function bindManagementHeaderEvents() {
    // ... (this function remains unchanged) ...
    const selectBtn = document.getElementById('emoji-select-btn');
    const deleteBtn = document.getElementById('emoji-delete-btn');
    const addWebBtn = document.getElementById('emoji-add-web-btn');
    const addLocalBtn = document.getElementById('emoji-add-local-btn');
    if (selectBtn) {
        selectBtn.addEventListener('click', () => {
            if (isSelectionMode) exitSelectionMode();
            else enterSelectionMode();
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!isSelectionMode || selectedEmojiIds.size === 0) return;
            if (confirm(`确定要删除选中的 ${selectedEmojiIds.size} 个表情吗？`)) {
                let emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];
                emojis = emojis.filter(emoji => !selectedEmojiIds.has(emoji.id));
                await dbStorage.setItem(EMOJI_DB_KEY, emojis);
                exitSelectionMode();
                await renderAll();
            }
        });
    }
    if (addWebBtn) {
        addWebBtn.addEventListener('click', () => {
            elements.webEmojiModal.classList.add('active');
        });
    }
    if (addLocalBtn) {
        addLocalBtn.addEventListener('click', () => {
            elements.emojiUploadInput.click();
        });
    }
}

async function renderAll() {
    await renderEmojiManagementGrid();
    await renderEmojiPicker();
}

export function initializeEmojiSystem(domElements, chatState, onSend) {
    elements = domElements; // 直接接收完整的 elements 对象
    state = chatState;
    onSendEmojiCallback = onSend;

    if (elements.emojiToggleBtn) {
        elements.emojiToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.chatInputArea.classList.remove('actions-expanded');
            elements.chatInputArea.classList.toggle('emoji-expanded');
            if (elements.chatInputArea.classList.contains('emoji-expanded')) {
                renderEmojiPicker();
            }
        });
    }

    if (elements.emojiManagementGridContainer) {
        elements.emojiManagementGridContainer.addEventListener('click', e => {
            const item = e.target.closest('.emoji-item');
            if (!item || !isSelectionMode) return;
            const id = item.dataset.id;
            if (selectedEmojiIds.has(id)) {
                selectedEmojiIds.delete(id);
                item.classList.remove('selected');
            } else {
                selectedEmojiIds.add(id);
                item.classList.add('selected');
            }
            updateDeleteButtonState();
        });
    }
    
    if (elements.emojiUploadInput) {
        elements.emojiUploadInput.addEventListener('change', e => {
            handleLocalUpload(e.target.files);
            e.target.value = '';
        });
    }

    if (elements.webEmojiModal) {
        elements.webEmojiModal.addEventListener('click', e => {
            if (e.target === elements.webEmojiModal) {
                elements.webEmojiModal.classList.remove('active');
            }
        });
        if(elements.cancelWebEmojiBtn) {
             elements.cancelWebEmojiBtn.addEventListener('click', () => {
                elements.webEmojiModal.classList.remove('active');
            });
        }
        if(elements.confirmWebEmojiBtn) {
            elements.confirmWebEmojiBtn.addEventListener('click', handleWebUpload);
        }
    }
    
    renderAll();

    return {
        renderAll,
    };
}