// 文件名: relia-chat/chat-link-sender.js

let elements = {};
let onSendCallback = null;
let state = {
    image: null, // { type: 'text-photo'/'image', text: '...', data: '...' }
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
        cardPreview: document.getElementById('link-card-preview'),
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

function updatePreview() {
    const title = escapeHtml(elements.titleInput.value.trim()) || '标题';
    const body = escapeHtml(elements.bodyInput.value.trim()) || '正文内容...';
    const source = escapeHtml(elements.sourceInput.value.trim());

    let imageHtml = '';
    if (state.image) {
        if (state.image.type === 'text-photo') {
            imageHtml = `<div class="link-card-image text-photo">${escapeHtml(state.image.text)}</div>`;
        } else {
            imageHtml = `<img src="${state.image.data}" class="link-card-image">`;
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
            state.image = null;
            elements.imageInput.value = '';
            updatePreview();
        };
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"g, "&quot;").replace(/'/g, "&#039;");
}

// ▼▼▼ 核心修复：替换为更健壮的图片获取逻辑 ▼▼▼
async function handleAddImage(url) {
    // 采用与 chat-image-sender.js 相同的健壮实现
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`图片加载失败，HTTP状态码: ${response.status}`);
        }
        const blob = await response.blob();
        const dataUrl = await fileToDataUrl(blob);
        
        // 注意：这里是给 state.image 赋值，而不是 push 到数组
        state.image = { type: 'image', data: dataUrl };
        
        updatePreview();
        elements.imageInput.value = '';
        elements.imageInput.style.height = 'auto';
    } catch (error) {
        // 关键：添加 console.error 方便未来调试
        console.error("在“发送链接”模态框中加载图片URL失败:", error);
        alert('图片链接加载失败，请检查URL、网络或浏览器控制台获取详细错误。');
    }
}
// ▲▲▲ 修复结束 ▲▲▲

async function handleAddLocalImage(file) {
    if (!file) return;
    try {
        const dataUrl = await fileToDataUrl(file);
        state.image = { type: 'image', data: dataUrl };
        updatePreview();
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
            image: state.image
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
        if(text && isValidHttpUrl(text)) {
            handleAddImage(text); // 调用修复后的函数
        } else {
            alert('请输入有效的图片链接后添加。');
        }
    });

    elements.addLocalPhotoBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleAddLocalImage(e.target.files[0]);
    });
}