// relia-chat/chat-link-sender.js

// ▼▼▼ 新增：从公共模块导入db和配置 ▼▼▼
import { dbStorage } from '../common/db.js';
const CHAT_PHOTO_PREFIX = 'chat-photo/';
// ▲▲▲ 新增结束 ▲▲▲

let elements = {};
let onSendCallback = null;
let state = {
    // ▼▼▼ 修改：image 对象的结构改变 ▼▼▼
    image: null, // { type: 'text-photo'/'image', source: 'local'/'url', text: '...', url: '...', filename: '...' }
    // ▲▲▲ 修改结束 ▲▲▲
    isLoading: false,
};

// 辅助函数：判断是否为有效URL
function isValidHttpUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https";
    } catch (_) { return false; }
}

// 辅助函数：文件转DataURL
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function initializeLinkSender(domElements, onSend) {
    elements = {
        ...domElements,
        overlay: document.getElementById('link-sender-overlay'),
        closeBtn: document.getElementById('close-link-sender-btn'),
        titleInput: document.getElementById('link-title-input'),
        bodyInput: document.getElementById('link-body-input'),
        sourceInput: document.getElementById('link-source-input'),
        // ▼▼▼ 核心修改：目标预览容器ID改变 ▼▼▼
        cardPreview: document.getElementById('link-card-preview'),
        // ▲▲▲ 修改结束 ▲▲▲
        imageInput: document.getElementById('link-image-input'),
        addTextPhotoBtn: document.getElementById('add-link-text-photo-btn'),
        addUrlPhotoBtn: document.getElementById('add-link-url-photo-btn'),
        addLocalPhotoBtn: document.getElementById('add-link-local-photo-btn'),
        localPhotoInput: document.getElementById('link-local-photo-upload'),
        sendBtn: document.getElementById('confirm-link-send-btn'),
    };
    onSendCallback = onSend;
    bindEvents();
}

export function openLinkSender() {
    if (!elements.overlay) return;
    resetPanel();
    elements.overlay.classList.add('active');
}

function closeLinkSender() {
    elements.overlay.classList.remove('active');
}

function resetPanel() {
    state = { image: null, isLoading: false };
    
    const inputs = [elements.titleInput, elements.bodyInput, elements.sourceInput, elements.imageInput];
    inputs.forEach(input => {
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
    });

    elements.localPhotoInput.value = '';
    updatePreview();
    updateSendButtonState();
}

function updateSendButtonState() {
    const canSend = elements.titleInput.value.trim() !== '' && elements.bodyInput.value.trim() !== '';
    elements.sendBtn.disabled = !canSend;
}

// ▼▼▼ 核心修改：重写整个预览更新逻辑 ▼▼▼
function updatePreview() {
    const title = escapeHtml(elements.titleInput.value.trim()) || '标题';
    const body = escapeHtml(elements.bodyInput.value.trim()) || '正文内容...';
    const source = escapeHtml(elements.sourceInput.value.trim());

    let imageHtml = '';
    if (state.image) {
        if (state.image.type === 'text-photo') {
            imageHtml = `<div class="link-card-image text-photo">${escapeHtml(state.image.text)}</div>`;
        } else if (state.image.type === 'image') {
            const imageUrl = state.image.source === 'local' ? state.image.previewUrl : state.image.url;
            imageHtml = `<img src="${imageUrl}" class="link-card-image">`;
        }
        imageHtml = `
            <div class="link-card-image-wrapper">
                ${imageHtml}
            </div>
        `;
    }

    elements.cardPreview.innerHTML = `
        <div class="link-card-container">
            <div class="link-card-title">${title}</div>
            <div class="link-card-main">
                <div class="link-card-body">${body}</div>
                ${imageHtml}
            </div>
            ${source ? `<div class="link-card-footer">${source}</div>` : ''}
        </div>
        ${state.image ? '<button class="remove-image-btn">&times;</button>' : ''}
    `;

    if (state.image) {
        elements.cardPreview.querySelector('.remove-image-btn').onclick = () => {
            if (state.image.previewUrl) URL.revokeObjectURL(state.image.previewUrl);
            state.image = null;
            elements.imageInput.value = '';
            updatePreview();
        };
    }
}
// ▲▲▲ 修改结束 ▲▲▲

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function handleAddImageUrl(url) {
    state.image = { type: 'image', source: 'url', url: url };
    updatePreview();
    elements.imageInput.value = '';
    elements.imageInput.style.height = 'auto';
}

async function handleAddLocalImage(file) {
    if (!file) return;
    try {
        const dataUrl = await fileToDataUrl(file);
        await dbStorage.setItem(`${CHAT_PHOTO_PREFIX}${file.name}`, dataUrl);

        const previewUrl = URL.createObjectURL(file);
        state.image = { type: 'image', source: 'local', filename: file.name, previewUrl: previewUrl };

        updatePreview();
    } catch (error) {
        alert('本地图片加载失败。');
    }
}

function handleSend() {
    if (elements.sendBtn.disabled) return;
    if (onSendCallback) {
        const finalImage = { ...state.image };
        delete finalImage.previewUrl; // 清理临时预览URL

        const message = {
            sender: 'user',
            type: 'link',
            title: elements.titleInput.value.trim(),
            body: elements.bodyInput.value.trim(),
            source: elements.sourceInput.value.trim(),
            image: Object.keys(finalImage).length > 0 ? finalImage : null,
        };
        onSendCallback(message);
    }
    closeLinkSender();
}

function bindEvents() {
    elements.overlay.addEventListener('click', e => {
        if (e.target === elements.overlay) closeLinkSender();
    });
    elements.closeBtn.addEventListener('click', closeLinkSender);
    elements.sendBtn.addEventListener('click', handleSend);

    const inputsForPreview = [elements.titleInput, elements.bodyInput, elements.sourceInput];
    inputsForPreview.forEach(input => {
        input.addEventListener('input', () => {
            updateSendButtonState();
            updatePreview();
        });
    });
    
    const autoGrowTextareas = [elements.titleInput, elements.bodyInput, elements.sourceInput, elements.imageInput];
    autoGrowTextareas.forEach(textarea => {
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = `${textarea.scrollHeight}px`;
            });
        }
    });

    elements.addTextPhotoBtn.addEventListener('click', () => {
        const text = elements.imageInput.value.trim();
        if(text && !isValidHttpUrl(text)) {
            state.image = { type: 'text-photo', text: text };
            updatePreview();
            elements.imageInput.value = '';
            elements.imageInput.style.height = 'auto';
        } else {
            alert('请输入普通文本后添加。');
        }
    });

    elements.addUrlPhotoBtn.addEventListener('click', () => {
        const text = elements.imageInput.value.trim();
        // ▼▼▼ 核心修复：修正函数调用错误 ▼▼▼
        if(text && isValidHttpUrl(text)) handleAddImageUrl(text);
        // ▲▲▲ 修复结束 ▲▲▲
        else alert('请输入有效的图片链接后添加。');
    });

    elements.addLocalPhotoBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleAddLocalImage(e.target.files[0]);
    });
}