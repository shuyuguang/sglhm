// relia-chat/chat-link-sender.js

let elements = {};
let onSendCallback = null;
let state = {
    title: '',
    body: '',
    source: '',
    image: null, // { type: 'text-photo'/'image', text: '...', data: '...' }
    isLoading: false,
};

// 辅助函数：判断是否为有效URL
function isValidHttpUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
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
    state = { title: '', body: '', source: '', image: null, isLoading: false };
    elements.titleInput.value = '';
    elements.bodyInput.value = '';
    elements.sourceInput.value = '';
    elements.imageInput.value = '';
    elements.localPhotoInput.value = '';
    updateImagePreview();
    updateSendButtonState();
}

function updateSendButtonState() {
    const canSend = elements.titleInput.value.trim() !== '' && elements.bodyInput.value.trim() !== '';
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
        const message = {
            sender: 'user',
            type: 'link',
            title: elements.titleInput.value.trim(),
            body: elements.bodyInput.value.trim(),
            source: elements.sourceInput.value.trim(),
            image: state.image // 如果没有图片，这里就是 null
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

    elements.titleInput.addEventListener('input', updateSendButtonState);
    elements.bodyInput.addEventListener('input', updateSendButtonState);
    
    elements.addTextPhotoBtn.addEventListener('click', () => {
        const text = elements.imageInput.value.trim();
        if(text && !isValidHttpUrl(text)) {
            state.image = { type: 'text-photo', text: text };
            updateImagePreview();
            elements.imageInput.value = '';
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