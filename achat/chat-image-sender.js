// achat/chat-image-sender.js

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
                thumb.innerHTML = `<img src="${item.data}" alt="预览">`;
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

function handleAddFromInput() {
    const text = elements.multiPurposeInput.value.trim();
    if (!text) return;

    if (isValidHttpUrl(text)) {
        // 作为URL处理
        handleAddUrl(text);
    } else {
        // 作为普通文本处理
        handleAddText(text);
    }
}

function handleAddText(text) {
    state.imagesToSend.push({ type: 'text-photo', text: text });
    elements.multiPurposeInput.value = '';
    elements.multiPurposeInput.style.height = 'auto'; // 重置高度
    updatePreview();
    updateSendButtonState();
}

async function handleAddUrl(url) {
    setLoading(true);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('无法加载图片');
        const blob = await response.blob();
        const dataUrl = await fileToDataUrl(blob);
        state.imagesToSend.push({ type: 'image', data: dataUrl });
        elements.multiPurposeInput.value = '';
        elements.multiPurposeInput.style.height = 'auto'; // 重置高度
        updatePreview();
        updateSendButtonState();
    } catch (error) {
        console.error("加载URL图片失败:", error);
        alert('图片链接加载失败，请检查URL或网络连接。');
    } finally {
        setLoading(false);
    }
}

async function handleAddLocal(file) {
    if (!file) return;
    setLoading(true);
    try {
        const dataUrl = await fileToDataUrl(file);
        state.imagesToSend.push({ type: 'image', data: dataUrl });
        updatePreview();
        updateSendButtonState();
    } catch (error) {
        console.error("加载本地图片失败:", error);
        alert('本地图片加载失败。');
    } finally {
        setLoading(false);
    }
}

function handleSend() {
    if (state.imagesToSend.length === 0) return;

    if (onSendCallback) {
        state.imagesToSend.forEach(item => {
            const message = { sender: 'user', ...item };
            onSendCallback(message);
        });
    }
    closeImageSender();
}

function bindEvents() {
    elements.overlay.addEventListener('click', e => {
        if (e.target === elements.overlay) closeImageSender();
    });
    elements.closeBtn.addEventListener('click', closeImageSender);
    elements.sendImageBtn.addEventListener('click', handleSend);
    
    // ▼▼▼ 核心重构：新的事件绑定 ▼▼▼
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
    // ▲▲▲ 重构结束 ▲▲▲
}