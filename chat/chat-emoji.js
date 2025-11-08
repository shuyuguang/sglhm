// 文件名: relia-chat/chat-emoji.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

const EMOJI_DB_KEY = CHAT_DB_KEYS.EMOJIS || 'relia-chat-emojis'; // 从配置或默认值获取

let state = {};
let elements = {};
let onSendEmojiCallback = null;

// 模块内部状态
let isSelectionMode = false;
let selectedEmojiIds = new Set();

/**
 * 渲染表情管理网格
 */
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
        <div class="emoji-management-grid">
            <!-- 表情将动态生成到这里 -->
        </div>
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


    // 重新绑定管理按钮的事件
    bindManagementHeaderEvents();
}

/**
 * 渲染底部聊天选择器面板
 */
async function renderEmojiPicker() {
    const container = elements.emojiPickerBar;
    if (!container) return;

    const emojis = await dbStorage.getItem(EMOJI_DB_KEY) || [];

    if (emojis.length === 0) {
        container.innerHTML = `<div class="emoji-placeholder">还没有表情包，快去添加吧！</div>`;
        return;
    }

    container.innerHTML = ''; // 清空
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
    // 重新渲染以移除选中状态
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

/**
 * 【已修复】处理本地文件上传，支持多文件
 * @param {FileList} files - 用户选择的文件列表
 */
async function handleLocalUpload(files) {
    const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                // 如果不是图片，直接resolve一个null值，后面会过滤掉
                return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageDataUrl = e.target.result;
                const name = prompt(`请输入表情包名称:`, file.name.split('.').slice(0, -1).join('.'));
                if (name === null) { // 用户点击了取消
                    return resolve(null);
                }
                resolve({
                    id: `emoji_${Date.now()}_${Math.random()}`,
                    name: name || '未命名表情',
                    data: imageDataUrl
                });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    });

    try {
        const newEmojisRaw = await Promise.all(filePromises);
        // 过滤掉用户取消或非图片文件的结果
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
        alert("文件读取失败，请重试。");
    }
}

async function handleWebUpload() {
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

/**
 * 初始化表情包系统
 * @param {object} domElements - 全局DOM元素对象
 * @param {object} chatState - 全局状态对象
 * @param {function} onSend - 发送表情的回调函数
 */
export function initializeEmojiSystem(domElements, chatState, onSend) {
    elements = domElements;
    state = chatState;
    onSendEmojiCallback = onSend;

    // 绑定主界面事件
    if (elements.emojiToggleBtn) {
        elements.emojiToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.chatInputArea.classList.remove('actions-expanded');
            elements.chatInputArea.classList.toggle('emoji-expanded');
            // 每次打开时重新渲染，确保是最新数据
            if (elements.chatInputArea.classList.contains('emoji-expanded')) {
                renderEmojiPicker();
            }
        });
    }

    // 绑定管理面板网格事件
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
    
    // 绑定文件上传
    if (elements.emojiUploadInput) {
        elements.emojiUploadInput.addEventListener('change', e => {
            handleLocalUpload(e.target.files);
            e.target.value = ''; // 清空以便下次选择
        });
    }

    // 绑定网络上传模态框
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
    
    // 初始渲染
    renderAll();

    return {
        renderAll, // 暴露一个方法，以便外部可以触发刷新
    };
}