// relia-chat/chat-link-sender.js

let elements = {};
let onSendCallback = null;
let state = {
    image: null,
    isLoading: false,
};

function isValidHttpUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) { return false; }
}

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
        // ▼▼▼ 核心修改：获取新/修改的元素 ▼▼▼
        urlInput: document.getElementById('link-url-input'),
        titleInput: document.getElementById('link-title-input'),
        descriptionInput: document.getElementById('link-description-input'),
        sourceInput: document.getElementById('link-source-input'),
        // ▲▲▲ 修改结束 ▲▲▲
        imagePreview: document.getElementById('link-image-preview'),
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
    
    const inputs = [elements.urlInput, elements.titleInput, elements.descriptionInput, elements.sourceInput, elements.imageInput];
    inputs.forEach(input => {
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
    });

    elements.localPhotoInput.value = '';
    updateImagePreview();
    updateSendButtonState();
}

function updateSendButtonState() {
    // ▼▼▼ 核心修改：发送条件包含URL、标题和描述 ▼▼▼
    const canSend = elements.urlInput.value.trim() !== '' && 
                    isValidHttpUrl(elements.urlInput.value.trim()) &&
                    elements.titleInput.value.trim() !== '' && 
                    elements.descriptionInput.value.trim() !== '';
    elements.sendBtn.disabled = !canSend;
}

function updateImagePreview() {
    if (state.image) {
        let previewContent = '';
        if (state.image.type === 'text-photo') {
            previewContent = `<div class="text-photo-preview">${escapeHtml(state.image.text)}</div>`;
        } else {
            previewContent = `<img src="${state.image.data}" alt="图片预览">`;
        }
        elements.imagePreview.innerHTML = `
            ${previewContent}
            <button class="remove-image-btn">&times;</button>
        `;
        elements.imagePreview.querySelector('.remove-image-btn').onclick = () => {
            state.image = null;
            updateImagePreview();
        };
    } else {
        elements.imagePreview.innerHTML = `
            <div class="placeholder">
                <i class="fa-regular fa-image"></i>
                <span>图片预览区</span>
            </div>
        `;
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function handleAddImage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('无法加载图片');
        const blob = await response.blob();
        const dataUrl = await fileToDataUrl(blob);
        state.image = { type: 'image', data: dataUrl };
        updateImagePreview();
        elements.imageInput.value = '';
        elements.imageInput.style.height = 'auto';
    } catch (error) {
        alert('图片链接加载失败，请检查URL或网络。');
    }
}

async function handleAddLocalImage(file) {
    if (!file) return;
    try {
        const dataUrl = await fileToDataUrl(file);
        state.image = { type: 'image', data: dataUrl };
        updateImagePreview();
    } catch (error) {
        alert('本地图片加载失败。');
    }
}

function handleSend() {
    if (elements.sendBtn.disabled) return;
    if (onSendCallback) {
        // ▼▼▼ 核心修改：构建正确的消息对象 ▼▼▼
        const sourceText = elements.sourceInput.value.trim();
        const descriptionText = elements.descriptionInput.value.trim() + (sourceText ? ` (来源: ${sourceText})` : '');

        const message = {
            sender: 'user',
            type: 'link',
            url: elements.urlInput.value.trim(),
            title: elements.titleInput.value.trim(),
            description: descriptionText,
            image: state.image ? (state.image.type === 'image' ? state.image.data : null) : null
            // 注意：这里简化处理，文字图不作为链接卡片的配图发送
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

    // ▼▼▼ 核心修改：监听所有相关输入框 ▼▼▼
    elements.urlInput.addEventListener('input', updateSendButtonState);
    elements.titleInput.addEventListener('input', updateSendButtonState);
    elements.descriptionInput.addEventListener('input', updateSendButtonState);
    
    const autoGrowTextareas = [elements.urlInput, elements.titleInput, elements.descriptionInput, elements.sourceInput, elements.imageInput];
    // ▲▲▲ 修改结束 ▲▲▲
    
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
            updateImagePreview();
            elements.imageInput.value = '';
            elements.imageInput.style.height = 'auto';
        } else {
            alert('请输入普通文本后添加。');
        }
    });

    elements.addUrlPhotoBtn.addEventListener('click', () => {
        const text = elements.imageInput.value.trim();
        if(text && isValidHttpUrl(text)) handleAddImage(text);
        else alert('请输入有效的图片链接后添加。');
    });

    elements.addLocalPhotoBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleAddLocalImage(e.target.files[0]);
    });
}