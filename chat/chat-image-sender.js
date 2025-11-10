// relia-chat/chat-image-sender.js

// ▼▼▼ 新增：从公共模块导入db和配置 ▼▼▼
import { dbStorage } from '../common/db.js';
const CHAT_PHOTO_PREFIX = 'chat-photo/';
// ▲▲▲ 新增结束 ▲▲▲

let elements = {};
let onSendCallback = null;
let state = {
    imagesToSend: [], // 队列保持不变
    isLoading: false
};

// 新增辅助函数：判断是否为有效URL
function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

export function initializeImageSender(domElements, onSend) {
    elements = {
        ...domElements,
        overlay: document.getElementById('image-sender-overlay'),
        closeBtn: document.getElementById('close-image-sender-btn'),
        // ▼▼▼ 核心重构：获取新UI元素 ▼▼▼
        multiPurposeInput: document.getElementById('multi-purpose-image-input'),
        helpBtn: document.getElementById('image-sender-help-btn'),
        helpTooltip: document.getElementById('image-sender-help-tooltip'),
        localPhotoInput: document.getElementById('local-photo-upload'),
        addTextBtn: document.getElementById('add-text-photo-btn'),
        addUrlBtn: document.getElementById('add-url-photo-btn'),
        addLocalBtn: document.getElementById('add-local-photo-btn'),
        multiPreviewContainer: document.getElementById('image-multi-preview-container'),
        multiPreviewPlaceholder: document.getElementById('image-multi-preview-placeholder'),
        sendImageBtn: document.getElementById('send-image-btn')
        // ▲▲▲ 重构结束 ▲▲▲
    };
    onSendCallback = onSend;
    bindEvents();
}

export function openImageSender() {
    if (!elements.overlay) return;
    resetPanel();
    elements.overlay.classList.add('active');
}

function closeImageSender() {
    elements.overlay.classList.remove('active');
}

function resetPanel() {
    state.imagesToSend = [];
    state.isLoading = false;
    elements.multiPurposeInput.value = '';
    elements.multiPurposeInput.style.height = 'auto'; // 重置高度
    elements.localPhotoInput.value = '';
    elements.helpTooltip.classList.remove('active'); // 关闭帮助
    updatePreview();
    updateSendButtonState();
}

function setLoading(isLoading) {
    state.isLoading = isLoading;
    // 未来可以添加全局加载指示器
}

function updatePreview() {
    elements.multiPreviewContainer.innerHTML = '';
    if (state.imagesToSend.length > 0) {
        elements.multiPreviewPlaceholder.style.display = 'none';
        state.imagesToSend.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'preview-thumbnail';

            if (item.type === 'text-photo') {
                thumb.innerHTML = `<span class="preview-thumbnail-text">${item.text}</span>`;
            } else if (item.type === 'image') {
                // ▼▼▼ 修改：根据图片来源决定预览图的src ▼▼▼
                const previewSrc = item.source === 'local' ? item.previewUrl : item.url;
                thumb.innerHTML = `<img src="${previewSrc}" alt="预览">`;
                // ▲▲▲ 修改结束 ▲▲▲
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-thumbnail-remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                state.imagesToSend.splice(index, 1);
                updatePreview();
                updateSendButtonState();
            };
            thumb.appendChild(removeBtn);
            elements.multiPreviewContainer.appendChild(thumb);
        });
    } else {
        elements.multiPreviewPlaceholder.style.display = 'flex';
    }
}

function updateSendButtonState() {
    const canSend = state.imagesToSend.length > 0;
    elements.sendImageBtn.disabled = !canSend;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function handleAddText(text) {
    state.imagesToSend.push({ type: 'text-photo', text: text });
    elements.multiPurposeInput.value = '';
    elements.multiPurposeInput.style.height = 'auto'; // 重置高度
    updatePreview();
    updateSendButtonState();
}

// ▼▼▼ 核心修改：处理URL图片和本地图片 ▼▼▼
function handleAddUrl(url) {
    // 对于URL图片，只存储URL本身
    state.imagesToSend.push({ type: 'image', source: 'url', url: url });
    elements.multiPurposeInput.value = '';
    elements.multiPurposeInput.style.height = 'auto';
    updatePreview();
    updateSendButtonState();
}

async function handleAddLocal(file) {
    if (!file) return;
    setLoading(true);
    try {
        const dataUrl = await fileToDataUrl(file);
        // 1. 将图片数据存入 IndexedDB
        await dbStorage.setItem(`${CHAT_PHOTO_PREFIX}${file.name}`, dataUrl);

        // 2. 创建一个临时的 blob URL 用于本地预览
        const previewUrl = URL.createObjectURL(file);

        // 3. 在待发送队列中只存储文件名和预览URL
        state.imagesToSend.push({
            type: 'image',
            source: 'local',
            filename: file.name,
            previewUrl: previewUrl // 仅用于本次会话的UI预览
        });

        updatePreview();
        updateSendButtonState();
    } catch (error) {
        console.error("加载本地图片失败:", error);
        alert('本地图片加载失败。');
    } finally {
        setLoading(false);
    }
}

// ▼▼▼ 核心修改：一次性发送所有图片消息 ▼▼▼
function handleSend() {
    if (state.imagesToSend.length === 0 || !onSendCallback) return;

    // 1. 创建一个包含所有消息的数组
    const messagesToSend = state.imagesToSend.map(item => {
        const message = { sender: 'user', ...item };
        // 清理掉临时的预览URL，不存入数据库
        delete message.previewUrl;
        return message;
    });

    // 2. 一次性调用回调函数，传入整个数组
    onSendCallback(messagesToSend);
    
    closeImageSender();
}
// ▲▲▲ 修改结束 ▲▲▲

function bindEvents() {
    // ... (bindEvents 函数的其他部分保持不变) ...
    elements.overlay.addEventListener('click', e => {
        if (e.target === elements.overlay) closeImageSender();
    });
    elements.closeBtn.addEventListener('click', closeImageSender);
    elements.sendImageBtn.addEventListener('click', handleSend); // 这个现在会调用我们修改后的 handleSend
    
    elements.multiPurposeInput.addEventListener('input', () => {
        const el = elements.multiPurposeInput;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    });

    elements.helpBtn.addEventListener('click', () => {
        elements.helpTooltip.classList.toggle('active');
    });

    elements.addTextBtn.addEventListener('click', () => {
        const text = elements.multiPurposeInput.value.trim();
        if(text && !isValidHttpUrl(text)) handleAddText(text);
        else alert('请输入普通文本后添加。');
    });

    elements.addUrlBtn.addEventListener('click', () => {
        const text = elements.multiPurposeInput.value.trim();
        if(text && isValidHttpUrl(text)) handleAddUrl(text);
        else alert('请输入有效的图片链接后添加。');
    });

    elements.addLocalBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleAddLocal(e.target.files[0]);
    });
}